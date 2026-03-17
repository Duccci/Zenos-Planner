import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WorktreeManager } from '../../src/core/worktree-manager.js'

vi.mock('simple-git')

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
    it('removes worktrees older than maxAgeMs', async () => {
      await manager.create('old-worktree')
      // wait a tick so createdAt is measurably in the past
      await new Promise((r) => setTimeout(r, 5))

      await manager.prune(1) // maxAgeMs=1ms, everything older is pruned

      const list = await manager.list()
      expect(list.find((w) => w.proposalHash === 'old-worktree')).toBeUndefined()
    })

    it('keeps worktrees younger than maxAgeMs', async () => {
      await manager.create('young-worktree')

      await manager.prune(60_000) // 1 minute — nothing is that old

      const list = await manager.list()
      expect(list.find((w) => w.proposalHash === 'young-worktree')).toBeDefined()
    })

    it('resolves without error when no worktrees exist', async () => {
      await expect(manager.prune(1000)).resolves.toBeUndefined()
    })
  })
})
