import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { GitTraceInputSchema, GitTraceOutputSchema } from '../schemas/git-trace-schemas.js'

/**
 * Git trace tool definitions
 */
export const gitTraceToolDefinitions = [
  {
    name: 'git_trace',
    description: `Trace commits in git history associated with a Zeno artifact (gate, proposal, requirement).

Input: artifactHash (required) - the artifact hash to trace. Optional: dateRange, branch, limit, dir.

Output: commits array with matching records, total commit count, and search parameters used.

Call this tool when: you need to find which commits created or modified a specific artifact.`,
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
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
          isError: true,
        }
      }
    },
  }
}
