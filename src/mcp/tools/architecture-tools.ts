import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  DiagramActionInputSchema,
  DiagramActionOutputSchema,
  getDiagramActionOutputSchema,
} from '../schemas/architecture-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'

/**
 * Unified diagram_action tool definition.
 * Consolidates all architecture diagram operations into a single action-based entrypoint.
 *
 * Actions: catalogue, select, generate, show
 */
export const architectureToolDefinitions = [
  {
    name: 'diagram_action',
    description: `REQUIRED TOOL: Use diagram_action for ALL architecture diagram operations.

Actions: catalogue (list all available diagram types with metadata), select (record which conditional diagrams to generate for a gate), generate (generate diagrams for a gate or a single type), show (retrieve and display a specific diagram).

Call this tool whenever: you need to view available diagram types, choose diagrams for a gate, generate architecture diagrams, or read diagram content.`,
    inputSchema: DiagramActionInputSchema,
  },
]

export function architectureHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const archActionHandler = createEntityActionHandler(
    {
      entity: 'arch',
      actions: ['catalogue', 'select', 'generate', 'show'] as const,
      inputSchema: DiagramActionInputSchema,
      outputSchema: DiagramActionOutputSchema,
      actionOutputSchema: getDiagramActionOutputSchema,
      actionHandlers: {
        catalogue: async (_payload, r) => r.invoke('arch_catalogue', {}),
        select: async (payload, r) => r.invoke('arch_select', payload ?? {}),
        generate: async (payload, r) => r.invoke('arch_generate', payload ?? {}),
        show: async (payload, r) => {
          // arch_show registry uses `type` key, but MCP input uses `diagramType`
          const { diagramType, ...rest } = (payload ?? {}) as { diagramType?: string } & Record<string, unknown>
          return r.invoke('arch_show', { type: diagramType, ...rest })
        },
      },
    },
    registry
  )

  return {
    diagram_action: archActionHandler,
  }
}
