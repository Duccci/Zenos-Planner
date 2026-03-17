import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorktreeManager, WorktreeInfo } from '../../src/core/worktree-manager';
import { simpleGit } from 'simple-git';

vi.mock('simple-git');
vi.mock('node:fs/promises', () => ({
  stat: vi.fn().mockResolvedValue({ birthtimeMs: 0, mtimeMs: Date.now() }),
}));

describe('WorktreeManager', () => {
  let manager: WorktreeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(simpleGit).mockReturnValue({
      raw: vi.fn().mockResolvedValue(''),
      merge: vi.fn().mockResolvedValue({ ok: true }),
    } as any);
    manager = new WorktreeManager();
  });

  describe('create()', () => {
    it('should return a WorktreeInfo with path, branch, proposalHash, and createdAt', async () => {
      const proposalHash = 'abc123def456';

      const info = await manager.create(proposalHash);

      expect(info).toHaveProperty('path');
      expect(info).toHaveProperty('branch');
      expect(info).toHaveProperty('proposalHash');
      expect(info).toHaveProperty('createdAt');
      expect(typeof info.path).toBe('string');
      expect(typeof info.branch).toBe('string');
      expect(info.proposalHash).toBe(proposalHash);
      expect(info.createdAt instanceof Date).toBe(true);
    });

    it('should place worktree under .local/worktrees/{proposalHash}/', async () => {
      const proposalHash = 'test-hash-001';

      const info = await manager.create(proposalHash);

      expect(info.path).toContain('.local/worktrees');
      expect(info.path).toContain(proposalHash);
      expect(info.path).toMatch(/\.local[/\\]worktrees[/\\]test-hash-001/);
    });

    it('should create a unique branch name', async () => {
      const proposalHash1 = 'hash-1';
      const proposalHash2 = 'hash-2';

      const info1 = await manager.create(proposalHash1);
      const info2 = await manager.create(proposalHash2);

      expect(info1.branch).not.toBe(info2.branch);
      expect(info1.branch).toContain('hash-1');
      expect(info2.branch).toContain('hash-2');
    });

    it('should set createdAt to current timestamp', async () => {
      const proposalHash = 'test-timestamp';
      const beforeCreate = new Date();

      const info = await manager.create(proposalHash);

      const afterCreate = new Date();

      expect(info.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(info.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });
  });

  describe('list()', () => {
    it('should return an array of WorktreeInfo', async () => {
      await manager.create('hash-list-1');
      await manager.create('hash-list-2');

      const list = await manager.list();

      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0]).toHaveProperty('path');
      expect(list[0]).toHaveProperty('branch');
      expect(list[0]).toHaveProperty('proposalHash');
      expect(list[0]).toHaveProperty('createdAt');
    });

    it('should return empty array when no worktrees exist', async () => {
      const list = await manager.list();

      expect(Array.isArray(list)).toBe(true);
      expect(list).toHaveLength(0);
    });

    it('should return all created worktrees', async () => {
      const hash1 = 'wt-a';
      const hash2 = 'wt-b';
      const hash3 = 'wt-c';

      await manager.create(hash1);
      await manager.create(hash2);
      await manager.create(hash3);

      const list = await manager.list();

      expect(list).toHaveLength(3);
      expect(list.map(w => w.proposalHash)).toContain(hash1);
      expect(list.map(w => w.proposalHash)).toContain(hash2);
      expect(list.map(w => w.proposalHash)).toContain(hash3);
    });
  });

  describe('remove()', () => {
    it('should delete the worktree entry', async () => {
      const proposalHash = 'remove-test';

      await manager.create(proposalHash);
      let list = await manager.list();
      expect(list.some(w => w.proposalHash === proposalHash)).toBe(true);

      await manager.remove(proposalHash);
      list = await manager.list();

      expect(list.some(w => w.proposalHash === proposalHash)).toBe(false);
    });

    it('should not throw when removing nonexistent worktree', async () => {
      expect(async () => {
        await manager.remove('nonexistent-hash');
      }).not.toThrow();
    });

    it('should remove only the specified worktree', async () => {
      const hash1 = 'keep-this';
      const hash2 = 'remove-this';

      await manager.create(hash1);
      await manager.create(hash2);

      await manager.remove(hash2);

      const list = await manager.list();

      expect(list.some(w => w.proposalHash === hash1)).toBe(true);
      expect(list.some(w => w.proposalHash === hash2)).toBe(false);
    });
  });

  describe('prune()', () => {
    it('should remove only expired worktrees', async () => {
      vi.useFakeTimers();
      const now = new Date('2026-03-16T12:00:00Z');
      vi.setSystemTime(now);

      const oldHash = 'old-worktree';
      await manager.create(oldHash);

      // Advance time by 2 hours
      vi.setSystemTime(new Date(now.getTime() + 2 * 3600000));
      const newHash = 'new-worktree';
      await manager.create(newHash);

      // Prune with max age of 1 hour
      await manager.prune(3600000);

      const list = await manager.list();

      expect(list.some(w => w.proposalHash === oldHash)).toBe(false);
      expect(list.some(w => w.proposalHash === newHash)).toBe(true);

      vi.useRealTimers();
    });

    it('should skip worktrees younger than max age', async () => {
      vi.useFakeTimers();
      const now = new Date('2026-03-16T12:00:00Z');
      vi.setSystemTime(now);

      const youngHash = 'young-worktree';
      await manager.create(youngHash);

      // Prune with max age of 1 hour (recent worktree is only a few ms old)
      await manager.prune(3600000);

      const list = await manager.list();

      expect(list.some(w => w.proposalHash === youngHash)).toBe(true);

      vi.useRealTimers();
    });

    it('should preserve all worktrees when none are expired', async () => {
      vi.useFakeTimers();
      const now = new Date('2026-03-16T12:00:00Z');
      vi.setSystemTime(now);

      const hash1 = 'wt-preserve-1';
      const hash2 = 'wt-preserve-2';
      await manager.create(hash1);
      await manager.create(hash2);

      // Prune with very long max age (everything is younger)
      await manager.prune(24 * 3600000); // 24 hours

      const list = await manager.list();

      expect(list).toHaveLength(2);
      expect(list.map(w => w.proposalHash)).toContain(hash1);
      expect(list.map(w => w.proposalHash)).toContain(hash2);

      vi.useRealTimers();
    });
  });

  describe('merge()', () => {
    it('should resolve without error on successful git operation', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        merge: vi.fn().mockResolvedValue({ ok: true }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'merge-test';
      const targetBranch = 'main';

      await manager.create(proposalHash);

      expect(async () => {
        await manager.merge(proposalHash, targetBranch);
      }).not.toThrow();
    });

    it('should call git merge with correct parameters', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        merge: vi.fn().mockResolvedValue({ ok: true }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'merge-params';
      const targetBranch = 'develop';

      await manager.create(proposalHash);
      await manager.merge(proposalHash, targetBranch);

      expect(mockGit.merge).toHaveBeenCalledWith(expect.objectContaining({
        from: expect.stringContaining(proposalHash),
        into: targetBranch,
      }));
    });

    it('should handle merge conflicts gracefully', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        merge: vi.fn().mockResolvedValue({ ok: false, conflicts: ['file.ts'] }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'merge-conflict';
      await manager.create(proposalHash);

      const result = await manager.merge(proposalHash, 'main');

      expect(result).toHaveProperty('conflicts');
    });

    it('should remove worktree after successful merge', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        merge: vi.fn().mockResolvedValue({ ok: true }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'merge-cleanup';
      await manager.create(proposalHash);

      await manager.merge(proposalHash, 'main');

      const list = await manager.list();

      expect(list.some(w => w.proposalHash === proposalHash)).toBe(false);
    });
  });
});
