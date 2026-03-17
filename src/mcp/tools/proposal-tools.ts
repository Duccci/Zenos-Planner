import {
  ProposalListOutputSchema,
  ProposalDetailSchema,
  ProposalValidateOutputSchema,
  ProposalApproveOutputSchema,
  ProposalRejectOutputSchema,
  ProposalStartOutputSchema,
  ProposalCancelOutputSchema,
  ProposalDeferOutputSchema,
  type ProposalQualitativeReview,
} from '../schemas/proposal-schemas.js'
import {
  ProposalUpdateProgressOutputSchema,
} from '../schemas/workflow-schemas.js'
import { ProposalActionInputSchema } from '../schemas/proposal-action-schemas.js'
import {
  validateApplyPhase,
  type ApplyPhaseValidationContext,
} from '../validators/apply-phase-validator.js'
import { validateQuality, DEFAULT_QUALITY_STUB_METRICS, type QualityValidationContext } from '../validators/quality-validator.js'
import { type ZenoConfig } from '../../utils/config.js'
import { type PreReview } from '../validators/pre-review-validator.js'
import {
  validateScope,
  validateTestFileScope,
  type ScopeValidationContext,
} from '../validators/scope-validator.js'
import { validateProposalPhases } from '../validators/proposal-phases-validator.js'
import { validateTestFirstPattern, validateGateLevelTestFirst, validateCleanupTestFileReuse } from '../validators/test-first-validator.js'
import { validateDependencies, type DependencyNode } from '../validators/dependency-validator.js'
import { validateArtifactFile } from '../validators/artifact-validator.js'
import { buildQualitativeReviewWarnings } from './handler-factory.js'
import { createGenerateValidators, resolveGateTestFirstSiblings, createProposalTransitionValidator } from './shared-validators.js'
import {
  APPLY_PHASE_GUARDRAILS,
  APPLY_PHASE_WORKFLOW,
  PROPOSAL_GENERATION_GUARDRAILS,
  PROPOSAL_GENERATION_WORKFLOW,
  QUALITATIVE_CHECKLIST,
  FEATURE_IMPLEMENTATION_CHECKLIST,
  DATABASE_ACCESS_GUARDRAILS,
  toNarrativeRules,
  toCompactWorkflow,
} from '../content/index.js'
import { inferRoleFromFilename } from '../validators/test-first-validator.js'
import { WorktreeManager } from '../../core/worktree-manager.js'
import { ApprovalAuditTrail } from '../../storage/approval-audit-trail.js'
import { getDatabase } from '../../storage/database.js'

/**
 * Unified proposal action tool definition.
 * Consolidates all proposal lifecycle operations into a single action-based entrypoint.
 *
 * Actions: list, show, generate, validate, approve, reject, start, progress, cancel, defer
 *
 * The 'generate' action intelligently routes based on payload:
 * - Explicit-fields path (title + tasks provided): creates the proposal directly via proposal_create
 * - Gate-tied AI path (gateId only, no title/tasks): decomposes gate PRD into proposals via generateProposals
 * - Solitary proposal (solitary=true or no gateId): creates a self-contained proposal via proposal_create
 *
 * Example usage:
 * ```json
 * {
 *   "action": "generate",
 *   "payload": {
 *     "title": "Add authentication",
 *     "summary": "Implement JWT-based auth",
 *     "gateId": "gate-03",
 *     "tasks": [{"description": "Create auth middleware", "acceptanceCriteria": ["Tests pass"]}],
 *     "filesAffected": ["src/auth/middleware.ts"]
 *   }
 * }
 * ```
 */
export const proposalToolDefinitions = [
  {
    name: 'proposal_action',
    description: [
      'Proposal lifecycle: list, show, generate, validate, approve, reject, start, progress, cancel, defer. Use for proposal management, validation, and worktree operations.',
      'cancel and defer require confirmed: true — omitting confirmed returns a prompt instead of executing.',
      '',
      'Database access rules (always apply):',
      ...DATABASE_ACCESS_GUARDRAILS.map(g => `- ${g.rule}`),
    ].join('\n'),
    inputSchema: ProposalActionInputSchema,
  },
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ProposalActionOutputSchema, ProposalGenerateOrCreateOutputSchema } from '../schemas/proposal-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'
import { withGuidance } from './handler-factory.js'
import type { ValidationResult } from '../validators/types.js'

/**
 * Resolves a proposal's role and filesAffected from disk and validates the
 * test-first pattern (role-file consistency check).
 *
 * Extracted to avoid repeating the find → readFile → roleMatch → fallback
 * block across start, validate, and approve validators.
 */
