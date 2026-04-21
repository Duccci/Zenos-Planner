/**
 * Project Sync Service
 *
 * Manages multi-repo submodule synchronization for Zeno projects.
 * Handles discovery of consumer repos, submodule status reporting,
 * core repo commits, and propagation of submodule pointer updates.
 */

import { simpleGit, type SimpleGit } from 'simple-git'
import { execSync } from 'node:child_process'
import { join, basename, dirname, resolve } from 'node:path'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { logger } from '../utils/logger.js'
import { loadConfig, getWorkspaceRoot, findProjectRoot } from '../utils/config.js'
import { WorktreeManager } from './worktree-manager.js'
import type {
  SyncConfig,
  ConsumerStatus,
  ProjectSyncStatusOutput,
  ProjectSyncCommitOutput,
  ProjectSyncPropagateOutput,
  PropagateResult,
  ProjectSyncFullOutput,
  ProjectSyncDiffOutput,
  ConsumerDiff,
  DiffFileEntry,
} from '../mcp/schemas/project-sync-schemas.js'

// ============================================================================
// Types
// ============================================================================

interface DiscoveredConsumer {
  name: string
  path: string
  submodulePath: string
}

interface CoreRepoInfo {
  name: string
  path: string
  remoteUrl: string | null
}

const DEFAULT_ZENO_SUBMODULE_PATH = 'zeno'

// ============================================================================
// Discovery
// ============================================================================

/**
 * Detect the core repo — the repo containing `.zeno/config.json`.
 */
async function detectCoreRepo(projectRoot: string): Promise<CoreRepoInfo> {
  const name = basename(projectRoot)
  let remoteUrl: string | null = null
  try {
    const git = simpleGit(projectRoot)
    const raw = await git.remote(['get-url', 'origin'])
    remoteUrl = raw ? raw.trim() : null
  } catch {
    // No remote configured
  }
  return { name, path: projectRoot, remoteUrl }
}

/**
 * Parse `.gitmodules` in a directory to find submodule entries.
 * Returns an array of { path, url } for each submodule.
 */
function parseGitmodules(repoPath: string): { path: string; url: string }[] {
  const gitmodulesPath = join(repoPath, '.gitmodules')
  if (!existsSync(gitmodulesPath)) return []

  const content = readFileSync(gitmodulesPath, 'utf8')
  const entries: { path: string; url: string }[] = []
  let currentPath: string | null = null
  let currentUrl: string | null = null

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[submodule ')) {
      // Push previous entry if complete
      if (currentPath && currentUrl) {
        entries.push({ path: currentPath, url: currentUrl })
      }
      currentPath = null
      currentUrl = null
    } else if (trimmed.startsWith('path = ')) {
      currentPath = trimmed.slice('path = '.length).trim()
    } else if (trimmed.startsWith('url = ')) {
      currentUrl = trimmed.slice('url = '.length).trim()
    }
  }
  // Push last entry
  if (currentPath && currentUrl) {
    entries.push({ path: currentPath, url: currentUrl })
  }
  return entries
}

function getTrackedZenoSubmodulePath(syncConfig: Partial<SyncConfig>): string {
  const configuredPath = syncConfig.submodulePath?.trim()
  return configuredPath && configuredPath.length > 0
    ? configuredPath
    : DEFAULT_ZENO_SUBMODULE_PATH
}

/**
 * Discover consumer repos via filesystem walk of sibling directories.
 * Each sibling that is a git repo and has a submodule matching the core
 * repo is considered a consumer.
 */
