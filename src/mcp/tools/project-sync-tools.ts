/**
 * Project Sync Tool Definitions and Handlers
 *
 * MCP tool for multi-repo submodule synchronization.
 * Actions: status, commit, propagate, full.
 */

import type { FunctionRegistry } from '../../integration/function-registry.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { syncStatus, syncCommit, syncPropagate, syncFull, syncDiff } from '../../core/project-sync-service.js'
import { ProjectSyncActionInputSchema } from '../schemas/project-sync-schemas.js'
import { getWorkspaceRoot, findProjectRoot } from '../../utils/config.js'

export const projectSyncToolDefinitions = [
  {
    name: 'project_sync',
    description:
      'Multi-repo submodule synchronization. Actions: status (report submodule pin state across consumers), commit (commit pending changes in core repo), propagate (update submodule pointer in consumer repos and commit), full (commit + propagate), diff (show file-level changes between core HEAD and each consumer\'s pinned submodule commit). Discovers consumer repos via repos_action registry or filesystem .gitmodules fallback.',
    inputSchema: ProjectSyncActionInputSchema,
  },
]

/**
 * Attempt to get registry consumers from repos_action:list.
 * Returns undefined if registry is unavailable.
 */
async function getRegistryConsumers(
  registry: FunctionRegistry,
  projectRoot: string,
): Promise<{ name: string; path: string }[] | undefined> {
  try {
    const result = await registry.invoke<{
      repositories: { name: string; path: string }[]
    }>('repos_list', { projectRoot })
    if (result.success) {
      return result.data.repositories
    }
  } catch {
    // Registry unavailable, fall back to filesystem discovery
  }
  return undefined
}

export function projectSyncHandlers(
  registry: FunctionRegistry,
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  return {
    project_sync: async (args) => {
      const parsed = ProjectSyncActionInputSchema.parse(args)
      const action = parsed.action
      const projectRoot = findProjectRoot() ?? getWorkspaceRoot()

      try {
        const registryConsumers = await getRegistryConsumers(registry, projectRoot)

        if (action === 'status') {
          const result = await syncStatus({
            repos: parsed.repos,
            projectRoot,
            registryConsumers,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        }

        if (action === 'diff') {
          const result = await syncDiff({
            repos: parsed.repos,
            detailed: parsed.detailed,
            projectRoot,
            registryConsumers,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        }

        if (action === 'commit') {
          if (!parsed.message) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: 'message is required for commit action',
                  }),
                },
              ],
              isError: true,
            }
          }
          const result = await syncCommit({
            message: parsed.message,
            scope: parsed.scope,
            push: parsed.push,
            tag: parsed.tag,
            projectRoot,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        }

        if (action === 'propagate') {
          const result = await syncPropagate({
            commitHash: parsed.commitHash,
            repos: parsed.repos,
            commitMessage: parsed.commitMessage,
            push: parsed.push,
            dryRun: parsed.dryRun,
            force: parsed.force,
            projectRoot,
            registryConsumers,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        }

        // action === 'full' (only remaining enum value)
        {
          if (!parsed.message) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: 'message is required for full action',
                  }),
                },
              ],
              isError: true,
            }
          }
          const result = await syncFull({
            message: parsed.message,
            scope: parsed.scope,
            push: parsed.push,
            tag: parsed.tag,
            commitHash: parsed.commitHash,
            repos: parsed.repos,
            commitMessage: parsed.commitMessage,
            dryRun: parsed.dryRun,
            force: parsed.force,
            projectRoot,
            registryConsumers,
          })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown project_sync action: ${action}` }),
            },
          ],
          isError: true,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        }
      }
    },
  }
}