async function resolveAndValidateTestFirst(
  r: FunctionRegistry,
  hash: string
): Promise<ValidationResult> {
  try {
    const { findProposalByHash } = await import('../../utils/artifact-locator.js')
    const { readFile } = await import('../../utils/file.js')
    const proposalResult = await r.invoke('proposal_show', { hash })
    if (!proposalResult.success) return { allowed: true }

    const proposal = proposalResult.data as Record<string, unknown>
    let filesAffected = ((proposal['files'] as { path: string }[] | undefined) ?? []).map(
      (f) => f.path
    )
    const gateId = proposal['gateId'] as string | undefined
    const isSolitary = !gateId || gateId === 'solitary'

    let role: string | undefined = (proposal['role'] as string | undefined)
    const filePath = await findProposalByHash(hash)
    if (filePath) {
      const content = await readFile(filePath)
      const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(content)
      role = roleMatch?.[1]?.trim() ?? role
      // Fall back to parsing markdown when DB has no files_affected recorded.
      if (filesAffected.length === 0) {
        const sectionMatch = /## Files Affected[^\n]*\n([\s\S]*?)(?=\n## |$)/i.exec(content)
        if (sectionMatch?.[1]) {
          const backtickPaths = sectionMatch[1].match(/`([^`]+\.[a-z]{1,10})`/gi) ?? []
          filesAffected = [...new Set(backtickPaths.map((m) => m.slice(1, -1)))]
        }
      }
    }

    return validateTestFirstPattern({
      proposalHash: hash,
      role,
      isGateTied: !isSolitary,
      filesAffected,
    })
  } catch {
    return { allowed: true }
  }
}

/**
 * Resolves a cleanup (GREEN) proposal's filesAffected and validates that all test
 * files it declares were established by the gate's testing (RED) proposal.
 *
 * Skips silently for solitary proposals or non-cleanup roles.
 */
async function resolveAndValidateCleanupReuse(
  r: FunctionRegistry,
  hash: string
): Promise<ValidationResult> {
  try {
    const proposalResult = await r.invoke('proposal_show', { hash })
    if (!proposalResult.success) return { allowed: true }

    const proposal = proposalResult.data as Record<string, unknown>
    const gateId = proposal['gateId'] as string | undefined
    if (!gateId || gateId === 'solitary') return { allowed: true }

    // Read role from disk — mirrors resolveAndValidateTestFirst to avoid filename fallback
    // being used here; explicit **Roles** field is required for gate-tied proposals.
    const { findProposalByHash } = await import('../../utils/artifact-locator.js')
    const { readFile } = await import('../../utils/file.js')

    let role: string | undefined = (proposal['role'] as string | undefined)
    let filesAffected = ((proposal['files'] as { path: string }[] | undefined) ?? []).map(
      (f) => f.path
    )

    const filePath = await findProposalByHash(hash)
    if (filePath) {
      const content = await readFile(filePath)
      const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(content)
      const rawRole = roleMatch?.[1]?.trim()
      role = rawRole && !rawRole.startsWith('{{') ? rawRole : role
      if (filesAffected.length === 0) {
        const sectionMatch = /## Files Affected[^\n]*\n([\s\S]*?)(?=\n## |$)/i.exec(content)
        if (sectionMatch?.[1]) {
          const backtickPaths = sectionMatch[1].match(/`([^`]+\.[a-z]{1,10})`/gi) ?? []
          filesAffected = [...new Set(backtickPaths.map((m) => m.slice(1, -1)))]
        }
      }
    }

    if (role !== 'cleanup') return { allowed: true }

    const gateProposals = await resolveGateTestFirstSiblings(r, gateId)
    return validateCleanupTestFileReuse(filesAffected, gateProposals)
  } catch {
    return { allowed: true }
  }
}


/**
 * Extracted from the generate and validate dependency validators which
 * were identical except for how they sourced gateId and hash.
 */
async function validateProposalDependencies(
  r: FunctionRegistry,
  hash: string,
  gateId: string,
  deps: string[]
): Promise<ValidationResult> {
  const allNodes = new Map<string, DependencyNode>()
  if (gateId) {
    const listResult = await r.invoke('proposal_list', { gateId })
    if (listResult.success) {
      const rows = ((listResult.data as { proposals?: unknown[] }).proposals ?? []) as {
        hash: string; dependencies?: string[]
      }[]
      for (const row of rows) {
        allNodes.set(row.hash, { hash: row.hash, dependencies: row.dependencies ?? [], gateId })
      }
    }
  }
  const node: DependencyNode = { hash, dependencies: deps, gateId }
  allNodes.set(hash, node)
  return validateDependencies({ node, allNodes })
}

/**
 * Unified proposal action handler.
 * Dispatches to the appropriate registry function based on action type.
 */
