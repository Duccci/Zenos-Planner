/**
 * Workflow Tool Definitions & Handlers
 *
 * DEPRECATED: Workflow operations are now consolidated into unified action tools:
 * - generateGates → gates_action with 'generate' action
 * - generateProposals → proposal_action with 'generate' action
 * - updateProposalProgress → proposal_action with 'progress' action
 *
 * This file is retained for backwards compatibility with existing function registry.
 * The workflowHandlers function is kept to support legacy function registry lookups.
 */

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { generateProposals } from '../../core/proposal-generation.js'
import { updateProposalProgress } from '../../core/proposal-application.js'
import { generateGates } from '../../core/gate-generation.js'

// Tool definitions removed - see gates_action and proposal_action for current implementations
export const workflowToolDefinitions: never[] = []

export function workflowHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
  return {
    generateProposals: (args) => generateProposals(args as never),
    updateProposalProgress: (args) => updateProposalProgress(args as never),
    generateGates: (args) => generateGates(args as never),
  }
}
