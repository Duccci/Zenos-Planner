import { z } from 'zod'

export const configToolDefinitions = [
  {
    name: 'config_get',
    title: 'Config Get',
    description: 'Get project configuration values',
    inputSchema: z.any()
  }
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

function parseJsonSafe(input: unknown) {
  try { return typeof input === 'string' ? JSON.parse(input) : input } catch { return null }
}

export function configHandlers(registry: FunctionRegistry) {
  return {
    async config_get(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('config_get', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) return { content: [ { type: 'text', text: JSON.stringify(parsed, null, 2) } ], structuredContent: parsed }
        return { content: [ { type: 'text', text: String((result.data as any).output ?? result.data) } ], structuredContent: { output: String((result.data as any).output ?? result.data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    }
  }
}
