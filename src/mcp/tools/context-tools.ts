/**
 * Context Action Tool Handlers
 *
 * MCP tool handlers for context_action (gate, proposal, requirement, repository).
 * Provides compact working context from the registry DB, replacing both the need
 * to load full PRD / architecture documents during execution and the old show_entity
 * tool. Resolves any entity by hash or by name/id.
 */

import { createEntityActionHandler } from './entity-action-handler.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  ContextActionInputSchema,
  ContextActionOutputSchema,
  GateContextOutputSchema,
  ProposalContextOutputSchema,
  RequirementContextOutputSchema,
  RepositoryContextOutputSchema,
} from '../schemas/context-action-schemas.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Tool definitions for context action operations.
 * Exposed to LLMs via MCP.
 */
export const contextToolDefinitions = [
  {
    name: 'context_action',
    description: `Resolve Zeno entities by hash or ID. Actions: gate (ID/hash), proposal (hash), requirement (hash), repository (hash/name). operationMode: 'execution' (DB-only), 'planning' (includes PRD paths).`,
    inputSchema: ContextActionInputSchema,
  },
]

/**
 * Handlers for context action tool.
 */
export function contextHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const contextActionHandler = createEntityActionHandler(
    {
      entity: 'context',
      actions: ['gate', 'proposal', 'requirement', 'repository'] as const,
      inputSchema: ContextActionInputSchema,
      outputSchema: ContextActionOutputSchema,
      actionOutputSchema: (action) => {
        switch (action) {
          case 'gate': return GateContextOutputSchema
          case 'proposal': return ProposalContextOutputSchema
          case 'requirement': return RequirementContextOutputSchema
          case 'repository': return RepositoryContextOutputSchema
          default: throw new Error(`Unknown context action: ${String(action)}`)
        }
      },
      actionHandlers: {
        gate: async (payload, r) => r.invoke('context_gate', payload),
        proposal: async (payload, r) => r.invoke('context_proposal', payload),
        requirement: async (payload, r) => r.invoke('context_requirement', payload),
        repository: async (payload, r) => r.invoke('context_repository', payload),
      },
    },
    _registry
  )

  return {
    context_action: contextActionHandler,
  }
}
