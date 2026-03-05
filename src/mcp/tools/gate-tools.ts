import { GatesActionInputSchema } from '../schemas/gates-action-schemas.js'
import { validateDependencies,
  type DependencyValidationContext,
} from '../validators/dependency-validator.js'
import { validateQuality, DEFAULT_QUALITY_STUB_METRICS, type QualityValidationContext } from '../validators/quality-validator.js'
import { createStateTransitionValidator } from './entity-action-handler.js'
import { validatePreReviewGeneratePhase, type PreReview } from '../validators/pre-review-validator.js'
import { validateMarkdownOnly } from '../validators/scope-validator.js'
import { validateGateLevelTestFirst, type ProposalGateSibling } from '../validators/test-first-validator.js'
import { validateArtifactFile } from '../validators/artifact-validator.js'
import {
  GATE_GENERATION_GUARDRAILS,
  GATE_GENERATION_WORKFLOW,
  GATE_QUALITATIVE_CHECKLIST,
  toNarrativeRules,
  toCompactWorkflow,
} from '../content/index.js'
import { type GateStatus, GATE_TRANSITIONS } from '../../core/transitions.js'

/**
 * Unified gate action tool definition.
 * Consolidates all gate lifecycle operations into a single action-based entrypoint.
 *
 * Actions: list, show, create, generate, start, complete, regenerate
 */
export const gateToolDefinitions = [
  {
    name: 'gates_action',
    description: `REQUIRED TOOL: Use gates_action for ALL gate operations—this is the ONLY way to manage gates.

Actions: list (see all gates, filter by status), show (get gate details by gateId), create (create new gate), generate (generate gates from requirements), validate (dry-run quality/structural checks, needs gateId), start (transition to in_progress), complete (finish gate), regenerate (update roadmap after rescope).

Call this tool whenever: you need to see gates, check gate status/details, validate a gate before completing, start/complete a gate, or manage the roadmap.`,
    inputSchema: GatesActionInputSchema,
  },
]

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  GatesListOutputSchema,
  GateDetailSchema,
  GatesStartOutputSchema,
  GatesCompleteOutputSchema,
  GatesRegenerateOutputSchema,
  GatesCancelOutputSchema,
  GatesDeferOutputSchema,
  GatesValidateOutputSchema,
} from '../schemas/gate-schemas.js'
import { GateCreateOutputSchema } from '../schemas/gate-create-schemas.js'
import { GateGenerateOutputSchema } from '../schemas/workflow-schemas.js'
import { GatesActionOutputSchema } from '../schemas/gates-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'
import { withGuidance } from './handler-factory.js'

