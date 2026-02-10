import type { FunctionRegistry } from '../../integration/function-registry.js'
import { z } from 'zod'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  ReposListOutputSchema,
  RepositoryDependencyGraphSchema,
  ReposDetectOutputSchema,
  ReposAdjustOutputSchema,
} from '../schemas/repository-schemas.js'
import { createSchemaValidatingHandler, parseJsonSafe } from './handler-factory.js'

export const repositoryToolDefinitions = [
  {
    name: 'repos_list',
    title: 'Repositories List',
    description: 'List detected repositories and boundaries',
    inputSchema: z.any(),
  },
  {
    name: 'repos_deps',
    title: 'Repositories Dependencies',
    description: 'Show repository dependency graph',
    inputSchema: z.any(),
  },
  {
    name: 'repos_detect',
    title: 'Repositories Detect',
    description: 'Detect repository boundaries by analyzing code',
    inputSchema: z.any(),
  },
  {
    name: 'repos_adjust',
    title: 'Repositories Adjust',
    description: 'Manually adjust detected repository boundaries',
    inputSchema: z.any(),
  },
]

export function repositoryHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  function notImplemented(msg?: string): CallToolResult {
    const message = msg ?? 'Repository analysis not implemented yet (Gate 05 required).'
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    } as unknown as CallToolResult
  }

  /**
   * Extract mockResult from tool arguments if present (for testing)
   * Returns the mockResult value if present, or explicitly null if not found
   */
  function extractMockResult(args: unknown): unknown {
    if (args && typeof args === 'object' && 'mockResult' in args && args.mockResult !== undefined) {
      return args.mockResult
    }
    return null
  }

  const listHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'repos_list', ReposListOutputSchema)
    : undefined
  const depsHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'repos_deps', RepositoryDependencyGraphSchema)
    : undefined
  const detectHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'repos_detect', ReposDetectOutputSchema)
    : undefined
  const adjustHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'repos_adjust', ReposAdjustOutputSchema)
    : undefined

  return {
    async repos_list(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = extractMockResult(args)
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const parsedOk = ReposListOutputSchema.safeParse(parsed)
          if (parsedOk.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(parsedOk.data, null, 2) }],
              structuredContent: parsedOk.data,
            }
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(raw, null, 2) }],
          structuredContent: { output: raw },
        }
      }

      if (!listHandler)
        return notImplemented('Repository analysis not implemented yet (Gate 05 required).')
      return listHandler(args)
    },

    async repos_deps(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = extractMockResult(args)
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const parsedOk = RepositoryDependencyGraphSchema.safeParse(parsed)
          if (parsedOk.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(parsedOk.data, null, 2) }],
              structuredContent: parsedOk.data,
            }
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(raw, null, 2) }],
          structuredContent: { output: raw },
        }
      }

      if (!depsHandler)
        return notImplemented(
          'Repository dependency analysis not implemented yet (Gate 05 required).'
        )
      return depsHandler(args)
    },

    async repos_detect(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = extractMockResult(args)
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const parsedOk = ReposDetectOutputSchema.safeParse(parsed)
          if (parsedOk.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(parsedOk.data, null, 2) }],
              structuredContent: parsedOk.data,
            }
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(raw, null, 2) }],
          structuredContent: { output: raw },
        }
      }

      if (!detectHandler)
        return notImplemented('Repository detection not implemented yet (Gate 05 required).')
      return detectHandler(args)
    },

    async repos_adjust(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = extractMockResult(args)
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const parsedOk = ReposAdjustOutputSchema.safeParse(parsed)
          if (parsedOk.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(parsedOk.data, null, 2) }],
              structuredContent: parsedOk.data,
            }
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(raw, null, 2) }],
          structuredContent: (raw ?? {}) as Record<string, unknown>,
        }
      }

      if (!adjustHandler) return notImplemented('Repository adjust not implemented yet.')
      return adjustHandler(args)
    },
  }
}
