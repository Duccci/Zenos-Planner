import { ReqListInputSchema, ReqShowInputSchema, ReqDepsInputSchema, ReqTransferInputSchema } from '../schemas/requirement-schemas.js'

export const requirementToolDefinitions = [
  {
    name: 'req_list',
    title: 'Requirement List',
    description: 'List requirements optionally filtered by gate or type',
    inputSchema: ReqListInputSchema
  },
  {
    name: 'req_show',
    title: 'Requirement Show',
    description: 'Show requirement details by hash or id',
    inputSchema: ReqShowInputSchema
  },
  {
    name: 'req_deps',
    title: 'Requirement Dependencies',
    description: 'Get dependency graph for a requirement',
    inputSchema: ReqDepsInputSchema
  },
  {
    name: 'req_transfer',
    title: 'Requirement Transfer',
    description: 'Transfer requirement to different gate',
    inputSchema: ReqTransferInputSchema
  }
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ReqListOutputSchema, RequirementDetailSchema, DependencyGraphSchema, ReqTransferOutputSchema } from '../schemas/requirement-schemas.js'

function parseJsonSafe(input: unknown) {
  try { return typeof input === 'string' ? JSON.parse(input) : input } catch { return null }
}

export function requirementHandlers(registry: FunctionRegistry) {
  return {
    async req_list(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('req_list', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = ReqListOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async req_show(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('req_show', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = RequirementDetailSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async req_deps(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('req_deps', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = DependencyGraphSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async req_transfer(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('req_transfer', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = ReqTransferOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: JSON.stringify(data, null, 2) } ], structuredContent: data }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    }
  }
}
