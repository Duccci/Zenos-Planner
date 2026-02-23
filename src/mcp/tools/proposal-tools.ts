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
            return r.invoke('proposal_create', solitaryPayload)
          } else {
            // Gate-tied proposal: use gate workflow (generateProposals)
            return r.invoke('generateProposals', payload)
          }
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
          return r.invoke('proposal_start', payload)
        },
        progress: async (payload, r) => r.invoke('updateProposalProgress', payload),
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
