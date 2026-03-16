/**
 * Zeno Git Utilities
 *
 * Provides git operations wrapper using simple-git for version control integration.
 * Enables commit automation, tagging for gate releases, and status checks.
 *
 * IMPORTANT: All commits respect pre-commit hooks. Zeno NEVER uses --no-verify or similar
 * flags that bypass quality gates. If commits fail due to hook violations, the failure is
 * intentional and indicates code quality issues that must be resolved before committing.
 *
 * This is a core principle of Zeno's architecture: quality gates are non-negotiable.
 */

import { statSync } from 'node:fs'
import { join } from 'node:path'
import { simpleGit, type SimpleGit, type StatusResult } from 'simple-git'
import { GitError } from './errors.js'
import { loadConfig } from './config.js'

/** Git operation timeout in milliseconds */
const GIT_TIMEOUT = 30000

/** Git user information */
export interface GitUserInfo {
  name: string | null
  email: string | null
}

/** Git status summary */
export interface GitStatus {
  /** Files with modifications */
  modified: string[]
  /** Files staged for commit */
  staged: string[]
  /** Untracked files */
  untracked: string[]
  /** Current branch name */
  branch: string | null
  /** Is working directory clean */
  isClean: boolean
}

/**
 * Create a simple-git instance for the specified directory.
 * @param baseDir - Base directory for git operations (default: process.cwd())
 * @returns Configured SimpleGit instance
 */
function getGit(baseDir: string = process.cwd()): SimpleGit {
  return simpleGit({
    baseDir,
    binary: 'git',
    maxConcurrentProcesses: 1,
    timeout: {
      block: GIT_TIMEOUT,
    },
  })
}

/**
 * Check if a directory is a git repository.
 * @param dir - Directory to check (default: process.cwd())
 * @returns true if directory is a git repository
 */
export async function isGitRepo(dir: string = process.cwd()): Promise<boolean> {
  try {
    const git = getGit(dir)
    return await git.checkIsRepo()
  } catch {
    return false
  }
}

/**
 * Get the current git status.
 * @param dir - Directory to check (default: process.cwd())
 * @returns Git status summary
 * @throws GitError if not a git repository or git operation fails
 */
