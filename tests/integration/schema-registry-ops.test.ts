/**
 * Schema Registry Operations Tests
 *
 * Covers both success paths (invocation) and error paths
 * (invokeCommand failures) for repository, architecture, and
 * analysis operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import {
  registerRepositoryOps,
  registerArchitectureOps,
  registerAnalysisOps,
} from '../../src/integration/schema-registry.js'

const mockInvokeCommand = vi.fn()
const mockParseCommitsForHashes = vi.fn()

vi.mock('../../src/integration/command-invoker.js', () => ({
  invokeCommand: (...args: unknown[]) => mockInvokeCommand(...args),
}))

vi.mock('../../src/utils/git.js', () => ({
  parseCommitsForHashes: (...args: unknown[]) => mockParseCommitsForHashes(...args),
}))

describe('schema-registry operations', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()
    registerRepositoryOps(registry)
    registerArchitectureOps(registry)
    registerAnalysisOps(registry)
  })

  // -------------------------------------------------------------------------
  // Repository operations
  // -------------------------------------------------------------------------
  describe('repos_list', () => {
    it('returns result on success', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true, data: { repos: [] } })

      const result = (await registry.invoke('repos_list', {})) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      expect(mockInvokeCommand).toHaveBeenCalledWith('repos_list')
    })

    it('throws on invokeCommand failure', async () => {
      mockInvokeCommand.mockResolvedValue({ success: false, error: 'Repo detection failed' })

      const result = (await registry.invoke('repos_list', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })

  describe('repos_deps', () => {
    it('returns result on success', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true, data: { graph: {} } })

      const result = (await registry.invoke('repos_deps', {})) as { success: boolean }
      expect(result.success).toBe(true)
    })

    it('throws on invokeCommand failure', async () => {
      mockInvokeCommand.mockResolvedValue({ success: false, error: 'Deps failed' })

      const result = (await registry.invoke('repos_deps', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })

  describe('repos_detect', () => {
    it('succeeds without returning a value', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true })

      const result = (await registry.invoke('repos_detect', {})) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
    })

    it('throws on invokeCommand failure', async () => {
      mockInvokeCommand.mockResolvedValue({ success: false, error: 'Detect failed' })

      const result = (await registry.invoke('repos_detect', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })

  describe('repos_adjust', () => {
    it('accepts valid repoId and boundary', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true })

      const result = (await registry.invoke('repos_adjust', {
        repoId: 'repo-1',
        boundary: 'src/services',
      })) as { success: boolean }
      expect(result.success).toBe(true)
      expect(mockInvokeCommand).toHaveBeenCalledWith(
        'repos_adjust',
        expect.objectContaining({ repoId: 'repo-1', boundary: 'src/services' })
      )
    })

    it('throws on invokeCommand failure', async () => {
      mockInvokeCommand.mockResolvedValue({ success: false, error: 'Adjust failed' })

      const result = (await registry.invoke('repos_adjust', {
        repoId: 'repo-1',
        boundary: 'src/services',
      })) as { success: boolean }
      expect(result.success).toBe(false)
    })

    it('fails schema validation for missing repoId', async () => {
      const result = (await registry.invoke('repos_adjust', { boundary: 'src/' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('fails schema validation for missing boundary', async () => {
      const result = (await registry.invoke('repos_adjust', { repoId: 'repo-1' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Architecture operations
  // -------------------------------------------------------------------------
  // arch_generate and arch_show use direct in-process generation (no invokeCommand)
  // to avoid CLI -> registry recursion. Tests verify the registry contract directly.
  describe('arch_generate', () => {
    it('succeeds and returns generation result', async () => {
      const result = (await registry.invoke('arch_generate', {})) as {
        success: boolean
        data: { totalGenerated: number }
      }
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(mockInvokeCommand).not.toHaveBeenCalledWith('arch_generate')
    })

    it('accepts optional gateHash and diagramType params', async () => {
      const result = (await registry.invoke('arch_generate', {
        gateHash: 'g05archdiag',
        diagramType: 'system-overview',
      })) as { success: boolean }
      expect(result.success).toBe(true)
    })
  })

  describe('arch_show', () => {
    it('returns diagram on success for valid type', async () => {
      const result = (await registry.invoke('arch_show', { type: 'system-overview' })) as {
        success: boolean
        data: { type: string; content: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.type).toBe('system-overview')
      expect(mockInvokeCommand).not.toHaveBeenCalledWith('arch_show', expect.anything())
    })

    it('fails for unknown diagram type', async () => {
      const result = (await registry.invoke('arch_show', { type: 'unknown-type-xyz' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('fails schema validation for missing type', async () => {
      const result = (await registry.invoke('arch_show', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Analysis operations
  // -------------------------------------------------------------------------
  describe('analyze', () => {
    it('analyzes without a path', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true, data: { stats: {} } })

      const result = (await registry.invoke('analyze', {})) as { success: boolean }
      expect(result.success).toBe(true)
    })

    it('analyzes with an optional path', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true, data: {} })

      const result = (await registry.invoke('analyze', { path: 'src/core' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
      expect(mockInvokeCommand).toHaveBeenCalledWith(
        'analyze',
        expect.objectContaining({ path: 'src/core' })
      )
    })

    it('throws on failure', async () => {
      mockInvokeCommand.mockResolvedValue({ success: false, error: 'Analyze failed' })

      const result = (await registry.invoke('analyze', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })

  describe('show', () => {
    it('resolves hash on success', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true, data: { type: 'gate' } })

      const result = (await registry.invoke('show', { hash: 'abc12345' })) as { success: boolean }
      expect(result.success).toBe(true)
    })

    it('throws on failure', async () => {
      mockInvokeCommand.mockResolvedValue({ success: false, error: 'Hash not found' })

      const result = (await registry.invoke('show', { hash: 'abc12345' })) as { success: boolean }
      expect(result.success).toBe(false)
    })

    it('fails schema validation for missing hash', async () => {
      const result = (await registry.invoke('show', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })

  describe('metrics', () => {
    it('returns metrics without path', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true, data: { coverage: 85 } })

      const result = (await registry.invoke('metrics', {})) as { success: boolean }
      expect(result.success).toBe(true)
    })

    it('returns metrics with path', async () => {
      mockInvokeCommand.mockResolvedValue({ success: true, data: { coverage: 90 } })

      const result = (await registry.invoke('metrics', { path: 'src/' })) as { success: boolean }
      expect(result.success).toBe(true)
    })

    it('throws on failure', async () => {
      mockInvokeCommand.mockResolvedValue({ success: false, error: 'Metrics failed' })

      const result = (await registry.invoke('metrics', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })

  describe('git_trace', () => {
    it('returns trace results for a valid hash', async () => {
      const commits = [
        {
          commitSha: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4',
          author: 'Test Author <test@example.com>',
          date: '2026-01-01T00:00:00Z',
          subject: 'feat: update #abc12345',
          filesChanged: ['src/foo.ts'],
          matchedHashes: ['abc12345'],
          inferredArtifacts: ['gate-01'],
          confidenceScore: 0.9,
        },
      ]
      mockParseCommitsForHashes.mockResolvedValue(commits)

      const result = (await registry.invoke('git_trace', {
        artifactHash: 'abc12345',
      })) as { success: boolean; data: unknown }

      expect(result.success).toBe(true)
      const data = result.data as { totalCommits: number }
      expect(data.totalCommits).toBe(1)
    })

    it('returns empty results when no commits reference the hash', async () => {
      mockParseCommitsForHashes.mockResolvedValue([])

      const result = (await registry.invoke('git_trace', {
        artifactHash: 'xxxxxxxx',
      })) as { success: boolean; data: unknown }

      expect(result.success).toBe(true)
      const data = result.data as { totalCommits: number }
      expect(data.totalCommits).toBe(0)
    })

    it('accepts optional dateRange, branch, and limit', async () => {
      mockParseCommitsForHashes.mockResolvedValue([])

      await registry.invoke('git_trace', {
        artifactHash: 'abc12345',
        dateRange: { from: '2026-01-01', to: '2026-12-31' },
        branch: 'main',
        limit: 10,
      })

      expect(mockParseCommitsForHashes).toHaveBeenCalledWith(
        'abc12345',
        expect.objectContaining({ branch: 'main', limit: 10 }),
        undefined
      )
    })

    it('fails schema validation for missing artifactHash', async () => {
      const result = (await registry.invoke('git_trace', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })
})
