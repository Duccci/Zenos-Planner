import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCurrentTimestamp,
  calculateNextGateId,
  createTagName,
  performGitCommitAndPush,
} from '../../src/core/archive-execution.js'

vi.mock('../../src/utils/git.js', () => ({
  createTag: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  pushCurrentBranch: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('archive-execution coverage', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getCurrentTimestamp', () => {
    it('should return ISO timestamp', () => {
      const ts = getCurrentTimestamp()
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('calculateNextGateId', () => {
    it('should increment gate number', () => {
      expect(calculateNextGateId('gate-01')).toBe('gate-02')
      expect(calculateNextGateId('gate-09')).toBe('gate-10')
      expect(calculateNextGateId('gate-99')).toBe('gate-100')
    })
  })

  describe('createTagName', () => {
    it('should create tag from gate id and name', () => {
      expect(createTagName('gate-01', 'Core Infrastructure')).toBe(
        'gate-01-core-infrastructure'
      )
    })

    it('should handle special characters', () => {
      expect(createTagName('gate-02', 'API & Auth!')).toBe('gate-02-api---auth-')
    })
  })

  describe('performGitCommitAndPush', () => {
    it('should commit and push with tag', async () => {
      const { createTag, commit, pushCurrentBranch } = await import('../../src/utils/git.js')

      await performGitCommitAndPush({
        tagName: 'v1.0.0',
        commitMessage: 'release v1.0.0',
        files: ['file1.ts', 'file2.ts'],
        remote: 'origin',
      })

      expect(createTag).toHaveBeenCalledWith('v1.0.0', 'Archive v1.0.0')
      expect(commit).toHaveBeenCalledWith('release v1.0.0', ['file1.ts', 'file2.ts'])
      expect(pushCurrentBranch).toHaveBeenCalledWith('origin')
    })

    it('should commit without tag', async () => {
      const { createTag, commit } = await import('../../src/utils/git.js')

      await performGitCommitAndPush({
        commitMessage: 'no tag commit',
        files: ['file.ts'],
      })

      expect(createTag).not.toHaveBeenCalled()
      expect(commit).toHaveBeenCalledWith('no tag commit', ['file.ts'])
    })

    it('should use default remote', async () => {
      const { pushCurrentBranch } = await import('../../src/utils/git.js')

      await performGitCommitAndPush({
        commitMessage: 'test',
        files: [],
      })

      expect(pushCurrentBranch).toHaveBeenCalledWith('origin')
    })

    it('should continue if push fails', async () => {
      const { pushCurrentBranch } = await import('../../src/utils/git.js')
      vi.mocked(pushCurrentBranch).mockRejectedValueOnce(new Error('push denied'))

      await performGitCommitAndPush({
        commitMessage: 'test',
        files: [],
      })

      // Should not throw
      expect(pushCurrentBranch).toHaveBeenCalled()
    })
  })
})
