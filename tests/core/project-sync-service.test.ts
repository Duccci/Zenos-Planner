import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Normalize path separators to forward slashes for cross-platform mock matching */
const norm = (p: string): string => p.replace(/\\/g, '/')

// Mock simple-git before importing the module under test
const mockGitInstance = {
  raw: vi.fn().mockResolvedValue(''),
  revparse: vi.fn().mockResolvedValue('abc1234567890def1234567890abcdef12345678'),
  status: vi.fn().mockResolvedValue({ isClean: () => true }),
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  tag: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn().mockResolvedValue(undefined),
  checkout: vi.fn().mockResolvedValue(undefined),
  diff: vi.fn().mockResolvedValue(''),
  log: vi.fn().mockResolvedValue({ latest: { hash: 'abc1234' } }),
  remote: vi.fn().mockResolvedValue('https://github.com/org/CoreRepo.git'),
}

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGitInstance),
}))

vi.mock('../../src/core/worktree-manager', () => {
  return {
    WorktreeManager: class MockWorktreeManager {
      async list() {
        return []
      }
    },
  }
})

vi.mock('../../src/utils/config', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    projectName: 'TestProject',
    git: {
      autoCommit: true,
      autoTag: true,
      autoPush: false,
      remote: 'origin',
      commitFormat: 'feat(%s): %m',
    },
  }),
  getWorkspaceRoot: vi.fn().mockReturnValue('/project/CoreRepo'),
  findProjectRoot: vi.fn().mockReturnValue('/project/CoreRepo'),
}))

vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { simpleGit } from 'simple-git'
import { syncStatus, syncCommit, syncPropagate, syncFull } from '../../src/core/project-sync-service'
import { loadConfig } from '../../src/utils/config'

// Mock fs functions used by the service
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  // Normalize path separators for cross-platform mock matching
  const n = (p: string): string => p.replace(/\\/g, '/')
  return {
    ...actual,
    existsSync: vi.fn((p: string) => {
      const np = n(p)
      if (np === '/project/CoreRepo/.git') return true
      if (np === '/project/ConsumerA/.git') return true
      if (np === '/project/ConsumerB/.git') return true
      if (np === '/project/ConsumerA/.gitmodules') return true
      if (np === '/project/ConsumerB/.gitmodules') return true
      if (np === '/project/CoreRepo/schemas') return true
      return false
    }),
    readdirSync: vi.fn((dir: string) => {
      if (n(dir) === '/project') return ['CoreRepo', 'ConsumerA', 'ConsumerB', 'not-a-repo']
      return []
    }),
    readFileSync: vi.fn((p: string) => {
      if (typeof p === 'string' && n(p).endsWith('.gitmodules')) {
        return `[submodule "CoreRepo"]
\tpath = CoreRepo
\turl = https://github.com/org/CoreRepo.git
`
      }
      return ''
    }),
    statSync: vi.fn((p: string) => {
      const np = n(p)
      const dirs = [
        '/project/CoreRepo',
        '/project/ConsumerA',
        '/project/ConsumerB',
      ]
      if (dirs.includes(np)) return { isDirectory: () => true }
      if (np === '/project/not-a-repo') return { isDirectory: () => false }
      throw new Error(`ENOENT: ${p}`)
    }),
  }
})

