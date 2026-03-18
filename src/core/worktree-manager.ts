import { stat } from 'node:fs/promises'
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

    const info: WorktreeInfo = {
      path: worktreePath,
      branch,
      proposalHash,
      createdAt: new Date(),
    }
    this.worktrees.set(proposalHash, info)

    const git = simpleGit(this.projectRoot)
    await git.raw(['worktree', 'add', '-b', branch, worktreePath])

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
    await git.raw(args)

    this.worktrees.delete(proposalHash)
  }

  async prune(maxAgeMs: number): Promise<void> {
    await this.syncFromGit()
    const now = Date.now()
    const toRemove: string[] = []
    for (const [hash, info] of this.worktrees) {
      if (now - info.createdAt.getTime() >= maxAgeMs) {
        toRemove.push(hash)
      }
    }
    for (const hash of toRemove) {
      await this.remove(hash).catch(() => undefined)
    }
  }

  async merge(
    proposalHash: string,
    targetBranch: string,
    strategy: 'rebase' | 'squash' | 'merge' = 'merge',
    dryRun = false,
  ): Promise<MergeResult> {
    const info = this.worktrees.get(proposalHash)
    if (!info) return {}
    if (dryRun) return {}

    const git = simpleGit(this.projectRoot)

    if (strategy === 'rebase') {
      await git.raw(['checkout', targetBranch])
      await git.raw(['rebase', info.branch])
      await this.remove(proposalHash, true)
      return {}
    }

    if (strategy === 'squash') {
      await git.raw(['checkout', targetBranch])
      await git.raw(['merge', '--squash', info.branch])
      await this.remove(proposalHash, true)
      return {}
    }

    // Default: standard merge
    const result = await git.merge({ from: info.branch, into: targetBranch } as Parameters<typeof git.merge>[0])
    const mergeResult = result as unknown as { ok: boolean; conflicts?: string[] }
    if (mergeResult.ok) {
      await this.remove(proposalHash, true)
      return {}
    }

    return { conflicts: mergeResult.conflicts ?? [] }
  }
}
