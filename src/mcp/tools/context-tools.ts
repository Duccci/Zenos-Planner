/**
 * Context Action Tool Handlers
 *
 * MCP tool handlers for context_action (gate, proposal).
 * Provides compact working context from the registry DB, replacing the need
 * to load full PRD / architecture documents during execution.
 */

import { createEntityActionHandler } from './entity-action-handler.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  ContextActionInputSchema,
  ContextActionOutputSchema,
  GateContextOutputSchema,
  ProposalContextOutputSchema,
} from '../schemas/context-action-schemas.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Tool definitions for context action operations.
 * Exposed to LLMs via MCP.
 */
export const contextToolDefinitions = [
  {
    name: 'context_action',
    description: `Get compact working context for a gate or proposal from the registry database.

Actions: gate (needs: gateId), proposal (needs: hash).

Use context_action:gate to get gate objectives, linked proposals, and requirements in a single call.
Use context_action:proposal to get proposal details, parent gate, requirements, and dependencies.

operationMode: Declare the current phase.
- 'execution' (default): DB-only context. Use during proposal implementation. Do NOT load PRD or STRUCTURE.md.
- 'planning': Adds _planningContext with paths to zeno/overview/PROJECT_PRD.md and zeno/overview/STRUCTURE.md. Use only during gate generation or proposal generation workflows.

This replaces loading full PRD or architecture documents during execution.`,
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
      actions: ['gate', 'proposal'] as const,
      inputSchema: ContextActionInputSchema,
      outputSchema: ContextActionOutputSchema,
      actionOutputSchema: (action) => {
        switch (action) {
          case 'gate': return GateContextOutputSchema
          case 'proposal': return ProposalContextOutputSchema
          default: throw new Error(`Unknown context action: ${String(action)}`)
        }
      },
      actionHandlers: {
        gate: async (payload, r) => r.invoke('context_gate', payload),
        proposal: async (payload, r) => r.invoke('context_proposal', payload),
      },
    },
    _registry
  )

  return {
    context_action: contextActionHandler,
  }
}
