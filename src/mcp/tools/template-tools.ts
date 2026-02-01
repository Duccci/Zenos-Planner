import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'

// Template schemas are provided by template subsystem; default to loose input schema
export const templateToolDefinitions = [
  {
    name: 'template_list',
    title: 'Template List',
    description: 'List available templates by category',
    inputSchema: {} as any
  },
  {
    name: 'template_get',
    title: 'Template Get',
    description: 'Get template content with metadata',
    inputSchema: {} as any
  },
  {
    name: 'template_context',
    title: 'Template Context',
    description: 'Prepare template context for LLM usage',
    inputSchema: {} as any
  }
]

export function templateHandlers(registry: FunctionRegistry) {
  return {
    async template_list(args: Record<string, unknown>): Promise<CallToolResult> {
      try {
        // Prefer JSON output for reliable parsing
        const invokeArgs = { ...(args || {}), format: 'json' }
        const result = await registry.invoke('template_list', invokeArgs)
        if (!result.success) {
          return {
            content: [ { type: 'text', text: JSON.stringify(result.error, null, 2) } ],
            isError: true
          }
        }

        const cmd = result.data as any
        // cmd.output expected to be JSON when format=json
        let templates = []
        try {
          templates = JSON.parse(String(cmd.output || '[]'))
        } catch (e) {
          // Fallback: treat output as plain text
          templates = [{ name: 'unknown', description: String(cmd.output || '') }]
        }

        return {
          content: [ { type: 'text', text: JSON.stringify({ templates }, null, 2) } ],
          structuredContent: { templates }
        }
      } catch (error) {
        return {
          content: [ { type: 'text', text: JSON.stringify({ error: String(error) }, null, 2) } ],
          isError: true
        }
      }
    },

    async template_get(args: Record<string, unknown>): Promise<CallToolResult> {
      try {
        const validated = args || {}
        if (!validated.name) {
          return { content: [ { type: 'text', text: 'Error: template name is required' } ], isError: true }
        }
        const result = await registry.invoke('template_get', validated)
        if (!result.success) {
          return { content: [ { type: 'text', text: JSON.stringify(result.error, null, 2) } ], isError: true }
        }
        const cmd = result.data as any
        return { content: [ { type: 'text', text: String(cmd.output || '') } ], structuredContent: { content: String(cmd.output || '') } }
      } catch (error) {
        return { content: [ { type: 'text', text: JSON.stringify({ error: String(error) }, null, 2) } ], isError: true }
      }
    },

    async template_context(args: Record<string, unknown>): Promise<CallToolResult> {
      try {
        const validated = args || {}
        if (!validated.name) {
          return { content: [ { type: 'text', text: 'Error: template name is required' } ], isError: true }
        }
        const result = await registry.invoke('template_context', validated)
        if (!result.success) {
          return { content: [ { type: 'text', text: JSON.stringify(result.error, null, 2) } ], isError: true }
        }
        const cmd = result.data as any
        return { content: [ { type: 'text', text: String(cmd.output || '') } ], structuredContent: { context: String(cmd.output || '') } }
      } catch (error) {
        return { content: [ { type: 'text', text: JSON.stringify({ error: String(error) }, null, 2) } ], isError: true }
      }
    }
  }
}

