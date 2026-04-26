/**
 * Sync Command
 *
 * CLI equivalent of the `project_sync` MCP tool.
 * Multi-repo submodule synchronization across the configured Zeno core repo
 * and its consumer repositories.
 *
 * Subcommands: status, diff, commit, propagate, full
 */

import type { Command } from 'commander'
import { logger } from '../../utils/logger.js'
import {
  syncStatus,
  syncDiff,
  syncCommit,
  syncPropagate,
  syncFull,
} from '../../core/project-sync-service.js'
import { listRepositories } from '../../storage/repository-storage.js'
import { findAllZenoProjects, getWorkspaceRoot } from '../../utils/config.js'

interface CommonOpts {
  json?: boolean
}

interface ReposOpts extends CommonOpts {
  repos?: string[]
}

interface DiffOpts extends ReposOpts {
  detailed?: boolean
}

interface CommitOpts extends CommonOpts {
  message?: string
  scope?: string
  tag?: string
  push?: boolean
  noPush?: boolean
}

interface PropagateOpts extends ReposOpts {
  commitHash?: string
  commitMessage?: string
  dryRun?: boolean
  force?: boolean
  push?: boolean
  noPush?: boolean
}

type FullOpts = CommitOpts & PropagateOpts

/**
 * Resolve registry consumers from the repository registry, mirroring what the
 * MCP handler does via `repos_action:list`. Returns undefined if the registry
 * cannot be read so the service falls back to filesystem `.gitmodules`
 * discovery.
 */
function resolveRegistryConsumers(
  projectRoot: string,
): { name: string; path: string }[] | undefined {
  try {
    const repos = listRepositories(undefined, projectRoot)
    if (repos.length === 0) return undefined
    return repos.map((r) => ({ name: r.name, path: r.path }))
  } catch {
    return undefined
  }
}

/**
 * Resolve `--push` / `--no-push` to a tri-state boolean.
 * Returns undefined when neither flag is provided so the service can fall back
 * to `config.git.autoPush`.
 */
function resolvePush(opts: { push?: boolean; noPush?: boolean }): boolean | undefined {
  if (opts.noPush) return false
  if (opts.push) return true
  return undefined
}

function emit(json: boolean | undefined, result: unknown): void {
  console.log(JSON.stringify(result, null, 2))
  void json
}

/**
 * Resolve the set of project roots to operate on.  Recursively scans the
 * current working directory for every Zeno project below it.  Throws if
 * none are found so we never silently no-op on a wrong directory.
 */
function resolveSyncProjectRoots(): string[] {
  const startDir = getWorkspaceRoot()
  const projects = findAllZenoProjects(startDir)
  if (projects.length === 0) {
    throw new Error(
      `No Zeno project found at or below ${startDir}. Run \`zeno init\` to create one.`,
    )
  }
  return projects
}

/**
 * Run a sync action against every Zeno project discovered below the current
 * working directory and emit the per-project results in a stable map keyed
 * by project path.  When only one project is present the result is emitted
 * directly to preserve the legacy single-project output shape.
 */
