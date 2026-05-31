import {
  ProposalListOutputSchema,
  ProposalDetailSchema,
  ProposalValidateOutputSchema,
  ProposalApproveOutputSchema,
  ProposalRejectOutputSchema,
  ProposalStartOutputSchema,
  ProposalCancelOutputSchema,
  ProposalDeferOutputSchema,
  ProposalDeleteOutputSchema,
  type ProposalQualitativeReview,
} from '../schemas/proposal-schemas.js'
import {
  ProposalRegenerateOutputSchema,
  ProposalUpdateProgressOutputSchema,
} from '../schemas/workflow-schemas.js'
import {
  DbStatusOutputSchema,
  DbSyncOutputSchema,
  PurgeOrphansOutputSchema,
} from '../schemas/reg-action-schemas.js'
import { ProposalActionInputSchema } from '../schemas/proposal-action-schemas.js'
import {
  validateApplyPhase,
  type ApplyPhaseValidationContext,
} from '../validators/apply-phase-validator.js'
import { validateQuality, DEFAULT_QUALITY_STUB_METRICS, type QualityValidationContext } from '../validators/quality-validator.js'
import { type ZenoConfig, getWorkspaceRoot, getZenoGitDir } from '../../utils/config.js'
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
import { ensureDir, readFile as readTextFile, walkDir, writeFile as writeTextFile } from '../../utils/file.js'
import { normalizeGateId, resolveGateIdentifier } from '../../utils/normalize.js'
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
import { resolveRoleFromContent } from '../../storage/frontmatter.js'
import { WorktreeManager } from '../../core/worktree-manager.js'
import { loadTemplateContent } from '../../generation/template-discovery.js'
import { dirname, join, relative } from 'node:path'
import { rm } from 'node:fs/promises'

/**
 * Unified proposal action tool definition.
 * Consolidates all proposal lifecycle operations into a single action-based entrypoint.
 *
 * Actions: list, show, scaffold, generate (alias), validate, approve, reject, start, progress,
 *          cancel, defer, delete, db_status, db_sync, purge_orphans, regenerate
 *
 * The 'scaffold' action (alias: 'generate') intelligently routes based on payload:
 * - Explicit-fields path (title + tasks provided): creates the proposal directly via proposal_create
 * - Gate-tied AI path (gateId only, no title/tasks): decomposes gate PRD into proposals via generateProposals
 * - Solitary proposal (solitary=true or no gateId): creates a self-contained proposal via proposal_create
 *
 * NOTE: scaffold creates EMPTY template files with [bracketed placeholders] that must be filled.
 * It does NOT produce finished proposals. After scaffolding, open each file and replace every
 * placeholder with concrete content before calling validate.
 *
 * Example usage (flat parameters — never nest under "payload"):
 * ```json
 * {
 *   "action": "scaffold",
 *   "title": "Add authentication",
 *   "summary": "Implement JWT-based auth",
 *   "gateId": "gate-03",
 *   "tasks": [{"description": "Create auth middleware", "acceptanceCriteria": ["Tests pass"]}],
 *   "filesAffected": ["src/auth/middleware.ts"]
 * }
 * ```
 */
