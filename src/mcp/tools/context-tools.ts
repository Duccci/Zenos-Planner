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
    description: `Get compact working context for any Zeno entity from the registry database.

Actions: gate (needs: gateId or hash), proposal (needs: hash), requirement (needs: hash), repository (needs: hash or name).

Use context_action:gate to get gate objectives, linked proposals, and requirements in a single call.
Use context_action:proposal to get proposal details, parent gate, requirements, and dependencies.
Use context_action:requirement to resolve a requirement hash to its full details.
Use context_action:repository to resolve a repository hash or name to its full details.

This replaces both loading full PRD or architecture documents during execution and the former show_entity tool.
Pass hash alone (without specifying action) to auto-resolve any entity type by hash.

operationMode: Declare the current phase.
- 'execution' (default): DB-only context. Use during proposal implementation. Do NOT load PRD or STRUCTURE.md.
- 'planning': Adds _planningContext with paths to zeno/overview/PROJECT_PRD.md and zeno/overview/STRUCTURE.md. Use only during gate generation or proposal generation workflows.`,
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
