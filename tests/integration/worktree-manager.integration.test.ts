import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WorktreeManager } from '../../src/core/worktree-manager.js'

vi.mock('simple-git')
vi.mock('node:fs/promises', () => ({
  stat: vi.fn().mockResolvedValue({ birthtimeMs: 0, mtimeMs: Date.now() }),
}))

// ─── suite ───────────────────────────────────────────────────────────────────

describe('WorktreeManager (integration)', () => {
  let manager: WorktreeManager

  beforeEach(async () => {
    vi.clearAllMocks()
    const { simpleGit } = await import('simple-git')
    vi.mocked(simpleGit).mockReturnValue({
      raw: vi.fn().mockResolvedValue(''),
      merge: vi.fn().mockResolvedValue({ ok: true }),
    } as any)
    manager = new WorktreeManager()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('returns WorktreeInfo with correct shape', async () => {
      const info = await manager.create('abc123')

      expect(info).toMatchObject({
        path: expect.stringContaining('abc123'),
        branch: expect.stringContaining('abc123'),
        proposalHash: 'abc123',
      })
      expect(info.createdAt).toBeInstanceOf(Date)
    })

    it('places worktree path under .local/worktrees/{hash}', async () => {
      const info = await manager.create('myhash')

      expect(info.path).toMatch(/\.local[/\\]worktrees[/\\]myhash/)
    })

    it('generates unique branches for different hashes', async () => {
      const a = await manager.create('hash-a')
      const b = await manager.create('hash-b')

      expect(a.branch).not.toBe(b.branch)
    })

    it('sets createdAt close to now', async () => {
      const before = Date.now()
      const info = await manager.create('timestamped')
      const after = Date.now()

      expect(info.createdAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(info.createdAt.getTime()).toBeLessThanOrEqual(after)
    })
  })

  // ─── list() ────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns an empty array when no worktrees have been created', async () => {
      const list = await manager.list()

      expect(Array.isArray(list)).toBe(true)
      expect(list).toHaveLength(0)
    })

    it('returns created worktree in the active list', async () => {
      await manager.create('list-hash-01')
      await manager.create('list-hash-02')

      const list = await manager.list()

      expect(list).toHaveLength(2)
      expect(list.map((w) => w.proposalHash)).toContain('list-hash-01')
      expect(list.map((w) => w.proposalHash)).toContain('list-hash-02')
    })
  })

  // ─── remove() ──────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deregisters the worktree so it no longer appears in list()', async () => {
      await manager.create('remove-me')

      await manager.remove('remove-me')

      const list = await manager.list()
      expect(list.find((w) => w.proposalHash === 'remove-me')).toBeUndefined()
    })

    it('resolves without error when removing a non-existent hash', async () => {
      await expect(manager.remove('does-not-exist')).resolves.toBeUndefined()
    })
  })

  // ─── prune() ───────────────────────────────────────────────────────────────

  describe('prune()', () => {
    it('removes orphaned worktrees not in known set', async () => {
      await manager.create('orphan-worktree')

      await manager.prune(new Set()) // empty known set — all are orphaned

      const list = await manager.list()
      expect(list.find((w) => w.proposalHash === 'orphan-worktree')).toBeUndefined()
    })

    it('keeps worktrees that have a matching proposal in known set', async () => {
      await manager.create('known-worktree')

      await manager.prune(new Set(['known-worktree']))

      const list = await manager.list()
      expect(list.find((w) => w.proposalHash === 'known-worktree')).toBeDefined()
    })

    it('resolves without error when no worktrees exist', async () => {
      await expect(manager.prune(new Set())).resolves.toBeUndefined()
    })
  })

  // ─── syncFromGit() ─────────────────────────────────────────────────────────

  describe('syncFromGit() via list()', () => {
    it('discovers orphaned worktrees from git that are not in memory', async () => {
      const { simpleGit } = await import('simple-git')
      const porcelain = [
        'worktree /absolute/path/.local/worktrees/orphaned-hash',
        'HEAD abc1234',
        'branch refs/heads/proposal/orphaned-hash',
        '',
      ].join('\n')
      vi.mocked(simpleGit).mockReturnValue({
        raw: vi.fn().mockResolvedValue(porcelain),
        merge: vi.fn().mockResolvedValue({ ok: true }),
      } as any)

      const freshManager = new WorktreeManager()
      const list = await freshManager.list()

      expect(list.find((w) => w.proposalHash === 'orphaned-hash')).toBeDefined()
    })

    it('does not duplicate worktrees already tracked in memory', async () => {
      const { simpleGit } = await import('simple-git')
      const porcelain = [
        'worktree /absolute/path/.local/worktrees/tracked-hash',
        'HEAD abc1234',
        'branch refs/heads/proposal/tracked-hash',
        '',
      ].join('\n')
      vi.mocked(simpleGit).mockReturnValue({
        raw: vi.fn().mockResolvedValue(porcelain),
        merge: vi.fn().mockResolvedValue({ ok: true }),
      } as any)

      const freshManager = new WorktreeManager()
      await freshManager.create('tracked-hash')
      const list = await freshManager.list()

      expect(list.filter((w) => w.proposalHash === 'tracked-hash')).toHaveLength(1)
    })

    it('ignores worktrees not under .local/worktrees/', async () => {
      const { simpleGit } = await import('simple-git')
      const porcelain = [
        'worktree /some/other/path',
        'HEAD abc1234',
        'branch refs/heads/main',
        '',
      ].join('\n')
      vi.mocked(simpleGit).mockReturnValue({
        raw: vi.fn().mockResolvedValue(porcelain),
        merge: vi.fn().mockResolvedValue({ ok: true }),
      } as any)

      const freshManager = new WorktreeManager()
      const list = await freshManager.list()

      expect(list).toHaveLength(0)
    })
  })
})
