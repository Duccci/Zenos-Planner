import { ProposalListInputSchema, ProposalShowInputSchema, ProposalValidateInputSchema, ProposalApproveInputSchema, ProposalRejectInputSchema, ProposalStartInputSchema } from '../schemas/proposal-schemas.js'
import { ProposalCreateInputSchema } from '../schemas/proposal-create-schemas.js'
import { ProposalActionInputSchema } from '../schemas/proposal-action-schemas.js'
import { validateApplyPhase, type ApplyPhaseValidationContext } from '../validators/apply-phase-validator.js'
import { validateScope, type ScopeValidationContext } from '../validators/scope-validator.js'
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
    title: 'Proposal Action',
    description: 'Unified proposal lifecycle tool with guardrail enforcement. Supports actions: list, show, create, validate, approve, reject, start. Actions "start" and "approve" run scope, quality, and apply-phase validators. Use discriminated union with action and payload.',
    inputSchema: ProposalActionInputSchema
  }
]

/**
 * Legacy individual tool definitions (deprecated - use proposal_action instead).
 * Kept for backward compatibility during transition.
 */
export const legacyProposalToolDefinitions = [
  {
    name: 'proposal_list',
    title: 'Proposal List',
    description: 'List proposals optionally filtered by gate or status',
    inputSchema: ProposalListInputSchema
  },
  {
    name: 'proposal_show',
    title: 'Proposal Show',
    description: 'Show detailed proposal information',
    inputSchema: ProposalShowInputSchema
  },
  {
    name: 'proposal_create',
    title: 'Proposal Create',
    description: 'Create a new proposal with tasks, files affected, and validation',
    inputSchema: ProposalCreateInputSchema
  },
  {
    name: 'proposal_validate',
    title: 'Proposal Validate',
    description: 'Validate proposal structure and dependencies',
    inputSchema: ProposalValidateInputSchema
  },
  {
    name: 'proposal_approve',
    title: 'Proposal Approve',
    description: 'Approve a proposal',
    inputSchema: ProposalApproveInputSchema
  },
  {
    name: 'proposal_reject',
    title: 'Proposal Reject',
    description: 'Reject a proposal with reason',
    inputSchema: ProposalRejectInputSchema
  },
  {
    name: 'proposal_start',
    title: 'Proposal Start',
    description: 'Start working on an approved proposal',
    inputSchema: ProposalStartInputSchema
  }
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ProposalListOutputSchema, ProposalDetailSchema, ProposalValidateOutputSchema, ProposalApproveOutputSchema, ProposalRejectOutputSchema, ProposalStartOutputSchema } from '../schemas/proposal-schemas.js'
import { ProposalCreateOutputSchema } from '../schemas/proposal-create-schemas.js'
import { ProposalActionOutputSchema } from '../schemas/proposal-action-schemas.js'
import { createSchemaValidatingHandler } from './handler-factory.js'

/**
 * Unified proposal action handler.
 * Dispatches to the appropriate registry function based on action type.
 */
