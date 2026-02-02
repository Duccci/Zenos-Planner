import { describe, it, expect, vi } from 'vitest'
import { parseCommitsForHashes, applyHashMatchingHeuristics } from '../../src/utils/git.js'

// Mock simple-git
vi.mock('simple-git', () => ({
  simpleGit: vi.fn()
}))

// Mock loadConfig
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn()
}))

describe('git trace utilities', () => {
  describe('applyHashMatchingHeuristics', () => {
    it('returns high confidence for direct hash match', () => {
      const message = 'feat: implement #g03p08gittrace functionality'
      const targetHash = '#g03p08gittrace'
      const commitFormat = 'feat(%s): %m'

      const result = applyHashMatchingHeuristics(message, targetHash, commitFormat)

      expect(result.matchedHashes).toContain(targetHash)
      expect(result.confidenceScore).toBe(1.0)
      expect(result.notes).toBe('Direct hash match in commit message')
    })

    it('returns medium confidence for hash without # prefix', () => {
      const message = 'feat: implement g03p08gittrace functionality'
      const targetHash = '#g03p08gittrace'
      const commitFormat = 'feat(%s): %m'

      const result = applyHashMatchingHeuristics(message, targetHash, commitFormat)

      expect(result.matchedHashes).toContain(targetHash)
      expect(result.confidenceScore).toBe(0.7)
      expect(result.notes).toBe('Hash match without # prefix')
    })

    it('returns medium confidence for fuzzy match', () => {
      const message = 'feat: implement g03p08gittrac functionality' // missing 'e'
      const targetHash = '#g03p08gittrace'
      const commitFormat = 'feat(%s): %m'

      const result = applyHashMatchingHeuristics(message, targetHash, commitFormat)

      expect(result.matchedHashes).toContain(targetHash)
      expect(result.confidenceScore).toBe(0.6)
      expect(result.notes).toBe('Fuzzy hash match')
    })

    it('returns low confidence for no match', () => {
      const message = 'feat: implement some other functionality'
      const targetHash = '#g03p08gittrace'
      const commitFormat = 'feat(%s): %m'

      const result = applyHashMatchingHeuristics(message, targetHash, commitFormat)

      expect(result.matchedHashes).toHaveLength(0)
      expect(result.confidenceScore).toBe(0)
      expect(result.notes).toBeUndefined()
    })

    it('handles commitFormat with scope', () => {
      const message = 'feat(#g03p08gittrace): implement functionality'
      const targetHash = '#g03p08gittrace'
      const commitFormat = 'feat(%s): %m'

      const result = applyHashMatchingHeuristics(message, targetHash, commitFormat)

      expect(result.matchedHashes).toContain(targetHash)
      expect(result.confidenceScore).toBe(1.0) // Direct match
      expect(result.notes).toBe('Direct hash match in commit message')
    })
  })

  describe('parseCommitsForHashes', () => {
    it('parses git log output correctly', async () => {
      // Mock git
      const mockGit = {
        raw: vi.fn().mockResolvedValue(`abc123def|John Doe|john@example.com|2026-02-01 10:00:00 +0000|feat: implement #g03p08gittrace|This implements the git trace tool\n`),
        status: vi.fn(),
        checkIsRepo: vi.fn()
      }

      const { simpleGit } = await import('simple-git')
      vi.mocked(simpleGit).mockReturnValue(mockGit as any)

      // Mock config
      const { loadConfig } = await import('../../src/utils/config.js')
      vi.mocked(loadConfig).mockResolvedValue({ git: { commitFormat: 'feat(%s): %m' } } as any)

      const commits = await parseCommitsForHashes('#g03p08gittrace')

      expect(commits).toHaveLength(1)
      expect(commits[0].commitSha).toBe('abc123def')
      expect(commits[0].author).toBe('John Doe <john@example.com>')
      expect(commits[0].subject).toBe('feat: implement #g03p08gittrace')
      expect(commits[0].confidenceScore).toBe(1.0)
    })

    it('filters commits by date range', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        status: vi.fn(),
        checkIsRepo: vi.fn()
      }

      const { simpleGit } = await import('simple-git')
      vi.mocked(simpleGit).mockReturnValue(mockGit as any)

      await parseCommitsForHashes('#g03p08gittrace', {
        dateRange: { from: '2026-01-01', to: '2026-02-01' }
      })

      expect(mockGit.raw).toHaveBeenCalledWith(
        expect.arrayContaining(['--since=2026-01-01', '--until=2026-02-01'])
      )
    })

    it('limits number of commits', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
        status: vi.fn(),
        checkIsRepo: vi.fn()
      }

      const { simpleGit } = await import('simple-git')
      vi.mocked(simpleGit).mockReturnValue(mockGit as any)

      await parseCommitsForHashes('#g03p08gittrace', { limit: 10 })

      expect(mockGit.raw).toHaveBeenCalledWith(
        expect.arrayContaining(['-n 10'])
      )
    })
  })
})