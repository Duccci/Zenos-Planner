import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { FunctionRegistry } from '../../integration/function-registry.js'

// Template schemas: use passthrough object so MCP SDK normalizeObjectSchema resolves
// correctly (z.any() has def.type='any' → normalizeObjectSchema returns undefined → _zod TypeError).
export const templateToolDefinitions = [
  {
    name: 'template_action',
    description:
      'Manage templates. Actions: list (browse all templates by category), get (retrieve a specific template by name; needs: name; optional: includeContext for LLM metadata).',
    inputSchema: z.looseObject({
      action: z.enum(['list', 'get']),
      name: z.string().optional(),
      includeContext: z.boolean().optional(),
    }),
  },
]

import { createDiscoveryService } from '../../generation/artifact-discovery-service.js'

const discovery = createDiscoveryService(process.cwd())

async function handleList(): Promise<CallToolResult> {
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
}

async function handleGet(
  nameVal: unknown,
  includeContextVal: unknown
): Promise<CallToolResult> {
  if (typeof nameVal !== 'string' || nameVal.length === 0) {
    return {
      content: [{ type: 'text', text: 'Error: template name is required for action "get"' }],
      isError: true,
    }
  }

  try {
    const name = nameVal
    const includeContext = includeContextVal === true || includeContextVal === 'true'
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
    if (includeContext) {
      const context = `Name: ${name}\nArtifact: ${artifactStr}`
      return {
        content: [{ type: 'text', text: context }],
        structuredContent: { context, artifact },
      }
    }
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
}

export function templateHandlers(
  _registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    template_action: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const action = args['action']
      if (action === 'list') {
        return handleList()
      }
      if (action === 'get') {
        return handleGet(args['name'], args['includeContext'])
      }
      return {
        content: [
          {
            type: 'text',
            text: `Error: unknown action "${String(action)}". Valid actions: list, get`,
          },
        ],
        isError: true,
      }
    },
  }
}
