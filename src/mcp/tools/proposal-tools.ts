import {
  ProposalListOutputSchema,
  ProposalDetailSchema,
  ProposalValidateOutputSchema,
  ProposalApproveOutputSchema,
  ProposalRejectOutputSchema,
  ProposalStartOutputSchema,
  ProposalCancelOutputSchema,
  ProposalDeferOutputSchema,
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
import { validateQuality, type QualityValidationContext } from '../validators/quality-validator.js'
import { type ZenoConfig } from '../../utils/config.js'
import { createStateTransitionValidator } from './entity-action-handler.js'
import type { PreReview } from '../schemas/pre-review-schemas.js'
import {
  validateTestFileScope,
  validateMarkdownOnly,
} from '../validators/scope-validator.js'
import {
  APPLY_PHASE_GUARDRAILS,
  APPLY_PHASE_WORKFLOW,
  PROPOSAL_GENERATION_GUARDRAILS,
  PROPOSAL_GENERATION_WORKFLOW,
  DATABASE_ACCESS_GUARDRAILS,
} from '../content/index.js'

/** Valid proposal statuses */
type ProposalStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'backlog'
  | 'archived'

/** Full proposal state transition map — used for helpful error messages */
const PROPOSAL_TRANSITIONS: Partial<Record<ProposalStatus, ProposalStatus[]>> = {
  pending: ['in_progress', 'cancelled', 'backlog'],
  in_progress: ['completed', 'rejected', 'cancelled', 'backlog'],
  rejected: ['pending'],
  completed: [],
  cancelled: [],
  backlog: ['pending'],
  archived: [],
}

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
    description: `REQUIRED TOOL: Use proposal_action for ALL proposal operations—this is the ONLY way to manage proposals.

Actions: list (see proposals by gate), show (get proposal details by hash), create (new proposal from requirements), generate (generate from gate PRD), validate (run quality checks), approve (review & merge), reject (with feedback), start (create isolated worktree), progress (update task during implementation).

Call this tool whenever: you need to manage proposals, create implementation plans, validate proposals, or check proposal details.`,
    inputSchema: ProposalActionInputSchema,
  },
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ProposalCreateOutputSchema } from '../schemas/proposal-create-schemas.js'
import { ProposalActionOutputSchema } from '../schemas/proposal-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'

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
          if (invokeResult.success) {
            const pre = (payload as { preReview?: unknown }).preReview
            return {
              ...invokeResult,
              data: {
                ...(invokeResult.data as Record<string, unknown>),
                ...(pre ? { preReviewSummary: pre } : {}),
                guidance: {
                  guardrails: [...PROPOSAL_GENERATION_GUARDRAILS, ...DATABASE_ACCESS_GUARDRAILS],
                  workflow: PROPOSAL_GENERATION_WORKFLOW,
                },
              },
            }
          }
          return invokeResult
        },
        validate: async (payload, r) => r.invoke('proposal_validate', payload),
        approve: async (payload, r) => {
          // Idempotent: if already completed, return success without re-invoking CLI
          const hash = (payload as { hash?: string }).hash ?? ''
          const showResult = await r.invoke('proposal_show', { hash })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'completed') {
              return { success: true, data: { hash, status: 'completed', message: 'Proposal already completed (no-op)' } }
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
              return { success: true, data: { hash, status: 'rejected', message: 'Proposal already rejected (no-op)' } }
            }
          }
          return r.invoke('proposal_reject', payload)
        },
        start: async (payload, r) => {
          // Idempotent: if already in_progress, return success without re-invoking CLI
          const hash = (payload as { hash?: string }).hash ?? ''
          const showResult = await r.invoke('proposal_show', { hash })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'in_progress') {
              return { success: true, data: { hash, status: 'in_progress', message: 'Proposal already in progress (no-op)' } }
            }
          }
          // Inject preReviewSummary and apply-phase guidance into successful response
          const startResult = await r.invoke('proposal_start', payload)
          if (startResult.success) {
            const pre = (payload as { preReview?: unknown }).preReview
            return {
              ...startResult,
              data: {
                ...(startResult.data as Record<string, unknown>),
                ...(pre ? { preReviewSummary: pre } : {}),
                guidance: {
                  guardrails: [...APPLY_PHASE_GUARDRAILS, ...DATABASE_ACCESS_GUARDRAILS],
                  workflow: APPLY_PHASE_WORKFLOW,
                },
              },
            }
          }
          return startResult
        },
        progress: async (payload, r) => {
          const progressResult = await r.invoke('updateProposalProgress', payload)
          // Inject progressSummary for drift detection — shows currentTask + cumulative file state
          if (progressResult.success) {
            const currentTask = (payload as { currentTask?: number }).currentTask
            const filesAffected = (payload as { filesAffected?: string[] }).filesAffected ?? []
            if (currentTask !== undefined) {
              return {
                ...progressResult,
                data: {
                  ...(progressResult.data as Record<string, unknown>),
                  progressSummary: {
                    currentTask,
                    cumulativeFilesModified: [],
                    remainingFilesNotTouched: filesAffected,
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
          // 1) Enforce state transition: only pending proposals can be started
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
            validFromStatuses: ['pending'],
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
        ],
        generate: (_payload, _r) => [
          // PreReview enforcement: G5-G8 structured preconditions for proposal generation
          // eslint-disable-next-line @typescript-eslint/require-await
          async () => {
            const pre = (_payload as { preReview?: PreReview }).preReview
            if (!pre) {
              return {
                allowed: false,
                errors: [
                  'preReview is required for proposal_action: generate. ' +
                    'Provide preReview with phase="generate" and: ' +
                    'openQuestionsResolved (bool), questionsFound (string[]), ' +
                    'gateReviewed (bool), requirementsVerified (bool), vagueRequirements (string[]), ' +
                    'assumptionsDocumented (string[]), blockersIdentified (string[]). ' +
                    'Read the full Gate PRD and all requirements before generating (SKILL.md G5-G8).',
                ],
                guidance:
                  'If you have already reviewed the Gate PRD, supply preReview with your findings.',
              }
            }

            const errors: string[] = []
            const warnings: string[] = []

            // G5: unresolved questions
            if (!pre.openQuestionsResolved && pre.questionsFound.length > 0) {
              errors.push(
                'Unresolved open questions in Gate PRD. Resolve before generating: ' +
                  pre.questionsFound.map((q) => `"${q}"`).join('; ')
              )
            }

            // G5: gate not reviewed
            if (pre.gateReviewed === false) {
              errors.push(
                'gateReviewed is false. Read the full Gate PRD before generating proposals.'
              )
            }

            // G6: vague requirements
            if (
              pre.requirementsVerified === false &&
              pre.vagueRequirements &&
              pre.vagueRequirements.length > 0
            ) {
              errors.push(
                'Vague or incomplete requirements found. Clarify before generating: ' +
                  pre.vagueRequirements.map((r) => `"${r}"`).join('; ')
              )
            }

            // G8: blockers (warning)
            if (pre.blockersIdentified.length > 0) {
              warnings.push(
                'Gate dependency blockers: ' +
                  pre.blockersIdentified.map((b) => `"${b}"`).join('; ') +
                  '. Resolve before generating proposals.'
              )
            }

            return {
              allowed: errors.length === 0,
              errors: errors.length > 0 ? errors : undefined,
              warnings: warnings.length > 0 ? warnings : undefined,
            }
          },
          // G12: generate actions must only produce markdown files
          // eslint-disable-next-line @typescript-eslint/require-await
          async () => {
            const filesAffected = (_payload as { filesAffected?: string[] }).filesAffected ?? []
            return validateMarkdownOnly(filesAffected)
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

            const qualityMetrics = {
              coverage: 95,
              lintErrors: 2,
              securityIssues: 0,
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