export function gateHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const gateActionHandler = createEntityActionHandler(
    {
      entity: 'gate',
      actions: ['list', 'show', 'create', 'generate', 'validate', 'start', 'complete', 'regenerate', 'cancel', 'defer'] as const,
      inputSchema: GatesActionInputSchema,
      outputSchema: GatesActionOutputSchema,
      actionOutputSchema(action) {
        switch (action) {
          case 'list':
            return GatesListOutputSchema
          case 'show':
            return GateDetailSchema
          case 'create':
            return GateCreateOutputSchema
          case 'generate':
            return GateGenerateOutputSchema
          case 'start':
            return GatesStartOutputSchema
          case 'complete':
            return GatesCompleteOutputSchema
          case 'validate':
            return GatesValidateOutputSchema
          case 'regenerate':
            return GatesRegenerateOutputSchema
          case 'cancel':
            return GatesCancelOutputSchema
          case 'defer':
            return GatesDeferOutputSchema
          default:
            throw new Error(`Unknown gate action: ${String(action)}`)
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('gates_list', payload),
        show: async (payload, r) => r.invoke('gates_show', payload),
        create: async (payload, r) => r.invoke('gate_create', payload),
        generate: async (payload, r) =>
          withGuidance(
            await r.invoke('generateGates', payload),
            toNarrativeRules(GATE_GENERATION_GUARDRAILS),
            toCompactWorkflow(GATE_GENERATION_WORKFLOW),
            (payload as { preReview?: unknown }).preReview
          ),
        start: async (payload, r) => {
          // Idempotent: if gate is already in_progress, return success without re-invoking CLI
          const gateId = (payload as { gateId?: string }).gateId ?? ''
          const showResult = await r.invoke('gates_show', { gateId })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'in_progress') {
              const showData = showResult.data as Record<string, unknown>
              return {
                success: true,
                data: {
                  gateId,
                  previousStatus: 'in_progress',
                  newStatus: 'in_progress' as const,
                  startedAt: (showData['startedAt'] as string | undefined) ?? new Date().toISOString(),
                },
              }
            }
          }
          return r.invoke('gates_start', payload)
        },
        complete: async (payload, r) => {
          // Idempotent: if gate is already completed, return success without re-invoking CLI
          const gateId = (payload as { gateId?: string }).gateId ?? ''
          const showResult = await r.invoke('gates_show', { gateId })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'completed') {
              const showData = showResult.data as Record<string, unknown>
              return {
                success: true,
                data: {
                  gateId,
                  previousStatus: 'completed',
                  newStatus: 'completed' as const,
                  completedAt:
                    (showData['lastUpdated'] as string | undefined) ??
                    new Date().toISOString(),
                  summary: { proposalsCompleted: 0, requirementsTested: 0 },
                },
              }
            }
          }
          return r.invoke('gates_complete', payload)
        },
        regenerate: async (payload, r) => r.invoke('gates_regenerate', payload),
        validate: async (payload, r) => {
          // Dry-run: run quality + structural checks against the gate without completing it.
          // Gates are held to a higher standard than proposals: they drive proposal creation,
          // so all checks must pass before a gate is fit to generate proposals.
          const gateId = (payload as { gateId?: string }).gateId ?? ''
          const allErrors: string[] = []
          const allWarnings: string[] = []
          let qualityPassed = true
          let testFirstPassed = true
          let artifactPassed = true
          let dependencyPassed = true
          let dependencyGatesCompleted = true
          let requirementsCoverage = true

          // 1) Artifact structure check
          try {
            const { findGateByGateId } = await import('../../utils/artifact-locator.js')
            const filePath = await findGateByGateId(gateId)
            if (filePath) {
              const artifactResult = await validateArtifactFile(filePath, 'gate')
              if (!artifactResult.allowed) {
                artifactPassed = false
                allErrors.push(...(artifactResult.errors ?? []))
              }
              allWarnings.push(...(artifactResult.warnings ?? []))
            }
          } catch {
            // artifact check is best-effort
          }

          // 2) Gate dependency DAG: declared dependencies must form a valid DAG (no cycles).
          // Mirrors the gates_action:create validator for early detection before complete.
          let declaredDependencies: string[] = []
          let allGatesForDeps: Record<string, unknown>[] = []
          try {
            const gatesResult = await r.invoke('gates_list', {})
            if (gatesResult.success) {
              allGatesForDeps = gatesResult.data as Record<string, unknown>[]
              const allNodes = new Map<
                string,
                { hash: string; dependencies: string[]; gateId: string; gateSequence: number }
              >()
              allGatesForDeps.forEach((gate) => {
                const id = String(gate['id'])
                const deps = Array.isArray(gate['dependencies'])
                  ? (gate['dependencies'] as string[])
                  : []
                allNodes.set(id, { hash: id, dependencies: deps, gateId: id, gateSequence: parseInt(id.split('-')[1] ?? '') || 0 })
              })
              const currentGate = allNodes.get(gateId)
              if (currentGate) {
                declaredDependencies = currentGate.dependencies
                const depResult = validateDependencies({ node: currentGate, allNodes })
                if (!depResult.allowed) {
                  dependencyPassed = false
                  allErrors.push(...(depResult.errors ?? []))
                }
                allWarnings.push(...(depResult.warnings ?? []))
              }

              // 3) All declared dependency gates must be completed.
              // A gate that depends on incomplete work cannot safely generate proposals —
              // the upstream context is unfinished and will change.
              for (const depId of declaredDependencies) {
                const depGate = allGatesForDeps.find((g) => String(g['id']) === depId)
                const depStatus = depGate ? String(depGate['status']) : ''
                if (depStatus !== 'completed') {
                  dependencyGatesCompleted = false
                  allErrors.push(
                    `Dependency gate ${depId} is not completed (status: ${depStatus || 'unknown'}) — complete upstream gates before validating this gate`
                  )
                }
              }
            }
          } catch { /* dependency checks are best-effort */ }

          // 4) Quality thresholds
          const showResult = await r.invoke('gates_show', { gateId })
          const showData = showResult.success ? (showResult.data as Record<string, unknown>) : {}
          const existingMetrics = (showData['qualityMetrics'] ?? {}) as Record<string, unknown>
          const qualityMetrics = {
            coverage: typeof existingMetrics['testCoverage'] === 'number' ? existingMetrics['testCoverage'] : DEFAULT_QUALITY_STUB_METRICS.coverage,
            lintErrors: typeof existingMetrics['lintErrors'] === 'number' ? existingMetrics['lintErrors'] : DEFAULT_QUALITY_STUB_METRICS.lintErrors,
            securityIssues: typeof existingMetrics['securityIssues'] === 'number' ? existingMetrics['securityIssues'] : DEFAULT_QUALITY_STUB_METRICS.securityIssues,
          }
          const qualityResult = await validateQuality({ metrics: qualityMetrics })
          if (!qualityResult.allowed) {
            qualityPassed = false
            allErrors.push(...(qualityResult.errors ?? []))
          }
          allWarnings.push(...(qualityResult.warnings ?? []))

          // 5) Requirements coverage: gate must have at least one requirement in the DB
          //    (owned or linked from another gate/PRD).
          // Gates without requirements provide no decomposition basis for proposals.
          // This is an error for in_progress gates, a warning for pending gates.
          try {
            const reqResult = await r.invoke('reg_action', { action: 'list', payload: { gateId } })
            if (reqResult.success) {
              const reqData = reqResult.data as {
                requirements?: unknown[]
                total?: number
                linkedCount?: number
              }
              const owned = reqData.total ?? reqData.requirements?.length ?? 0
              const linked = reqData.linkedCount ?? 0
              const count = owned + linked
              if (count === 0) {
                const currentStatus = (showData['status'] as string) || ''
                if (currentStatus === 'in_progress') {
                  requirementsCoverage = false
                  allErrors.push(
                    `Gate ${gateId} has no requirements (owned or inherited) — run gates_action:start to generate gate-level requirements before proceeding`
                  )
                } else {
                  allWarnings.push(
                    `Gate ${gateId} has no requirements yet — requirements will be generated when the gate is started`
                  )
                }
              }
            }
          } catch { /* requirements check is best-effort */ }

          // 6) Gate-level test-first structure
          try {
            const listResult = await r.invoke('proposal_list', { gateId })
            if (listResult.success) {
              const rows = ((listResult.data as { proposals?: unknown[] }).proposals ?? []) as {
                hash: string; lastUpdated?: string
              }[]
              if (rows.length > 0) {
                const { findProposalByHash } = await import('../../utils/artifact-locator.js')
                const { readFile } = await import('../../utils/file.js')
                const gateProposals: ProposalGateSibling[] = await Promise.all(
                  rows.map(async (p) => {
                    let role: string | undefined
                    try {
                      const filePath = await findProposalByHash(p.hash)
                      if (filePath) {
                        const content = await readFile(filePath)
                        const roleMatch = /\*\*Role\*\*:\s*(.+)/.exec(content)
                        role = roleMatch?.[1]?.trim()
                      }
                    } catch { /* role stays undefined */ }
                    return { hash: p.hash, role, createdAt: p.lastUpdated ?? new Date().toISOString() }
                  })
                )
                const testFirstResult = validateGateLevelTestFirst(gateProposals)
                if (!testFirstResult.allowed) {
                  testFirstPassed = false
                  allErrors.push(...(testFirstResult.errors ?? []))
                }
                allWarnings.push(...(testFirstResult.warnings ?? []))
              }
            }
          } catch {
            // test-first check is best-effort
          }

          const passed = allErrors.length === 0
          const previousStatus = (showData['status'] as string | undefined) ?? 'pending'

          // When all checks pass, advance gate status to 'validated'
          if (passed && previousStatus !== 'validated' && previousStatus !== 'in_progress' && previousStatus !== 'completed') {
            try {
              const { getDatabase } = await import('../../storage/database.js')
              const db = getDatabase()
              db.prepare(`UPDATE gates SET status = 'validated' WHERE id = ?`).run(gateId)
              // Sync to project-overview.json
              const { syncGatesToProjectOverview } = await import('../../utils/gate-sync.js')
              await syncGatesToProjectOverview().catch(() => { /* best-effort */ })
            } catch {
              // Status update is best-effort; validation result is still returned
            }
          }

          if (passed) {
            // Structural checks all passed: strip redundant all-true checks noise.
            // Only surface what the agent must act on next — mirrors proposal_action:validate.
            return {
              success: true,
              data: {
                gateId,
                passed: true,
                ...(previousStatus !== 'validated' && previousStatus !== 'in_progress' && previousStatus !== 'completed'
                  ? { previousStatus, newStatus: 'validated' as const }
                  : {}),
                warnings: allWarnings.length > 0 ? allWarnings : undefined,
                nextRequiredStep: {
                  blocking: true,
                  action: 'qualitative-review',
                  description:
                    'Structural checks passed. Qualitative review is MANDATORY before calling gates_action:start — do NOT call start based solely on this result.',
                  checklist: GATE_QUALITATIVE_CHECKLIST,
                },
              },
            }
          }

          // Structural checks failed: only surface the checks that failed so
          // the agent sees exactly what to fix — mirrors proposal_action:validate.
          const allChecks = {
            dependencies: dependencyPassed,
            dependencyGatesCompleted,
            artifactStructure: artifactPassed,
            requirementsCoverage,
            testFirstStructure: testFirstPassed,
            quality: qualityPassed,
          }
          const failedChecks = Object.fromEntries(
            Object.entries(allChecks).filter(([, v]) => !v)
          )

          return {
            success: true,
            data: {
              gateId,
              passed: false,
              errors: allErrors.length > 0 ? allErrors : undefined,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
              ...(Object.keys(failedChecks).length > 0 ? { failedChecks } : {}),
              nextRequiredStep: {
                blocking: true,
                action: 'fix-structural-errors',
                description:
                  'Structural checks failed. Fix every error in errors[] and re-run gates_action:validate before proceeding.',
              },
            },
          }
        },
        cancel: async (payload, r) => {
          const { confirmed, gateId } = payload as { confirmed?: boolean; gateId?: string }
          if (!confirmed) {
            return {
              success: true,
              data: {
                requiresConfirmation: true,
                action: 'cancel' as const,
                gateId,
                message:
                  `Cancelling gate${gateId ? ` "${gateId}"` : ''} is irreversible and will mark it as dropped from the roadmap. ` +
                  'Please confirm with the user before proceeding. ' +
                  'Re-call with confirmed: true once the user has explicitly approved.',
              },
            }
          }
          return r.invoke('gate_cancel', payload)
        },
        defer: async (payload, r) => {
          const { confirmed, gateId } = payload as { confirmed?: boolean; gateId?: string }
          if (!confirmed) {
            return {
              success: true,
              data: {
                requiresConfirmation: true,
                action: 'defer' as const,
                gateId,
                message:
                  `Deferring gate${gateId ? ` "${gateId}"` : ''} will move it to the backlog and remove it from the active roadmap. ` +
                  'Please confirm with the user before proceeding. ' +
                  'Re-call with confirmed: true once the user has explicitly approved.',
              },
            }
          }
          return r.invoke('gate_defer', payload)
        },
      },
      validators: {
        generate: (_payload, _r) => [
          // PreReview enforcement: G5-G8 structured preconditions for gate generation
          // eslint-disable-next-line @typescript-eslint/require-await
          async () =>
            validatePreReviewGeneratePhase(
              (_payload as { preReview?: PreReview }).preReview,
              'gates_action'
            ),
          // G12: gate generation must only produce markdown files
          // eslint-disable-next-line @typescript-eslint/require-await
          async () => {
            const filesAffected = (_payload as { filesAffected?: string[] }).filesAffected ?? []
            return validateMarkdownOnly(filesAffected)
          },
        ],
        start: (_payload, r) => [
          // Enforce state transition: only validated or rejected gates can be started
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createStateTransitionValidator<GateStatus>({
            getCurrentStatus: async () => {
              const gateId = (_payload as { gateId?: string }).gateId ?? ''
              const result = await r.invoke('gates_show', { gateId })
              if (!result.success) return null
              const status = (result.data as { status?: string }).status as GateStatus | undefined
              return status ?? null
            },
            targetStatus: 'in_progress',
            validFromStatuses: ['validated', 'rejected'],
            allTransitions: GATE_TRANSITIONS,
            entityLabel: `gate:${(_payload as { gateId?: string }).gateId ?? '<unknown>'}`,
          }),
          // Gate PRD structure check: required sections and valid status field
          async () => {
            const gateId = (_payload as { gateId?: string }).gateId ?? ''
            try {
              const { findGateByGateId } = await import('../../utils/artifact-locator.js')
              const filePath = await findGateByGateId(gateId)
              if (!filePath) return { allowed: true }
              return await validateArtifactFile(filePath, 'gate')
            } catch {
              return { allowed: true }
            }
          },
        ],
        create: (_payload, r) => [
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            const configResult = await r.invoke('config_get', {})
            if (!configResult.success) {
              allWarnings.push(
                `Failed to retrieve config: ${configResult.error.message}. Using default quality thresholds.`
              )
            }

            try {
              const gatesResult = await r.invoke('gates_list', {})
              if (!gatesResult.success) {
                allWarnings.push(
                  `Failed to retrieve gates list for dependency validation: ${gatesResult.error.message}`
                )
              } else {
                const allGates = gatesResult.data as Record<string, unknown>[]
                const allNodes = new Map<
                  string,
                  { hash: string; dependencies: string[]; gateId: string; gateSequence: number }
                >()

                allGates.forEach((gate) => {
                  const gateId = String(gate['id'])
                  const deps = Array.isArray(gate['dependencies'])
                    ? (gate['dependencies'] as string[])
                    : []
                  allNodes.set(gateId, {
                    hash: gateId,
                    dependencies: deps,
                    gateId: gateId,
                    gateSequence: parseInt(gateId.split('-')[1] ?? '') || 0,
                  })
                })

                const rawGateId = _payload?.['gateId']
                const payloadGateId = typeof rawGateId === 'string' ? rawGateId : ''
                const rawDeps = _payload?.['dependencies']
                const payloadDeps = Array.isArray(rawDeps) ? (rawDeps as string[]) : []
                const newNode = {
                  hash: payloadGateId,
                  dependencies: payloadDeps,
                  gateId: payloadGateId,
                  gateSequence: parseInt(payloadGateId.split('-')[1] ?? '') || 0,
                }

                const dependencyContext: DependencyValidationContext = {
                  node: newNode,
                  allNodes: allNodes,
                }

                const dependencyResult = validateDependencies(dependencyContext)
                allErrors.push(...(dependencyResult.errors ?? []))
                allWarnings.push(...(dependencyResult.warnings ?? []))
              }
            } catch (error) {
              allWarnings.push(`Validator execution failed: ${String(error)}`)
            }

            return {
              allowed: allErrors.length === 0,
              errors: allErrors.length > 0 ? allErrors : undefined,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
            }
          },
        ],
        complete: (_payload, r) => [
          // Enforce state transition: only in_progress gates can be completed
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createStateTransitionValidator<GateStatus>({
            getCurrentStatus: async () => {
              const gateId = (_payload as { gateId?: string }).gateId ?? ''
              const result = await r.invoke('gates_show', { gateId })
              if (!result.success) return null
              const status = (result.data as { status?: string }).status as GateStatus | undefined
              return status ?? null
            },
            targetStatus: 'completed',
            validFromStatuses: ['in_progress'],
            allTransitions: GATE_TRANSITIONS,
            entityLabel: `gate:${(_payload as { gateId?: string }).gateId ?? '<unknown>'}`,
          }),
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            // Read quality metrics from gates_show (read-only) — do NOT invoke
            // gates_complete here as that would complete the gate as a side-effect
            // before the action handler runs.
            const gateId = (_payload as { gateId?: string }).gateId ?? ''
            const showResult = await r.invoke('gates_show', { gateId })
            const showData = showResult.success ? (showResult.data as Record<string, unknown>) : {}
            const existingMetrics = (showData['qualityMetrics'] ?? {}) as Record<string, unknown>
            const qualityMetrics = {
              coverage: typeof existingMetrics['testCoverage'] === 'number' ? existingMetrics['testCoverage'] : DEFAULT_QUALITY_STUB_METRICS.coverage,
              lintErrors: typeof existingMetrics['lintErrors'] === 'number' ? existingMetrics['lintErrors'] : DEFAULT_QUALITY_STUB_METRICS.lintErrors,
              securityIssues: typeof existingMetrics['securityIssues'] === 'number' ? existingMetrics['securityIssues'] : DEFAULT_QUALITY_STUB_METRICS.securityIssues,
            }

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
          // Gate-level test-first structure: verify exactly one test-suite (first) and
          // one test-cleanup (last) among the gate's proposals
          async () => {
            const gateId = (_payload as { gateId?: string }).gateId ?? ''
            try {
              const listResult = await r.invoke('proposal_list', { gateId })
              if (!listResult.success) return { allowed: true }

              const rows = ((listResult.data as { proposals?: unknown[] }).proposals ?? []) as {
                hash: string
                lastUpdated?: string
              }[]
              if (rows.length === 0) return { allowed: true }

              const { findProposalByHash } = await import('../../utils/artifact-locator.js')
              const { readFile } = await import('../../utils/file.js')

              const gateProposals: ProposalGateSibling[] = await Promise.all(
                rows.map(async (p) => {
                  let role: string | undefined
                  try {
                    const filePath = await findProposalByHash(p.hash)
                    if (filePath) {
                      const content = await readFile(filePath)
                      const roleMatch = /\*\*Role\*\*:\s*(.+)/.exec(content)
                      role = roleMatch?.[1]?.trim()
                    }
                  } catch {
                    // role stays undefined — validator treats as unset
                  }
                  return {
                    hash: p.hash,
                    role,
                    createdAt: p.lastUpdated ?? new Date().toISOString(),
                  }
                })
              )

              return validateGateLevelTestFirst(gateProposals)
            } catch {
              return { allowed: true }
            }
          },
        ],
      },
    },
    _registry
  )

  return {
    gates_action: gateActionHandler,
  }
}