export const proposalToolDefinitions = [
  {
    name: 'proposal_action',
    description: [
      'Proposal lifecycle: list, show, scaffold (alias: generate), validate, approve, reject, start, progress, cancel, defer, delete, db_status, db_sync, purge_orphans, regenerate.',
      '',
      'SCAFFOLD vs GENERATE: "scaffold" and "generate" are the same action. Both stamp out EMPTY template files with [bracketed placeholders]. The LLM must fill every placeholder before calling validate. Think of it as "create blank forms", not "produce finished proposals".',
      '',
      'USE start FIRST when asked to "start", "implement", "work on", or "execute" any proposal (gate-tied or solitary). Call start { hash } before editing any files — it transitions the proposal to in_progress. Gate-tied proposals return a worktree path and must be edited there; solitary proposals stay in the current workspace and are tracked by the proposal lifecycle. Then validate and complete via progress/approve as directed.',
      '',
      'USE generate with { solitary: true } for work that is not tied to any gate (cross-cutting improvements, tooling, experiments). Solitary proposals live in proposals/solitary/ and have gateId=null. List them with list { gateId: "solitary" }.',
      '',
      'scaffold/generate with gateId (AI decomposition path) REQUIRES preReview with phase="generate". Read the full Gate PRD and call reg_action { action: "list", gateId } BEFORE calling scaffold. Then supply preReview: { phase: "generate", openQuestionsResolved (bool), questionsFound (string[]), gateReviewed (bool), requirementsVerified (bool), vagueRequirements (string[]), assumptionsDocumented (string[]), blockersIdentified (string[]) }. Omitting preReview returns a structured validation error.',
      '',
      'DELETE: Use delete { hash, confirmed: true } to permanently remove a proposal (DB row + disk file). Cannot be undone. For stale/orphaned DB rows that have no disk file, use purge_orphans instead.',
      '',
      'DB HOUSEKEEPING (call before scaffold to detect stale state):',
      '  db_status   — report orphan count and status breakdown',
      '  db_sync     — reconcile DB with disk (add missing rows, remove orphans)',
      '  purge_orphans — remove DB rows with no matching .md file (optional: gateId, solitary, dryRun)',
      '',
      'REGENERATE:',
      '  regenerate  — atomically regenerate proposal scaffolds from gate PRDs',
      '                - supply gateId to regenerate one gate',
      '                - omit gateId to regenerate all active, non-terminal gates',
      '                - use reg_action { action: "regenerate" } if you need to rebuild registry.db itself',
      '',
      'cancel and defer require confirmed: true — omitting confirmed returns a prompt instead of executing.',
      '',
      'Database access rules (always apply):',
      ...DATABASE_ACCESS_GUARDRAILS.map(g => `- ${g.rule}`),
    ].join('\n'),
    inputSchema: ProposalActionInputSchema,
  },
]

import type { FunctionRegistry, FunctionResult } from '../../integration/function-registry.js'
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
      role = resolveRoleFromContent(content) ?? role
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
      role = resolveRoleFromContent(content) ?? role
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
 * Shared body for the proposal_action:scaffold and proposal_action:generate actions.
 *
 * Both action names are public aliases — they MUST behave identically. This function
 * centralizes the routing decision (solitary vs. gate-tied direct vs. gate-tied AI) and,
 * critically, attaches the proposal template (templateInfo.content), the placeholder-fill
 * instruction (fillInstruction), and the proposal-generation guardrails/workflow via
 * withGuidance. Without these the calling LLM receives only file paths and produces
 * proposals that are still unfilled templates.
 */
