import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('../../src/utils/config.js', () => ({
  findProjectRoot: (...args: unknown[]) => mockFindProjectRoot(...args),
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

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('completions coverage', () => {
  const mockDb = {
    prepare: vi.fn(),
    transaction: vi.fn(),
  }

  const defaultConfig = {
    version: '0.1.0',
    git: { autoCommit: true, autoTag: true, autoPush: false, remote: 'origin' },
    versioning: {
      enabled: true,
      proposalBump: 'patch',
      gateBump: 'minor',
      lifecycleBump: 'major',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    mockFindProjectRoot.mockReturnValue('/project')
    mockInitializeDatabase.mockResolvedValue({ created: false })
    mockGetDatabase.mockReturnValue(mockDb)
    mockLoadConfig.mockResolvedValue(defaultConfig)
    mockSaveConfig.mockResolvedValue(undefined)
    mockSyncWithGit.mockResolvedValue(undefined)
    mockConsolidate.mockResolvedValue({ gateId: 'gate-01', proposals: [] })
    mockGenerateConsolidationMd.mockReturnValue('## Consolidation')
    mockReadFile.mockResolvedValue('# Gate Content')
    mockWriteFile.mockResolvedValue(undefined)
    mockEnsureDir.mockResolvedValue(undefined)
    mockReaddir.mockResolvedValue([])
    mockUnlink.mockResolvedValue(undefined)
    mockAnalyzeGateChanges.mockResolvedValue(undefined)
    mockRegenerateGatesWithAnalysis.mockResolvedValue(undefined)
    mockUpdateProjectPRDGates.mockResolvedValue(undefined)
  })

  describe('approveProposal', () => {
    it('should approve a proposal in pending state', async () => {
      // Setup DB mocks
      const mockRun = vi.fn()
      const mockGet = vi.fn()

      // For ALTER TABLE (idempotent)
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet })

      // Setup get to return the proposal
      mockGet.mockReturnValueOnce({
        id: 'p1',
        gateId: 'gate-01',
        title: 'Test Proposal',
        status: 'in_progress',
        requirement_id: null,
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
  })

  describe('completeGate', () => {
    it('should complete a gate and bump version', async () => {
      const mockRun = vi.fn()

      mockDb.prepare.mockReturnValue({
        run: mockRun,
        get: vi.fn()
          .mockReturnValueOnce({ id: 'gate-01', name: 'Setup', status: 'in_progress' }) // gate lookup
          .mockReturnValueOnce({ count: 1 }), // remaining gates
        all: vi.fn().mockReturnValue([]), // proposal hashes
      })

      mockDb.transaction.mockImplementation((fn: (...args: unknown[]) => void) => fn)

      const { completeGate } = await import('../../src/core/completions.js')
      const result = await completeGate('gate-01')

      expect(result.gateId).toBe('gate-01')
      expect(result.gateName).toBe('Setup')
      expect(result.bump).toBe('minor')
    })

    it('should throw for already completed gate', async () => {
      mockDb.prepare.mockReturnValue({
        run: vi.fn(),
        get: vi.fn().mockReturnValue({
          id: 'gate-01',
          name: 'Setup',
          status: 'completed',
        }),
      })

      const { completeGate } = await import('../../src/core/completions.js')
      await expect(completeGate('gate-01')).rejects.toThrow('already completed')
    })

    it('should throw for rejected gate', async () => {
      mockDb.prepare.mockReturnValue({
        run: vi.fn(),
        get: vi.fn().mockReturnValue({
          id: 'gate-01',
          name: 'Setup',
          status: 'rejected',
        }),
      })

      const { completeGate } = await import('../../src/core/completions.js')
      await expect(completeGate('gate-01')).rejects.toThrow('rejected')
    })

    it('should throw when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null)

      const { completeGate } = await import('../../src/core/completions.js')
      await expect(completeGate('gate-01')).rejects.toThrow()
    })
  })
})
