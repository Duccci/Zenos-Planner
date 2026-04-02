/**
 * Proposal Frontmatter Sync Tests
 *
 * Verifies that YAML frontmatter `status:` is kept in sync with the DB
 * across all five proposal state transitions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerProposalsOps } from '../../src/integration/proposals-registry.js'

// ---------------------------------------------------------------------------
// Mock setup (mirrors proposals-registry-ops.test.ts)
// ---------------------------------------------------------------------------

const mockAll = vi.fn()
const mockGet = vi.fn()
const mockPrepare = vi.fn()
const mockRun = vi.fn()
const mockGetDatabase = vi.fn()
const mockFindProposalByHash = vi.fn()
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockValidateArtifactFile = vi.fn()
const mockStartProposal = vi.fn()
const mockApproveProposal = vi.fn()
const mockRejectProposal = vi.fn()
const mockValidateApplyPhase = vi.fn()
const mockValidateQuality = vi.fn()
const mockLoadConfig = vi.fn()

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(''),
  writeFileSync: vi.fn(),
}))

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../src/storage/proposal-sync.js', () => ({
  syncProposalsFromDisk: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../src/integration/command-invoker.js', () => ({
  invokeCommand: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('../../src/utils/artifact-locator.js', () => ({
  findProposalByHash: (...args: unknown[]) => mockFindProposalByHash(...args),
  findGateByGateId: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../src/utils/config.js', () => ({
  getWorkspaceRoot: vi.fn().mockReturnValue('/mock/project'),
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  getDefaultConfig: vi.fn().mockReturnValue({ version: '1.0.0' }),
  readProjectOverview: vi.fn().mockResolvedValue({ completedGates: [], currentGate: null }),
  getGatesFromOverview: vi.fn().mockReturnValue([]),
}))

vi.mock('../../src/utils/git.js', () => ({
  getGitUserInfo: vi.fn().mockRejectedValue(new Error('git not available')),
}))

vi.mock('../../src/mcp/validators/artifact-validator.js', () => ({
  validateArtifactFile: (...args: unknown[]) => mockValidateArtifactFile(...args),
}))

vi.mock('../../src/mcp/validators/apply-phase-validator.js', () => ({
  validateApplyPhase: (...args: unknown[]) => mockValidateApplyPhase(...args),
}))

vi.mock('../../src/mcp/validators/quality-validator.js', () => ({
  validateQuality: (...args: unknown[]) => mockValidateQuality(...args),
  DEFAULT_QUALITY_STUB_METRICS: { coverage: 100, securityVulnerabilities: 0, lintErrors: 0, typeErrors: 0 },
}))

vi.mock('../../src/mcp/validators/dependency-validator.js', () => ({
  validateDependencies: vi.fn().mockReturnValue({ allowed: true, errors: [], warnings: [] }),
}))

vi.mock('../../src/mcp/validators/scope-validator.js', () => ({
  validateScope: vi.fn().mockReturnValue({ allowed: true, errors: [], warnings: [] }),
  validateTestFileScope: vi.fn().mockReturnValue({ allowed: true, errors: [], warnings: [] }),
}))

vi.mock('../../src/mcp/validators/test-first-validator.js', () => ({
  validateTestFirstPattern: vi.fn().mockReturnValue({ allowed: true, errors: [], warnings: [] }),
  validateGateLevelTestFirst: vi.fn().mockReturnValue({ allowed: true, errors: [], warnings: [] }),
  validateRedTestCoverage: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock('../../src/mcp/validators/proposal-phases-validator.js', () => ({
  validateProposalPhases: vi.fn().mockReturnValue({ allowed: true, errors: [], warnings: [] }),
}))

vi.mock('../../src/mcp/validators/requirement-relevance-validator.js', () => ({
  validateRequirementRelevance: vi.fn().mockReturnValue({ allowed: true, errors: [], warnings: [] }),
}))

vi.mock('../../src/core/completions.js', () => ({
  approveProposal: (...args: unknown[]) => mockApproveProposal(...args),
  rejectProposal: (...args: unknown[]) => mockRejectProposal(...args),
  startProposal: (...args: unknown[]) => mockStartProposal(...args),
}))

vi.mock('../../src/core/shell-validation-runner.js', () => ({
  ShellValidationRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({ results: [], passed: true, timestamp: new Date().toISOString() }),
  })),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Proposal markdown with YAML frontmatter containing a `status:` field. */
