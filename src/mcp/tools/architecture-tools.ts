import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  ArchitectureActionInputSchema,
  ArchGenerateOutputSchema,
  ArchShowOutputSchema,
} from '../schemas/architecture-action-schemas.js'

/**
 * Architecture tool definitions for consolidated arch_action
 */
export const architectureToolDefinitions = [
  {
    name: 'arch_action',
    description: `Unified architecture diagram management.

Actions: generate (generate all architecture diagrams), show (display specific diagram type).

Call this tool when: you need to generate or retrieve architecture diagrams for the project.`,
    inputSchema: ArchitectureActionInputSchema,
  },
]

export function architectureHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    arch_action: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const validated = ArchitectureActionInputSchema.parse(args)

        // Route to appropriate function based on action
        if (validated.action === 'generate') {
          return await handleArchGenerate(registry)
        }

        return await handleArchShow(registry, validated.payload)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
          structuredContent: { error: { message } },
          isError: true,
        }
      }
    },
  }
}

/**
 * Handle arch_generate action
 */
async function handleArchGenerate(registry: FunctionRegistry): Promise<CallToolResult> {
  try {
    const result = await registry.invoke('arch_generate', {})

    if (result.success) {
      const data = result.data as Record<string, unknown>
      const validated = ArchGenerateOutputSchema.parse(data)

      return {
        content: [{ type: 'text', text: JSON.stringify(validated, null, 2) }],
        structuredContent: validated,
      }
    } else {
      const error = result.error
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: error.message || 'Failed to generate architecture diagrams' },
              null,
              2
            ),
          },
        ],
        structuredContent: { error },
        isError: true,
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
      structuredContent: { error: { message } },
      isError: true,
    }
  }
}

/**
 * Handle arch_show action
 */
async function handleArchShow(
  registry: FunctionRegistry,
  payload: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  try {
    const diagramType = payload?.['type']
    if (typeof diagramType !== 'string' || diagramType.length === 0) {
      return {
        content: [{ type: 'text', text: 'Error: diagram type is required' }],
        isError: true,
      }
    }

    const result = await registry.invoke('arch_show', { type: diagramType })

    if (result.success) {
      const data = result.data as Record<string, unknown>
      const validated = ArchShowOutputSchema.parse(data)

      return {
        content: [{ type: 'text', text: JSON.stringify(validated, null, 2) }],
        structuredContent: validated,
      }
    } else {
      const error = result.error
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: error.message || `Failed to retrieve architecture diagram: ${diagramType}` },
              null,
              2
            ),
          },
        ],
        structuredContent: { error },
        isError: true,
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
      structuredContent: { error: { message } },
      isError: true,
    }
  }
}
