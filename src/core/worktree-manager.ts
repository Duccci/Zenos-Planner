import { rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { simpleGit } from 'simple-git'

export interface WorktreeInfo {
  path: string
  branch: string
  proposalHash: string
  createdAt: Date
}

export interface MergeResult {
  conflicts?: string[]
}

export class WorktreeManager {
  private readonly projectRoot: string
  private readonly worktrees = new Map<string, WorktreeInfo>()

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd()
  }

  /**
   * Synchronize in-memory state from git's actual worktree list.
   * Any worktree under `.local/worktrees/<hash>` that is registered with git
   * but not yet tracked in memory is added with createdAt derived from the
   * directory mtime.  Already-tracked entries are not overwritten.
   */
  private async syncFromGit(): Promise<void> {
    const git = simpleGit(this.projectRoot)
    let output: string
    try {
      output = await git.raw(['worktree', 'list', '--porcelain'])
    } catch {
      return
    }

    const blocks = output.trim().split(/\n\n+/)
    for (const block of blocks) {
      const lines = block.trim().split('\n')
      const pathLine = lines.find((l) => l.startsWith('worktree '))
      const branchLine = lines.find((l) => l.startsWith('branch '))
      if (!pathLine) continue

      const wtPath = pathLine.slice('worktree '.length).trim()
      const match = /[/\\]\.local[/\\]worktrees[/\\]([^/\\]+)$/.exec(wtPath)
      if (!match) continue

      const proposalHash = match[1]
      if (!proposalHash) continue
      if (this.worktrees.has(proposalHash)) continue

      const branch = branchLine
        ? branchLine.slice('branch refs/heads/'.length).trim()
        : `proposal/${proposalHash}`

      let createdAt: Date
      try {
        const s = await stat(wtPath)
        createdAt = new Date(s.birthtimeMs || s.mtimeMs)
      } catch {
        // directory may have been removed externally; skip
        continue
      }

      this.worktrees.set(proposalHash, {
        path: `.local/worktrees/${proposalHash}`,
        branch,
        proposalHash,
        createdAt,
      })
    }
  }

  async create(proposalHash: string, _gateId?: string): Promise<WorktreeInfo> {
    const worktreePath = `.local/worktrees/${proposalHash}`
    const branch = `proposal/${proposalHash}`

    const git = simpleGit(this.projectRoot)

    // If the branch already exists (e.g. stale from a prior failed removal),
    // attach worktree to the existing branch instead of creating a new one.
    let branchExists = false
    try {
      const refs = await git.raw(['branch', '--list', branch])
      branchExists = refs.trim().length > 0
    } catch {
      // branch check failed; fall through to the default -b path
    }

    const info: WorktreeInfo = {
      path: worktreePath,
      branch,
      proposalHash,
      createdAt: new Date(),
    }
    this.worktrees.set(proposalHash, info)

    if (branchExists) {
      await git.raw(['worktree', 'add', worktreePath, branch])
    } else {
      await git.raw(['worktree', 'add', '-b', branch, worktreePath])
    }

    return info
  }

  async list(): Promise<WorktreeInfo[]> {
    await this.syncFromGit()
    return Array.from(this.worktrees.values())
  }

  async remove(proposalHash: string, force = false): Promise<void> {
    if (!this.worktrees.has(proposalHash)) {
      await this.syncFromGit()
    }
    const info = this.worktrees.get(proposalHash)
    if (!info) return

    const git = simpleGit(this.projectRoot)
    const args = force
      ? ['worktree', 'remove', '--force', info.path]
      : ['worktree', 'remove', info.path]
    try {
      await git.raw(args)
    } catch (err) {
      // On Windows, 'git worktree remove' can fail with "Filename too long" when the
      // worktree contains paths that exceed MAX_PATH (260 chars). Fall back to manual
      // directory removal using the \\?\ UNC prefix to bypass the limit, then prune
      // git's internal worktree reference.
      const msg = err instanceof Error ? err.message : String(err)
      if (/filename too long|path too long/i.test(msg)) {
        const absPath = resolve(this.projectRoot, info.path)
        const longPath =
          process.platform === 'win32' ? `\\\\?\\${absPath.replace(/\//g, '\\')}` : absPath
        await rm(longPath, { recursive: true, force: true })
        await git.raw(['worktree', 'prune'])
      } else {
        throw err
      }
    }

    // Delete the proposal branch to prevent stale branches from accumulating.
    try {
      await git.raw(['branch', '-D', info.branch])
    } catch {
      // Branch may have already been deleted or never fully created; ignore.
    }

    this.worktrees.delete(proposalHash)
  }

  async prune(knownHashes: Set<string>): Promise<void> {
    await this.syncFromGit()
    const toRemove: string[] = []
    for (const [hash] of this.worktrees) {
      if (!knownHashes.has(hash)) {
        toRemove.push(hash)
      }
    }
    for (const hash of toRemove) {
      await this.remove(hash).catch(() => undefined)
    }
  }

  /**
   * Save the current branch name so it can be restored after operations that
   * require checking out a different branch in the main worktree.
   */
  private async getCurrentBranch(git: ReturnType<typeof simpleGit>): Promise<string | null> {
    try {
      const status = await git.status()
      return status.current
    } catch {
      return null
    }
  }

  async merge(
    proposalHash: string,
    targetBranch: string,
    strategy: 'rebase' | 'squash' | 'merge' = 'merge',
    dryRun = false,
  ): Promise<MergeResult> {
    if (!this.worktrees.has(proposalHash)) {
      await this.syncFromGit()
    }
    const info = this.worktrees.get(proposalHash)
    if (!info) return {}
    if (dryRun) return {}

    const git = simpleGit(this.projectRoot)

    // Guard: refuse to merge/remove if the worktree itself has uncommitted changes.
    // Without this check, `git worktree remove --force` silently destroys any
    // work that was written to disk but never committed to the proposal branch.
    try {
      const worktreeGit = simpleGit(info.path)
      const worktreeStatus = await worktreeGit.status()
      if (!worktreeStatus.isClean()) {
        return {
          conflicts: [
            `Worktree at ${info.path} has uncommitted changes. Commit or stash them before merging.`,
          ],
        }
      }
    } catch {
      // Worktree directory may already be gone; proceed with normal flow.
    }

    // Auto-stash uncommitted changes in the main working tree so the merge can
    // proceed even when a prior step (e.g. approveProposal writing .md metadata)
    // has left the tree dirty.  The stash is popped in the finally block.
    let didStash = false
    const mainStatus = await git.status()
    if (!mainStatus.isClean()) {
      await git.raw(['stash', 'push', '-m', `zeno-merge-auto-stash/${proposalHash}`])
      didStash = true
    }

    try {
      return await this.mergeInner(git, proposalHash, targetBranch, strategy, info)
    } finally {
      if (didStash) {
        try { await git.raw(['stash', 'pop']) } catch { /* best-effort: stash may conflict */ }
      }
    }
  }

  private async mergeInner(
    git: ReturnType<typeof simpleGit>,
    proposalHash: string,
    targetBranch: string,
    strategy: 'rebase' | 'squash' | 'merge',
    info: WorktreeInfo,
  ): Promise<MergeResult> {
    // Remember current branch so we can restore it after merge/squash.
    const previousBranch = await this.getCurrentBranch(git)

    if (strategy === 'rebase') {
      try {
        await git.raw(['checkout', targetBranch])
        await git.raw(['rebase', info.branch])
        await this.remove(proposalHash, true)
        return {}
      } finally {
        // Restore the previous branch in the main worktree.
        if (previousBranch && previousBranch !== targetBranch) {
          try { await git.raw(['checkout', previousBranch]) } catch { /* best-effort */ }
        }
      }
    }

    if (strategy === 'squash') {
      try {
        await git.raw(['checkout', targetBranch])
        await git.raw(['merge', '--squash', info.branch])
        // --squash stages changes but does NOT create a commit; finalize it.
        await git.raw(['commit', '-m', `squash: merge proposal/${proposalHash}`])
        await this.remove(proposalHash, true)
        return {}
      } finally {
        if (previousBranch && previousBranch !== targetBranch) {
          try { await git.raw(['checkout', previousBranch]) } catch { /* best-effort */ }
        }
      }
    }

    // Default: standard merge.
    // First check if the proposal branch has any commits not already in targetBranch.
    let hasNewCommits = false
    try {
      const count = await git.raw(['rev-list', `${targetBranch}..${info.branch}`, '--count'])
      hasNewCommits = parseInt(count.trim(), 10) > 0
    } catch {
      // rev-list failed (e.g. targetBranch doesn't exist yet); skip merge.
    }

    if (!hasNewCommits) {
      // Nothing to integrate — just clean up the worktree.
      await this.remove(proposalHash, true)
      return {}
    }

    const defaultPreviousBranch = await this.getCurrentBranch(git)
    try {
      await git.raw(['checkout', targetBranch])
      const result = await git.merge([info.branch])
      const conflicts = (result as unknown as { conflicts?: string[] }).conflicts ?? []
      if (conflicts.length === 0) {
        await this.remove(proposalHash, true)
        return {}
      }
      return { conflicts }
    } finally {
      if (defaultPreviousBranch && defaultPreviousBranch !== targetBranch) {
        try { await git.raw(['checkout', defaultPreviousBranch]) } catch { /* best-effort */ }
      }
    }
  }
}
