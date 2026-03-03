/**
 * Project Action Tool Handlers
 *
 * MCP tool handlers for project-level operations (init, status).
 * Uses the unified action handler pattern for consistency with gates_action, proposal_action, etc.
 */

import { createEntityActionHandler } from './entity-action-handler.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  ProjectActionInputSchema,
  ProjectActionOutputSchema,
  ProjectInitOutputSchema,
  ProjectStatusOutputSchema,
} from '../schemas/project-action-schemas.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Tool definitions for project action operations.
 * Exposed to LLMs via MCP.
 */
export const projectToolDefinitions = [
  {
    name: 'project_action',
    description: `Project management tool for initialization and status.

Actions: init (create new project), status (show project overview).

Use project_action: init to initialize a new Zeno project with project name and end state.
Use project_action: status to get current project status, active gates, and MCP server health.`,
    inputSchema: ProjectActionInputSchema,
  },
]

/**
 * Handlers for project action tool.
 */
export function projectHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const projectActionHandler = createEntityActionHandler(
    {
      entity: 'project',
      actions: ['init', 'status'] as const,
      inputSchema: ProjectActionInputSchema,
      outputSchema: ProjectActionOutputSchema,
      actionOutputSchema: (action) => {
        switch (action) {
          case 'init': return ProjectInitOutputSchema
          case 'status': return ProjectStatusOutputSchema
          default: throw new Error(`Unknown project action: ${String(action)}`)
        }
      },
      actionHandlers: {
        init: async (payload, r) => r.invoke('project_init', payload),
        status: async (payload, r) => r.invoke('project_status', payload),
      },
      validators: {
        // No special validators needed for project operations
        // Basic JSON schema validation is sufficient
      },
    },
    _registry
  )

  return {
    project_action: projectActionHandler,
  }
}
