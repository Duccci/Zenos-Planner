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
import { findAllZenoProjects, getWorkspaceRoot } from '../../utils/config.js'

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

      // Validate required-message actions up front so a bad payload reports
      // once instead of repeating the same error per discovered project.
      if ((action === 'commit' || action === 'full') && !parsed.message) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `message is required for ${action} action`,
              }),
            },
          ],
          isError: true,
        }
      }

      // Recursively discover every Zeno project beneath the active workspace.
      // Errors when none exist so we never silently no-op or auto-create one.
      const startDir = getWorkspaceRoot()
      const projectRoots = findAllZenoProjects(startDir)
      if (projectRoots.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `No Zeno project found at or below ${startDir}. Run \`zeno init\` to create one.`,
              }),
            },
          ],
          isError: true,
        }
      }

      const runForProject = async (projectRoot: string): Promise<unknown> => {
        const registryConsumers = await getRegistryConsumers(registry, projectRoot)

        if (action === 'status') {
          return syncStatus({
            repos: parsed.repos,
            projectRoot,
            registryConsumers,
          })
        }

        if (action === 'diff') {
          return syncDiff({
            repos: parsed.repos,
            detailed: parsed.detailed,
            projectRoot,
            registryConsumers,
          })
        }

        if (action === 'commit') {
          return syncCommit({
            message: parsed.message ?? '',
            scope: parsed.scope,
            push: parsed.push,
            tag: parsed.tag,
            projectRoot,
          })
        }

        if (action === 'propagate') {
          return syncPropagate({
            commitHash: parsed.commitHash,
            repos: parsed.repos,
            commitMessage: parsed.commitMessage,
            push: parsed.push,
            dryRun: parsed.dryRun,
            force: parsed.force,
            projectRoot,
            registryConsumers,
          })
        }

        // action === 'full'
        return syncFull({
          message: parsed.message ?? '',
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
      }

      try {
        // Single-project case preserves the original output shape for
        // backwards compatibility.
        const [firstProjectRoot] = projectRoots
        if (projectRoots.length === 1 && firstProjectRoot != null) {
          const result = await runForProject(firstProjectRoot)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          }
        }

        const results: { project: string; ok: boolean; result?: unknown; error?: string }[] = []
        for (const root of projectRoots) {
          try {
            const result = await runForProject(root)
            results.push({ project: root, ok: true, result })
          } catch (err) {
            results.push({
              project: root,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ projects: results }, null, 2) }],
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
