import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  GitTraceInputSchema,
  GitTraceOutputSchema,
  GitGetUserInputSchema,
  GitGetUserOutputSchema,
} from '../schemas/git-trace-schemas.js'

/**
 * Git tool definitions (git_trace + git_get_user)
 */
export const gitTraceToolDefinitions = [
  {
    name: 'git_trace',
    description: `Trace git commits for artifacts. Inputs: artifactHash (required), optional dateRange, branch, limit, dir. Use to link commits to gates, proposals, or requirements.`,
    inputSchema: GitTraceInputSchema,
  },
  {
    name: 'git_get_user',
    description:
      'Get the git user name and email from git config (runs `git config user.name` and `git config user.email`). Use this to identify the current developer for attribution in proposals, gates, and archives.',
    inputSchema: GitGetUserInputSchema,
  },
]

/**
 * Git tool handlers (git_trace + git_get_user)
 */
export function gitTraceHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    git_trace: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const validated = GitTraceInputSchema.parse(args)

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

    git_get_user: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const validated = GitGetUserInputSchema.parse(args)
        const result = await registry.invoke('git_get_user', validated)

        if (result.success) {
          const output = GitGetUserOutputSchema.parse(result.data)
          return {
            content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
            structuredContent: output as unknown as Record<string, unknown>,
          }
        }

        const error = result.error
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error.message || 'Failed to get git user' }, null, 2),
            },
          ],
          isError: true,
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