async function runProposalGenerate(
  payload: Record<string, unknown> | undefined,
  r: FunctionRegistry
): Promise<FunctionResult> {
  payload = payload ?? {}
  // Route based on payload shape:
  // - Solitary or no gateId → proposal_create (self-contained proposal)
  // - Gate-tied with explicit fields (title + tasks) → proposal_create (direct creation)
  // - Gate-tied without explicit fields → generateProposals (AI decomposition)
  const isSolitary = (payload as { solitary?: boolean }).solitary === true
  const hasGateId = Boolean((payload as { gateId?: string }).gateId)
  const gateId = (payload as { gateId?: string }).gateId
  const hasTitle = Boolean((payload as { title?: string }).title)
  const hasSummary = Boolean((payload as { summary?: string }).summary)
  const explicitTasks = (payload as { tasks?: unknown[] }).tasks
  const hasTasks = Array.isArray(explicitTasks) && explicitTasks.length > 0
  const hasExplicitFields = hasTitle && hasTasks

  // Pre-dispatch validation: catch missing required fields for the
  // direct-creation path before the inner proposal_create schema rejects
  // with a cryptic parameter validation error.
  const isDirectCreatePath = isSolitary || !hasGateId || hasExplicitFields
  if (isDirectCreatePath) {
    const missing: string[] = []
    if (!hasTitle) missing.push('title')
    if (!hasSummary) missing.push('summary')
    if (!hasTasks) missing.push('tasks')
    if (missing.length > 0) {
      return {
        success: false,
        error: {
          code: 'SCAFFOLD_DIRECT_CREATE_MISSING_FIELDS',
          message:
            `proposal_action:scaffold/generate direct-creation path requires title + summary + tasks. Missing: ${missing.join(', ')}. ` +
            'The direct-creation path is selected when solitary=true, when no gateId is provided, ' +
            'or when title+tasks are supplied alongside a gateId. ' +
            'Provide ALL of: title (string), summary (2-3 sentence description), tasks (array of {description, acceptanceCriteria?, phase?, files?, action?}). ' +
            'To use the AI decomposition path instead, omit title/tasks and supply gateId + preReview (phase="generate").',
          context: {
            missingFields: missing,
            receivedKeys: Object.keys(payload),
            routingDecision: isSolitary
              ? 'solitary'
              : !hasGateId
                ? 'no-gateId-defaulted-to-solitary'
                : 'gate-tied-explicit-fields',
          },
        },
      }
    }
  }

  let invokeResult
  if (isSolitary || !hasGateId) {
    // Solitary proposal: use proposal_create workflow
    // If no gateId is provided and not explicitly solitary, default to solitary mode
    const solitaryPayload = {
      ...payload,
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
      // Auto-warn: check for orphaned DB rows before continuing so the LLM
      // is aware of stale state from prior (interrupted) scaffold attempts.
      try {
        const statusResult = await r.invoke('reg_action', { action: 'db_status', payload: {} })
        if (statusResult.success) {
          const dbStatus = statusResult.data as { orphaned?: number; orphanedHashes?: string[] }
          if ((dbStatus.orphaned ?? 0) > 0) {
            invokeResult = {
              ...invokeResult,
              data: {
                ...(invokeResult.data as Record<string, unknown>),
                orphanWarning: {
                  orphaned: dbStatus.orphaned,
                  orphanedHashes: dbStatus.orphanedHashes,
                  message:
                    `${String(dbStatus.orphaned)} orphaned DB row(s) detected (DB entries with no matching .md file on disk). ` +
                    'These are likely from an earlier interrupted scaffold session. ' +
                    'Call proposal_action { action: "purge_orphans", dryRun: false } to clean them up.',
                },
              },
            }
          }
        }
      } catch {
        // orphan check is best-effort; never block scaffold on it
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

  // Load the full proposal template including meta-commentary sections.
  // HTML comments and meta sections (e.g. "## Single-Phase Requirement") are sent
  // intact in templateInfo.content so the filling LLM has full authoring context.
  // HTML comments are stripped from scaffold files automatically at write time;
  // meta-instruction sections (body text, not comments) must still be removed by
  // the filling LLM — the fillInstruction below directs that.
  let templateInfo: { name: string; content: string; fillInstruction?: string; outputPathHint?: string } | undefined
  try {
    const content = await loadTemplateContent(undefined, 'templates/md-templates/proposal-template.md')
    const isSolitaryProposal = isSolitary || !hasGateId
    templateInfo = {
      name: 'proposal-template',
      content,
      fillInstruction:
        'CRITICAL: scaffolding produced empty template files; you must now author each one. ' +
        'The scaffold files in scaffoldedFiles are already on disk with HTML comments stripped. ' +
        'templateInfo.content above is the full template (with HTML comments) — use it for ' +
        'authoring context only; do not re-create or overwrite the scaffold files from it. ' +
        'For each scaffold file: open the file, read it, then DIRECTLY EDIT it by replacing ' +
        'every [bracketed placeholder] with concrete, gate-specific content derived from the ' +
        'gate PRD objectives and requirements. ' +
        'STRIP FROM OUTPUT — remove entirely from the written file — any section whose opening ' +
        'bracket text contains "Meta-constraint guidance" or "omit this section from submitted ' +
        'proposals" (e.g. the ## Single-Phase Requirement section): read it for context, then ' +
        'delete the entire section including its --- divider. ' +
        'Search the result for [ to verify every unfilled slot is replaced — the validator ' +
        'rejects files that still contain bracket placeholders. ' +
        'Process proposals one at a time in sequence; do not create scripts or batch processors. ' +
        'Call proposal_action:validate after completing each file. ' +
        'DO NOT consider scaffolding "done" until every scaffolded file has been opened, filled, ' +
        'and validated — returning the response from this call alone is not completion.',
      outputPathHint: isSolitaryProposal
        ? 'zeno/proposals/solitary/<name>.md — path listed in scaffoldedFiles from this response'
        : 'zeno/proposals/gate-<XX>/<name>.md — paths listed in scaffoldedFiles from this response',
    }
  } catch {
    // Template loading is best-effort; guidance still flows without it
  }

  // Inject preReviewSummary, template, and proposal-generation guidance
  return withGuidance(
    invokeResult,
    toNarrativeRules(PROPOSAL_GENERATION_GUARDRAILS),
    toCompactWorkflow(PROPOSAL_GENERATION_WORKFLOW),
    {
      preReview: !isSolitary && hasGateId && !hasExplicitFields
        ? (payload as { preReview?: unknown }).preReview
        : undefined,
      templateInfo,
    }
  )
}

interface ProposalDirectorySnapshot {
  gateId: string
  dirPath: string
  files: { relativePath: string; content: string }[]
}

function getProposalDirForGate(gateId: string): string {
  return join(getZenoGitDir(getWorkspaceRoot()), 'proposals', normalizeGateId(gateId))
}

async function snapshotProposalDirectory(gateId: string): Promise<ProposalDirectorySnapshot> {
  const dirPath = getProposalDirForGate(gateId)
  const files = await walkDir(dirPath)

  return {
    gateId,
    dirPath,
    files: await Promise.all(
      files.map(async (filePath) => ({
        relativePath: relative(dirPath, filePath).replace(/\\/g, '/'),
        content: await readTextFile(filePath),
      }))
    ),
  }
}

async function restoreProposalDirectory(snapshot: ProposalDirectorySnapshot): Promise<void> {
  await rm(snapshot.dirPath, { recursive: true, force: true })

  for (const file of snapshot.files) {
    const targetPath = join(snapshot.dirPath, file.relativePath)
    await ensureDir(dirname(targetPath))
    await writeTextFile(targetPath, file.content)
  }
}

async function resolveProposalRegenerateGateIds(
  payload: Record<string, unknown> | undefined,
  r: FunctionRegistry
): Promise<FunctionResult<string[]>> {
  const requestedGateId = typeof payload?.['gateId'] === 'string' ? payload['gateId'] : undefined

  if (requestedGateId) {
    const normalizedGateId = resolveGateIdentifier(requestedGateId)
    if (normalizedGateId === 'solitary') {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'proposal_action:regenerate only supports gate-tied proposal scaffolds. Solitary proposals must be regenerated individually with scaffold/generate.',
        },
      }
    }

    const gateResult = await r.invoke('gates_show', { gateId: normalizedGateId })
    if (!gateResult.success) {
      return gateResult as FunctionResult<string[]>
    }

    const gate = gateResult.data as { status?: string; prdGenerated?: boolean }
    if (gate.prdGenerated === false) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Gate ${normalizedGateId} does not have a generated PRD yet, so its proposal scaffolds cannot be regenerated.`,
        },
      }
    }
    if (gate.status === 'completed' || gate.status === 'cancelled') {
      return {
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Gate ${normalizedGateId} is ${gate.status}; proposal regeneration only applies to active, non-terminal gates.`,
        },
      }
    }

    return { success: true, data: [normalizedGateId] }
  }

  const listResult = await r.invoke('gates_list', {})
  if (!listResult.success) {
    return listResult as FunctionResult<string[]>
  }

  const activeGateIds = ((listResult.data as { gates?: { id: string; status?: string; prdGenerated?: boolean }[] }).gates ?? [])
    .filter((gate) => gate.prdGenerated !== false)
    .filter((gate) => gate.status !== 'completed' && gate.status !== 'cancelled')
    .map((gate) => gate.id)

  if (activeGateIds.length === 0) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'No active gate PRDs were found to regenerate proposals from.',
      },
    }
  }

  return { success: true, data: activeGateIds }
}

