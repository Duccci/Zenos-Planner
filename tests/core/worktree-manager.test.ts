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
      status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'main' }),
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
    it('should remove only orphaned worktrees', async () => {
      const knownHash = 'known-proposal';
      const orphanHash = 'orphan-proposal';
      await manager.create(knownHash);
      await manager.create(orphanHash);

      // Prune with only knownHash in the known set
      await manager.prune(new Set([knownHash]));

      const list = await manager.list();

      expect(list.some(w => w.proposalHash === knownHash)).toBe(true);
      expect(list.some(w => w.proposalHash === orphanHash)).toBe(false);
    });

    it('should preserve worktrees that have a matching proposal', async () => {
      const hash1 = 'wt-preserve-1';
      const hash2 = 'wt-preserve-2';
      await manager.create(hash1);
      await manager.create(hash2);

      // Both hashes are known — nothing should be pruned
      await manager.prune(new Set([hash1, hash2]));

      const list = await manager.list();

      expect(list).toHaveLength(2);
      expect(list.map(w => w.proposalHash)).toContain(hash1);
      expect(list.map(w => w.proposalHash)).toContain(hash2);
    });

    it('should remove all worktrees when known set is empty', async () => {
      const hash1 = 'wt-orphan-1';
      const hash2 = 'wt-orphan-2';
      await manager.create(hash1);
      await manager.create(hash2);

      // Empty known set — all are orphaned
      await manager.prune(new Set());

      const list = await manager.list();

      expect(list).toHaveLength(0);
    });
  });

  describe('merge()', () => {
    it('should resolve without error on successful git operation', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        merge: vi.fn().mockResolvedValue({ ok: true }),
        status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'main' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'merge-test';
      const targetBranch = 'main';

      await manager.create(proposalHash);

      expect(async () => {
        await manager.merge(proposalHash, targetBranch);
      }).not.toThrow();
    });

    it('should checkout target branch and call git merge with branch name when proposal has new commits', async () => {
      const rawCalls: string[][] = [];
      const mockGit = {
        raw: vi.fn().mockImplementation((...args: string[][]) => {
          rawCalls.push(args[0]);
          // Simulate 1 new commit on proposal branch
          if (args[0][0] === 'rev-list') {
            return Promise.resolve('1');
          }
          return Promise.resolve('');
        }),
        merge: vi.fn().mockResolvedValue({ conflicts: [] }),
        status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'main' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'merge-params';
      const targetBranch = 'develop';
      const m = new WorktreeManager();

      await m.create(proposalHash);
      rawCalls.length = 0;
      await m.merge(proposalHash, targetBranch);

      // Should checkout the target branch first
      const checkoutCall = rawCalls.find(c => c[0] === 'checkout' && c[1] === targetBranch);
      expect(checkoutCall).toBeDefined();
      // Should call git.merge with the proposal branch as an array element
      expect(mockGit.merge).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining(proposalHash)])
      );
    });

    it('should handle merge conflicts gracefully', async () => {
      const mockGit = {
        raw: vi.fn().mockImplementation((...args: string[][]) => {
          // Simulate 1 new commit so the merge path is exercised
          if (args[0][0] === 'rev-list') {
            return Promise.resolve('1');
          }
          return Promise.resolve('');
        }),
        merge: vi.fn().mockResolvedValue({ conflicts: ['file.ts'] }),
        status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'main' }),
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
        status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'main' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'merge-cleanup';
      await manager.create(proposalHash);

      await manager.merge(proposalHash, 'main');

      const list = await manager.list();

      expect(list.some(w => w.proposalHash === proposalHash)).toBe(false);
    });

    it('should commit after squash merge', async () => {
      const rawCalls: string[][] = [];
      const mockGit = {
        raw: vi.fn().mockImplementation((...args: string[][]) => {
          rawCalls.push(args[0]);
          return Promise.resolve('');
        }),
        merge: vi.fn().mockResolvedValue({ ok: true }),
        status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'feature' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'squash-commit-test';
      await manager.create(proposalHash);

      // Reset rawCalls after create to only track merge calls
      rawCalls.length = 0;
      await manager.merge(proposalHash, 'main', 'squash');

      // Verify the sequence: checkout -> merge --squash -> commit -> worktree remove -> branch -D
      const checkoutIdx = rawCalls.findIndex(c => c[0] === 'checkout' && c[1] === 'main');
      const squashIdx = rawCalls.findIndex(c => c[0] === 'merge' && c[1] === '--squash');
      const commitIdx = rawCalls.findIndex(c => c[0] === 'commit');

      expect(checkoutIdx).toBeGreaterThanOrEqual(0);
      expect(squashIdx).toBeGreaterThan(checkoutIdx);
      expect(commitIdx).toBeGreaterThan(squashIdx);
      expect(rawCalls[commitIdx]).toEqual(expect.arrayContaining(['commit', '-m', expect.stringContaining('squash')]));
    });

    it('should refuse squash merge when working tree is dirty', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        merge: vi.fn().mockResolvedValue({ ok: true }),
        status: vi.fn().mockResolvedValue({ isClean: () => false, current: 'main' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'dirty-squash';
      await manager.create(proposalHash);

      const result = await manager.merge(proposalHash, 'main', 'squash');

      expect(result.conflicts).toBeDefined();
      expect(result.conflicts![0]).toContain('uncommitted changes');
    });

    it('should refuse rebase merge when working tree is dirty', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        merge: vi.fn().mockResolvedValue({ ok: true }),
        status: vi.fn().mockResolvedValue({ isClean: () => false, current: 'main' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'dirty-rebase';
      await manager.create(proposalHash);

      const result = await manager.merge(proposalHash, 'main', 'rebase');

      expect(result.conflicts).toBeDefined();
      expect(result.conflicts![0]).toContain('uncommitted changes');
    });

    it('should restore previous branch after squash merge', async () => {
      const rawCalls: string[][] = [];
      const mockGit = {
        raw: vi.fn().mockImplementation((...args: string[][]) => {
          rawCalls.push(args[0]);
          return Promise.resolve('');
        }),
        merge: vi.fn().mockResolvedValue({ ok: true }),
        status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'feature-branch' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const proposalHash = 'restore-branch';
      await manager.create(proposalHash);
      rawCalls.length = 0;

      await manager.merge(proposalHash, 'main', 'squash');

      // Last checkout should restore `feature-branch`
      const checkoutCalls = rawCalls.filter(c => c[0] === 'checkout');
      const lastCheckout = checkoutCalls[checkoutCalls.length - 1];
      expect(lastCheckout).toEqual(['checkout', 'feature-branch']);
    });
  });

  describe('create() - existing branch handling', () => {
    it('should attach to an existing branch instead of creating a new one', async () => {
      const rawCalls: string[][] = [];
      const mockGit = {
        raw: vi.fn().mockImplementation((...args: string[][]) => {
          rawCalls.push(args[0]);
          // Return non-empty string for branch --list to simulate existing branch
          if (args[0][0] === 'branch' && args[0][1] === '--list') {
            return Promise.resolve('  proposal/existing-hash\n');
          }
          return Promise.resolve('');
        }),
        merge: vi.fn().mockResolvedValue({ ok: true }),
        status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'main' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const m = new WorktreeManager();
      await m.create('existing-hash');

      // Should use `worktree add <path> <branch>` (without -b)
      const addCall = rawCalls.find(c => c[0] === 'worktree' && c[1] === 'add');
      expect(addCall).toBeDefined();
      expect(addCall).not.toContain('-b');
    });
  });

  describe('remove() - branch cleanup', () => {
    it('should delete the proposal branch after removing the worktree', async () => {
      const rawCalls: string[][] = [];
      const mockGit = {
        raw: vi.fn().mockImplementation((...args: string[][]) => {
          rawCalls.push(args[0]);
          return Promise.resolve('');
        }),
        merge: vi.fn().mockResolvedValue({ ok: true }),
        status: vi.fn().mockResolvedValue({ isClean: () => true, current: 'main' }),
      };

      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const m = new WorktreeManager();
      await m.create('branch-cleanup-test');
      rawCalls.length = 0;

      await m.remove('branch-cleanup-test');

      const branchDeleteCall = rawCalls.find(c => c[0] === 'branch' && c[1] === '-D');
      expect(branchDeleteCall).toBeDefined();
      expect(branchDeleteCall![2]).toBe('proposal/branch-cleanup-test');
    });
  });
});
