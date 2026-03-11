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
  ProposalGenerateOutputSchema,
  ProposalUpdateProgressOutputSchema,
} from '../schemas/workflow-schemas.js'
import { ProposalActionInputSchema } from '../schemas/proposal-action-schemas.js'
import {
  validateApplyPhase,
  type ApplyPhaseValidationContext,
} from '../validators/apply-phase-validator.js'
import { validateQuality, DEFAULT_QUALITY_STUB_METRICS, type QualityValidationContext } from '../validators/quality-validator.js'
import { type ZenoConfig } from '../../utils/config.js'
import { createStateTransitionValidator } from './entity-action-handler.js'
import { validatePreReviewGeneratePhase, type PreReview } from '../validators/pre-review-validator.js'
import {
  validateScope,
  validateTestFileScope,
  validateMarkdownOnly,
  type ScopeValidationContext,
} from '../validators/scope-validator.js'
import { validateProposalPhases } from '../validators/proposal-phases-validator.js'
import { validateTestFirstPattern, validateGateLevelTestFirst, type ProposalGateSibling } from '../validators/test-first-validator.js'
import { validateDependencies, type DependencyValidationContext, type DependencyNode } from '../validators/dependency-validator.js'
import { validateArtifactFile } from '../validators/artifact-validator.js'
import {
  APPLY_PHASE_GUARDRAILS,
  APPLY_PHASE_WORKFLOW,
  PROPOSAL_GENERATION_GUARDRAILS,
  PROPOSAL_GENERATION_WORKFLOW,
  QUALITATIVE_CHECKLIST,
  DATABASE_ACCESS_GUARDRAILS,
  toNarrativeRules,
  toCompactWorkflow,
} from '../content/index.js'
import { type ProposalStatus, PROPOSAL_TRANSITIONS } from '../../core/transitions.js'

