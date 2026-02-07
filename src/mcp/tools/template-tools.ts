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

import { createDiscoveryService } from '../../generation/artifact-discovery-service.js'

const discovery = createDiscoveryService(process.cwd())

export function templateHandlers(_registry: FunctionRegistry) {
  return {
    template_list: async (_args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const templates = await discovery.getTemplates()
        return {
          content: [{ type: 'text', text: JSON.stringify({ templates }, null, 2) }],
          structuredContent: { templates }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const payload = { code: 'INTERNAL_ERROR', message, timestamp: new Date().toISOString() }
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: { error: payload }, isError: true }
      }
    },

    template_get: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const validated = args || {}
      if (!validated['name']) {
        return { content: [ { type: 'text', text: 'Error: template name is required' } ], isError: true }
      }

      try {
        const name = String(validated['name'])
        const artifact = await discovery.getArtifact('template', name)
        if (!artifact) {
          const payload = { code: 'NOT_FOUND', message: `Template not found: ${name}`, timestamp: new Date().toISOString() }
          return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: { error: payload }, isError: true }
        }
        const content = (artifact as any).content ?? ''
        return { content: [{ type: 'text', text: String(content) }], structuredContent: { content: String(content) } }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const payload = { code: 'INTERNAL_ERROR', message, timestamp: new Date().toISOString() }
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: { error: payload }, isError: true }
      }
    },

    template_context: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const validated = args || {}
      if (!validated['name']) {
        return { content: [ { type: 'text', text: 'Error: template name is required' } ], isError: true }
      }

      try {
        const name = String(validated['name'])
        const artifact = await discovery.getArtifact('template', name)
        if (!artifact) {
          const payload = { code: 'NOT_FOUND', message: `Template not found: ${name}`, timestamp: new Date().toISOString() }
          return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: { error: payload }, isError: true }
        }
        const content = (artifact as any).content ?? ''
        const context = `Name: ${name}\nCategory: ${ (artifact as any).category || 'unknown' }\n\n${content}`
        return { content: [{ type: 'text', text: String(context) }], structuredContent: { context: String(context) } }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const payload = { code: 'INTERNAL_ERROR', message, timestamp: new Date().toISOString() }
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: { error: payload }, isError: true }
      }
    }
  }
}

