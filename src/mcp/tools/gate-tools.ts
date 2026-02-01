import {
  GatesListInputSchema,
  GatesShowInputSchema,
  GatesStartInputSchema,
  GatesCompleteInputSchema,
  GatesRegenerateInputSchema
} from '../schemas/gate-schemas.js'

/**
 * Gate tool metadata for registration and documentation
 */
export const gateToolDefinitions = [
  {
    name: 'gates_list',
    title: 'Gates List',
    description: 'List all project gates (optional status filter)',
    inputSchema: GatesListInputSchema
  },
  {
    name: 'gates_show',
    title: 'Gate Show',
    description: 'Show detailed gate information for a gate id',
    inputSchema: GatesShowInputSchema
  },
  {
    name: 'gates_start',
    title: 'Gate Start',
    description: 'Start a gate (transition to in_progress)',
    inputSchema: GatesStartInputSchema
  },
  {
    name: 'gates_complete',
    title: 'Gate Complete',
    description: 'Complete a gate with optional completion notes',
    inputSchema: GatesCompleteInputSchema
  },
  {
    name: 'gates_regenerate',
    title: 'Gates Regenerate',
    description: 'Regenerate future gates or check for suggestions',
    inputSchema: GatesRegenerateInputSchema
  }
]

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { GatesListOutputSchema, GateDetailSchema, GatesStartOutputSchema, GatesCompleteOutputSchema, GatesRegenerateOutputSchema } from '../schemas/gate-schemas.js'

function parseJsonSafe(input: unknown) {
  try { return typeof input === 'string' ? JSON.parse(input) : input } catch { return null }
}

export function gateHandlers(registry: FunctionRegistry) {
  return {
    async gates_list(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('gates_list', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = GatesListOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String((result.data as any).output ?? result.data) } ], structuredContent: { output: String((result.data as any).output ?? result.data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async gates_show(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('gates_show', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = GateDetailSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String((result.data as any).output ?? result.data) } ], structuredContent: { output: String((result.data as any).output ?? result.data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async gates_start(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('gates_start', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = GatesStartOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String((result.data as any).output ?? result.data) } ], structuredContent: { output: String((result.data as any).output ?? result.data) } }
      }
      const code = String(result.error?.code ?? '').toLowerCase()
      const msg = result.error?.message ?? String(result.error)
      return { content: [ { type: 'text', text: JSON.stringify({ error: code || msg }, null, 2) } ], isError: true }
    },

    async gates_complete(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('gates_complete', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = GatesCompleteOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String((result.data as any).output ?? result.data) } ], structuredContent: { output: String((result.data as any).output ?? result.data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async gates_regenerate(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('gates_regenerate', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = GatesRegenerateOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String((result.data as any).output ?? result.data) } ], structuredContent: { output: String((result.data as any).output ?? result.data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    }
  }
}