function discoverConsumersFromFilesystem(
  coreRepo: CoreRepoInfo,
  syncConfig: Partial<SyncConfig>,
): DiscoveredConsumer[] {
  const parentDir = dirname(coreRepo.path)
  const consumers: DiscoveredConsumer[] = []
  const trackedZenoSubmodulePath = getTrackedZenoSubmodulePath(syncConfig)

  let entries: string[]
  try {
    entries = readdirSync(parentDir)
  } catch {
    logger.warn(`Cannot read parent directory: ${parentDir}`)
    return consumers
  }

  for (const entry of entries) {
    const candidatePath = join(parentDir, entry)

    // Skip non-directories and the core repo itself
    try {
      if (!statSync(candidatePath).isDirectory()) continue
    } catch {
      continue
    }
    if (resolve(candidatePath) === resolve(coreRepo.path)) continue

    // Must be a git repo
    if (!existsSync(join(candidatePath, '.git'))) continue

    // Check .gitmodules for a matching submodule
    const submodules = parseGitmodules(candidatePath)
    for (const sub of submodules) {
      if (sub.path === trackedZenoSubmodulePath) {
        consumers.push({
          name: entry,
          path: candidatePath,
          submodulePath: trackedZenoSubmodulePath,
        })
        break // One match per consumer is enough
      }
    }
  }

  return consumers
}

/**
 * Discover consumer repos, preferring explicit config, then registry, then filesystem.
 */