describe('project-sync-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default mock implementations
    mockGitInstance.revparse.mockResolvedValue('abc1234567890def1234567890abcdef12345678')
    mockGitInstance.status.mockResolvedValue({ isClean: () => true })
    mockGitInstance.raw.mockResolvedValue('')
    mockGitInstance.diff.mockResolvedValue('')
    mockGitInstance.remote.mockResolvedValue('https://github.com/org/CoreRepo.git')
    mockGitInstance.log.mockResolvedValue({ latest: { hash: 'abc1234' } })
  })

  // ==========================================================================
  // syncStatus
  // ==========================================================================
  describe('syncStatus', () => {
    it('should return core HEAD and empty consumers when none discovered', async () => {
      // Override readdirSync to return nothing beside CoreRepo
      const fs = await import('node:fs')
      vi.mocked(fs.readdirSync).mockReturnValueOnce(['CoreRepo'] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = await syncStatus({ projectRoot: '/project/CoreRepo' })

      expect(result.coreRepo).toBe('CoreRepo')
      expect(result.coreHead).toBe('abc1234567890def1234567890abcdef12345678')
      expect(result.coreHeadShort).toBe('abc1234')
      expect(result.consumers).toHaveLength(0)
      expect(result.summary.total).toBe(0)
    })

    it('should discover consumers from sibling directories', async () => {
      // Submodule status output format: " <hash> <path>"
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule' && args[1] === 'status') {
          return ' abc1234567890def1234567890abcdef12345678 CoreRepo (v1.0)'
        }
        if (args[0] === 'rev-list') {
          return '0'
        }
        return ''
      })

      const result = await syncStatus({ projectRoot: '/project/CoreRepo' })

      expect(result.consumers.length).toBeGreaterThan(0)
      expect(result.consumers[0]!.repo).toBe('ConsumerA')
      expect(result.summary.total).toBeGreaterThan(0)
    })

    it('should detect dirty submodule state', async () => {
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule' && args[1] === 'status') {
          // '+' prefix means dirty
          return '+abc1234567890def1234567890abcdef12345678 CoreRepo (v1.0)'
        }
        if (args[0] === 'rev-list') return '0'
        return ''
      })

      const result = await syncStatus({ projectRoot: '/project/CoreRepo' })

      const consumer = result.consumers.find(c => c.repo === 'ConsumerA')
      expect(consumer?.dirty).toBe(true)
      expect(result.summary.dirty).toBeGreaterThan(0)
    })

    it('should filter to requested repos subset', async () => {
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule') return ' abc1234567890def1234567890abcdef12345678 CoreRepo'
        if (args[0] === 'rev-list') return '0'
        return ''
      })

      const result = await syncStatus({
        repos: ['ConsumerA'],
        projectRoot: '/project/CoreRepo',
      })

      expect(result.consumers.length).toBe(1)
      expect(result.consumers[0]!.repo).toBe('ConsumerA')
    })

    it('should report behind count when consumer is not at HEAD', async () => {
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule') return ' 0000000000000000000000000000000000000000 CoreRepo'
        if (args[0] === 'rev-list') return '5'
        return ''
      })

      const result = await syncStatus({
        repos: ['ConsumerA'],
        projectRoot: '/project/CoreRepo',
      })

      expect(result.consumers[0]!.behind).toBe(5)
      expect(result.summary.behind).toBe(1)
    })
  })

  // ==========================================================================
  // syncCommit
  // ==========================================================================
  describe('syncCommit', () => {
    it('should return no-op when working tree is clean', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })

      const result = await syncCommit({
        message: 'test commit',
        projectRoot: '/project/CoreRepo',
      })

      expect(result.status).toBe('no-op')
      expect(result.commitHash).toBeUndefined()
    })

    it('should stage, commit, and return hash when dirty', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => false })
      mockGitInstance.revparse.mockResolvedValue('deadbeef12345678901234567890abcdef123456')

      const result = await syncCommit({
        message: 'add schema changes',
        scope: 'schemas',
        projectRoot: '/project/CoreRepo',
      })

      expect(result.status).toBe('committed')
      expect(result.commitHash).toBe('deadbeef12345678901234567890abcdef123456')
      expect(result.commitHashShort).toBe('deadbee')
      expect(result.commitMessage).toBe('feat(schemas): add schema changes')
      expect(mockGitInstance.add).toHaveBeenCalledWith('-A')
      expect(mockGitInstance.commit).toHaveBeenCalled()
    })

    it('should format message without scope when scope is omitted', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => false })

      const result = await syncCommit({
        message: 'update gates',
        projectRoot: '/project/CoreRepo',
      })

      expect(result.status).toBe('committed')
      expect(result.commitMessage).not.toContain('(%s)')
      expect(result.commitMessage).toContain('update gates')
    })

    it('should create tag when requested', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => false })

      await syncCommit({
        message: 'release',
        tag: 'v1.0.0',
        projectRoot: '/project/CoreRepo',
      })

      expect(mockGitInstance.tag).toHaveBeenCalledWith(['-a', 'v1.0.0', '-m', 'Tag v1.0.0'])
    })

    it('should push when push=true', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => false })

      const result = await syncCommit({
        message: 'push test',
        push: true,
        projectRoot: '/project/CoreRepo',
      })

      expect(result.pushed).toBe(true)
      expect(mockGitInstance.push).toHaveBeenCalledWith('origin', 'HEAD')
    })

    it('should not push by default when autoPush is false', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => false })

      const result = await syncCommit({
        message: 'no push test',
        projectRoot: '/project/CoreRepo',
      })

      expect(result.pushed).toBe(false)
      expect(mockGitInstance.push).not.toHaveBeenCalled()
    })

    it('should respect autoPush from config', async () => {
      vi.mocked(loadConfig).mockResolvedValueOnce({
        projectName: 'TestProject',
        git: {
          autoCommit: true,
          autoTag: true,
          autoPush: true,
          remote: 'origin',
          commitFormat: 'feat(%s): %m',
        },
      } as any)
      mockGitInstance.status.mockResolvedValue({ isClean: () => false })

      const result = await syncCommit({
        message: 'auto push test',
        projectRoot: '/project/CoreRepo',
      })

      expect(result.pushed).toBe(true)
    })
  })

  // ==========================================================================
  // syncPropagate
  // ==========================================================================
  describe('syncPropagate', () => {
    it('should skip consumers with dirty working trees by default', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => false })

      const result = await syncPropagate({
        repos: ['ConsumerA'],
        projectRoot: '/project/CoreRepo',
      })

      expect(result.results[0]!.status).toBe('blocked-dirty')
      expect(result.summary.blocked).toBe(1)
    })

    it('should proceed with dirty consumer when force=true', async () => {
      let callCount = 0
      mockGitInstance.status.mockImplementation(async () => {
        callCount++
        // First call is for the consumer dirty check — report dirty
        return { isClean: () => false }
      })
      // After force=true, the submodule update proceeds
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule' && args[1] === 'status') {
          return ' 0000000000000000000000000000000000000000 CoreRepo'
        }
        return ''
      })
      mockGitInstance.diff.mockResolvedValue('CoreRepo')

      const result = await syncPropagate({
        repos: ['ConsumerA'],
        force: true,
        projectRoot: '/project/CoreRepo',
      })

      expect(result.results[0]!.status).not.toBe('blocked-dirty')
    })

    it('should report already-current when submodule is at target hash', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule' && args[1] === 'status') {
          return ' abc1234567890def1234567890abcdef12345678 CoreRepo'
        }
        if (args[0] === 'log') {
          return 'test commit message'
        }
        return ''
      })
      // diff returns empty = nothing changed
      mockGitInstance.diff.mockResolvedValue('')

      const result = await syncPropagate({
        repos: ['ConsumerA'],
        projectRoot: '/project/CoreRepo',
      })

      expect(result.results[0]!.status).toBe('already-current')
      expect(result.summary.alreadyCurrent).toBe(1)
    })

    it('should perform dry-run without writing', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule' && args[1] === 'status') {
          return ' 0000000000000000000000000000000000000000 CoreRepo'
        }
        if (args[0] === 'log') return 'test message'
        return ''
      })

      const result = await syncPropagate({
        repos: ['ConsumerA'],
        dryRun: true,
        projectRoot: '/project/CoreRepo',
      })

      expect(result.dryRun).toBe(true)
      // Dry-run should not call commit
      expect(mockGitInstance.commit).not.toHaveBeenCalled()
      expect(result.results[0]!.status).toBe('updated')
    })

    it('should update submodule pointer and commit in consumer', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule' && args[1] === 'status') {
          return ' 0000000000000000000000000000000000000000 CoreRepo'
        }
        if (args[0] === 'submodule' && args[1] === 'update') return ''
        if (args[0] === 'log') return 'feat(schemas): add new schema #abc12345'
        return ''
      })
      mockGitInstance.diff.mockResolvedValue('CoreRepo')

      const result = await syncPropagate({
        repos: ['ConsumerA'],
        projectRoot: '/project/CoreRepo',
      })

      expect(result.results[0]!.status).toBe('updated')
      expect(result.results[0]!.newHash).toBe('abc1234567890def1234567890abcdef12345678')
      expect(mockGitInstance.commit).toHaveBeenCalled()
      expect(result.summary.updated).toBe(1)
    })

    it('should include artifact hashes in propagation commit for traceability', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule' && args[1] === 'status') {
          return ' 0000000000000000000000000000000000000000 CoreRepo'
        }
        if (args[0] === 'submodule' && args[1] === 'update') return ''
        if (args[0] === 'log') return 'feat(schemas): add schema #abcd1234efgh'
        return ''
      })
      mockGitInstance.diff.mockResolvedValue('CoreRepo')

      await syncPropagate({
        repos: ['ConsumerA'],
        projectRoot: '/project/CoreRepo',
      })

      const commitCall = mockGitInstance.commit.mock.calls[0]
      const commitMsg = commitCall?.[0] as string
      expect(commitMsg).toContain('Traces: #abcd1234efgh')
    })

    it('should handle partial failures without aborting batch', async () => {
      // ConsumerA succeeds, ConsumerB fails
      let consumerIndex = 0
      mockGitInstance.status.mockImplementation(async () => {
        consumerIndex++
        if (consumerIndex === 2) {
          // ConsumerB: throw error during status check
          throw new Error('Network error')
        }
        return { isClean: () => true }
      })
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule' && args[1] === 'status') {
          return ' 0000000000000000000000000000000000000000 CoreRepo'
        }
        if (args[0] === 'log') return 'test'
        return ''
      })
      mockGitInstance.diff.mockResolvedValue('CoreRepo')

      const result = await syncPropagate({
        projectRoot: '/project/CoreRepo',
      })

      // Should have results for both consumers
      const updated = result.results.filter(r => r.status === 'updated')
      const errors = result.results.filter(r => r.status === 'error')
      expect(updated.length + errors.length).toBe(result.results.length)
    })

    it('should use default core HEAD when no commitHash specified', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })
      mockGitInstance.raw.mockResolvedValue(' 0000000000000000000000000000000000000000 CoreRepo')
      mockGitInstance.diff.mockResolvedValue('')

      const result = await syncPropagate({
        repos: ['ConsumerA'],
        projectRoot: '/project/CoreRepo',
      })

      expect(result.coreCommitHash).toBe('abc1234567890def1234567890abcdef12345678')
    })

    it('should use custom commit message when provided', async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule') return ' 0000000000000000000000000000000000000000 CoreRepo'
        if (args[0] === 'log') return 'test'
        return ''
      })
      mockGitInstance.diff.mockResolvedValue('CoreRepo')

      await syncPropagate({
        repos: ['ConsumerA'],
        commitMessage: 'custom: update submodule',
        projectRoot: '/project/CoreRepo',
      })

      const commitMsg = mockGitInstance.commit.mock.calls[0]?.[0] as string
      expect(commitMsg).toContain('custom: update submodule')
    })
  })

  // ==========================================================================
  // syncFull
  // ==========================================================================
  describe('syncFull', () => {
    it('should chain commit then propagate', async () => {
      // Commit succeeds
      mockGitInstance.status.mockResolvedValueOnce({ isClean: () => false }) // commit: dirty
      mockGitInstance.revparse.mockResolvedValue('newcommithash1234567890123456789012345678')
      // Propagate: consumers clean
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })
      mockGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'submodule') return ' 0000000000000000000000000000000000000000 CoreRepo'
        if (args[0] === 'log') return 'test'
        return ''
      })
      mockGitInstance.diff.mockResolvedValue('CoreRepo')

      // Override readdirSync to have no consumers for simplicity
      const fs = await import('node:fs')
      vi.mocked(fs.readdirSync).mockReturnValue(['CoreRepo'] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = await syncFull({
        message: 'full sync test',
        scope: 'schemas',
        projectRoot: '/project/CoreRepo',
      })

      expect(result.commit.status).toBe('committed')
      expect(result.propagate).toBeDefined()
      expect(result.propagate.coreCommitHash).toBeDefined()
    })

    it('should still propagate when commit is no-op', async () => {
      // Commit: clean (no-op)
      mockGitInstance.status.mockResolvedValueOnce({ isClean: () => true })
      // Propagate still runs
      mockGitInstance.status.mockResolvedValue({ isClean: () => true })
      mockGitInstance.raw.mockResolvedValue('')

      const fs = await import('node:fs')
      vi.mocked(fs.readdirSync).mockReturnValue(['CoreRepo'] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = await syncFull({
        message: 'no-op commit',
        projectRoot: '/project/CoreRepo',
      })

      expect(result.commit.status).toBe('no-op')
      expect(result.propagate).toBeDefined()
    })
  })
})

