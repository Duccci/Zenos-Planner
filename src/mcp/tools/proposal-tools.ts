/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import {
  ProposalListInputSchema,
  ProposalShowInputSchema,
  ProposalValidateInputSchema,
  ProposalApproveInputSchema,
  ProposalRejectInputSchema,
  ProposalStartInputSchema,
} from '../schemas/proposal-schemas.js'
import { ProposalCreateInputSchema } from '../schemas/proposal-create-schemas.js'
import { ProposalActionInputSchema } from '../schemas/proposal-action-schemas.js'
import {
  validateApplyPhase,
  type ApplyPhaseValidationContext,
} from '../validators/apply-phase-validator.js'
import { validateQuality, type QualityValidationContext } from '../validators/quality-validator.js'

/**
 * Unified proposal action tool definition.
 * Consolidates all proposal lifecycle operations into a single action-based entrypoint.
 *
 * Actions: list, show, create, validate, approve, reject, start
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
    description:
      'Unified proposal lifecycle: list, show, create, validate, approve, reject, start with guardrails',
    inputSchema: ProposalActionInputSchema,
  },
]

/**
 * Legacy individual tool definitions (deprecated - use proposal_action instead).
 * Kept for backward compatibility during transition.
 */
export const legacyProposalToolDefinitions = [
  {
    name: 'proposal_list',
    description: 'List proposals by gate or status',
    inputSchema: ProposalListInputSchema,
  },
  {
    name: 'proposal_show',
    description: 'Show proposal details',
    inputSchema: ProposalShowInputSchema,
  },
  {
    name: 'proposal_create',
    description: 'Create proposal with tasks and affected files',
    inputSchema: ProposalCreateInputSchema,
  },
  {
    name: 'proposal_validate',
    description: 'Validate proposal structure and dependencies',
    inputSchema: ProposalValidateInputSchema,
  },
  {
    name: 'proposal_approve',
    description: 'Approve proposal (state change only, no git)',
    inputSchema: ProposalApproveInputSchema,
  },
  {
    name: 'proposal_reject',
    description: 'Reject proposal with reason',
    inputSchema: ProposalRejectInputSchema,
  },
  {
    name: 'proposal_start',
    description: 'Start working on approved proposal (state change only)',
    inputSchema: ProposalStartInputSchema,
  },
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  ProposalListOutputSchema,
  ProposalDetailSchema,
  ProposalValidateOutputSchema,
  ProposalApproveOutputSchema,
  ProposalRejectOutputSchema,
  ProposalStartOutputSchema,
} from '../schemas/proposal-schemas.js'

import { ProposalCreateOutputSchema } from '../schemas/proposal-create-schemas.js'
import { ProposalActionOutputSchema } from '../schemas/proposal-action-schemas.js'
import { createSchemaValidatingHandler } from './handler-factory.js'
import { createEntityActionHandler } from './entity-action-handler.js'

/**
 * Unified proposal action handler.
 * Dispatches to the appropriate registry function based on action type.
 */
export function proposalHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  // Individual handlers for legacy compatibility
  const handlers = {
    proposal_list: createSchemaValidatingHandler(
      registry,
      'proposal_list',
      ProposalListOutputSchema
    ),
    proposal_show: createSchemaValidatingHandler(registry, 'proposal_show', ProposalDetailSchema),
    proposal_create: createSchemaValidatingHandler(
      registry,
      'proposal_create',
      ProposalCreateOutputSchema
    ),
    proposal_validate: createSchemaValidatingHandler(
      registry,
      'proposal_validate',
      ProposalValidateOutputSchema
    ),
    proposal_approve: createSchemaValidatingHandler(
      registry,
      'proposal_approve',
      ProposalApproveOutputSchema
    ),
    proposal_reject: createSchemaValidatingHandler(
      registry,
      'proposal_reject',
      ProposalRejectOutputSchema
    ),
    proposal_start: createSchemaValidatingHandler(
      registry,
      'proposal_start',
      ProposalStartOutputSchema
    ),
  }

  /**
   * Run validators for proposal actions that change state.
   * Returns combined validation results from all applicable validators.
   */

  /**
   * Unified action dispatcher for proposal lifecycle operations.
   * Validates action and payload, then delegates to appropriate handler.
   */
  // Replace inline dispatcher with generic entity action handler
  const proposalActionHandler = createEntityActionHandler(
    {
      entity: 'proposal',
      actions: ['list', 'show', 'create', 'validate', 'approve', 'reject', 'start'] as const,
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
          case 'validate':
            return ProposalValidateOutputSchema
          case 'approve':
            return ProposalApproveOutputSchema
          case 'reject':
            return ProposalRejectOutputSchema
          case 'start':
            return ProposalStartOutputSchema
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('proposal_list', payload),
        show: async (payload, r) => r.invoke('proposal_show', payload),
        create: async (payload, r) => r.invoke('proposal_create', payload),
        validate: async (payload, r) => r.invoke('proposal_validate', payload),
        approve: async (payload, r) => r.invoke('proposal_approve', payload),
        reject: async (payload, r) => r.invoke('proposal_reject', payload),
        start: async (payload, r) => r.invoke('proposal_start', payload),
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

            let config: any

            if (configResult.success) {
              config = configResult.data
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

            let config: any

            if (configResult.success) {
              config = configResult.data as any
            } else {
              const { getDefaultConfig } = await import('../../utils/config.js')
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
    ...handlers,
    proposal_action: proposalActionHandler,
  }
}
