import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { FunctionRegistry } from '../../integration/function-registry.js'

// Template schemas are provided by template subsystem; default to loose input schema
export const templateToolDefinitions = [
  {
    name: 'template_list',
    description: 'List templates by category',
    inputSchema: z.any(),
  },
  {
    name: 'template_get',
    description: 'Get template content with metadata',
    inputSchema: z.any(),
  },
  {
    name: 'template_context',
    description: 'Prepare template context for LLM',
    inputSchema: z.any(),
  },
]

import { createDiscoveryService } from '../../generation/artifact-discovery-service.js'

const discovery = createDiscoveryService(process.cwd())

export function templateHandlers(
  _registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    template_list: async (_args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const templates = await discovery.getTemplates()
        return {
          content: [{ type: 'text', text: JSON.stringify({ templates }, null, 2) }],
          structuredContent: { templates },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const payload = { code: 'INTERNAL_ERROR', message, timestamp: new Date().toISOString() }
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: { error: payload },
          isError: true,
        }
      }
    },

    template_get: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const nameVal = args['name']
      if (typeof nameVal !== 'string' || nameVal.length === 0) {
        return {
          content: [{ type: 'text', text: 'Error: template name is required' }],
          isError: true,
        }
      }

      try {
        const name = nameVal
        const artifact = await discovery.getArtifact('template', name)
        if (!artifact) {
          const payload = {
            code: 'NOT_FOUND',
            message: `Template not found: ${name}`,
            timestamp: new Date().toISOString(),
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            structuredContent: { error: payload },
            isError: true,
          }
        }
        const artifactStr = JSON.stringify(artifact, null, 2)
        return { content: [{ type: 'text', text: artifactStr }], structuredContent: { artifact } }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const payload = { code: 'INTERNAL_ERROR', message, timestamp: new Date().toISOString() }
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: { error: payload },
          isError: true,
        }
      }
    },

    template_context: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const nameVal = args['name']
      if (typeof nameVal !== 'string' || nameVal.length === 0) {
        return {
          content: [{ type: 'text', text: 'Error: template name is required' }],
          isError: true,
        }
      }

      try {
        const name = nameVal
        const artifact = await discovery.getArtifact('template', name)
        if (!artifact) {
          const payload = {
            code: 'NOT_FOUND',
            message: `Template not found: ${name}`,
            timestamp: new Date().toISOString(),
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            structuredContent: { error: payload },
            isError: true,
          }
        }
        const artifactStr = JSON.stringify(artifact, null, 2)
        const context = `Name: ${name}\nArtifact: ${artifactStr}`
        return {
          content: [{ type: 'text', text: context }],
          structuredContent: { context, artifact },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const payload = { code: 'INTERNAL_ERROR', message, timestamp: new Date().toISOString() }
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: { error: payload },
          isError: true,
        }
      }
    },
  }
}