async function runProposalRegenerate(
  payload: Record<string, unknown> | undefined,
  r: FunctionRegistry
): Promise<FunctionResult> {
  const gateIdsResult = await resolveProposalRegenerateGateIds(payload, r)
  if (!gateIdsResult.success) {
    return gateIdsResult
  }

  const gateIds = gateIdsResult.data
  const templateName = typeof payload?.['templateName'] === 'string' ? payload['templateName'] : undefined
  const outputDir = typeof payload?.['outputDir'] === 'string' ? payload['outputDir'] : undefined
  const preReview = (payload as { preReview?: unknown } | undefined)?.preReview
  const snapshots = await Promise.all(gateIds.map((gateId) => snapshotProposalDirectory(gateId)))
  const perGateResults: Record<string, unknown>[] = []

  try {
    for (const gateId of gateIds) {
      await rm(getProposalDirForGate(gateId), { recursive: true, force: true })

      const resetResult = await r.invoke('reg_action', {
        action: 'reset_gate',
        payload: { gateId },
      })
      if (!resetResult.success) {
        throw new Error(resetResult.error.message)
      }

      const resolvedOutputDir = outputDir
        ? gateIds.length === 1
          ? outputDir
          : join(outputDir, gateId)
        : undefined

      // Delegate to the canonical scaffold/generate workflow so regenerate
      // applies the same gate auto-start, orphan check, requirements injection,
      // template guidance, and withGuidance wrapping as proposal_action:scaffold.
      // This guarantees regenerate cannot drift from the scaffold workflow.
      const generateResult = await runProposalGenerate(
        {
          gateId,
          ...(templateName ? { templateName } : {}),
          ...(resolvedOutputDir ? { outputDir: resolvedOutputDir } : {}),
          ...(preReview !== undefined ? { preReview } : {}),
        },
        r
      )
      if (!generateResult.success) {
        throw new Error(generateResult.error.message)
      }

      perGateResults.push((generateResult.data ?? {}) as Record<string, unknown>)
    }
  } catch (error) {
    for (const snapshot of snapshots) {
      await restoreProposalDirectory(snapshot)
      const rollbackReset = await r.invoke('reg_action', {
        action: 'reset_gate',
        payload: { gateId: snapshot.gateId },
      })
      if (!rollbackReset.success) {
        return {
          success: false,
          error: {
            code: 'COMMAND_FAILED',
            message:
              `Failed to regenerate proposals atomically: ${error instanceof Error ? error.message : String(error)}. ` +
              `Rollback also failed while restoring ${snapshot.gateId}: ${rollbackReset.error.message}`,
            context: { gateIds },
          },
        }
      }
    }

    return {
      success: false,
      error: {
        code: 'COMMAND_FAILED',
        message:
          `Failed to regenerate proposals atomically: ${error instanceof Error ? error.message : String(error)}. ` +
          'All targeted proposal directories were rolled back to their previous on-disk state.',
        context: { gateIds },
      },
    }
  }

  // Always aggregate to the ProposalRegenerate output shape, regardless of
  // single- vs multi-gate scope. Pass-through templateInfo + guidance from the
  // canonical scaffold workflow rather than reconstructing them here, so
  // regenerate cannot drift from proposal_action:scaffold's behaviour.
  const generatedGates = perGateResults.map((data) => {
    // Strip workflow-only fields from each per-gate entry so the array conforms
    // to ProposalGenerateOutputSchema; the wrapper fields are surfaced once at
    // the top level below.
    const { guidance: _g, templateInfo: _t, orphanWarning: _o, requirementsContext: _r, ...rest } = data
    void _g; void _t; void _o; void _r
    return rest
  })
  const proposalsGenerated = generatedGates.reduce((sum, gate) => {
    const count = gate['proposalsGenerated']
    return sum + (typeof count === 'number' ? count : 0)
  }, 0)

  // Lift workflow-wrapper fields (templateInfo, guidance, orphanWarning,
  // requirementsContext) from the first per-gate result so the regenerate
  // response surfaces the same authoring context that scaffold returns.
  const firstData = perGateResults[0] ?? {}
  const passthroughTemplateInfo = firstData['templateInfo']
  const passthroughGuidance = firstData['guidance']
  const passthroughOrphanWarning = firstData['orphanWarning']
  const passthroughRequirements = firstData['requirementsContext']

  const regenerateResult: FunctionResult = {
    success: true,
    data: {
      success: true,
      scope: payload?.['gateId'] ? 'single' : 'all',
      gateIds,
      gatesProcessed: generatedGates.length,
      proposalsGenerated,
      gates: generatedGates,
      message:
        payload?.['gateId']
          ? `Regenerated ${String(proposalsGenerated)} proposal scaffold(s) for ${String(gateIds[0])}.`
          : `Regenerated ${String(proposalsGenerated)} proposal scaffold(s) across ${String(generatedGates.length)} gate(s).`,
      ...(passthroughOrphanWarning ? { orphanWarning: passthroughOrphanWarning } : {}),
      ...(passthroughRequirements ? { requirementsContext: passthroughRequirements } : {}),
      ...(passthroughTemplateInfo ? { templateInfo: passthroughTemplateInfo } : {}),
      ...(passthroughGuidance ? { guidance: passthroughGuidance } : {}),
    },
  }

  return regenerateResult
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
        'scaffold',
        'generate',
        'validate',
        'approve',
        'reject',
        'start',
        'progress',
        'cancel',
        'defer',
        'delete',
        'db_status',
        'db_sync',
        'purge_orphans',
        'regenerate',
      ] as const,
      inputSchema: ProposalActionInputSchema,
      outputSchema: ProposalActionOutputSchema,
      actionOutputSchema(action) {
        switch (action) {
          case 'list':
            return ProposalListOutputSchema
          case 'show':
            return ProposalDetailSchema
          case 'scaffold':
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
          case 'delete':
            return ProposalDeleteOutputSchema
          case 'db_status':
            return DbStatusOutputSchema
          case 'db_sync':
            return DbSyncOutputSchema
          case 'purge_orphans':
            return PurgeOrphansOutputSchema
          case 'regenerate':
            return ProposalRegenerateOutputSchema
          default:
            throw new Error(`Unknown proposal action: ${String(action)}`)
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('proposal_list', payload),
        show: async (payload, r) => {
          return r.invoke('proposal_show', payload)
        },
        // scaffold and generate are aliases — both must produce identical output
        // (paths + template + fillInstruction + PROPOSAL_GENERATION_GUARDRAILS) so
        // the calling LLM has full authoring context. Route both to the same body.
        scaffold: async (payload, r) => runProposalGenerate(payload, r),
        generate: async (payload, r) => runProposalGenerate(payload, r),
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
                const diskRole = resolveRoleFromContent(content)
                if (diskRole) resolvedRole = diskRole
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
          // Audit trail recording and worktree merge are handled by
          // completions.ts approveProposal() — invoked via proposal_approve.
          // Do not duplicate them here.
          return await r.invoke('proposal_approve', payload)
        },
        reject: async (payload, r) => {
          // Idempotent: if already rejected, return success without re-invoking CLI
          const hash = (payload as { hash?: string }).hash ?? ''
          const reason = (payload as { rejectionReason?: string }).rejectionReason
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
          // Pre-dispatch validation: rejection without a reason loses critical
          // rework context. The inner CLI silently defaults to 'No reason
          // provided'; surface a structured error instead so the LLM is forced
          // to supply actionable feedback.
          if (!reason?.trim()) {
            return {
              success: false,
              error: {
                code: 'REJECT_MISSING_REASON',
                message:
                  'proposal_action:reject requires a non-empty rejectionReason. Provide a concrete explanation of why the proposal is being rejected so the rework cycle has actionable feedback. Optional fields: rejectedBy.',
                context: {
                  hash,
                  receivedKeys: Object.keys(payload ?? {}),
                },
              },
            }
          }
          const rejectResult = await r.invoke('proposal_reject', payload)
          return rejectResult
        },
        start: async (payload, r) => {
          const p = payload as { hash?: string; qualitativeReview?: ProposalQualitativeReview; preReview?: PreReview; startedBy?: string }
          // Idempotent: if already in_progress, return success without re-invoking CLI
          const hash = p.hash ?? ''
          const showResult = await r.invoke('proposal_show', { hash })
          if (showResult.success) {
            const showData = showResult.data as {
              status?: string
              gateId?: string | null
              gate_id?: string | null
              solitary?: boolean
              startedAt?: string
            }
            const currentStatus = showData.status
            if (currentStatus === 'in_progress') {
              return {
                success: true,
                data: {
                  hash,
                  previousStatus: 'in_progress',
                  newStatus: 'in_progress' as const,
                  startedAt:
                    showData.startedAt ?? new Date().toISOString(),
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
            const proposalGateId = showData.gateId ?? showData.gate_id
            const isSolitaryProposal =
              showData.solitary === true || !proposalGateId || proposalGateId === 'solitary'

            // Create worktree for isolated gate-tied development (best-effort).
            // Solitary proposals intentionally stay in the current workspace and
            // are tracked through proposal progress/approval only.
            if (rawResult.success && !isSolitaryProposal) {
              try {
                const manager = new WorktreeManager(getWorkspaceRoot())
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
        delete: async (payload, r) => {
          const { confirmed, hash } = payload as { confirmed?: boolean; hash?: string }
          if (!confirmed) {
            return {
              success: true,
              data: {
                requiresConfirmation: true,
                action: 'delete' as const,
                hash,
                message:
                  `Deleting proposal${hash ? ` "${hash}"` : ''} is PERMANENT and cannot be undone. ` +
                  'This removes both the DB row and the disk file. ' +
                  'Please confirm with the user before proceeding. ' +
                  'To remove only orphaned DB rows (no disk file present), use purge_orphans instead. ' +
                  'Re-call with confirmed: true once the user has explicitly approved.',
              },
            }
          }
          return r.invoke('proposal_delete', payload)
        },
        db_status: async (_payload, r) => {
          return r.invoke('reg_action', { action: 'db_status', payload: {} })
        },
        db_sync: async (_payload, r) => {
          return r.invoke('reg_action', { action: 'db_sync', payload: {} })
        },
        purge_orphans: async (payload, r) => {
          const p = payload as { gateId?: string; solitary?: boolean; dryRun?: boolean } | undefined
          return r.invoke('reg_action', {
            action: 'purge_orphans',
            payload: {
              gateId: p?.gateId,
              solitary: p?.solitary,
              dryRun: p?.dryRun ?? false,
            },
          })
        },
        regenerate: async (payload, r) => {
          return runProposalRegenerate(payload, r)
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
              // Treat unreplaced template placeholders as unset.
              // Do NOT infer role from filename here — the validator must receive
              // undefined when the **Roles** field is absent so it can flag it as
              // an error. Filename-based inference is only used for sibling-structure
              // checks (resolveGateTestFirstSiblings), not per-proposal field validation.
              const role = resolveRoleFromContent(content)

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
              projectRoot: getWorkspaceRoot(),
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
              projectRoot: getWorkspaceRoot(),
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