async function runSyncAcrossProjects<T>(
  json: boolean | undefined,
  action: (projectRoot: string) => Promise<T>,
): Promise<void> {
  const roots = resolveSyncProjectRoots()
  const [firstRoot] = roots
  if (roots.length === 1 && firstRoot != null) {
    const result = await action(firstRoot)
    emit(json, result)
    return
  }

  const results: { project: string; ok: boolean; result?: T; error?: string }[] = []
  for (const root of roots) {
    try {
      const result = await action(root)
      results.push({ project: root, ok: true, result })
    } catch (err) {
      results.push({
        project: root,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  emit(json, { projects: results })
}

export function registerSyncCommand(program: Command): void {
  const syncCmd = program
    .command('sync')
    .description('Multi-repo submodule synchronization across consumer repositories')

  syncCmd
    .command('status')
    .description("Report the submodule pin state across all consumer repos")
    .option('-r, --repos <names...>', 'Subset of consumer repo names (default: all discovered)')
    .option('--json', 'Output JSON (default)')
    .action(async (opts: ReposOpts) => {
      try {
        await runSyncAcrossProjects(opts.json, (projectRoot) =>
          syncStatus({
            repos: opts.repos,
            projectRoot,
            registryConsumers: resolveRegistryConsumers(projectRoot),
          }),
        )
      } catch (error) {
        logger.error(
          'sync status failed',
          error instanceof Error ? error : undefined,
        )
        process.exit(1)
      }
    })

  syncCmd
    .command('diff')
    .description(
      "Show file-level changes between core HEAD and each consumer's pinned submodule commit",
    )
    .option('-r, --repos <names...>', 'Subset of consumer repo names (default: all discovered)')
    .option('-d, --detailed', 'Include full unified diff patch output per consumer', false)
    .option('--json', 'Output JSON (default)')
    .action(async (opts: DiffOpts) => {
      try {
        await runSyncAcrossProjects(opts.json, (projectRoot) =>
          syncDiff({
            repos: opts.repos,
            detailed: opts.detailed ?? false,
            projectRoot,
            registryConsumers: resolveRegistryConsumers(projectRoot),
          }),
        )
      } catch (error) {
        logger.error('sync diff failed', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })

  syncCmd
    .command('commit')
    .description('Commit pending changes in the core repo')
    .requiredOption('-m, --message <subject>', 'Commit message subject line')
    .option('-s, --scope <scope>', 'Scope for commitFormat interpolation (e.g. "schemas")')
    .option('-t, --tag <tag>', 'Optional tag to create after commit')
    .option('--push', 'Push after committing')
    .option('--no-push', 'Do not push after committing')
    .option('--json', 'Output JSON (default)')
    .action(async (opts: CommitOpts) => {
      try {
        await runSyncAcrossProjects(opts.json, (projectRoot) =>
          syncCommit({
            message: opts.message ?? '',
            scope: opts.scope,
            tag: opts.tag,
            push: resolvePush(opts),
            projectRoot,
          }),
        )
      } catch (error) {
        logger.error('sync commit failed', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })

  syncCmd
    .command('propagate')
    .description('Update the submodule pointer in consumer repos and commit')
    .option('-c, --commit-hash <sha>', 'Core commit to pin (default: core repo HEAD)')
    .option('-r, --repos <names...>', 'Subset of consumer repo names (default: all discovered)')
    .option('--commit-message <msg>', 'Override propagation commit message')
    .option('--dry-run', 'Report changes without writing', false)
    .option('--force', 'Sync even if consumer working tree is dirty', false)
    .option('--push', 'Push after committing')
    .option('--no-push', 'Do not push after committing')
    .option('--json', 'Output JSON (default)')
    .action(async (opts: PropagateOpts) => {
      try {
        await runSyncAcrossProjects(opts.json, (projectRoot) =>
          syncPropagate({
            commitHash: opts.commitHash,
            repos: opts.repos,
            commitMessage: opts.commitMessage,
            push: resolvePush(opts),
            dryRun: opts.dryRun ?? false,
            force: opts.force ?? false,
            projectRoot,
            registryConsumers: resolveRegistryConsumers(projectRoot),
          }),
        )
      } catch (error) {
        logger.error('sync propagate failed', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })

  syncCmd
    .command('full')
    .description('Commit core changes then propagate to consumers (commit + propagate)')
    .requiredOption('-m, --message <subject>', 'Commit message subject line')
    .option('-s, --scope <scope>', 'Scope for commitFormat interpolation')
    .option('-t, --tag <tag>', 'Optional tag to create after commit')
    .option('-c, --commit-hash <sha>', 'Core commit to pin (default: new commit HEAD)')
    .option('-r, --repos <names...>', 'Subset of consumer repo names (default: all discovered)')
    .option('--commit-message <msg>', 'Override propagation commit message')
    .option('--dry-run', 'Report changes without writing', false)
    .option('--force', 'Sync even if consumer working tree is dirty', false)
    .option('--push', 'Push after committing')
    .option('--no-push', 'Do not push after committing')
    .option('--json', 'Output JSON (default)')
    .action(async (opts: FullOpts) => {
      try {
        await runSyncAcrossProjects(opts.json, (projectRoot) =>
          syncFull({
            message: opts.message ?? '',
            scope: opts.scope,
            tag: opts.tag,
            push: resolvePush(opts),
            commitHash: opts.commitHash,
            repos: opts.repos,
            commitMessage: opts.commitMessage,
            dryRun: opts.dryRun ?? false,
            force: opts.force ?? false,
            projectRoot,
            registryConsumers: resolveRegistryConsumers(projectRoot),
          }),
        )
      } catch (error) {
        logger.error('sync full failed', error instanceof Error ? error : undefined)
        process.exit(1)
      }
    })
}
