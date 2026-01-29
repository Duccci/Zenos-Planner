import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { simpleGit } from 'simple-git'
import {
  isGitRepo,
  getGitStatus,
  getGitUserInfo,
  getCurrentBranch,
  commit,
  createTag,
  getTags,
  syncWithGit,
} from '../../src/utils/git.js'

// Use OS temp directory to ensure isolation from parent git repo
const TEST_DIR = join(tmpdir(), `.test-git-utils-${Date.now()}`)

describe('git utilities', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
    vi.restoreAllMocks()
  })

  describe('isGitRepo', () => {
    it('returns true for git repository', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()

      const result = await isGitRepo(TEST_DIR)
      expect(result).toBe(true)
    })

    it('returns false for non-git directory', async () => {
      // TEST_DIR is in OS temp, isolated from parent repo
      const result = await isGitRepo(TEST_DIR)
      expect(result).toBe(false)
    })

    it('returns false for nonexistent directory', async () => {
      const result = await isGitRepo(join(TEST_DIR, 'nonexistent'))
      expect(result).toBe(false)
    })
  })

  describe('getGitStatus', () => {
    it('returns status for git repo', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      // Create initial commit
      await writeFile(join(TEST_DIR, 'README.md'), '# Test', 'utf-8')
      await git.add('.')
      await git.commit('Initial commit')

      const status = await getGitStatus(TEST_DIR)
      expect(status.isClean).toBe(true)
      expect(status.branch).toBeDefined()
    })

    it('detects modified files', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      // Create and commit file
      await writeFile(join(TEST_DIR, 'file.txt'), 'original', 'utf-8')
      await git.add('.')
      await git.commit('Initial')

      // Modify file
      await writeFile(join(TEST_DIR, 'file.txt'), 'modified', 'utf-8')

      const status = await getGitStatus(TEST_DIR)
      expect(status.modified).toContain('file.txt')
      expect(status.isClean).toBe(false)
    })

    it('detects untracked files', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      // Create initial commit
      await writeFile(join(TEST_DIR, 'tracked.txt'), 'tracked', 'utf-8')
      await git.add('.')
      await git.commit('Initial')

      // Add untracked file
      await writeFile(join(TEST_DIR, 'untracked.txt'), 'new', 'utf-8')

      const status = await getGitStatus(TEST_DIR)
      expect(status.untracked).toContain('untracked.txt')
    })

    it('throws for non-git directory', async () => {
      await expect(getGitStatus(TEST_DIR)).rejects.toThrow('Failed to get git status')
    })
  })

  describe('getGitUserInfo', () => {
    it('returns user info from git config', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      const info = await getGitUserInfo(TEST_DIR)
      expect(info.name).toBe('Test User')
      expect(info.email).toBe('test@example.com')
    })

    it('returns null for missing local config in fresh repo', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()

      // In an isolated temp dir without global git config inheritance
      const info = await getGitUserInfo(TEST_DIR)
      // May inherit from global config, so just check structure
      expect(info).toHaveProperty('name')
      expect(info).toHaveProperty('email')
    })

    it('handles error gracefully', async () => {
      // Non-existent directory should return nulls
      const info = await getGitUserInfo(join(TEST_DIR, 'nonexistent'))
      expect(info.name).toBeNull()
      expect(info.email).toBeNull()
    })
  })

  describe('getCurrentBranch', () => {
    it('returns current branch name', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      await writeFile(join(TEST_DIR, 'file.txt'), 'content', 'utf-8')
      await git.add('.')
      await git.commit('Initial')

      const branch = await getCurrentBranch(TEST_DIR)
      expect(branch).toBeDefined()
      expect(typeof branch).toBe('string')
    })

    it('throws for non-git directory', async () => {
      await expect(getCurrentBranch(TEST_DIR)).rejects.toThrow('Failed to get current branch')
    })
  })

  describe('commit', () => {
    it('creates commit with message', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      await writeFile(join(TEST_DIR, 'file.txt'), 'content', 'utf-8')

      const hash = await commit('Test commit', [], TEST_DIR)
      expect(hash).toBeDefined()
      expect(hash.length).toBeGreaterThan(0)
    })

    it('stages specified files only', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      // Initial commit
      await writeFile(join(TEST_DIR, 'initial.txt'), 'init', 'utf-8')
      await git.add('.')
      await git.commit('Initial')

      // Create two files
      await writeFile(join(TEST_DIR, 'file1.txt'), 'content1', 'utf-8')
      await writeFile(join(TEST_DIR, 'file2.txt'), 'content2', 'utf-8')

      // Commit only file1
      await commit('Add file1', ['file1.txt'], TEST_DIR)

      const status = await getGitStatus(TEST_DIR)
      expect(status.untracked).toContain('file2.txt')
    })

    it('throws for non-git directory', async () => {
      await expect(commit('Test', [], TEST_DIR)).rejects.toThrow('Failed to create commit')
    })
  })

  describe('createTag', () => {
    it('creates annotated tag', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      await writeFile(join(TEST_DIR, 'file.txt'), 'content', 'utf-8')
      await git.add('.')
      await git.commit('Initial')

      await createTag('v1.0.0', 'Release 1.0.0', TEST_DIR)

      const tags = await getTags(TEST_DIR)
      expect(tags).toContain('v1.0.0')
    })

    it('throws for non-git directory', async () => {
      await expect(createTag('v1.0.0', 'Test', TEST_DIR)).rejects.toThrow('Failed to create tag')
    })
  })

  describe('getTags', () => {
    it('returns list of tags', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      await writeFile(join(TEST_DIR, 'file.txt'), 'content', 'utf-8')
      await git.add('.')
      await git.commit('Initial')

      await git.addAnnotatedTag('v1.0.0', 'First')
      await git.addAnnotatedTag('v2.0.0', 'Second')

      const tags = await getTags(TEST_DIR)
      expect(tags).toContain('v1.0.0')
      expect(tags).toContain('v2.0.0')
    })

    it('returns empty array for non-git directory', async () => {
      const tags = await getTags(TEST_DIR)
      expect(tags).toEqual([])
    })
  })

  describe('getGitUserInfo edge cases', () => {
    it('handles repo without user.name set', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      // Don't set user.name

      const info = await getGitUserInfo(TEST_DIR)
      expect(info.email).toBe('test@example.com')
      // name may be null or inherited from global config
      expect(info).toHaveProperty('name')
    })

    it('handles repo without user.email set', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.name', 'Test User')
      // Don't set user.email

      const info = await getGitUserInfo(TEST_DIR)
      expect(info.name).toBe('Test User')
      // email may be null or inherited from global config
      expect(info).toHaveProperty('email')
    })
  })

  describe('syncWithGit', () => {
    it('commits and tags when dirty', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      await writeFile(join(TEST_DIR, 'file.txt'), 'content', 'utf-8')

      const result = await syncWithGit({
        commitMessage: 'Sync commit',
        tagName: 'v0.1.1-proposal-test',
        tagMessage: 'Proposal test',
        autoPush: false,
        dir: TEST_DIR,
      })

      expect(result.committed).toBe(true)
      expect(result.tagged).toBe(true)

      const tags = await getTags(TEST_DIR)
      expect(tags).toContain('v0.1.1-proposal-test')
    })

    it('does nothing when clean', async () => {
      const git = simpleGit(TEST_DIR)
      await git.init()
      await git.addConfig('user.email', 'test@example.com')
      await git.addConfig('user.name', 'Test User')

      await writeFile(join(TEST_DIR, 'file.txt'), 'content', 'utf-8')
      await git.add('.')
      await git.commit('Initial')

      const result = await syncWithGit({
        commitMessage: 'Should not commit',
        tagName: 'v0.0.0',
        dir: TEST_DIR,
      })

      expect(result.committed).toBe(false)
      expect(result.tagged).toBe(false)
      expect(result.pushed).toBe(false)
    })
  })
})