// ==========================================================================
// Schema validation tests
// ==========================================================================
describe('project-sync-schemas', async () => {
  // Import schemas
  const {
    ProjectSyncActionInputSchema,
    ProjectSyncStatusOutputSchema,
    ProjectSyncCommitOutputSchema,
    ProjectSyncPropagateOutputSchema,
    SyncConfigSchema,
  } = await import('../../src/mcp/schemas/project-sync-schemas')

  it('should validate status action input', () => {
    const result = ProjectSyncActionInputSchema.safeParse({
      action: 'status',
      repos: ['ConsumerA'],
    })
    expect(result.success).toBe(true)
  })

  it('should validate commit action input', () => {
    const result = ProjectSyncActionInputSchema.safeParse({
      action: 'commit',
      message: 'test commit',
      scope: 'schemas',
      push: false,
      tag: 'v1.0.0',
    })
    expect(result.success).toBe(true)
  })

  it('should validate propagate action input', () => {
    const result = ProjectSyncActionInputSchema.safeParse({
      action: 'propagate',
      commitHash: 'abc1234',
      repos: ['ConsumerA', 'ConsumerB'],
      dryRun: true,
      force: false,
    })
    expect(result.success).toBe(true)
  })

  it('should validate full action input', () => {
    const result = ProjectSyncActionInputSchema.safeParse({
      action: 'full',
      message: 'full sync',
      push: false,
    })
    expect(result.success).toBe(true)
  })

  it('should reject unknown action', () => {
    const result = ProjectSyncActionInputSchema.safeParse({
      action: 'unknown',
    })
    expect(result.success).toBe(false)
  })

  it('should validate SyncConfig schema', () => {
    const result = SyncConfigSchema.safeParse({
      coreRepo: 'CoreRepo',
      consumers: ['ConsumerA'],
      submodulePath: 'CoreRepo',
      postSyncHooks: ['npm run build'],
      schemaDir: 'schemas/',
      schemaDriftWarning: true,
    })
    expect(result.success).toBe(true)
  })

  it('should accept empty SyncConfig', () => {
    const result = SyncConfigSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should validate status output schema', () => {
    const result = ProjectSyncStatusOutputSchema.safeParse({
      coreRepo: 'CoreRepo',
      coreHead: 'abc1234567890def1234567890abcdef12345678',
      coreHeadShort: 'abc1234',
      consumers: [
        {
          repo: 'ConsumerA',
          pinnedHash: 'abc1234567890def1234567890abcdef12345678',
          behind: 0,
          dirty: false,
          hasWorktree: false,
        },
      ],
      summary: { total: 1, current: 1, behind: 0, dirty: 0, blocked: 0 },
    })
    expect(result.success).toBe(true)
  })

  it('should validate commit output schema', () => {
    const result = ProjectSyncCommitOutputSchema.safeParse({
      status: 'committed',
      commitHash: 'abc1234567890def1234567890abcdef12345678',
      commitHashShort: 'abc1234',
      commitMessage: 'feat(schemas): test',
      pushed: false,
    })
    expect(result.success).toBe(true)
  })

  it('should validate propagate output schema', () => {
    const result = ProjectSyncPropagateOutputSchema.safeParse({
      coreCommitHash: 'abc1234567890def1234567890abcdef12345678',
      coreCommitHashShort: 'abc1234',
      dryRun: false,
      results: [
        {
          repo: 'ConsumerA',
          status: 'updated',
          previousHash: '0000000000000000000000000000000000000000',
          newHash: 'abc1234567890def1234567890abcdef12345678',
          pushed: false,
        },
      ],
      summary: { updated: 1, alreadyCurrent: 0, blocked: 0, errors: 0 },
    })
    expect(result.success).toBe(true)
  })
})
