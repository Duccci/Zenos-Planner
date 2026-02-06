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
import { createSchemaValidatingHandler, parseJsonSafe } from './handler-factory.js'

export function gateHandlers(_registry?: FunctionRegistry) {
  function notImplemented(msg?: string): CallToolResult {
    const message = msg ?? 'Gate functionality not implemented yet (Gate 03-06 required).'
    return { content: [ { type: 'text', text: JSON.stringify({ error: message }, null, 2) } ], isError: true } as unknown as CallToolResult
  }

  const listHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_list', GatesListOutputSchema) : undefined
  const showHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_show', GateDetailSchema) : undefined
  const startHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_start', GatesStartOutputSchema) : undefined
  const completeHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_complete', GatesCompleteOutputSchema) : undefined
  const regenHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_regenerate', GatesRegenerateOutputSchema) : undefined

  return {
    async gates_list(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesListOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!listHandler) return notImplemented('Gates list not implemented yet.')
      return listHandler(args)
    },


    async gates_show(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GateDetailSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!showHandler) return notImplemented('Gate details not implemented yet.')
      return showHandler(args)
    },


    async gates_start(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        if (typeof raw === 'object' && (raw as any).success === false) {
          const code = String((raw as any).error?.code ?? '').toLowerCase()
          const msg = (raw as any).error?.message ?? String((raw as any).error)
          return { content: [ { type: 'text', text: JSON.stringify({ error: code || msg }, null, 2) } ], isError: true }
        }

        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesStartOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!startHandler) return notImplemented('Gate start not implemented yet.')
      return startHandler(args)
    },

    async gates_complete(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        if (typeof raw === 'object' && (raw as any).success === false) {
          return { content: [ { type: 'text', text: JSON.stringify((raw as any).error ?? {}, null, 2) } ], isError: true }
        }

        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesCompleteOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!completeHandler) return notImplemented('Gate completion not implemented yet.')
      return completeHandler(args)
    },

    async gates_regenerate(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesRegenerateOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!regenHandler) return notImplemented('Gates regenerate not implemented yet.')
      return regenHandler(args)
    }
  }
}