/**
 * Unified proposal action tool definition.
 * Consolidates all proposal lifecycle operations into a single action-based entrypoint.
 *
 * Actions: list, show, create, generate, validate, approve, reject, start, progress
 *
 * The 'generate' action intelligently routes based on proposal type:
 * - Gate-tied proposals (gateId provided): uses gate workflow to decompose gate PRD into proposals
 * - Solitary proposals (solitary=true or no gateId): uses proposal workflow to create self-contained proposal
 *
 * Example usage:
 * ```json
 * {
 *   "action": "create",
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
      'Proposal lifecycle: list, show, create, generate, validate, approve, reject, start, progress. Use for proposal management, validation, and worktree operations.',
      '',
      'Database access rules (always apply):',
      ...DATABASE_ACCESS_GUARDRAILS.map(g => `- ${g.rule}`),
    ].join('\n'),
    inputSchema: ProposalActionInputSchema,
  },
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ProposalCreateOutputSchema } from '../schemas/proposal-create-schemas.js'
import { ProposalActionOutputSchema } from '../schemas/proposal-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'
import { withGuidance } from './handler-factory.js'

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
        'create',
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
          case 'create':
            return ProposalCreateOutputSchema
          case 'generate':
            return ProposalGenerateOutputSchema
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
        show: async (payload, r) => r.invoke('proposal_show', payload),
        create: async (payload, r) => r.invoke('proposal_create', payload),
        generate: async (payload, r) => {
          // Route solitary proposals to the proposal workflow (proposal_create)
          // Route gate-tied proposals to the gate workflow (generateProposals)
          const isSolitary = (payload as { solitary?: boolean }).solitary === true
          const hasGateId = Boolean((payload as { gateId?: string }).gateId)

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
          } else {
            // Gate-tied proposal: use gate workflow (generateProposals)
            invokeResult = await r.invoke('generateProposals', payload)
          }

          // Inject preReviewSummary and proposal-generation guidance into successful response
          return withGuidance(
            invokeResult,
            toNarrativeRules(PROPOSAL_GENERATION_GUARDRAILS),
            toCompactWorkflow(PROPOSAL_GENERATION_WORKFLOW),
            (payload as { preReview?: unknown }).preReview
          )
        },
        validate: async (payload, r) => {
          const inner = await r.invoke('proposal_validate', payload)
          if (!inner.success) return inner

          const rawData = inner.data as Record<string, unknown>
          const structuralPassed = Boolean(rawData['passedQuantitative'])

          if (structuralPassed) {
            // Structural checks all passed: strip redundant noise.
            // `checks` (8× true) and `guidance` both reinforce a false "all-clear" signal.
            // Only surface what the agent must act on next.
            return {
              success: true,
              data: {
                hash: rawData['hash'],
                passedQuantitative: true,
                issues: rawData['issues'] ?? [],
                nextRequiredStep: {
                  blocking: true,
                  action: 'submit-qualitative-review',
                  agentInstruction:
                    'YOU (the LLM) must evaluate each item in checklist[] with your own judgment right now — do NOT present this to the user. Read the proposal tasks, acceptance criteria, filesAffected, and rollback section, set each boolean to reflect what you found, list any concerns in flaggedItems, then call proposal_action:start with both preReview and qualitativeReview filled in.',
                  description:
                    'Structural checks passed. Evaluate the checklist and call proposal_action:start { hash, preReview: { phase: "apply", ... }, qualitativeReview: { taskDescriptionsSpecific, acceptanceCriteriaMeasurable, filesAffectedVerified, noUnresolvedMarkers, scopeFocused, rollbackSpecific, flaggedItems } }.',
                  checklist: QUALITATIVE_CHECKLIST,
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
          return r.invoke('proposal_approve', payload)
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
          return r.invoke('proposal_reject', payload)
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
            const reviewWarnings: string[] = []
            if (qr.flaggedItems.length > 0) reviewWarnings.push(...qr.flaggedItems)
            if (!qr.taskDescriptionsSpecific) reviewWarnings.push('taskDescriptionsSpecific=false: some tasks use vague language without naming concrete files or functions')
            if (!qr.acceptanceCriteriaMeasurable) reviewWarnings.push('acceptanceCriteriaMeasurable=false: some acceptance criteria lack measurable success conditions')
            if (!qr.filesAffectedVerified) reviewWarnings.push('filesAffectedVerified=false: filesAffected paths may not match project naming conventions')
            if (!qr.noUnresolvedMarkers) reviewWarnings.push('noUnresolvedMarkers=false: unresolved TODO/TBD/unclear markers found in proposal content')
            if (!qr.scopeFocused) reviewWarnings.push('scopeFocused=false: proposal may bundle unrelated concerns that should be separate proposals')
            if (!qr.rollbackSpecific) reviewWarnings.push('rollbackSpecific=false: rollback section lacks specific reversible steps')

            // Strip qualitativeReview before delegating (unknown field to CLI handler)
            const { qualitativeReview: _qr, ...cliPayload } = p
            const rawResult = await r.invoke('proposal_start', cliPayload)
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
        cancel: async (payload, r) => r.invoke('proposal_cancel', payload),
        defer: async (payload, r) => r.invoke('proposal_defer', payload),
      },

      validators: {
        start: (payload, r) => [
          // 1) Enforce state transition: only validated proposals can be started (pending must validate first)
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createStateTransitionValidator<ProposalStatus>({
            getCurrentStatus: async () => {
              const hash = (payload as { hash?: string }).hash ?? ''
              const result = await r.invoke('proposal_show', { hash })
              if (!result.success) return null
              const status = (result.data as { status?: string }).status as ProposalStatus | undefined
              return status ?? null
            },
            targetStatus: 'in_progress',
            validFromStatuses: ['validated'],
            allTransitions: PROPOSAL_TRANSITIONS,
            entityLabel: `proposal:${(payload as { hash?: string }).hash ?? '<unknown>'}`,
          }),
          // 2) Apply-phase constraints (no git ops, files in scope)
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
          // 3) PreReview enforcement: G1-G4 structured preconditions
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
          // 4) Test file scope: G10/G11 enforcement (gate-tied proposals must not have test files)
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
          // 5) Test-first gate pattern: role-file consistency check
          async () => {
            const hash = (payload as { hash?: string }).hash ?? ''
            try {
              const { findProposalByHash } = await import('../../utils/artifact-locator.js')
              const { readFile } = await import('../../utils/file.js')
              const proposalResult = await r.invoke('proposal_show', { hash })
              if (!proposalResult.success) return { allowed: true }

              const proposal = proposalResult.data as Record<string, unknown>
              let filesAffected = ((proposal['files'] as { path: string }[] | undefined) ?? []).map((f) => f.path)
              const gateId = proposal['gateId'] as string | undefined
              const isSolitary = !gateId || gateId === 'solitary'

              const filePath = await findProposalByHash(hash)
              let role: string | undefined
              if (filePath) {
                const content = await readFile(filePath)
                const roleMatch = /\*\*Role\*\*:\s*(.+)/.exec(content)
                role = roleMatch?.[1]?.trim()
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
                // Gate-level structure is validated at gates_action: complete; skip siblings here
              })
            } catch {
              return { allowed: true }
            }
          },
        ],
        generate: (_payload, _r) => [
          // PreReview enforcement: G5-G8 structured preconditions for proposal generation
          // eslint-disable-next-line @typescript-eslint/require-await
          async () =>
            validatePreReviewGeneratePhase(
              (_payload as { preReview?: PreReview }).preReview,
              'proposal_action'
            ),
          // G12: generate actions must only produce markdown files
          // eslint-disable-next-line @typescript-eslint/require-await
          async () => {
            const filesAffected = (_payload as { filesAffected?: string[] }).filesAffected ?? []
            return validateMarkdownOnly(filesAffected)
          },
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
              const allNodes = new Map<string, DependencyNode>()

              if (gateId) {
                const listResult = await _r.invoke('proposal_list', { gateId })
                if (listResult.success) {
                  const rows = ((listResult.data as { proposals?: unknown[] }).proposals ?? []) as {
                    hash: string; dependencies?: string[]
                  }[]
                  for (const row of rows) {
                    allNodes.set(row.hash, {
                      hash: row.hash,
                      dependencies: row.dependencies ?? [],
                      gateId,
                    })
                  }
                }
              }

              const proposalHash = (_payload as { hash?: string }).hash ?? 'new'
              const newNode: DependencyNode = { hash: proposalHash, dependencies: payloadDeps, gateId }
              allNodes.set(proposalHash, newNode)

              const depContext: DependencyValidationContext = { node: newNode, allNodes }
              return validateDependencies(depContext)
            } catch {
              return { allowed: true }
            }
          },
        ],
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
          // Scope-creep check: proposal must not mix RED and GREEN phases.
          // Reads title/summary/tasks from the stored proposal via proposal_show.
          async () => {
            const hash = (payload as { hash?: string }).hash ?? ''
            try {
              const proposalResult = await r.invoke('proposal_show', { hash })
              if (!proposalResult.success) return { allowed: true }

              const proposal = proposalResult.data as Record<string, unknown>
              const title = typeof proposal['title'] === 'string' ? proposal['title'] : ''
              const summary = typeof proposal['description'] === 'string' ? proposal['description'] : ''
              const tasks = Array.isArray(proposal['tasks'])
                ? (proposal['tasks'] as { description?: string }[])
                : []

              return validateProposalPhases({
                title,
                summary,
                taskDescriptions: tasks.map((t) => t.description ?? ''),
              })
            } catch {
              return { allowed: true }
            }
          },
          // Explicit path check: no wildcards or directory-only entries in filesAffected.
          // Reads files_affected from the stored proposal via proposal_show.
          async () => {
            const hash = (payload as { hash?: string }).hash ?? ''
            try {
              const proposalResult = await r.invoke('proposal_show', { hash })
              if (!proposalResult.success) return { allowed: true }

              const proposal = proposalResult.data as Record<string, unknown>
              const filesAffected = Array.isArray(proposal['files_affected'])
                ? (proposal['files_affected'] as string[])
                : []

              const scopeContext: ScopeValidationContext = {
                filesAffected,
                filesModified: filesAffected,
                allowTestFiles: true,
              }
              return validateScope(scopeContext)
            } catch {
              return { allowed: true }
            }
          },
          // Circular dependency check: declared proposal dependencies must form a DAG.
          // Reads dependencies from the stored proposal and sibling proposals in its gate.
          async () => {
            const hash = (payload as { hash?: string }).hash ?? ''
            try {
              const proposalResult = await r.invoke('proposal_show', { hash })
              if (!proposalResult.success) return { allowed: true }

              const proposal = proposalResult.data as Record<string, unknown>
              const rawDeps = proposal['dependencies']
              const payloadDeps = Array.isArray(rawDeps) ? (rawDeps as string[]) : []
              if (payloadDeps.length === 0) return { allowed: true }

              const gateId = typeof proposal['gateId'] === 'string' ? proposal['gateId'] : ''
              const allNodes = new Map<string, DependencyNode>()

              if (gateId) {
                const listResult = await r.invoke('proposal_list', { gateId })
                if (listResult.success) {
                  const rows = ((listResult.data as { proposals?: unknown[] }).proposals ?? []) as {
                    hash: string; dependencies?: string[]
                  }[]
                  for (const row of rows) {
                    allNodes.set(row.hash, {
                      hash: row.hash,
                      dependencies: row.dependencies ?? [],
                      gateId,
                    })
                  }
                }
              }

              const currentNode: DependencyNode = { hash, dependencies: payloadDeps, gateId }
              allNodes.set(hash, currentNode)

              return validateDependencies({ node: currentNode, allNodes })
            } catch {
              return { allowed: true }
            }
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
              const roleMatch = /\*\*Role\*\*:\s*(.+)/.exec(content)
              const role = roleMatch?.[1]?.trim()

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
          // Test-first gate pattern: role-file consistency at validation time.
          // Mirrors the approve/start validators so agents get early feedback before
          // the proposal reaches the approval stage.
          async () => {
            const hash = (payload as { hash?: string }).hash ?? ''
            try {
              const { findProposalByHash } = await import('../../utils/artifact-locator.js')
              const { readFile } = await import('../../utils/file.js')
              const proposalResult = await r.invoke('proposal_show', { hash })
              if (!proposalResult.success) return { allowed: true }

              const proposal = proposalResult.data as Record<string, unknown>
              let filesAffected = ((proposal['files'] as { path: string }[] | undefined) ?? []).map((f) => f.path)
              const gateId = proposal['gateId'] as string | undefined
              const isSolitary = !gateId || gateId === 'solitary'

              const filePath = await findProposalByHash(hash)
              let role: string | undefined
              if (filePath) {
                const content = await readFile(filePath)
                const roleMatch = /\*\*Role\*\*:\s*(.+)/.exec(content)
                role = roleMatch?.[1]?.trim()
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

              const listResult = await r.invoke('proposal_list', { gateId })
              if (!listResult.success) return { allowed: true }

              const rows = ((listResult.data as { proposals?: unknown[] }).proposals ?? []) as {
                hash: string; lastUpdated?: string
              }[]
              if (rows.length === 0) return { allowed: true }

              const { findProposalByHash } = await import('../../utils/artifact-locator.js')
              const { readFile } = await import('../../utils/file.js')

              const gateProposals: ProposalGateSibling[] = await Promise.all(
                rows.map(async (p) => {
                  let role: string | undefined
                  let resolvedPath: string | undefined
                  try {
                    const filePath = await findProposalByHash(p.hash)
                    if (filePath) {
                      resolvedPath = filePath
                      const content = await readFile(filePath)
                      const roleMatch = /\*\*Role\*\*:\s*(.+)/.exec(content)
                      role = roleMatch?.[1]?.trim()
                    }
                  } catch { /* role stays undefined */ }
                  return { hash: p.hash, role, createdAt: p.lastUpdated ?? new Date().toISOString(), filePath: resolvedPath }
                })
              )

              return validateGateLevelTestFirst(gateProposals)
            } catch {
              return { allowed: true }
            }
          },
        ],
        approve: (payload, r) => [
          // 1) Enforce state transition: only in_progress proposals can be approved
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createStateTransitionValidator<ProposalStatus>({
            getCurrentStatus: async () => {
              const hash = (payload as { hash?: string }).hash ?? ''
              const result = await r.invoke('proposal_show', { hash })
              if (!result.success) return null
              const status = (result.data as { status?: string }).status as ProposalStatus | undefined
              return status ?? null
            },
            targetStatus: 'completed',
            validFromStatuses: ['in_progress'],
            allTransitions: PROPOSAL_TRANSITIONS,
            entityLabel: `proposal:${(payload as { hash?: string }).hash ?? '<unknown>'}`,
          }),
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
          async () => {
            const hash = (payload as { hash?: string }).hash ?? ''
            try {
              const { findProposalByHash } = await import('../../utils/artifact-locator.js')
              const { readFile } = await import('../../utils/file.js')
              const proposalResult = await r.invoke('proposal_show', { hash })
              if (!proposalResult.success) return { allowed: true }

              const proposal = proposalResult.data as Record<string, unknown>
              let filesAffected = ((proposal['files'] as { path: string }[] | undefined) ?? []).map((f) => f.path)
              const gateId = proposal['gateId'] as string | undefined
              const isSolitary = !gateId || gateId === 'solitary'

              const filePath = await findProposalByHash(hash)
              let role: string | undefined
              if (filePath) {
                const content = await readFile(filePath)
                const roleMatch = /\*\*Role\*\*:\s*(.+)/.exec(content)
                role = roleMatch?.[1]?.trim()
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
          },
        ],
        reject: (payload, r) => [
          // Enforce state transition: only in_progress proposals can be rejected
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createStateTransitionValidator<ProposalStatus>({
            getCurrentStatus: async () => {
              const hash = (payload as { hash?: string }).hash ?? ''
              const result = await r.invoke('proposal_show', { hash })
              if (!result.success) return null
              const status = (result.data as { status?: string }).status as ProposalStatus | undefined
              return status ?? null
            },
            targetStatus: 'rejected',
            validFromStatuses: ['in_progress'],
            allTransitions: PROPOSAL_TRANSITIONS,
            entityLabel: `proposal:${(payload as { hash?: string }).hash ?? '<unknown>'}`,
          }),
        ],
      },
    },
    registry
  )

  return {
    proposal_action: proposalActionHandler,
  }
}
