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

  list(): Promise<WorktreeInfo[]> {
    return Promise.resolve(Array.from(this.worktrees.values()))
  }

  async remove(proposalHash: string, force = false): Promise<void> {
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
      this.worktrees.delete(proposalHash)
      return {}
    }

    if (strategy === 'squash') {
      await git.raw(['checkout', targetBranch])
      await git.raw(['merge', '--squash', info.branch])
      this.worktrees.delete(proposalHash)
      return {}
    }

    // Default: standard merge
    const result = await git.merge({ from: info.branch, into: targetBranch } as Parameters<typeof git.merge>[0])
    const mergeResult = result as unknown as { ok: boolean; conflicts?: string[] }
    if (mergeResult.ok) {
      this.worktrees.delete(proposalHash)
      return {}
    }

    return { conflicts: mergeResult.conflicts ?? [] }
  }
}
