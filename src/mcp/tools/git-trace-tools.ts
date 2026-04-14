import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { GitTraceInputSchema, GitTraceOutputSchema } from '../schemas/git-trace-schemas.js'
import { normalizeHash } from '../../utils/normalize.js'

/**
 * Git trace tool definitions
 */
export const gitTraceToolDefinitions = [
  {
    name: 'git_trace',
    description: `Trace git commits for artifacts. Inputs: artifactHash (required), optional dateRange, branch, limit, dir. Use to link commits to gates, proposals, or requirements.`,
    inputSchema: GitTraceInputSchema,
  },
]

/**
 * Git trace tool handler
 */
export function gitTraceHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    git_trace: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        // Normalize artifactHash: strip leading '#' so tool works with or without it
        const normalizedArgs = { ...args }
        if (typeof normalizedArgs['artifactHash'] === 'string') {
          normalizedArgs['artifactHash'] = normalizeHash(normalizedArgs['artifactHash'] as string)
        }
        const validated = GitTraceInputSchema.parse(normalizedArgs)

        const result = await registry.invoke('git_trace', validated)

        if (result.success) {
          const data = result.data as Record<string, unknown>
          const validated_output = GitTraceOutputSchema.parse(data)

          return {
            content: [{ type: 'text', text: JSON.stringify(validated_output, null, 2) }],
          }
        } else {
          const error = result.error
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { error: error.message || 'Failed to trace git history' },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const errorPayload = { error: { message } }
        return {
          content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }],
          isError: true,
          structuredContent: errorPayload,
        }
      }
    },
  }
}