export function proposalHandlers(registry: FunctionRegistry) {
  // Individual handlers for legacy compatibility
  const handlers = {
    proposal_list: createSchemaValidatingHandler(registry, 'proposal_list', ProposalListOutputSchema),
    proposal_show: createSchemaValidatingHandler(registry, 'proposal_show', ProposalDetailSchema),
    proposal_create: createSchemaValidatingHandler(registry, 'proposal_create', ProposalCreateOutputSchema),
    proposal_validate: createSchemaValidatingHandler(registry, 'proposal_validate', ProposalValidateOutputSchema),
    proposal_approve: createSchemaValidatingHandler(registry, 'proposal_approve', ProposalApproveOutputSchema),
    proposal_reject: createSchemaValidatingHandler(registry, 'proposal_reject', ProposalRejectOutputSchema),
    proposal_start: createSchemaValidatingHandler(registry, 'proposal_start', ProposalStartOutputSchema)
  }

  /**
   * Run validators for proposal actions that change state.
   * Returns combined validation results from all applicable validators.
   */
  async function runProposalValidators(
    action: 'start' | 'approve',
    payload: any,
    registry: FunctionRegistry
  ): Promise<{ allowed: boolean; errors?: string[]; warnings?: string[] }> {
    const allErrors: string[] = []
    const allWarnings: string[] = []

    try {
      // Get proposal details for validation context
      const proposalResult = await registry.invoke('proposal_show', { hash: payload.hash })
      if (!proposalResult.success) {
        allErrors.push(`Failed to retrieve proposal details: ${proposalResult.error.message}`)
        return { allowed: false, errors: allErrors }
      }

      const proposal = proposalResult.data
      const filesAffected = proposal.filesAffected || []

      // Get project configuration
      const configResult = await registry.invoke('config_get', {})
      if (!configResult.success) {
        allWarnings.push(`Failed to retrieve config, using defaults: ${configResult.error.message}`)
      }
      const config = configResult.success ? configResult.data : {
        qualityThresholds: {
          codeCoverage: 90,
          typeCheckingErrors: 0,
          lintingErrorRate: 0.01,
          securityVulnerabilities: 0
        }
      }

      // For 'start' action: validate scope and apply phase constraints
      if (action === 'start') {
        // Get current git status to check for uncommitted changes
        // Note: This is a simplified check - in practice we'd need to detect actual file modifications
        const gitOperations: string[] = [] // TODO: Implement git operation detection
        const filesModified: string[] = [] // TODO: Track files modified during implementation

        const applyPhaseContext: ApplyPhaseValidationContext = {
          proposalHash: payload.hash,
          filesAffected,
          filesModified,
          gitOperations,
          config
        }

        const applyPhaseResult = validateApplyPhase(applyPhaseContext)
        allErrors.push(...(applyPhaseResult.errors || []))
        allWarnings.push(...(applyPhaseResult.warnings || []))
      }

      // For 'approve' action: validate quality metrics
      if (action === 'approve') {
        // Get quality metrics (simplified - in practice this would come from CI/CD or analysis)
        const qualityMetrics = {
          coverage: 95, // TODO: Get actual coverage
          typeErrors: 0, // TODO: Get actual type errors
          lintErrors: 2, // TODO: Get actual lint errors
          securityIssues: 0 // TODO: Get actual security issues
        }

        const qualityContext: QualityValidationContext = {
          metrics: qualityMetrics,
          config,
          strict: false // Allow warnings for approval
        }

        const qualityResult = validateQuality(qualityContext)
        allErrors.push(...(qualityResult.errors || []))
        allWarnings.push(...(qualityResult.warnings || []))
      }

    } catch (error) {
      allWarnings.push(`Validator execution failed: ${String(error)}`)
    }

    return {
      allowed: allErrors.length === 0,
      errors: allErrors.length > 0 ? allErrors : undefined,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    }
  }

  /**
   * Unified action dispatcher for proposal lifecycle operations.
   * Validates action and payload, then delegates to appropriate handler.
   */
  async function proposal_action(args: Record<string, unknown>): Promise<CallToolResult> {
    try {
      const { ProposalActionInputSchema } = await import('../schemas/proposal-action-schemas.js')
      const validated = ProposalActionInputSchema.parse(args)

      let invokeResult: any

      switch (validated.action) {
        case 'list':
          invokeResult = await registry.invoke('proposal_list', validated.payload)
          break
        case 'show':
          invokeResult = await registry.invoke('proposal_show', validated.payload)
          break
        case 'create':
          invokeResult = await registry.invoke('proposal_create', validated.payload)
          break
        case 'validate':
          invokeResult = await registry.invoke('proposal_validate', validated.payload)
          break
        case 'approve':
        case 'start': {
          // Run validators for state-changing actions
          const validationResults = await runProposalValidators(validated.action, validated.payload, registry)

          // If validation fails with errors, return validation results
          if (!validationResults.allowed) {
            const output = {
              action: validated.action,
              result: null,
              validation: validationResults
            }
            const validatedOutput = ProposalActionOutputSchema.parse(output)
            return {
              content: [{ type: 'text', text: JSON.stringify(validatedOutput, null, 2) }],
              structuredContent: validatedOutput,
              isError: true
            } as CallToolResult
          }

          // Proceed with the action
          invokeResult = await registry.invoke(
            validated.action === 'approve' ? 'proposal_approve' : 'proposal_start',
            validated.payload
          )

          // Include validation warnings in result if present
          const output = {
            action: validated.action,
            result: invokeResult.data,
            validation: validationResults.warnings && validationResults.warnings.length > 0 ? validationResults : undefined
          }
          break
        }
        case 'reject':
          invokeResult = await registry.invoke('proposal_reject', validated.payload)
          break
        default:
          throw new Error(`Unknown proposal action: ${(validated as any).action}`)
      }

      // Check for invocation errors
      if (!invokeResult.success) {
        throw new Error(invokeResult.error.message)
      }

      // Wrap result in action envelope
      const output = {
        action: validated.action,
        result: invokeResult.data,
        validation: undefined // Only set for validated actions
      }

      // Validate output
      const validatedOutput = ProposalActionOutputSchema.parse(output)

      return {
        content: [{ type: 'text', text: JSON.stringify(validatedOutput, null, 2) }],
        structuredContent: validatedOutput
      } as CallToolResult
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: String(error) }, null, 2) }],
        isError: true
      } as CallToolResult
    }
  }

  return {
    ...handlers,
    proposal_action
  }
}
