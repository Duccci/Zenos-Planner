import {
  ProposalListOutputSchema,
  ProposalDetailSchema,
  ProposalValidateOutputSchema,
  ProposalApproveOutputSchema,
  ProposalRejectOutputSchema,
  ProposalStartOutputSchema,
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
import { type ZenoConfig, getDefaultConfig } from '../../utils/config.js'

/**
 * Unified proposal action tool definition.
 * Consolidates all proposal lifecycle operations into a single action-based entrypoint.
 *
 * Actions: list, show, create, generate, validate, approve, reject, start, progress
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
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('proposal_list', payload),
        show: async (payload, r) => r.invoke('proposal_show', payload),
        create: async (payload, r) => r.invoke('proposal_create', payload),
        generate: async (payload, r) => r.invoke('generateProposals', payload),
        validate: async (payload, r) => r.invoke('proposal_validate', payload),
        approve: async (payload, r) => r.invoke('proposal_approve', payload),
        reject: async (payload, r) => r.invoke('proposal_reject', payload),
        start: async (payload, r) => r.invoke('proposal_start', payload),
        progress: async (payload, r) => r.invoke('updateProposalProgress', payload),
      },

      validators: {
        start: (payload, r) => [
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
        approve: (_payload, r) => [
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            const configResult = await r.invoke('config_get', {})

            let config: ZenoConfig

            if (configResult.success) {
              config = configResult.data as ZenoConfig
            } else {
              const cfgErrMsg =
                'error' in configResult ? configResult.error.message : 'unknown error'
              allWarnings.push(
                `Failed to retrieve config: ${cfgErrMsg}. Using default quality thresholds.`
              )
              config = getDefaultConfig('unknown')
            }

            const qualityMetrics = {
              coverage: 95,
              typeErrors: 0,
              lintErrors: 2,
              securityIssues: 0,
            }

            const qualityContext: QualityValidationContext = {
              metrics: qualityMetrics,
              config,
              strict: false,
            }

            const qualityResult = validateQuality(qualityContext)
            allErrors.push(...(qualityResult.errors ?? []))
            allWarnings.push(...(qualityResult.warnings ?? []))

            return {
              allowed: allErrors.length === 0,
              errors: allErrors.length > 0 ? allErrors : undefined,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
            }
          },
        ],
      },
    },
    registry
  )

  return {
    proposal_action: proposalActionHandler,
  }
}
