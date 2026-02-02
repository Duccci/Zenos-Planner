import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ReposListOutputSchema, RepositoryDependencyGraphSchema, ReposDetectOutputSchema, ReposAdjustOutputSchema } from '../schemas/repository-schemas.js'

export const repositoryToolDefinitions = [
  {
    name: 'repos_list',
    title: 'Repositories List',
    description: 'List detected repositories and boundaries',
    inputSchema: {} as any
  },
  {
    name: 'repos_deps',
    title: 'Repositories Dependencies',
    description: 'Show repository dependency graph',
    inputSchema: {} as any
  },
  {
    name: 'repos_detect',
    title: 'Repositories Detect',
    description: 'Detect repository boundaries by analyzing code',
    inputSchema: {} as any
  },
  {
    name: 'repos_adjust',
    title: 'Repositories Adjust',
    description: 'Manually adjust detected repository boundaries',
    inputSchema: {} as any
  }
]

function parseJsonSafe(input: unknown) {
  try {
    return typeof input === 'string' ? JSON.parse(input) : input
  } catch {
    return null
  }
}

export function repositoryHandlers(registry: FunctionRegistry) {
  return {
    async repos_list(_args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('repos_list')
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          // Validate against schema
          const parsedOk = ReposListOutputSchema.safeParse(parsed)
          if (parsedOk.success) {
            return { content: [ { type: 'text', text: JSON.stringify(parsedOk.data, null, 2) } ], structuredContent: parsedOk.data }
          }
        }

        // Fallback: return raw output
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      } else {
        // Provide helpful guidance when backend is not implemented
        const msg = result.error?.message?.includes('Unknown command')
          ? 'Repository analysis not implemented yet (Gate 05 required). Please run repo detection after Gate 05 implementation.'
          : result.error?.message ?? String(result.error)
        return { content: [ { type: 'text', text: JSON.stringify({ error: msg }, null, 2) } ], isError: true }
      }
    },

    async repos_deps(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('repos_deps', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const parsedOk = RepositoryDependencyGraphSchema.safeParse(parsed)
          if (parsedOk.success) {
            return { content: [ { type: 'text', text: JSON.stringify(parsedOk.data, null, 2) } ], structuredContent: parsedOk.data }
          }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      } else {
        const msg = result.error?.message?.includes('Unknown command')
          ? 'Repository dependency analysis not implemented yet (Gate 05 required).' : result.error?.message ?? String(result.error)
        return { content: [ { type: 'text', text: JSON.stringify({ error: msg }, null, 2) } ], isError: true }
      }
    },

    async repos_detect(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('repos_detect', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const parsedOk = ReposDetectOutputSchema.safeParse(parsed)
          if (parsedOk.success) {
            return { content: [ { type: 'text', text: JSON.stringify(parsedOk.data, null, 2) } ], structuredContent: parsedOk.data }
          }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      } else {
        const msg = result.error?.message?.includes('Unknown command')
          ? 'Repository detection not implemented yet (Gate 05 required).' : result.error?.message ?? String(result.error)
        return { content: [ { type: 'text', text: JSON.stringify({ error: msg }, null, 2) } ], isError: true }
      }
    },

    async repos_adjust(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('repos_adjust', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const parsedOk = ReposAdjustOutputSchema.safeParse(parsed)
          if (parsedOk.success) {
            return { content: [ { type: 'text', text: JSON.stringify(parsedOk.data, null, 2) } ], structuredContent: parsedOk.data }
          }
        }
        return { content: [ { type: 'text', text: JSON.stringify(data, null, 2) } ], structuredContent: data }
      } else {
        return { content: [ { type: 'text', text: JSON.stringify(result.error, null, 2) } ], isError: true }
      }
    }
  }
}
