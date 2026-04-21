import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeGateDbRow } from '../fixtures/gates.js'

const mockFindProjectRoot = vi.fn()
const mockLoadConfig = vi.fn()
const mockSaveConfig = vi.fn()
const mockGetDatabase = vi.fn()
const mockInitializeDatabase = vi.fn()
const mockSyncWithGit = vi.fn()
const mockConsolidate = vi.fn()
const mockGenerateConsolidationMd = vi.fn()
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockEnsureDir = vi.fn()
const mockReaddir = vi.fn()
const mockUnlink = vi.fn()
const mockStripAnsi = vi.fn((s: string) => s)
const mockAnalyzeGateChanges = vi.fn()
const mockRegenerateGatesWithAnalysis = vi.fn()
const mockUpdateProjectPRDGates = vi.fn()
const mockBumpSemver = vi.fn()
const mockRename = vi.fn()

vi.mock('../../src/utils/config.js', () => ({
  findProjectRoot: (...args: unknown[]) => mockFindProjectRoot(...args),
  getWorkspaceRoot: () => '/project',
  getZenoGitDir: vi.fn().mockReturnValue('/project/zeno'),
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  saveConfig: (...args: unknown[]) => mockSaveConfig(...args),
}))

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
  initializeDatabase: (...args: unknown[]) => mockInitializeDatabase(...args),
}))

vi.mock('../../src/utils/git.js', () => ({
  syncWithGit: (...args: unknown[]) => mockSyncWithGit(...args),
}))

vi.mock('../../src/utils/gate-consolidation.js', () => ({
  consolidateGateProposals: (...args: unknown[]) => mockConsolidate(...args),
  generateConsolidationMarkdown: (...args: unknown[]) => mockGenerateConsolidationMd(...args),
}))

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
}))

vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  rename: (...args: unknown[]) => mockRename(...args),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/utils/ansi-strip.js', () => ({
  stripAnsi: (s: string) => mockStripAnsi(s),
}))

vi.mock('../../src/core/write-time-analyzer.js', () => ({
  analyzeGateChanges: (...args: unknown[]) => mockAnalyzeGateChanges(...args),
}))

vi.mock('../../src/core/gate-generator.js', () => ({
  regenerateGatesWithAnalysis: (...args: unknown[]) => mockRegenerateGatesWithAnalysis(...args),
}))

vi.mock('../../src/core/prd-updater.js', () => ({
  updateProjectPRDGates: (...args: unknown[]) => mockUpdateProjectPRDGates(...args),
}))