export async function getGitStatus(dir: string = process.cwd()): Promise<GitStatus> {
  try {
    const git = getGit(dir)
    const status: StatusResult = await git.status()

    return {
      modified: status.modified,
      staged: status.staged,
      untracked: status.not_added,
      branch: status.current,
      isClean: status.isClean(),
    }
  } catch (error) {
    throw new GitError(
      'Failed to get git status',
      'GIT_STATUS_FAILED',
      { dir },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Get git user configuration (user.name and user.email).
 * @param dir - Directory to check (default: process.cwd())
 * @returns Git user info
 */
export async function getGitUserInfo(dir: string = process.cwd()): Promise<GitUserInfo> {
  try {
    const git = getGit(dir)

    let name: string | null = null
    let email: string | null = null

    try {
      name = (await git.getConfig('user.name')).value
    } catch {
      // Ignore - user.name not set
    }

    try {
      email = (await git.getConfig('user.email')).value
    } catch {
      // Ignore - user.email not set
    }

    return { name, email }
  } catch {
    return { name: null, email: null }
  }
}

/**
 * Get the current branch name.
 * @param dir - Directory to check (default: process.cwd())
 * @returns Current branch name or null if not on a branch
 * @throws GitError if not a git repository
 */
export async function getCurrentBranch(dir: string = process.cwd()): Promise<string | null> {
  try {
    const git = getGit(dir)
    const status = await git.status()
    return status.current
  } catch (error) {
    throw new GitError(
      'Failed to get current branch',
      'GIT_BRANCH_FAILED',
      { dir },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Stage files and create a commit.
 *
 * This function respects all pre-commit hooks. If the commit fails due to hook violations
 * (linting errors, test failures, security issues, etc.), the error is intentional and
 * indicates that the code quality gates have been triggered. These failures must be
 * resolved before the commit can proceed.
 *
 * IMPORTANT: Zeno NEVER bypasses pre-commit hooks (no --no-verify, no skip flags).
 * This is a core principle of Zeno's architecture - quality gates are non-negotiable.
 *
 * @param message - Commit message
 * @param files - Files to stage (empty array means all changes)
 * @param dir - Repository directory (default: process.cwd())
 * @returns Commit hash
 * @throws GitError if commit fails (including hook violations - this is intentional)
 */
export async function commit(
  message: string,
  files: string[] = [],
  dir: string = process.cwd()
): Promise<string> {
  try {
    const git = getGit(dir)

    // Stage files
    if (files.length > 0) {
      await git.add(files)
    } else {
      await git.add('.')
    }

    // Create commit - this will respect pre-commit hooks and fail if they detect issues
    const result = await git.commit(message)
    return result.commit
  } catch (error) {
    // If commit fails, it's likely due to:
    // 1. Pre-commit hook violations (linting, formatting, tests, security)
    // 2. Actual git errors (invalid repo, permission issues, etc)
    // Both cases are intentional failures - pre-commit hooks are a quality gate.
    // Do NOT bypass them with --no-verify or similar flags.
    throw new GitError(
      'Failed to create commit',
      'GIT_COMMIT_FAILED',
      { message, files, dir },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Create an annotated tag.
 * @param tagName - Tag name (e.g., "v0.1.0-gate-01")
 * @param message - Tag message
 * @param dir - Repository directory (default: process.cwd())
 * @throws GitError if tag creation fails
 */
export async function createTag(
  tagName: string,
  message: string,
  dir: string = process.cwd()
): Promise<void> {
  try {
    const git = getGit(dir)
    await git.addAnnotatedTag(tagName, message)
  } catch (error) {
    throw new GitError(
      `Failed to create tag: ${tagName}`,
      'GIT_TAG_FAILED',
      { tagName, message, dir },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Get list of all tags.
 * @param dir - Repository directory (default: process.cwd())
 * @returns Array of tag names
 */
export async function getTags(dir: string = process.cwd()): Promise<string[]> {
  try {
    const git = getGit(dir)
    const result = await git.tags()
    return result.all
  } catch {
    return []
  }
}

/**
 * Push the current branch to a remote.
 * @param remote - Remote name (default: "origin")
 * @param dir - Repository directory (default: process.cwd())
 */
export async function pushCurrentBranch(remote = 'origin', dir = process.cwd()): Promise<void> {
  try {
    const git = getGit(dir)
    const status = await git.status()
    const branch = status.current
    if (!branch) {
      throw new GitError('Not on a branch; cannot push', 'GIT_PUSH_FAILED', { dir, remote })
    }
    await git.push(remote, branch)
  } catch (error) {
    if (error instanceof GitError) throw error
    throw new GitError(
      'Failed to push current branch',
      'GIT_PUSH_FAILED',
      { dir, remote },
      error instanceof Error ? error : undefined
    )
  }
}

export interface GitSyncResult {
  committed: boolean
  commitHash?: string
  tagged: boolean
  pushed: boolean
}

/**
 * Sync changes with git as part of a lifecycle event.
 *
 * This function respects all pre-commit hooks. Commits are only created if:
 * 1. The working tree has uncommitted changes
 * 2. All pre-commit hooks pass (linting, formatting, tests, security, etc.)
 *
 * This is intentionally conservative:
 * - If working tree is clean, it does nothing.
 * - It never pushes unless explicitly requested via autoPush=true.
 * - It NEVER bypasses quality gates (no --no-verify flags)
 */
export async function syncWithGit(options: {
  commitMessage: string
  tagName?: string
  tagMessage?: string
  autoPush?: boolean
  /**
   * When true, push failures during lifecycle operations (e.g., archive) are
   * treated as non-fatal and will not reject the overall sync operation.
   */
  ignorePushFailure?: boolean
  remote?: string
  dir?: string
}): Promise<GitSyncResult> {
  const dir = options.dir ?? process.cwd()

  if (!(await isGitRepo(dir))) {
    throw new GitError('Not a git repository', 'GIT_NOT_REPO', { dir })
  }

  const status = await getGitStatus(dir)
  if (status.isClean) {
    return { committed: false, tagged: false, pushed: false }
  }

  const commitHash = await commit(options.commitMessage, [], dir)

  let tagged = false
  if (options.tagName) {
    await createTag(options.tagName, options.tagMessage ?? options.tagName, dir)
    tagged = true
  }

  let pushed = false
  if (options.autoPush) {
    try {
      await pushCurrentBranch(options.remote ?? 'origin', dir)
      pushed = true
    } catch (error) {
      // If caller explicitly requested that push failures be non-fatal,
      // swallow the push error and continue. Otherwise, surface it.
      if (options.ignorePushFailure) {
        // Log the failure for diagnostics but do not fail the archive flow.
        // Use console.warn to avoid introducing additional runtime deps.
        // The caller (archive workflow) is expected to surface the warning to the user if needed.

        console.warn(
          'Push failed but `ignorePushFailure` is true; continuing archive. Error:',
          error
        )
        pushed = false
      } else {
        if (error instanceof GitError) throw error
        throw new GitError(
          'Failed to push current branch',
          'GIT_PUSH_FAILED',
          { dir, remote: options.remote ?? 'origin' },
          error instanceof Error ? error : undefined
        )
      }
    }
  }

  return { committed: true, commitHash, tagged, pushed }
}

/**
 * Commit record for git traceability
 */
/**
 * Stage and commit the zeno/ submodule pointer in the parent repository.
 *
 * Call this after committing changes inside the submodule's own git repo so
 * that the parent records the new HEAD of the submodule.
 *
 * @param parentDir - Parent repository root (default: process.cwd())
 * @param message - Commit message for the pointer update
 */
export async function updateSubmodulePointer(
  parentDir: string = process.cwd(),
  message: string
): Promise<void> {
  try {
    const git = getGit(parentDir)
    await git.add('zeno')
    const status: StatusResult = await git.status()
    if (status.isClean()) {
      return // submodule pointer unchanged, nothing to commit
    }
    await git.commit(message)
  } catch (error) {
    throw new GitError(
      'Failed to update submodule pointer in parent repo',
      'GIT_COMMIT_FAILED',
      { parentDir, message },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Detect whether the `zeno/` directory inside a project root is a git submodule.
 *
 * A submodule's working directory contains a `.git` FILE (not a directory) that
 * points back into the parent's `.git/modules/<name>`. A plain directory would
 * have no `.git` entry at all, or a `.git/` directory if it was accidentally
 * `git init`-ed standalone.
 *
 * @param projectRoot - Parent repository root (default: process.cwd())
 * @returns true when zeno/ is a mounted git submodule
 */
export function isZenoSubmodule(projectRoot: string = process.cwd()): boolean {
  try {
    const gitEntry = join(projectRoot, 'zeno', '.git')
    const stat = statSync(gitEntry)
    return stat.isFile() // submodule gitfile, not a directory
  } catch {
    return false
  }
}

/**
 * Register a remote URL as the `zeno/` git submodule in the parent repository.
 *
 * Equivalent to: git submodule add <url> zeno
 *
 * The caller is responsible for ensuring the parent is a git repository and
 * that `zeno/` does not already exist as a plain directory.
 *
 * @param url - Remote URL of the planning repo to use as the submodule
 * @param parentDir - Parent repository root (default: process.cwd())
 */
export async function addZenoSubmodule(
  url: string,
  parentDir: string = process.cwd()
): Promise<void> {
  try {
    const git = getGit(parentDir)
    // simple-git exposes raw git commands via `raw()`
    await git.raw(['submodule', 'add', url, 'zeno'])
  } catch (error) {
    throw new GitError(
      `Failed to add zeno submodule from ${url}`,
      'GIT_COMMIT_FAILED',
      { url, parentDir },
      error instanceof Error ? error : undefined
    )
  }
}

export interface CommitRecord {
  commitSha: string
  author: string
  date: string
  subject: string
  body?: string
  filesChanged: string[]
  matchedHashes: string[]
  inferredArtifacts: string[]
  confidenceScore: number
  notes?: string
}

/**
 * Options for parsing commits
 */
export interface ParseCommitsOptions {
  dateRange?: { from?: string; to?: string }
  branch?: string
  limit?: number
}

/**
 * Parse git log output to extract commits referencing a specific artifact hash
 * @param artifactHash - The hash to search for in commit messages
 * @param options - Search options
 * @param dir - Repository directory
 * @returns Array of commit records with traceability info
 */
export async function parseCommitsForHashes(
  artifactHash: string,
  options: ParseCommitsOptions = {},
  dir: string = process.cwd()
): Promise<CommitRecord[]> {
  try {
    const git = getGit(dir)
    let commitFormat = 'feat(%s): %m' // default
    try {
      const config = await loadConfig(dir)
      commitFormat = config.git?.commitFormat ?? commitFormat
    } catch {
      // Use default if config not found
    }

    // Build git log command with filters
    const logOptions: string[] = [
      'log',
      '--pretty=format:%H|%an|%ae|%ai|%s|%b',
      '--no-merges', // Skip merge commits for cleaner history
    ]

    if (options.dateRange?.from) {
      logOptions.push(`--since=${options.dateRange.from}`)
    }
    if (options.dateRange?.to) {
      logOptions.push(`--until=${options.dateRange.to}`)
    }
    if (options.branch) {
      logOptions.push(options.branch)
    }
    if (options.limit) {
      logOptions.push(`-n ${String(options.limit)}`)
    }

    // Get raw log output
    const logOutput = await git.raw(logOptions)

    if (!logOutput) {
      return []
    }

    const commits: CommitRecord[] = []
    const lines = logOutput.trim().split('\n')

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 5) continue

      const [commitSha, authorName, authorEmail, date, subject, ...bodyParts] = parts as [
        string,
        string,
        string,
        string,
        string,
        ...string[],
      ]
      const body = bodyParts.join('|').trim()
      const fullMessage = `${subject}${body ? `\n\n${body}` : ''}`

      // Apply heuristics to find hash references
      const { matchedHashes, confidenceScore, notes } = applyHashMatchingHeuristics(
        fullMessage,
        artifactHash,
        commitFormat
      )

      if (matchedHashes.length > 0) {
        // Get files changed in this commit
        const filesChanged = await getFilesChangedInCommit(commitSha, dir)

        // Infer artifacts from matched hashes (simplified - just use the hashes)
        const inferredArtifacts = matchedHashes

        commits.push({
          commitSha,
          author: `${authorName} <${authorEmail}>`,
          date,
          subject,
          body: body || undefined,
          filesChanged,
          matchedHashes,
          inferredArtifacts,
          confidenceScore,
          notes,
        })
      }
    }

    return commits
  } catch (error) {
    throw new GitError(
      'Failed to parse commits for hashes',
      'GIT_PARSE_FAILED',
      { artifactHash, options, dir },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Apply heuristics to match hashes in commit messages
 * @param message - Commit message
 * @param targetHash - Hash to search for
 * @param commitFormat - Expected commit format from config
 * @returns Matching results with confidence
 */
export function applyHashMatchingHeuristics(
  message: string,
  targetHash: string,
  commitFormat: string
): { matchedHashes: string[]; confidenceScore: number; notes?: string } {
  const matchedHashes: string[] = []
  let confidenceScore = 0
  let notes = ''

  const cleanHash = targetHash.replace(/^#/, '')

  // Direct hash match (highest confidence)
  if (message.includes(targetHash)) {
    matchedHashes.push(targetHash)
    confidenceScore = 1.0
    notes = 'Direct hash match in commit message'
    return { matchedHashes, confidenceScore, notes }
  }

  // Pattern-based matching using commitFormat
  // Extract scope from commitFormat (e.g., 'feat(%s): %m' -> '%s' is scope)
  const scopeMatch = commitFormat.match(/%\w+/g)
  if (scopeMatch) {
    for (const pattern of scopeMatch) {
      if (pattern === '%s' && message.includes(targetHash)) {
        // Scope contains hash
        matchedHashes.push(targetHash)
        confidenceScore = 0.8
        notes = 'Hash found in commit scope'
        break
      }
    }
  }

  // Look for similar patterns (e.g., #g03p08 vs g03p08)
  if (message.includes(cleanHash)) {
    if (matchedHashes.length === 0) {
      matchedHashes.push(targetHash)
      confidenceScore = 0.7
      notes = 'Hash match without # prefix'
    }
  }

  // Fuzzy matching for partial hashes or variations
  const cleanMessage = message.replace(/#/g, '')
  if (cleanMessage.includes(cleanHash.slice(0, -1)) || cleanMessage.includes(cleanHash.slice(1))) {
    if (matchedHashes.length === 0) {
      matchedHashes.push(targetHash)
      confidenceScore = 0.6
      notes = 'Fuzzy hash match'
    }
  }

  return { matchedHashes, confidenceScore, notes: notes || undefined }
}

/**
 * Get files changed in a specific commit
 * @param commitSha - Commit hash
 * @param dir - Repository directory
 * @returns Array of changed file paths
 */
async function getFilesChangedInCommit(commitSha: string, dir: string): Promise<string[]> {
  try {
    const git = getGit(dir)
    const result = await git.raw(['show', '--name-only', '--pretty=format:', commitSha])
    return result
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
  } catch {
    return []
  }
}
