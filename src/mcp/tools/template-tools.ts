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

import { createBasicHandler } from './handler-factory.js'

export function templateHandlers(registry: FunctionRegistry) {
  const templateListHandler = createBasicHandler(registry, 'template_list')
  const templateGetHandler = createBasicHandler(registry, 'template_get')
  const templateContextHandler = createBasicHandler(registry, 'template_context')

  return {
    template_list: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      // Prefer JSON output for reliable parsing
      const invokeArgs = { ...(args || {}), format: 'json' }
      const res = await templateListHandler(invokeArgs)
      if (res.isError) return res

      const rawOutput = (res.structuredContent && (res.structuredContent as any).output) ?? ''
      let templates: Array<Record<string, unknown>> = []

      if (typeof rawOutput === 'string') {
        try {
          const parsed = JSON.parse(rawOutput)
          if (Array.isArray(parsed)) templates = parsed
          else if (parsed && Array.isArray((parsed as any).templates)) templates = (parsed as any).templates
        } catch {
          templates = [{ name: 'unknown', description: String(rawOutput) }]
        }
      } else if (Array.isArray(rawOutput)) {
        templates = rawOutput as any
      } else if (res.structuredContent && Array.isArray((res.structuredContent as any).templates)) {
        templates = (res.structuredContent as any).templates
      }

      return {
        content: [ { type: 'text', text: JSON.stringify({ templates }, null, 2) } ],
        structuredContent: { templates }
      }
    },

    template_get: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const validated = args || {}
      if (!validated['name']) {
        return { content: [ { type: 'text', text: 'Error: template name is required' } ], isError: true }
      }

      const res = await templateGetHandler(validated)
      if (res.isError) return res

      const rawOutput = (res.structuredContent && (res.structuredContent as any).output) ?? ''
      return {
        content: [ { type: 'text', text: String(rawOutput) } ],
        structuredContent: { content: String(rawOutput) }
      }
    },

    template_context: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const validated = args || {}
      if (!validated['name']) {
        return { content: [ { type: 'text', text: 'Error: template name is required' } ], isError: true }
      }

      const res = await templateContextHandler(validated)
      if (res.isError) return res

      const rawOutput = (res.structuredContent && (res.structuredContent as any).output) ?? ''
      return {
        content: [ { type: 'text', text: String(rawOutput) } ],
        structuredContent: { context: String(rawOutput) }
      }
    }
  }
}