vi.mock('../../src/utils/version.js', () => ({
  bumpSemver: (...args: unknown[]) => mockBumpSemver(...args),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../src/core/worktree-manager.js', () => ({
  WorktreeManager: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([]),
    merge: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()

  mockFindProjectRoot.mockReturnValue('/project')
  mockInitializeDatabase.mockResolvedValue({ created: false })
  mockGetDatabase.mockReturnValue({
    prepare: vi.fn(),
    transaction: vi.fn(),
  })
  mockLoadConfig.mockResolvedValue({
    version: '0.1.0',
    git: { autoCommit: true, autoTag: true, autoPush: false, remote: 'origin' },
    versioning: {
      enabled: true,
      proposalBump: 'patch',
      gateBump: 'minor',
      lifecycleBump: 'major',
    },
  })
  mockSaveConfig.mockResolvedValue(undefined)
  mockSyncWithGit.mockResolvedValue(undefined)
  mockConsolidate.mockResolvedValue({ gateId: 'gate-01', proposals: [] })
  mockGenerateConsolidationMd.mockReturnValue('## Consolidation')
  mockReadFile.mockResolvedValue('# Gate Content')
  mockWriteFile.mockResolvedValue(undefined)
  mockEnsureDir.mockResolvedValue(undefined)
  mockReaddir.mockResolvedValue([])
  mockUnlink.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockAnalyzeGateChanges.mockResolvedValue(undefined)
  mockRegenerateGatesWithAnalysis.mockResolvedValue(undefined)
  mockUpdateProjectPRDGates.mockResolvedValue(undefined)
  mockBumpSemver.mockImplementation((v: string) => '2.0.0')
})

describe('completeGate', () => {
  it('completeGate throws ValidationError when gate not found', async () => {
    const mockDb = mockGetDatabase()
    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn(),
    })

    const { completeGate } = await import('../../src/core/completions.js')
    await expect(completeGate('gate-01')).rejects.toThrow('Gate not found')
  })

  it('completeGate completes gate and bumps version', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return {
          get: vi.fn().mockReturnValue({ id: 'gate-01', name: 'Setup', status: 'in_progress' }),
          run: mockRun,
        }
      }
      if (normalized.includes('count(*)')) {
        return { get: vi.fn().mockReturnValue({ count: 1 }) }
      }
      if (normalized.includes('select hash from proposals')) {
        return { all: vi.fn().mockReturnValue([]) }
      }
      return { run: mockRun, get: vi.fn(), all: vi.fn().mockReturnValue([]) }
    })

    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    const { completeGate } = await import('../../src/core/completions.js')
    const result = await completeGate('gate-01')

    expect(result.gateId).toBe('gate-01')
    expect(result.gateName).toBe('Setup')
    expect(result.bump).toBe('minor')
  })

  it('should throw for already completed gate', async () => {
    const mockDb = mockGetDatabase()
    mockDb.prepare.mockReturnValue({
      run: vi.fn(),
      get: vi.fn().mockReturnValue(makeGateDbRow({ status: 'completed' })),
    })

    const { completeGate } = await import('../../src/core/completions.js')
    await expect(completeGate('gate-01')).rejects.toThrow('already completed')
  })

  it('should throw for rejected gate', async () => {
    const mockDb = mockGetDatabase()
    mockDb.prepare.mockReturnValue({
      run: vi.fn(),
      get: vi.fn().mockReturnValue(makeGateDbRow({ status: 'rejected' })),
    })

    const { completeGate } = await import('../../src/core/completions.js')
    await expect(completeGate('gate-01')).rejects.toThrow('rejected')
  })

  it('should throw when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(null)

    const { completeGate } = await import('../../src/core/completions.js')
    await expect(completeGate('gate-01')).rejects.toThrow()
  })

  it('completeGate - major bump when no remaining incomplete gates', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return {
          get: vi.fn().mockReturnValue(makeGateDbRow({ name: 'Final Gate' })),
          run: mockRun,
        }
      }
      if (normalized.includes('count(*)')) {
        // remaining count = 0 → major bump
        return { get: vi.fn().mockReturnValue({ count: 0 }) }
      }
      if (normalized.includes('select hash from proposals')) {
        return { all: vi.fn().mockReturnValue([]) }
      }
      return { run: mockRun, get: vi.fn(), all: vi.fn().mockReturnValue([]) }
    })
    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    const { completeGate } = await import('../../src/core/completions.js')
    const result = await completeGate('gate-01')

    expect(result.bump).toBe('major')
  })

  it('completeGate - skips git sync when autoCommit is false', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return {
          get: vi.fn().mockReturnValue(makeGateDbRow()),
          run: mockRun,
        }
      }
      if (normalized.includes('count(*)')) {
        return { get: vi.fn().mockReturnValue({ count: 1 }) }
      }
      if (normalized.includes('select hash from proposals')) {
        return { all: vi.fn().mockReturnValue([]) }
      }
      return { run: mockRun, get: vi.fn(), all: vi.fn().mockReturnValue([]) }
    })
    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    mockLoadConfig.mockResolvedValue({
      version: '0.1.0',
      git: { autoCommit: false, autoTag: false, autoPush: false, remote: 'origin' },
      versioning: {
        enabled: true,
        proposalBump: 'patch',
        gateBump: 'minor',
        lifecycleBump: 'major',
      },
    })

    const { completeGate } = await import('../../src/core/completions.js')
    await completeGate('gate-01')

    expect(mockSyncWithGit).not.toHaveBeenCalled()
  })

  it('completeGate - no version save when versioning disabled', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return {
          get: vi.fn().mockReturnValue(makeGateDbRow()),
          run: mockRun,
        }
      }
      if (normalized.includes('count(*)')) {
        return { get: vi.fn().mockReturnValue({ count: 1 }) }
      }
      if (normalized.includes('select hash from proposals')) {
        return { all: vi.fn().mockReturnValue([]) }
      }
      return { run: mockRun, get: vi.fn(), all: vi.fn().mockReturnValue([]) }
    })
    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    mockLoadConfig.mockResolvedValue({
      version: '1.2.3',
      git: { autoCommit: false, autoTag: false, autoPush: false, remote: 'origin' },
      versioning: {
        enabled: false,
        proposalBump: 'patch',
        gateBump: 'minor',
        lifecycleBump: 'major',
      },
    })

    const { completeGate } = await import('../../src/core/completions.js')
    const result = await completeGate('gate-01')

    // Version unchanged because versioning disabled
    expect(result.newVersion).toBe('1.2.3')
    expect(result.previousVersion).toBe('1.2.3')
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  it('completeGate - deletes proposal hashes from database when present', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return {
          get: vi.fn().mockReturnValue(makeGateDbRow({ id: 'g1' })),
          run: mockRun,
        }
      }
      if (normalized.includes('count(*)')) {
        return { get: vi.fn().mockReturnValue({ count: 1 }) }
      }
      if (normalized.includes('select hash from proposals')) {
        // Return two proposal hashes so the cleanup path is exercised
        return { all: vi.fn().mockReturnValue([{ hash: 'hash1' }, { hash: 'hash2' }]) }
      }
      return { run: mockRun, get: vi.fn(), all: vi.fn().mockReturnValue([]) }
    })
    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    const { completeGate } = await import('../../src/core/completions.js')
    const result = await completeGate('gate-01')

    expect(result.gateId).toBe('gate-01')
    // The DELETE statements should have been constructed (mockRun called multiple times for cleanup)
    expect(mockRun).toHaveBeenCalled()
  })

  it('completeGate - uses fallback PRD content when gate file not readable', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return {
          get: vi.fn().mockReturnValue(makeGateDbRow({ name: 'Init' })),
          run: mockRun,
        }
      }
      if (normalized.includes('count(*)')) {
        return { get: vi.fn().mockReturnValue({ count: 1 }) }
      }
      if (normalized.includes('select hash from proposals')) {
        return { all: vi.fn().mockReturnValue([]) }
      }
      return { run: mockRun, get: vi.fn(), all: vi.fn().mockReturnValue([]) }
    })
    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    // readFile throws for the gate PRD path → fallback content is used
    mockReadFile.mockRejectedValue(new Error('file not found'))

    const { completeGate } = await import('../../src/core/completions.js')
    const result = await completeGate('gate-01')

    // Should still complete successfully using fallback gate content
    expect(result.gateId).toBe('gate-01')
    expect(result.gateName).toBe('Init')
  })

  it('completeGate - error in analyzeGateChanges is swallowed', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return {
          get: vi.fn().mockReturnValue(makeGateDbRow()),
          run: mockRun,
        }
      }
      if (normalized.includes('count(*)')) {
        return { get: vi.fn().mockReturnValue({ count: 1 }) }
      }
      if (normalized.includes('select hash from proposals')) {
        return { all: vi.fn().mockReturnValue([]) }
      }
      return { run: mockRun, get: vi.fn(), all: vi.fn().mockReturnValue([]) }
    })
    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    mockAnalyzeGateChanges.mockRejectedValue(new Error('analysis failed'))

    const { completeGate } = await import('../../src/core/completions.js')
    // Should complete despite analysis error
    const result = await completeGate('gate-01')
    expect(result.gateId).toBe('gate-01')
  })

  it('completeGate writes completed status into the archived gate markdown', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      if (normalized.includes('from gates') && normalized.includes('where id')) {
        return {
          get: vi.fn().mockReturnValue(makeGateDbRow({ name: 'Setup', hash: 'g01setup' })),
          run: mockRun,
        }
      }
      if (normalized.includes('count(*)')) {
        return { get: vi.fn().mockReturnValue({ count: 1 }) }
      }
      if (normalized.includes('select id, hash from proposals')) {
        return { all: vi.fn().mockReturnValue([]) }
      }
      if (normalized.includes('select hash from proposals')) {
        return { all: vi.fn().mockReturnValue([]) }
      }
      return { run: mockRun, get: vi.fn(), all: vi.fn().mockReturnValue([]) }
    })
    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    mockReaddir.mockImplementation(async (dir: string) => {
      const normalizedDir = dir.replace(/\\/g, '/')
      if (normalizedDir.includes('/project/zeno/gates')) return ['gate-01-setup.md']
      return []
    })
    mockReadFile.mockResolvedValue(
      [
        '---',
        'zeno:',
        '  id: gate-01',
        '  name: Setup',
        '  sequence: 1',
        '  type: feature',
        '  status: in_progress',
        '  hash: g01setup',
        '---',
        '',
        '# Gate 01: Setup',
        '',
        '**Status**: in_progress',
        '',
        '## Overview',
        '',
        'Gate overview.',
      ].join('\n')
    )

    const { completeGate } = await import('../../src/core/completions.js')
    await completeGate('gate-01')

    const archiveWrite = mockWriteFile.mock.calls.find((call) => {
      const target = String(call[0])
      return target.includes('archive') && target.endsWith('.md')
    })
    expect(archiveWrite).toBeDefined()
    expect(String(archiveWrite?.[1])).toContain('  status: completed')
    expect(String(archiveWrite?.[1])).toContain('**Status**: completed')
  })
})