function discoverConsumers(
  coreRepo: CoreRepoInfo,
  syncConfig: Partial<SyncConfig>,
  registryConsumers?: { name: string; path: string }[],
): DiscoveredConsumer[] {
  const submodulePath = getTrackedZenoSubmodulePath(syncConfig)

  // 1. Explicit config list
  if (syncConfig.consumers && syncConfig.consumers.length > 0) {
    const parentDir = dirname(coreRepo.path)
    return syncConfig.consumers
      .map((name) => {
        const consumerPath = join(parentDir, name)
        if (!existsSync(consumerPath)) {
          logger.warn(`Configured consumer not found: ${name}`)
          return null
        }
        return { name, path: consumerPath, submodulePath }
      })
      .filter((c): c is DiscoveredConsumer => c !== null)
  }

  // 2. Registry consumers (repos_action:list results)
  if (registryConsumers && registryConsumers.length > 0) {
    const consumers: DiscoveredConsumer[] = []
    for (const repo of registryConsumers) {
      const repoPath = resolve(repo.path)
      if (repoPath === resolve(coreRepo.path)) continue
      if (!existsSync(repoPath)) continue

      // Verify it actually has the core repo as submodule
      const submodules = parseGitmodules(repoPath)
      const hasCore = submodules.some((s) => s.path === submodulePath)
      if (hasCore) {
        consumers.push({ name: repo.name, path: repoPath, submodulePath })
      }
    }
    if (consumers.length > 0) return consumers
  }

  // 3. Filesystem fallback
  return discoverConsumersFromFilesystem(coreRepo, syncConfig)
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve the path of the main (non-worktree) working tree.  When the
 * given `projectRoot` is itself a Zeno-generated worktree
 * (`.local/worktrees/<hash>`), we walk up to the real project root so
 * that all sync operations read the user's checked-out branch, not a
 * transient proposal branch.
 */
function resolveMainWorktreeRoot(projectRoot: string): string {
  const normalized = projectRoot.replace(/\\/g, '/')
  const match = /^(.+)\/\.local\/worktrees\/[^/]+\/?$/.exec(normalized)
  return match?.[1] ?? projectRoot
}

/**
 * Check whether the current branch is a Zeno-generated worktree branch.
 */
async function isOnWorktreeBranch(git: ReturnType<typeof simpleGit>): Promise<boolean> {
  try {
    const branch = (await git.raw(['symbolic-ref', '--short', 'HEAD'])).trim()
    return branch.startsWith('proposal/')
  } catch {
    return false // detached HEAD or other non-branch state
  }
}

function parsePinnedSubmoduleHash(submoduleStatusRaw: string): string {
  const trimmed = submoduleStatusRaw.trim()
  const hashMatch = /^(?:[-+U ])?([0-9a-f]{40})/.exec(trimmed)
  return hashMatch?.[1] ?? ''
}

async function isSubmoduleDirty(git: SimpleGit, submodulePath: string): Promise<boolean> {
  // Restrict the check to the gitlink so unrelated consumer repo changes do not block sync.
  const porcelain = await git.raw([
    'status',
    '--porcelain=v1',
    '--ignore-submodules=none',
    '--',
    submodulePath,
  ])
  return porcelain.trim().length > 0
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Report the current submodule pin state across all consumer repos.
 */
export async function syncStatus(params: {
  repos?: string[]
  projectRoot?: string
  registryConsumers?: { name: string; path: string }[]
}): Promise<ProjectSyncStatusOutput> {
  const rawProjectRoot = params.projectRoot ?? findProjectRoot() ?? getWorkspaceRoot()
  const projectRoot = resolveMainWorktreeRoot(rawProjectRoot)
  const config = await loadConfig(projectRoot)
  const syncConfig: Partial<SyncConfig> = ((config as Record<string, unknown>)['sync'] as Partial<SyncConfig> | undefined) ?? {}

  const coreRepo = await detectCoreRepo(projectRoot)
  const coreGit = simpleGit(projectRoot)
  const coreHead = (await coreGit.revparse(['HEAD'])).trim()
  const coreHeadShort = coreHead.slice(0, 7)

  let allConsumers = discoverConsumers(coreRepo, syncConfig, params.registryConsumers)

  // Filter to requested subset
  if (params.repos && params.repos.length > 0) {
    const requestedSet = new Set(params.repos)
    allConsumers = allConsumers.filter((c) => requestedSet.has(c.name))
  }

  const worktreeManager = new WorktreeManager()
  let worktreePaths: Set<string>
  try {
    const worktrees = await worktreeManager.list()
    worktreePaths = new Set(worktrees.map((w) => resolve(w.path)))
  } catch {
    worktreePaths = new Set()
  }

  const consumers: ConsumerStatus[] = []

  for (const consumer of allConsumers) {
    try {
      const consumerGit = simpleGit(consumer.path)
      const submoduleStatusRaw = await consumerGit.raw([
        'submodule', 'status', consumer.submodulePath,
      ])
      const pinnedHash = parsePinnedSubmoduleHash(submoduleStatusRaw)
      const dirty = await isSubmoduleDirty(consumerGit, consumer.submodulePath)

      // Count commits behind
      let behind = 0
      if (pinnedHash && pinnedHash !== coreHead) {
        try {
          const subGit = simpleGit(join(consumer.path, consumer.submodulePath))
          await subGit.fetch(['origin'])
          const countRaw = await subGit.raw([
            'rev-list', '--count', `${pinnedHash}..${coreHead}`,
          ])
          behind = parseInt(countRaw.trim(), 10) || 0
        } catch {
          // If we can't count, report -1 or just 0
          behind = pinnedHash !== coreHead ? -1 : 0
        }
      }

      // Check if this specific consumer directory is inside an active worktree
      const hasWorktree = worktreePaths.has(resolve(consumer.path))

      consumers.push({
        repo: consumer.name,
        pinnedHash,
        behind,
        dirty,
        hasWorktree,
      })
    } catch (error) {
      logger.warn(`Failed to read submodule status for ${consumer.name}: ${error instanceof Error ? error.message : String(error)}`)
      consumers.push({
        repo: consumer.name,
        pinnedHash: '',
        behind: -1,
        dirty: false,
        hasWorktree: false,
      })
    }
  }

  const summary = {
    total: consumers.length,
    current: consumers.filter((c) => c.behind === 0 && c.pinnedHash !== '').length,
    behind: consumers.filter((c) => c.behind > 0 || c.behind === -1).length,
    dirty: consumers.filter((c) => c.dirty).length,
    blocked: consumers.filter((c) => c.hasWorktree).length,
  }

  return {
    coreRepo: coreRepo.name,
    coreHead,
    coreHeadShort,
    consumers,
    summary,
  }
}

// ============================================================================
// Diff
// ============================================================================

/**
 * Parse a git --numstat line into a DiffFileEntry.
 * Format: "additions\tdeletions\tfilename" (binary files show "-\t-\tfile").
 */
function parseNumstatLine(line: string): DiffFileEntry | null {
  const parts = line.split('\t')
  if (parts.length < 3) return null
  const [addStr, delStr, ...fileParts] = parts
  const file = fileParts.join('\t') // handle paths with tabs (rare)
  const additions = addStr === '-' ? 0 : parseInt(addStr ?? '', 10) || 0
  const deletions = delStr === '-' ? 0 : parseInt(delStr ?? '', 10) || 0
  return { file, status: 'modified', additions, deletions }
}

/**
 * Parse a git --name-status line to determine the file change type.
 * Format: "M\tfilename" or "R100\told\tnew"
 */
function parseNameStatusLine(line: string): { file: string; status: DiffFileEntry['status'] } | null {
  const parts = line.split('\t')
  if (parts.length < 2) return null
  const code = (parts[0] ?? '').charAt(0)
  const file = parts.length >= 3 ? (parts[2] ?? '') : (parts[1] ?? '') // renames use 3rd column
  const statusMap: Record<string, DiffFileEntry['status']> = {
    A: 'added',
    M: 'modified',
    D: 'deleted',
    R: 'renamed',
    C: 'copied',
  }
  return { file, status: statusMap[code] ?? 'modified' }
}

/**
 * Report file-level diff between core HEAD and each consumer's pinned submodule commit.
 */
export async function syncDiff(params: {
  repos?: string[]
  detailed?: boolean
  projectRoot?: string
  registryConsumers?: { name: string; path: string }[]
}): Promise<ProjectSyncDiffOutput> {
  const projectRoot = params.projectRoot ?? findProjectRoot() ?? getWorkspaceRoot()
  const config = await loadConfig(projectRoot)
  const syncConfig: Partial<SyncConfig> = ((config as Record<string, unknown>)['sync'] as Partial<SyncConfig> | undefined) ?? {}
  const detailed = params.detailed ?? false

  const coreRepo = await detectCoreRepo(projectRoot)
  const coreGit = simpleGit(projectRoot)
  const coreHead = (await coreGit.revparse(['HEAD'])).trim()
  const coreHeadShort = coreHead.slice(0, 7)

  let allConsumers = discoverConsumers(coreRepo, syncConfig, params.registryConsumers)

  if (params.repos && params.repos.length > 0) {
    const requestedSet = new Set(params.repos)
    allConsumers = allConsumers.filter((c) => requestedSet.has(c.name))
  }

  const consumers: ConsumerDiff[] = []

  for (const consumer of allConsumers) {
    try {
      const consumerGit = simpleGit(consumer.path)
      const submoduleStatusRaw = await consumerGit.raw([
        'submodule', 'status', consumer.submodulePath,
      ])
      const pinnedHash = parsePinnedSubmoduleHash(submoduleStatusRaw)
      const pinnedHashShort = pinnedHash.slice(0, 7)

      if (!pinnedHash || pinnedHash === coreHead) {
        consumers.push({
          repo: consumer.name,
          pinnedHash,
          pinnedHashShort,
          coreHead,
          coreHeadShort,
          status: 'current',
          behind: 0,
          files: [],
          totalAdditions: 0,
          totalDeletions: 0,
        })
        continue
      }

      const submoduleFullPath = join(consumer.path, consumer.submodulePath)
      const subGit = simpleGit(submoduleFullPath)

      // Fetch so both commits are available locally
      try {
        await subGit.fetch(['origin'])
      } catch {
        // Best-effort; commits may already be local
      }

      // Count commits behind
      let behind = 0
      try {
        const countRaw = await subGit.raw(['rev-list', '--count', `${pinnedHash}..${coreHead}`])
        behind = parseInt(countRaw.trim(), 10) || 0
      } catch {
        behind = -1
      }

      // Get file-level numstat diff
      const numstatRaw = await subGit.raw([
        'diff', '--numstat', pinnedHash, coreHead,
      ])

      // Get file-level name-status diff for change types
      const nameStatusRaw = await subGit.raw([
        'diff', '--name-status', pinnedHash, coreHead,
      ])

      // Parse name-status into a lookup
      const statusLookup = new Map<string, DiffFileEntry['status']>()
      for (const line of nameStatusRaw.trim().split('\n').filter(Boolean)) {
        const parsed = parseNameStatusLine(line)
        if (parsed) statusLookup.set(parsed.file, parsed.status)
      }

      // Parse numstat and merge with statuses
      const files: DiffFileEntry[] = []
      let totalAdditions = 0
      let totalDeletions = 0
      for (const line of numstatRaw.trim().split('\n').filter(Boolean)) {
        const entry = parseNumstatLine(line)
        if (!entry) continue
        // Override status from name-status if available
        const fileStatus = statusLookup.get(entry.file)
        if (fileStatus) entry.status = fileStatus
        files.push(entry)
        totalAdditions += entry.additions
        totalDeletions += entry.deletions
      }

      // Optionally include full unified diff patch
      let patch: string | undefined
      if (detailed) {
        try {
          patch = await subGit.raw(['diff', pinnedHash, coreHead])
        } catch {
          // Patch retrieval is best-effort
        }
      }

      consumers.push({
        repo: consumer.name,
        pinnedHash,
        pinnedHashShort,
        coreHead,
        coreHeadShort,
        status: 'behind',
        behind,
        files,
        totalAdditions,
        totalDeletions,
        patch,
      })
    } catch (error) {
      consumers.push({
        repo: consumer.name,
        pinnedHash: '',
        pinnedHashShort: '',
        coreHead,
        coreHeadShort,
        status: 'error',
        behind: -1,
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const summary = {
    total: consumers.length,
    current: consumers.filter((c) => c.status === 'current').length,
    behind: consumers.filter((c) => c.status === 'behind').length,
    totalFiles: consumers.reduce((sum, c) => sum + c.files.length, 0),
    totalAdditions: consumers.reduce((sum, c) => sum + c.totalAdditions, 0),
    totalDeletions: consumers.reduce((sum, c) => sum + c.totalDeletions, 0),
    errors: consumers.filter((c) => c.status === 'error').length,
  }

  return {
    coreRepo: coreRepo.name,
    coreHead,
    coreHeadShort,
    consumers,
    summary,
  }
}

/**
 * Commit pending changes in the core repo.
 */
export async function syncCommit(params: {
  message: string
  scope?: string
  push?: boolean
  tag?: string
  projectRoot?: string
}): Promise<ProjectSyncCommitOutput> {
  const rawProjectRoot = params.projectRoot ?? findProjectRoot() ?? getWorkspaceRoot()
  const projectRoot = resolveMainWorktreeRoot(rawProjectRoot)
  const config = await loadConfig(projectRoot)
  const gitConfig = config.git ?? { autoCommit: true, autoTag: true, autoPush: false, remote: 'origin', commitFormat: 'feat(%s): %m' }

  const git = simpleGit(projectRoot)

  // Refuse to commit from a Zeno worktree branch; sync should only
  // operate on the user's checked-out branch.
  if (await isOnWorktreeBranch(git)) {
    return { status: 'no-op' }
  }

  const status = await git.status()

  if (status.isClean()) {
    return { status: 'no-op' }
  }

  // Stage all changes
  await git.add('-A')

  // Format commit message
  const commitFormat = gitConfig.commitFormat
  let formattedMessage: string
  if (params.scope) {
    formattedMessage = commitFormat.replace('%s', params.scope).replace('%m', params.message)
  } else {
    // Remove scope placeholder and parens when no scope
    formattedMessage = commitFormat
      .replace('(%s)', '')
      .replace('%s', '')
      .replace(/:\s*%m/, `: ${params.message}`)
      .replace('%m', params.message)
      .replace(/\s+/g, ' ')
      .trim()
  }

  await git.commit(formattedMessage)

  const commitHash = (await git.revparse(['HEAD'])).trim()
  const commitHashShort = commitHash.slice(0, 7)

  // Tag if requested
  if (params.tag) {
    await git.tag(['-a', params.tag, '-m', `Tag ${params.tag}`])
  }

  // Push if requested or if autoPush is on
  const shouldPush = params.push ?? gitConfig.autoPush
  let pushed = false
  if (shouldPush) {
    const remote = gitConfig.remote
    // Push the current branch by name; never push bare HEAD which could
    // resolve to a Zeno worktree branch.
    let branchRef = 'HEAD'
    try {
      branchRef = (await git.raw(['symbolic-ref', '--short', 'HEAD'])).trim() || 'HEAD'
    } catch {
      // detached HEAD — fall back
    }
    await git.push(remote, branchRef)
    if (params.tag) {
      await git.push(remote, params.tag)
    }
    pushed = true
  }

  return {
    status: 'committed',
    commitHash,
    commitHashShort,
    commitMessage: formattedMessage,
    tag: params.tag,
    pushed,
  }
}

/**
 * Detect schema-drift warnings between two commits.
 */
async function detectSchemaDrift(
  projectRoot: string,
  oldHash: string,
  newHash: string,
  schemaDir: string,
): Promise<{ type: 'schema-change'; files: string[]; message: string }[]> {
  if (oldHash === newHash) return []
  try {
    const git = simpleGit(projectRoot)
    const diffRaw = await git.diff(['--name-only', oldHash, newHash])
    const changedFiles = diffRaw.trim().split('\n').filter(Boolean)
    const schemaFiles = changedFiles.filter((f) => f.startsWith(schemaDir))
    if (schemaFiles.length > 0) {
      return [
        {
          type: 'schema-change' as const,
          files: schemaFiles,
          message: `Schema files changed between ${oldHash.slice(0, 7)} and ${newHash.slice(0, 7)}. Consumers may need to regenerate bindings and update version registries.`,
        },
      ]
    }
  } catch {
    // Best-effort: if we can't diff, skip warning
  }
  return []
}

/**
 * Run post-sync hooks in a consumer directory.
 */
function runPostSyncHooks(
  consumerPath: string,
  hooks: string[],
): { command: string; exitCode: number; stderr?: string }[] {
  const results: { command: string; exitCode: number; stderr?: string }[] = []
  for (const command of hooks) {
    logger.info(`Running post-sync hook in ${consumerPath}: ${command}`)
    try {
      execSync(command, {
        cwd: consumerPath,
        encoding: 'utf8',
        timeout: 120_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      results.push({ command, exitCode: 0 })
    } catch (error) {
      const exitCode = (error as { status?: number }).status ?? 1
      const stderr = (error as { stderr?: string }).stderr
      results.push({ command, exitCode, stderr: stderr ?? undefined })
    }
  }
  return results
}

/**
 * Extract artifact hashes from a commit message for traceability.
 */
function extractArtifactHashes(message: string): string[] {
  const matches = message.match(/#[a-z0-9]{8,16}/g)
  return matches ? matches.map((m) => m.slice(1)) : []
}

/**
 * Update the core submodule pointer in consumer repos and commit the change.
 */
export async function syncPropagate(params: {
  commitHash?: string
  repos?: string[]
  commitMessage?: string
  push?: boolean
  dryRun?: boolean
  force?: boolean
  projectRoot?: string
  registryConsumers?: { name: string; path: string }[]
}): Promise<ProjectSyncPropagateOutput> {
  const rawProjectRoot = params.projectRoot ?? findProjectRoot() ?? getWorkspaceRoot()
  const projectRoot = resolveMainWorktreeRoot(rawProjectRoot)
  const config = await loadConfig(projectRoot)
  const syncConfig: Partial<SyncConfig> = ((config as Record<string, unknown>)['sync'] as Partial<SyncConfig> | undefined) ?? {}
  const gitConfig = config.git ?? { autoPush: false, remote: 'origin', commitFormat: 'feat(%s): %m' }
  const dryRun = params.dryRun ?? false
  const force = params.force ?? false

  const coreRepo = await detectCoreRepo(projectRoot)
  const coreGit = simpleGit(projectRoot)

  // Resolve target commit hash from the main working tree's HEAD,
  // never from a transient Zeno worktree.
  let targetHash: string
  if (params.commitHash) {
    targetHash = (await coreGit.revparse([params.commitHash])).trim()
  } else {
    targetHash = (await coreGit.revparse(['HEAD'])).trim()
  }
  const targetHashShort = targetHash.slice(0, 7)

  let allConsumers = discoverConsumers(coreRepo, syncConfig, params.registryConsumers)

  // Filter to requested subset
  if (params.repos && params.repos.length > 0) {
    const requestedSet = new Set(params.repos)
    allConsumers = allConsumers.filter((c) => requestedSet.has(c.name))
  }

  // Worktree check removed — sync operates on the default branch commit,
  // not on worktree branches, so active worktrees do not block propagation.

  const results: PropagateResult[] = []
  const shouldPush = params.push ?? gitConfig.autoPush
  const postSyncHooks = syncConfig.postSyncHooks ?? []

  // Resolve the core commit message for artifact hash extraction
  let coreCommitMessage = ''
  try {
    coreCommitMessage = (await coreGit.log(['-1', '--format=%s%n%b', targetHash])).latest?.hash
      ? (await coreGit.raw(['log', '-1', '--format=%s%n%b', targetHash])).trim()
      : ''
  } catch {
    // Best-effort
  }
  const artifactHashes = extractArtifactHashes(coreCommitMessage)

  for (const consumer of allConsumers) {
    try {
      // Pre-checks
      const consumerGit = simpleGit(consumer.path)

      // Skip consumers that are on a Zeno worktree branch
      if (await isOnWorktreeBranch(consumerGit)) {
        results.push({ repo: consumer.name, status: 'blocked-worktree' })
        continue
      }

      // Check the configured submodule path only; unrelated repo changes should not block sync.
      if (!force) {
        const submoduleDirty = await isSubmoduleDirty(consumerGit, consumer.submodulePath)
        if (submoduleDirty) {
          results.push({ repo: consumer.name, status: 'blocked-dirty' })
          continue
        }
      }

      if (dryRun) {
        // In dry-run, just report what would happen
        const submoduleStatusRaw = await consumerGit.raw([
          'submodule', 'status', consumer.submodulePath,
        ])
        const pinnedHash = parsePinnedSubmoduleHash(submoduleStatusRaw)
        results.push({
          repo: consumer.name,
          status: pinnedHash === targetHash ? 'already-current' : 'updated',
          previousHash: pinnedHash,
          newHash: targetHash,
        })
        continue
      }

      // Read current pinned hash before update
      const beforeStatusRaw = await consumerGit.raw([
        'submodule', 'status', consumer.submodulePath,
      ])
      const previousHash = parsePinnedSubmoduleHash(beforeStatusRaw)

      // Update submodule
      await consumerGit.raw(['submodule', 'update', '--init', consumer.submodulePath])

      const submoduleFullPath = join(consumer.path, consumer.submodulePath)
      const subGit = simpleGit(submoduleFullPath)
      await subGit.fetch(['origin'])
      await subGit.checkout(targetHash)

      // Stage the submodule pointer change
      await consumerGit.add(consumer.submodulePath)

      // Check if anything actually changed
      const diffResult = await consumerGit.diff(['--cached', '--name-only'])
      if (!diffResult.trim()) {
        results.push({ repo: consumer.name, status: 'already-current', previousHash })
        continue
      }

      // Commit with formatted message
      let propagateMessage = params.commitMessage
        ?? `chore(${coreRepo.name}): update ${coreRepo.name} to ${targetHashShort}`

      // Append artifact hashes for traceability
      if (artifactHashes.length > 0) {
        propagateMessage += `\n\nTraces: ${artifactHashes.map((h) => `#${h}`).join(', ')}`
      }

      await consumerGit.commit(propagateMessage)

      // Push if requested
      let pushed = false
      if (shouldPush) {
        try {
          const remote = gitConfig.remote
          // Push by branch name, not bare HEAD
          let branchRef = 'HEAD'
          try {
            branchRef = (await consumerGit.raw(['symbolic-ref', '--short', 'HEAD'])).trim() || 'HEAD'
          } catch {
            // detached HEAD fallback
          }
          await consumerGit.push(remote, branchRef)
          pushed = true
        } catch (error) {
          results.push({
            repo: consumer.name,
            status: 'error',
            previousHash,
            error: `Push failed: ${error instanceof Error ? error.message : String(error)}`,
          })
          continue
        }
      }

      // Run post-sync hooks
      const hookResults = postSyncHooks.length > 0
        ? runPostSyncHooks(consumer.path, postSyncHooks)
        : undefined

      results.push({
        repo: consumer.name,
        status: 'updated',
        previousHash,
        newHash: targetHash,
        pushed,
        hookResults,
      })
    } catch (error) {
      results.push({
        repo: consumer.name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Schema drift detection
  let warnings: { type: 'schema-change'; files: string[]; message: string }[] | undefined
  const schemaDriftWarning = syncConfig.schemaDriftWarning ?? true
  if (schemaDriftWarning) {
    const schemaDir = syncConfig.schemaDir ?? (existsSync(join(projectRoot, 'schemas')) ? 'schemas/' : undefined)
    if (schemaDir) {
      const updatedConsumers = results.filter((r) => r.status === 'updated' && r.previousHash)
      const firstUpdated = updatedConsumers[0]
      if (firstUpdated?.previousHash) {
        const drift = await detectSchemaDrift(projectRoot, firstUpdated.previousHash, targetHash, schemaDir)
        if (drift.length > 0) {
          warnings = drift
        }
      }
    }
  }

  const summary = {
    updated: results.filter((r) => r.status === 'updated').length,
    alreadyCurrent: results.filter((r) => r.status === 'already-current').length,
    blocked: results.filter((r) => r.status === 'blocked-worktree' || r.status === 'blocked-dirty').length,
    errors: results.filter((r) => r.status === 'error').length,
  }

  return {
    coreCommitHash: targetHash,
    coreCommitHashShort: targetHashShort,
    dryRun,
    results,
    summary,
    warnings,
  }
}

/**
 * Full sync: commit core changes, then propagate to all consumers.
 */
export async function syncFull(params: {
  message: string
  scope?: string
  push?: boolean
  tag?: string
  commitHash?: string
  repos?: string[]
  commitMessage?: string
  dryRun?: boolean
  force?: boolean
  projectRoot?: string
  registryConsumers?: { name: string; path: string }[]
}): Promise<ProjectSyncFullOutput> {
  const rawProjectRoot = params.projectRoot ?? findProjectRoot() ?? getWorkspaceRoot()
  const projectRoot = resolveMainWorktreeRoot(rawProjectRoot)

  // Step 1: Commit core changes
  const commitResult = await syncCommit({
    message: params.message,
    scope: params.scope,
    push: params.push,
    tag: params.tag,
    projectRoot,
  })

  // Step 2: Propagate — use new commit hash if we just committed, otherwise HEAD
  const propagateHash = commitResult.status === 'committed'
    ? commitResult.commitHash
    : params.commitHash

  const propagateResult = await syncPropagate({
    commitHash: propagateHash,
    repos: params.repos,
    commitMessage: params.commitMessage,
    push: params.push,
    dryRun: params.dryRun,
    force: params.force,
    projectRoot,
    registryConsumers: params.registryConsumers,
  })

  return {
    commit: commitResult,
    propagate: propagateResult,
  }
}
