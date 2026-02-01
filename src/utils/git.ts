/**
 * Zeno Git Utilities
 *
 * Provides git operations wrapper using simple-git for version control integration.
 * Enables commit automation, tagging for gate releases, and status checks.
 */

import { simpleGit, type SimpleGit, type StatusResult } from 'simple-git'
import { GitError } from './errors.js'

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
 * @param message - Commit message
 * @param files - Files to stage (empty array means all changes)
 * @param dir - Repository directory (default: process.cwd())
 * @returns Commit hash
 * @throws GitError if commit fails
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

    // Create commit
    const result = await git.commit(message)
    return result.commit
  } catch (error) {
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
export async function pushCurrentBranch(
  remote = 'origin',
  dir = process.cwd()
): Promise<void> {
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
 * This is intentionally conservative:
 * - If working tree is clean, it does nothing.
 * - It never pushes unless explicitly requested via autoPush=true.
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
        // eslint-disable-next-line no-console
        console.warn('Push failed but `ignorePushFailure` is true; continuing archive. Error:', error)
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