describe('approveProposal', () => {
  it('approveProposal throws when proposal not found', async () => {
    const mockDb = mockGetDatabase()
    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn(),
    })

    const { approveProposal } = await import('../../src/core/completions.js')
    await expect(approveProposal('#missing')).rejects.toThrow('Proposal not found')
  })

  it('approveProposal moves proposal file and returns metadata', async () => {
    const mockDb = mockGetDatabase()
    const mockRunFn = vi.fn()

    mockDb.prepare.mockImplementation((q: string) => ({
      get: vi.fn().mockReturnValue({
        id: 'p1',
        gateId: 'gate-01',
        title: 'Add feature',
        status: 'in_progress',
        requirement_id: null,
      }),
      run: mockRunFn,
      all: vi.fn().mockReturnValue([]),
    }))

    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes('something.md')) {
        return `# Proposal: Add feature\n\n**Hash**: #abc\n\n## Summary\n\nThis adds a new command`
      }
      throw new Error('no file')
    })

    mockReaddir.mockImplementation(async (p: string) => {
      if (p.includes('gate-01')) return ['something.md']
      if (p.includes('archive')) return []
      return []
    })

    const { approveProposal } = await import('../../src/core/completions.js')
    const res = await approveProposal('#abc')

    expect(res.proposalHash).toBe('abc')
    expect(res.gateId).toBe('gate-01')
  })

  it('should approve a proposal in pending state', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockReturnValue({
      run: mockRun,
      get: vi.fn().mockReturnValue({
        id: 'p1',
        gateId: 'gate-01',
        title: 'Test Proposal',
        status: 'in_progress',
        requirement_id: null,
      }),
      all: vi.fn().mockReturnValue([]),
    })

    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    const { approveProposal } = await import('../../src/core/completions.js')
    const result = await approveProposal('#abc123')

    expect(result.proposalHash).toBe('abc123')
    expect(result.gateId).toBe('gate-01')
  })

  it('should throw when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(null)

    const { approveProposal } = await import('../../src/core/completions.js')
    await expect(approveProposal('abc')).rejects.toThrow()
  })

  it('should throw for already completed proposal', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()
    mockDb.prepare.mockReturnValue({
      run: mockRun,
      get: vi.fn().mockReturnValue({
        id: 'p1',
        gateId: 'gate-01',
        title: 'Test',
        status: 'completed',
        requirement_id: null,
      }),
    })

    const { approveProposal } = await import('../../src/core/completions.js')
    await expect(approveProposal('abc')).rejects.toThrow('already completed')
  })

  it('should throw for rejected proposal', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()
    mockDb.prepare.mockReturnValue({
      run: mockRun,
      get: vi.fn().mockReturnValue({
        id: 'p1',
        gateId: 'gate-01',
        title: 'Test',
        status: 'rejected',
        requirement_id: null,
      }),
    })

    const { approveProposal } = await import('../../src/core/completions.js')
    await expect(approveProposal('abc')).rejects.toThrow('rejected')
  })

  it('approveProposal records approver in file when options.approver provided', async () => {
    const mockDb = mockGetDatabase()
    const mockRun = vi.fn()

    mockDb.prepare.mockReturnValue({
      run: mockRun,
      get: vi.fn().mockReturnValue({
        id: 'p1',
        gateId: 'gate-01',
        title: 'Feat',
        status: 'in_progress',
        requirement_id: null,
      }),
      all: vi.fn().mockReturnValue([]),
    })
    mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

    mockReaddir.mockImplementation(async (p: string) => {
      if (String(p).includes('gate-01')) return ['feat.md']
      return []
    })
    mockReadFile.mockImplementation(
      async () => '# Proposal\n\n**Hash**: #approverhash\n\n**Status**: in_progress\n'
    )

    const { approveProposal } = await import('../../src/core/completions.js')
    const result = await approveProposal('#approverhash', { approver: 'team-lead' })

    expect(result.proposalHash).toBe('approverhash')
    // writeFile should have been called with Approved By metadata injected
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('team-lead')
    )
  })
})