function makeProposalContent(status: string): string {
  return [
    '---',
    `status: ${status}`,
    'hash: abc12345',
    '---',
    '',
    `**Status**: ${status}`,
    '',
    '## Summary',
    'Test proposal.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proposal frontmatter status sync', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()

    mockGetDatabase.mockReturnValue({ prepare: mockPrepare })
    mockPrepare.mockReturnValue({ all: mockAll, get: mockGet, run: mockRun })
    mockAll.mockReturnValue([])
    mockGet.mockReturnValue(undefined)
    mockRun.mockReturnValue({})
    mockWriteFile.mockResolvedValue(undefined)
    mockApproveProposal.mockResolvedValue({})
    mockRejectProposal.mockResolvedValue({})
    mockStartProposal.mockResolvedValue({})
    mockValidateApplyPhase.mockReturnValue({ allowed: true, warnings: [] })
    mockValidateQuality.mockResolvedValue({ allowed: true, warnings: [] })
    mockValidateArtifactFile.mockResolvedValue({ allowed: true, warnings: [] })
    mockLoadConfig.mockResolvedValue({ quality: { coverageThreshold: 90 } })
    mockFindProposalByHash.mockResolvedValue(null)

    registerProposalsOps(registry)
  })

  // -------------------------------------------------------------------------
  // proposal_cancel
  // -------------------------------------------------------------------------
  describe('proposal_cancel', () => {
    it('updates YAML frontmatter status to cancelled', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/solitary/test.md')
      mockReadFile.mockResolvedValue(content)

      const result = (await registry.invoke('proposal_cancel', { hash: 'abc12345' })) as {
        success: boolean; data: { newStatus: string }
      }
      expect(result.success).toBe(true)

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toMatch(/^status: cancelled$/m)
    })

    it('also updates body **Status**: field on cancel', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/solitary/test.md')
      mockReadFile.mockResolvedValue(content)

      await registry.invoke('proposal_cancel', { hash: 'abc12345' })

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toContain('**Status**: cancelled')
    })

    it('does not write when proposal file is not found', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue(null)

      const result = (await registry.invoke('proposal_cancel', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
      expect(mockWriteFile).not.toHaveBeenCalled()
    })

    it('swallows writeFile errors and still returns success', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/solitary/test.md')
      mockReadFile.mockResolvedValue(content)
      mockWriteFile.mockRejectedValue(new Error('disk full'))

      const result = (await registry.invoke('proposal_cancel', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // proposal_defer
  // -------------------------------------------------------------------------
  describe('proposal_defer', () => {
    it('updates YAML frontmatter status to backlog', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/solitary/test.md')
      mockReadFile.mockResolvedValue(content)

      const result = (await registry.invoke('proposal_defer', { hash: 'abc12345' })) as {
        success: boolean; data: { newStatus: string }
      }
      expect(result.success).toBe(true)

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toMatch(/^status: backlog$/m)
    })

    it('also updates body **Status**: field on defer', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/solitary/test.md')
      mockReadFile.mockResolvedValue(content)

      await registry.invoke('proposal_defer', { hash: 'abc12345' })

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toContain('**Status**: backlog')
    })
  })

  // -------------------------------------------------------------------------
  // proposal_start
  // -------------------------------------------------------------------------
  describe('proposal_start', () => {
    it('updates YAML frontmatter status to in_progress', async () => {
      const content = makeProposalContent('pending')
      mockGet
        .mockReturnValueOnce({ hash: 'abc12345', gate_id: 'gate-01', title: 'Test' })  // proposal lookup
        .mockReturnValueOnce({ status: 'pending' })  // currentRow status lookup
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/test.md')
      // readFile called twice: once for artifact validation, once for frontmatter sync
      mockReadFile.mockResolvedValue(content)
      mockStartProposal.mockResolvedValue(undefined)

      const result = (await registry.invoke('proposal_start', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toMatch(/^status: in_progress$/m)
    })

    it('does not update body **Status**: field on start', async () => {
      const content = makeProposalContent('pending')
      mockGet
        .mockReturnValueOnce({ hash: 'abc12345', gate_id: 'gate-01', title: 'Test' })
        .mockReturnValueOnce({ status: 'pending' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/test.md')
      mockReadFile.mockResolvedValue(content)
      mockStartProposal.mockResolvedValue(undefined)

      await registry.invoke('proposal_start', { hash: 'abc12345' })

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      // Body **Status**: unchanged (still 'pending')
      expect(written).toContain('**Status**: pending')
    })
  })

  // -------------------------------------------------------------------------
  // proposal_approve
  // -------------------------------------------------------------------------
  describe('proposal_approve', () => {
    const approveProposalRow = {
      hash: 'abc12345',
      dependencies: '[]',
      gate_id: 'gate-01',
      quality_metrics: JSON.stringify({ coverage: 95, securityVulnerabilities: 0, lintErrors: 0, typeErrors: 0 }),
      files_affected: '[]',
      status: 'in_progress',
    }

    it('always syncs YAML frontmatter status to completed (no writeback flag)', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue(approveProposalRow)
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/test.md')
      mockReadFile.mockResolvedValue(content)

      const result = (await registry.invoke('proposal_approve', { hash: 'abc12345' })) as {
        success: boolean; data: { wroteBack: boolean }
      }
      expect(result.success).toBe(true)

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toMatch(/^status: completed$/m)
      expect(result.data.wroteBack).toBe(false)
    })

    it('also updates body **Status**: when writeback is true', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue(approveProposalRow)
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/test.md')
      mockReadFile.mockResolvedValue(content)

      const result = (await registry.invoke('proposal_approve', {
        hash: 'abc12345',
        writeback: true,
      })) as { success: boolean; data: { wroteBack: boolean } }
      expect(result.success).toBe(true)

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toMatch(/^status: completed$/m)
      expect(written).toContain('**Status**: completed')
      expect(result.data.wroteBack).toBe(true)
    })

    it('does not update body **Status**: when writeback is false', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue(approveProposalRow)
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/test.md')
      mockReadFile.mockResolvedValue(content)

      await registry.invoke('proposal_approve', { hash: 'abc12345', writeback: false })

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toContain('**Status**: in_progress')
    })
  })

  // -------------------------------------------------------------------------
  // proposal_reject
  // -------------------------------------------------------------------------
  describe('proposal_reject', () => {
    it('updates YAML frontmatter status to rejected', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/test.md')
      mockReadFile.mockResolvedValue(content)

      const result = (await registry.invoke('proposal_reject', {
        hash: 'abc12345',
        rejectionReason: 'Not aligned with goals',
      })) as { success: boolean; data: { newStatus: string } }
      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('rejected')

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toMatch(/^status: rejected$/m)
    })

    it('does not update body **Status**: field on reject', async () => {
      const content = makeProposalContent('in_progress')
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/test.md')
      mockReadFile.mockResolvedValue(content)

      await registry.invoke('proposal_reject', { hash: 'abc12345' })

      const written = mockWriteFile.mock.calls[0]?.[1] as string
      expect(written).toContain('**Status**: in_progress')
    })

    it('does not write when proposal file is not found', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
      mockFindProposalByHash.mockResolvedValue(null)

      const result = (await registry.invoke('proposal_reject', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
      expect(mockWriteFile).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // No frontmatter block: graceful degradation
  // -------------------------------------------------------------------------
  it('skips frontmatter sync when file has no --- delimiters', async () => {
    const contentNoFm = '**Status**: in_progress\n\n## Summary\nTest.'
    mockGet.mockReturnValue({ hash: 'abc12345', status: 'in_progress' })
    mockFindProposalByHash.mockResolvedValue('zeno/proposals/solitary/test.md')
    mockReadFile.mockResolvedValue(contentNoFm)

    const result = (await registry.invoke('proposal_cancel', { hash: 'abc12345' })) as {
      success: boolean
    }
    expect(result.success).toBe(true)
    // writeFile still called (body **Status** replacement still runs)
    expect(mockWriteFile).toHaveBeenCalled()
    const written = mockWriteFile.mock.calls[0]?.[1] as string
    // But no `status:` frontmatter line should have been introduced
    expect(written).not.toMatch(/^status:/m)
  })
})