export function proposalHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  /**
   * Unified action dispatcher for proposal lifecycle operations.
   * Validates action and payload, then delegates to appropriate handler.
   */
  const proposalActionHandler = createEntityActionHandler(
    {
      entity: 'proposal',
      actions: [
        'list',
        'show',
        'generate',
        'validate',
        'approve',
        'reject',
        'start',
        'progress',
        'cancel',
        'defer',
      ] as const,
      inputSchema: ProposalActionInputSchema,
      outputSchema: ProposalActionOutputSchema,
      actionOutputSchema(action) {
        switch (action) {
          case 'list':
            return ProposalListOutputSchema
          case 'show':
            return ProposalDetailSchema
          case 'generate':
            return ProposalGenerateOrCreateOutputSchema
          case 'validate':
            return ProposalValidateOutputSchema
          case 'approve':
            return ProposalApproveOutputSchema
          case 'reject':
            return ProposalRejectOutputSchema
          case 'start':
            return ProposalStartOutputSchema
          case 'progress':
            return ProposalUpdateProgressOutputSchema
          case 'cancel':
            return ProposalCancelOutputSchema
          case 'defer':
            return ProposalDeferOutputSchema
          default:
            throw new Error(`Unknown proposal action: ${String(action)}`)
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('proposal_list', payload),
        show: async (payload, r) => {
          const showResult = await r.invoke('proposal_show', payload)
          if (showResult.success) {
            // Enrich with approval/rejection review history (best-effort)
            try {
              const hash = (payload as { hash?: string }).hash ?? ''
              if (hash) {
                const db = getDatabase()
                const audit = new ApprovalAuditTrail(db)
                const reviewHistory = audit.getHistory(hash)
                if (reviewHistory.length > 0) {
                  return {
                    ...showResult,
                    data: { ...(showResult.data as Record<string, unknown>), reviewHistory },
                  }
                }
              }
            } catch {
              // Audit enrichment is best-effort
            }
          }
          return showResult
        },
        generate: async (payload, r) => {
          // Route based on payload shape:
          // - Solitary or no gateId → proposal_create (self-contained proposal)
          // - Gate-tied with explicit fields (title + tasks) → proposal_create (direct creation)
          // - Gate-tied without explicit fields → generateProposals (AI decomposition)
          const isSolitary = (payload as { solitary?: boolean }).solitary === true
          const hasGateId = Boolean((payload as { gateId?: string }).gateId)
          const gateId = (payload as { gateId?: string }).gateId
          const hasTitle = Boolean((payload as { title?: string }).title)
          const explicitTasks = (payload as { tasks?: unknown[] }).tasks
          const hasExplicitFields = hasTitle && Array.isArray(explicitTasks) && explicitTasks.length > 0

          let invokeResult
          if (isSolitary || !hasGateId) {
            // Solitary proposal: use proposal_create workflow
            // If no gateId is provided and not explicitly solitary, default to solitary mode
            const solitaryPayload = {
              ...(payload ?? {}),
              solitary: true,
            }
            // Remove gateId if present with solitary=true to avoid conflict
            if (isSolitary && hasGateId) {
              delete (solitaryPayload as Record<string, unknown>)['gateId']
            }
            invokeResult = await r.invoke('proposal_create', solitaryPayload)
            // Inject project-level requirements so the solitary proposal can align with the registry
            if (invokeResult.success) {
              const reqResult = await r.invoke('reg_action', { action: 'list', payload: {} }).catch(() => null)
              if (reqResult?.success) {
                invokeResult = {
                  ...invokeResult,
                  data: { ...(invokeResult.data as Record<string, unknown>), requirementsContext: reqResult.data },
                }
              }
            }
          } else if (hasExplicitFields) {
            // Gate-tied explicit creation: use proposal_create directly (skip AI decomposition)
            invokeResult = await r.invoke('proposal_create', payload)
          } else {
            // Gate-tied AI path: use gate workflow (generateProposals)
            invokeResult = await r.invoke('generateProposals', payload)
            if (invokeResult.success && gateId) {
              // Auto-start gate when proposals are generated: generating proposals is the
              // first concrete work on a gate, so transition it to in_progress if not already.
              try {
                const showResult = await r.invoke('gates_show', { gateId })
                const currentStatus = showResult.success
                  ? (showResult.data as { status?: string }).status
                  : undefined
                if (currentStatus !== 'in_progress' && currentStatus !== 'completed') {
                  await r.invoke('gates_start', { gateId })
                }
              } catch {
                // best-effort: don't fail proposal generation if gate state update fails
              }
              // Inject gate requirements so generated proposals utilize the prescribed specs
              const reqResult = await r.invoke('reg_action', { action: 'list', payload: { gateId } }).catch(() => null)
              if (reqResult?.success) {
                invokeResult = {
                  ...invokeResult,
                  data: { ...(invokeResult.data as Record<string, unknown>), requirementsContext: reqResult.data },
                }
              }
            }
          }

          // Inject preReviewSummary and proposal-generation guidance for AI decomposition path
          return withGuidance(
            invokeResult,
            toNarrativeRules(PROPOSAL_GENERATION_GUARDRAILS),
            toCompactWorkflow(PROPOSAL_GENERATION_WORKFLOW),
            !isSolitary && hasGateId && !hasExplicitFields
              ? (payload as { preReview?: unknown }).preReview
              : undefined
          )
        },
        validate: async (payload, r) => {
          const inner = await r.invoke('proposal_validate', payload)
          if (!inner.success) return inner

          const rawData = inner.data as Record<string, unknown>
          const structuralPassed = Boolean(rawData['passedQuantitative'])

          if (structuralPassed) {
            // Resolve proposal role to select the appropriate qualitative checklist.
            // Feature (GREEN) proposals get additional implementation-fidelity checks.
            const hash = (payload as { hash?: string }).hash ?? ''
            let resolvedRole: string | undefined
            try {
              const { findProposalByHash } = await import('../../utils/artifact-locator.js')
              const { readFile } = await import('../../utils/file.js')
              const showResult = await r.invoke('proposal_show', { hash })
              if (showResult.success) {
                resolvedRole = (showResult.data as Record<string, unknown>)['role'] as string | undefined
              }
              const filePath = await findProposalByHash(hash)
              if (filePath) {
                const content = await readFile(filePath)
                const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(content)
                const diskRole = roleMatch?.[1]?.trim()
                if (diskRole && !diskRole.startsWith('{{')) resolvedRole = diskRole
                resolvedRole ??= inferRoleFromFilename(filePath)
              }
            } catch {
              // best-effort role resolution; fall back to base checklist
            }

            const isFeatureRole = resolvedRole === 'feature'
            const checklist = isFeatureRole
              ? [...QUALITATIVE_CHECKLIST, ...FEATURE_IMPLEMENTATION_CHECKLIST]
              : QUALITATIVE_CHECKLIST

            const fidelityField = isFeatureRole
              ? ', implementationFidelityVerified'
              : ''

            return {
              success: true,
              data: {
                hash: rawData['hash'],
                passedQuantitative: true,
                issues: rawData['issues'] ?? [],
                proposalRole: resolvedRole,
                nextRequiredStep: {
                  blocking: true,
                  action: 'submit-qualitative-review',
                  agentInstruction:
                    'YOU (the LLM) must evaluate each item in checklist[] with your own judgment right now — do NOT present this to the user. Read the proposal tasks, acceptance criteria, filesAffected, and rollback section, set each boolean to reflect what you found, list any concerns in flaggedItems, then call proposal_action:start with both preReview and qualitativeReview filled in.' +
                    (isFeatureRole
                      ? ' CRITICAL for feature proposals: open the actual implementation source files and verify they perform real I/O operations (filesystem, git, network, database) as stated in acceptance criteria — do NOT rely solely on test pass/fail since tests may mock the operations.'
                      : ''),
                  description:
                    `Structural checks passed. Evaluate the checklist and call proposal_action:start { hash, preReview: { phase: "apply", ... }, qualitativeReview: { taskDescriptionsSpecific, acceptanceCriteriaMeasurable, filesAffectedVerified, noUnresolvedMarkers, scopeFocused, rollbackSpecific${fidelityField}, flaggedItems } }.`,
                  checklist,
                },
              },
            }
          }

          // Structural checks failed: only surface the checks that failed so
          // the agent sees exactly what to fix without all the passing noise.
          const rawChecks = rawData['checks'] as Record<string, boolean> | undefined
          const failedChecks = rawChecks
            ? Object.fromEntries(Object.entries(rawChecks).filter(([, v]) => !v))
            : undefined

          return {
            success: true,
            data: {
              hash: rawData['hash'],
              passedQuantitative: false,
              issues: rawData['issues'] ?? [],
              ...(failedChecks && Object.keys(failedChecks).length > 0
                ? { failedChecks }
                : {}),
              nextRequiredStep: {
                blocking: true,
                action: 'fix-structural-errors',
                description:
                  'Structural checks failed. Fix every error in issues[] and re-run proposal_action:validate before proceeding.',
              },
            },
          }
        },
        approve: async (payload, r) => {
          // Idempotent: if already completed, return success without re-invoking CLI
          const hash = (payload as { hash?: string }).hash ?? ''
          const showResult = await r.invoke('proposal_show', { hash })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'completed') {
              const showData = showResult.data as Record<string, unknown>
              return {
                success: true,
                data: {
                  hash,
                  previousStatus: 'completed',
                  newStatus: 'completed' as const,
                  approvedAt:
                    (showData['lastUpdated'] as string | undefined) ?? new Date().toISOString(),
                },
              }
            }
          }
          const approveResult = await r.invoke('proposal_approve', payload)
          if (approveResult.success) {
            // Record approval in audit trail (best-effort)
            try {
              const db = getDatabase()
              const audit = new ApprovalAuditTrail(db)
              audit.record({
                proposal_hash: hash,
                decision: 'approved',
                actor: (payload as { approvedBy?: string }).approvedBy ?? 'zeno',
                reason: (payload as { approverNotes?: string }).approverNotes ?? null,
                timestamp: new Date().toISOString(),
              })
            } catch {
              // Audit recording is best-effort; don't fail the approve
            }
            try {
              const manager = new WorktreeManager()
              const mergeResult = await manager.merge(hash, 'main')
              if (mergeResult.conflicts && mergeResult.conflicts.length > 0) {
                return {
                  success: false as const,
                  error: {
                    code: 'MERGE_CONFLICTS',
                    message: `Worktree merge failed with conflicts in: ${mergeResult.conflicts.join(', ')}. Resolve conflicts manually before approving.`,
                  },
                }
              }
            } catch {
              // Worktree may not exist; best-effort merge
            }
          }
          return approveResult
        },
        reject: async (payload, r) => {
          // Idempotent: if already rejected, return success without re-invoking CLI
          const hash = (payload as { hash?: string }).hash ?? ''
          const showResult = await r.invoke('proposal_show', { hash })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'rejected') {
              const showData = showResult.data as Record<string, unknown>
              return {
                success: true,
                data: {
                  hash,
                  previousStatus: 'rejected',
                  newStatus: 'rejected' as const,
                  rejectedAt:
                    (showData['rejectedAt'] as string | undefined) ?? new Date().toISOString(),
                  reason: 'Proposal already rejected (no-op)',
                },
              }
            }
          }
          const rejectResult = await r.invoke('proposal_reject', payload)
          // Record rejection in audit trail (best-effort)
          if (rejectResult.success) {
            try {
              const db = getDatabase()
              const audit = new ApprovalAuditTrail(db)
              audit.record({
                proposal_hash: hash,
                decision: 'rejected',
                actor: (payload as { rejectedBy?: string }).rejectedBy ?? 'zeno',
                reason: (payload as { rejectionReason?: string }).rejectionReason ?? null,
                timestamp: new Date().toISOString(),
              })
            } catch {
              // Audit recording is best-effort; don't fail the reject
            }
          }
          return rejectResult
        },
        start: async (payload, r) => {
          const p = payload as { hash?: string; qualitativeReview?: ProposalQualitativeReview; preReview?: PreReview; startedBy?: string }
          // Idempotent: if already in_progress, return success without re-invoking CLI
          const hash = p.hash ?? ''
          const showResult = await r.invoke('proposal_show', { hash })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'in_progress') {
              const showData = showResult.data as Record<string, unknown>
              return {
                success: true,
                data: {
                  hash,
                  previousStatus: 'in_progress',
                  newStatus: 'in_progress' as const,
                  startedAt:
                    (showData['startedAt'] as string | undefined) ?? new Date().toISOString(),
                },
              }
            }

            // Proposal exists but not yet in_progress — require qualitativeReview evidence
            const qr = p.qualitativeReview
            if (!qr) {
              return {
                success: false,
                error: {
                  code: 'QUALITATIVE_REVIEW_REQUIRED',
                  message:
                    'qualitativeReview is required before calling proposal_action:start. ' +
                    'Run proposal_action:validate first, evaluate every item in the checklist with ' +
                    'your own judgment, then re-call start with: preReview (phase=apply) AND ' +
                    'qualitativeReview: { taskDescriptionsSpecific, acceptanceCriteriaMeasurable, ' +
                    'filesAffectedVerified, noUnresolvedMarkers, scopeFocused, rollbackSpecific, flaggedItems }.',
                },
              }
            }

            // Build review warnings from false booleans and flagged items
            const reviewWarnings = buildQualitativeReviewWarnings(qr, {
              taskDescriptionsSpecific: 'taskDescriptionsSpecific=false: some tasks use vague language without naming concrete files or functions',
              acceptanceCriteriaMeasurable: 'acceptanceCriteriaMeasurable=false: some acceptance criteria lack measurable success conditions',
              filesAffectedVerified: 'filesAffectedVerified=false: filesAffected paths may not match project naming conventions',
              noUnresolvedMarkers: 'noUnresolvedMarkers=false: unresolved TODO/TBD/unclear markers found in proposal content',
              scopeFocused: 'scopeFocused=false: proposal may bundle unrelated concerns that should be separate proposals',
              rollbackSpecific: 'rollbackSpecific=false: rollback section lacks specific reversible steps',
              implementationFidelityVerified: 'implementationFidelityVerified=false: implementation may use in-memory stubs instead of performing real I/O operations stated in acceptance criteria — verify actual system calls (filesystem, git, network, database) are made',
            })

            // Strip qualitativeReview before delegating (unknown field to CLI handler)
            const { qualitativeReview: _qr, ...cliPayload } = p
            let rawResult = await r.invoke('proposal_start', cliPayload)

            // Create worktree for isolated development (best-effort)
            if (rawResult.success) {
              try {
                const manager = new WorktreeManager()
                const worktreeInfo = await manager.create(hash)
                rawResult = {
                  ...rawResult,
                  data: {
                    ...(rawResult.data as object),
                    worktree: { path: worktreeInfo.path, branch: worktreeInfo.branch },
                  },
                }
              } catch {
                // Worktree creation is best-effort; don't fail the start
              }
            }

            const resultWithWarnings =
              rawResult.success && reviewWarnings.length > 0
                ? { ...rawResult, data: { ...(rawResult.data as object), reviewWarnings } }
                : rawResult
            return withGuidance(
              resultWithWarnings,
              toNarrativeRules(APPLY_PHASE_GUARDRAILS),
              toCompactWorkflow(APPLY_PHASE_WORKFLOW),
              cliPayload.preReview
            )
          }

          // proposal_show failed (proposal not found or other error) — delegate to start which will surface the error
          return withGuidance(
            await r.invoke('proposal_start', { hash, startedBy: p.startedBy }),
            toNarrativeRules(APPLY_PHASE_GUARDRAILS),
            toCompactWorkflow(APPLY_PHASE_WORKFLOW),
            p.preReview
          )
        },
        progress: async (payload, r) => {
          // Map currentTask (1-based task section number) → taskIndex (0-based) for updateProposalProgress
          const currentTask = (payload as { currentTask?: number }).currentTask
          const mappedPayload =
            currentTask !== undefined && (payload as { taskIndex?: number }).taskIndex === undefined
              ? { ...(payload as object), taskIndex: currentTask - 1 }
              : payload
          const progressResult = await r.invoke('updateProposalProgress', mappedPayload)
          // Inject progressSummary for drift detection — shows currentTask + cumulative file state
          if (progressResult.success) {
            const filesAffected = (payload as { filesAffected?: string[] }).filesAffected ?? []
            if (currentTask !== undefined) {
              // completedFiles are the files from fully-completed task sections in the proposal
              const completedFiles =
                ((progressResult.data as Record<string, unknown>)['completedFiles'] as
                  | string[]
                  | undefined) ?? []
              const remainingFilesNotTouched = filesAffected.filter(
                (f) => !completedFiles.includes(f)
              )
              return {
                ...progressResult,
                data: {
                  ...(progressResult.data as Record<string, unknown>),
                  progressSummary: {
                    currentTask,
                    cumulativeFilesModified: completedFiles,
                    remainingFilesNotTouched,
                  },
                },
              }
            }
          }
          return progressResult
        },
        cancel: async (payload, r) => {
          const { confirmed, hash } = payload as { confirmed?: boolean; hash?: string }
          if (!confirmed) {
            return {
              success: true,
              data: {
                requiresConfirmation: true,
                action: 'cancel' as const,
                hash,
                message:
                  `Cancelling proposal${hash ? ` "${hash}"` : ''} is irreversible and will mark it as dropped. ` +
                  'Please confirm with the user before proceeding. ' +
                  'Re-call with confirmed: true once the user has explicitly approved.',
              },
            }
          }
          return r.invoke('proposal_cancel', payload)
        },
        defer: async (payload, r) => {
          const { confirmed, hash } = payload as { confirmed?: boolean; hash?: string }
          if (!confirmed) {
            return {
              success: true,
              data: {
                requiresConfirmation: true,
                action: 'defer' as const,
                hash,
                message:
                  `Deferring proposal${hash ? ` "${hash}"` : ''} will move it to the backlog and remove it from the active implementation path. ` +
                  'Please confirm with the user before proceeding. ' +
                  'Re-call with confirmed: true once the user has explicitly approved.',
              },
            }
          }
          return r.invoke('proposal_defer', payload)
        },
      },

      validators: {
        start: (payload, r) => [
          // 1) Enforce state transition: only validated proposals can be started (pending must validate first)
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createProposalTransitionValidator(payload, r, 'in_progress', ['validated']),
          // 2) Proposal artifact structure: markdown file must be valid (required sections, proper format)
          async () => {
            const proposalHash = (payload as { hash: string }).hash
            try {
              const { findProposalByHash } = await import('../../utils/artifact-locator.js')
              const filePath = await findProposalByHash(proposalHash)
              if (!filePath) return { allowed: true } // artifact not found is handled downstream
              const { validateArtifactFile } = await import('../validators/artifact-validator.js')
              const result = await validateArtifactFile(filePath, 'proposal')
              
              // Enhance error messages for LLM with explicit file fixing guidance
              if (!result.allowed && result.errors && result.errors.length > 0) {
                return {
                  allowed: false,
                  errors: [
                    `Proposal artifact structure is invalid. Edit the proposal markdown file at:\n${filePath}\n\nErrors to fix:`,
                    ...result.errors,
                  ],
                  nextRequiredStep: {
                    blocking: true,
                    action: 'fix-structural-errors',
                    description: `Fix every error listed above in the proposal markdown file at ${filePath}. Ensure all required sections are present and properly formatted, then re-run proposal_action:validate before attempting start again.`,
                  },
                }
              }
              return result
            } catch {
              return { allowed: true } // artifact check is best-effort
            }
          },
          // 3) Apply-phase constraints (no git ops, files in scope)
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            const proposalResult = await r.invoke('proposal_show', {
              hash: (payload as { hash: string }).hash,
            })

            if (!proposalResult.success) {
              const proposalErr =
                'error' in proposalResult ? proposalResult.error.message : 'unknown error'
              allErrors.push(`Failed to retrieve proposal details: ${proposalErr}`)
              return { allowed: false, errors: allErrors }
            }

            const proposal = proposalResult.data
            const filesAffected = (proposal as { files_affected?: string[] }).files_affected ?? []

            const configResult = await r.invoke('config_get', {})

            let config: ZenoConfig

            if (configResult.success) {
              config = configResult.data as ZenoConfig
            } else {
              const { getDefaultConfig } = await import('../../utils/config.js')
              const cfgErrMsg =
                'error' in configResult ? configResult.error.message : 'unknown error'
              allWarnings.push(
                `Failed to retrieve config: ${cfgErrMsg}. Using default quality thresholds.`
              )
              config = getDefaultConfig('unknown')
            }

            const gitOperations: string[] = []
            const filesModified: string[] = []

            const applyPhaseContext: ApplyPhaseValidationContext = {
              proposalHash: (payload as { hash: string }).hash,
              filesAffected,
              filesModified,
              gitOperations,
              config,
            }

            const applyPhaseResult = validateApplyPhase(applyPhaseContext)
            allErrors.push(...(applyPhaseResult.errors ?? []))
            allWarnings.push(...(applyPhaseResult.warnings ?? []))

            return {
              allowed: allErrors.length === 0,
              errors: allErrors.length > 0 ? allErrors : undefined,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
            }
          },
          // 4) PreReview enforcement: G1-G4 structured preconditions
          // eslint-disable-next-line @typescript-eslint/require-await
          async () => {
            const pre = (payload as { preReview?: PreReview }).preReview
            if (!pre) {
              return {
                allowed: false,
                errors: [
                  'preReview is required for proposal_action: start. ' +
                    'Provide preReview with phase="apply" and: ' +
                    'openQuestionsResolved (bool), questionsFound (string[]), ' +
                    'filesVerified (bool), assumptionsDocumented (string[]), blockersIdentified (string[]). ' +
                    'Read the full proposal before calling start — this ensures you have performed ' +
                    'the mandatory pre-apply checks (SKILL.md G1-G4).',
                ],
                guidance:
                  'If you have already reviewed the proposal, supply preReview with your findings.',
              }
            }

            const errors: string[] = []
            const warnings: string[] = []

            // G1: unresolved open questions
            if (!pre.openQuestionsResolved && pre.questionsFound.length > 0) {
              errors.push(
                'Unresolved open questions found. Resolve them before starting: ' +
                  pre.questionsFound.map((q) => `"${q}"`).join('; ')
              )
            }

            // G2: files not verified
            if (pre.filesVerified === false) {
              errors.push(
                'filesVerified is false. Verify that all entries in Files Affected exist ' +
                  '(or are explicitly marked as new files) before starting.'
              )
            }

            // G4: blockers (warning, not error — documenting blockers is good)
            if (pre.blockersIdentified.length > 0) {
              warnings.push(
                'Blockers identified in Dependencies table: ' +
                  pre.blockersIdentified.map((b) => `"${b}"`).join('; ') +
                  '. Document these in the proposal and handle incomplete dependencies before proceeding.'
              )
            }

            return {
              allowed: errors.length === 0,
              errors: errors.length > 0 ? errors : undefined,
              warnings: warnings.length > 0 ? warnings : undefined,
            }
          },
          // 5) Test file scope: G10/G11 enforcement (gate-tied proposals must not have test files)
          async () => {
            const proposalResult = await r.invoke('proposal_show', {
              hash: (payload as { hash: string }).hash,
            })
            if (!proposalResult.success) return { allowed: true } // let action handler report not-found

            const proposal = proposalResult.data
            const filesAffected = (proposal as { files_affected?: string[] }).files_affected ?? []
            const isSolitary = (proposal as { solitary?: boolean }).solitary ?? false

            return validateTestFileScope(filesAffected, isSolitary)
          },
          // 6) Test-first gate pattern: role-file consistency check
          async () => resolveAndValidateTestFirst(r, (payload as { hash?: string }).hash ?? ''),
          // 7) Cleanup test file reuse: cleanup proposals must only reference test files from RED
          async () => resolveAndValidateCleanupReuse(r, (payload as { hash?: string }).hash ?? ''),
        ],
        generate: (_payload, _r) => {
          const isSolitary = (_payload as { solitary?: boolean }).solitary === true
          const hasGateIdV = Boolean((_payload as { gateId?: string }).gateId)
          const hasTitleV = Boolean((_payload as { title?: string }).title)
          const explicitTasksV = (_payload as { tasks?: unknown[] }).tasks
          const hasExplicitFieldsV =
            hasTitleV && Array.isArray(explicitTasksV) && explicitTasksV.length > 0
          const isAIPath = !isSolitary && hasGateIdV && !hasExplicitFieldsV
          if (!isAIPath) {
            // Direct creation path: skip preReview; only validate dependencies
            return [
              async () => {
                const payloadDeps = (_payload as { dependencies?: string[] }).dependencies ?? []
                if (payloadDeps.length === 0) return { allowed: true }
                try {
                  const gateId = (_payload as { gateId?: string }).gateId ?? ''
                  const hash = (_payload as { hash?: string }).hash ?? 'new'
                  return await validateProposalDependencies(_r, hash, gateId, payloadDeps)
                } catch {
                  return { allowed: true }
                }
              },
            ]
          }
          return [
            // G5-G8 preReview + G12 markdown-only: shared with gates, delegated to factory
            ...createGenerateValidators('proposal_action')(_payload, _r),
          // Scope-creep check: reject multi-phase proposals at generation time
          // eslint-disable-next-line @typescript-eslint/require-await
          async () => {
            const title = (_payload as { title?: string }).title ?? ''
            const summary = (_payload as { summary?: string }).summary ?? ''
            const tasks = (_payload as { tasks?: { description?: string }[] }).tasks ?? []
            return validateProposalPhases({
              title,
              summary,
              taskDescriptions: tasks.map((t) => t.description ?? ''),
            })
          },
          // Explicit path check: reject wildcards and directory-only entries in filesAffected
          // eslint-disable-next-line @typescript-eslint/require-await
          async () => {
            const filesAffected = (_payload as { filesAffected?: string[] }).filesAffected ?? []
            const scopeContext: ScopeValidationContext = {
              filesAffected,
              filesModified: filesAffected, // assume all declared files will be produced
              allowTestFiles: true,
            }
            return validateScope(scopeContext)
          },
          // Circular dependency check: validate declared proposal dependencies form a DAG
          async () => {
            const payloadDeps = (_payload as { dependencies?: string[] }).dependencies ?? []
            if (payloadDeps.length === 0) return { allowed: true }
            try {
              const gateId = (_payload as { gateId?: string }).gateId ?? ''
              const hash = (_payload as { hash?: string }).hash ?? 'new'
              return await validateProposalDependencies(_r, hash, gateId, payloadDeps)
            } catch {
              return { allowed: true }
            }
          },
          ]
        },
        progress: (payload, r) => [
          // currentTask enforcement: required on every progress call; out-of-bounds detection
          async () => {
            const currentTask = (payload as { currentTask?: number }).currentTask
            if (currentTask === undefined) {
              return {
                allowed: false,
                errors: [
                  'currentTask is required for proposal_action: progress. ' +
                    'Provide the 1-based index of the task currently being applied (e.g. currentTask: 1 for the first task). ' +
                    'This enables out-of-bounds detection and drift tracking.',
                ],
              }
            }

            if (currentTask < 1) {
              return {
                allowed: false,
                errors: [`currentTask must be >= 1 (got ${String(currentTask)}). Tasks are 1-based.`],
              }
            }

            // Validate upper bound: fetch proposal to get task count
            const hash = (payload as { hash?: string }).hash
            if (hash) {
              try {
                const showResult = await r.invoke('proposal_show', { hash })
                if (showResult.success) {
                  const tasks = (showResult.data as { tasks?: unknown[] }).tasks ?? []
                  if (tasks.length > 0 && currentTask > tasks.length) {
                    return {
                      allowed: false,
                      errors: [
                        `currentTask ${String(currentTask)} is out of bounds. ` +
                          `This proposal has ${String(tasks.length)} task(s) (valid range: 1-${String(tasks.length)}). ` +
                          'Check for context rot — the agent may have lost track of its position.',
                      ],
                    }
                  }
                }
              } catch {
                // If we cannot fetch the proposal, skip bounds check
              }
            }

            return { allowed: true }
          },
        ],
        validate: (payload, r) => [
          // G10/G11: test file scope check during validation
          async () => {
            const proposalResult = await r.invoke('proposal_show', {
              hash: (payload as { hash?: string }).hash ?? '',
            })
            if (!proposalResult.success) return { allowed: true }

            const proposal = proposalResult.data
            const filesAffected = (proposal as { files_affected?: string[] }).files_affected ?? []
            const isSolitary = (proposal as { solitary?: boolean }).solitary ?? false

            return validateTestFileScope(filesAffected, isSolitary)
          },
          // Comprehensive artifact validation: template sections, single-phase check,
          // explicit file paths (no wildcards), and dependency DAG check.
          // validateArtifactFile is the unified validator — replaces individual section checks.
          async () => {
            const hash = (payload as { hash?: string }).hash ?? ''
            try {
              const { findProposalByHash } = await import('../../utils/artifact-locator.js')
              const filePath = await findProposalByHash(hash)
              if (!filePath) return { allowed: true }

              const proposalResult = await r.invoke('proposal_show', { hash })
              const proposalData = proposalResult.success
                ? (proposalResult.data as Record<string, unknown>)
                : {}
              const gateId = proposalData['gateId'] as string | undefined

              const { readFile } = await import('../../utils/file.js')
              const content = await readFile(filePath)
              const roleMatch = /\*\*Roles\*\*:\s*(.+)/.exec(content)
              const rawRole = roleMatch?.[1]?.trim()
              // Treat unreplaced template placeholders as unset.
              // Do NOT infer role from filename here — the validator must receive
              // undefined when the **Roles** field is absent so it can flag it as
              // an error. Filename-based inference is only used for sibling-structure
              // checks (resolveGateTestFirstSiblings), not per-proposal field validation.
              const role = rawRole && !rawRole.startsWith('{{') ? rawRole : undefined

              return await validateArtifactFile(filePath, 'proposal', {
                hash,
                gateId,
                role,
              })
            } catch {
              return { allowed: true }
            }
          },
          // Quality thresholds: coverage ≥90%, 0 security issues, <0.01% lint errors.
          // Mirrors the approve validator so an agent can catch quality failures before
          // transitioning the proposal to in_progress for final approval.
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            const qualityContext: QualityValidationContext = {
              metrics: { ...DEFAULT_QUALITY_STUB_METRICS },
            }

            const qualityResult = await validateQuality(qualityContext)
            allErrors.push(...(qualityResult.errors ?? []))
            allWarnings.push(...(qualityResult.warnings ?? []))

            return {
              allowed: allErrors.length === 0,
              errors: allErrors.length > 0 ? allErrors : undefined,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
            }
          },
          // Gate-level test-first structure: exactly 1 test-suite (first) and 1 cleanup (last)
          // among all sibling proposals in the gate. Surfaces the holistic gate structure
          // issue early, mirrors the gates_action:complete and gates_action:validate checks.
          async () => {
            const hash = (payload as { hash?: string }).hash ?? ''
            try {
              const proposalResult = await r.invoke('proposal_show', { hash })
              if (!proposalResult.success) return { allowed: true }

              const proposal = proposalResult.data as Record<string, unknown>
              const gateId = proposal['gateId'] as string | undefined
              if (!gateId || gateId === 'solitary') return { allowed: true } // skipped for solitary

              const gateProposals = await resolveGateTestFirstSiblings(r, gateId)
              if (gateProposals.length === 0) return { allowed: true }
              return validateGateLevelTestFirst(gateProposals)
            } catch {
              return { allowed: true }
            }
          },
          // Cleanup test file reuse: cleanup (GREEN) proposals must only reference test files
          // established by the gate's testing (RED) proposal.
          async () => resolveAndValidateCleanupReuse(r, (payload as { hash?: string }).hash ?? ''),
        ],
        approve: (payload, r) => [
          // 1) Enforce state transition: only in_progress proposals can be approved
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createProposalTransitionValidator(payload, r, 'completed', ['in_progress']),
          // 2) Quality thresholds
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            const qualityMetrics = { ...DEFAULT_QUALITY_STUB_METRICS }

            const qualityContext: QualityValidationContext = {
              metrics: qualityMetrics,
            }

            const qualityResult = await validateQuality(qualityContext)
            allErrors.push(...(qualityResult.errors ?? []))
            allWarnings.push(...(qualityResult.warnings ?? []))

            return {
              allowed: allErrors.length === 0,
              errors: allErrors.length > 0 ? allErrors : undefined,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
            }
          },
          // 3) Test-first gate pattern: role-file consistency at approval time
          async () => resolveAndValidateTestFirst(r, (payload as { hash?: string }).hash ?? ''),
          // 4) Cleanup test file reuse: cleanup proposals must only reference test files from RED
          async () => resolveAndValidateCleanupReuse(r, (payload as { hash?: string }).hash ?? ''),
        ],
        reject: (payload, r) => [
          // Enforce state transition: only in_progress proposals can be rejected
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createProposalTransitionValidator(payload, r, 'rejected', ['in_progress']),
        ],
      },
    },
    registry
  )

  return {
    proposal_action: proposalActionHandler,
  }
}
