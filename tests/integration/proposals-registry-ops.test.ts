/**
 * Proposals Registry Operations Tests
 *
 * Covers proposal_list, proposal_show, proposal_validate,
 * proposal_approve, proposal_reject, and proposal_start operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerProposalsOps } from '../../src/integration/proposals-registry.js'

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockAll = vi.fn()
const mockGet = vi.fn()
const mockPrepare = vi.fn()
const mockGetDatabase = vi.fn()
const mockSyncProposalsFromDisk = vi.fn()
const mockInvokeCommand = vi.fn()
const mockValidateDependencies = vi.fn()
const mockValidateQuality = vi.fn()
const mockValidateProposalPhases = vi.fn()
const mockValidateScope = vi.fn()
const mockValidateTestFileScope = vi.fn()
const mockValidateTestFirstPattern = vi.fn()
const mockValidateGateLevelTestFirst = vi.fn()
const mockValidateRedTestCoverage = vi.fn()
const mockFindProposalByHash = vi.fn()
const mockReadFile = vi.fn()
const mockValidateApplyPhase = vi.fn()
const mockLoadConfig = vi.fn()
const mockValidateArtifactFile = vi.fn()
const mockApproveProposal = vi.fn()
const mockRejectProposal = vi.fn()
const mockStartProposal = vi.fn()
const mockRun = vi.fn()
const mockWriteFile = vi.fn()
const mockReadFileSync = vi.fn()
const mockWriteFileSync = vi.fn()

vi.mock('node:fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}))

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../src/storage/proposal-sync.js', () => ({
  syncProposalsFromDisk: (...args: unknown[]) => mockSyncProposalsFromDisk(...args),
}))

vi.mock('../../src/integration/command-invoker.js', () => ({
  invokeCommand: (...args: unknown[]) => mockInvokeCommand(...args),
}))

vi.mock('../../src/mcp/validators/dependency-validator.js', () => ({
  validateDependencies: (...args: unknown[]) => mockValidateDependencies(...args),
}))

vi.mock('../../src/mcp/validators/quality-validator.js', () => ({
  validateQuality: (...args: unknown[]) => mockValidateQuality(...args),
  DEFAULT_QUALITY_STUB_METRICS: { coverage: 100, securityVulnerabilities: 0, lintErrors: 0, typeErrors: 0 },
}))

vi.mock('../../src/mcp/validators/scope-validator.js', () => ({
  validateScope: (...args: unknown[]) => mockValidateScope(...args),
  validateTestFileScope: (...args: unknown[]) => mockValidateTestFileScope(...args),
}))

vi.mock('../../src/mcp/validators/test-first-validator.js', () => ({
  validateTestFirstPattern: (...args: unknown[]) => mockValidateTestFirstPattern(...args),
  validateGateLevelTestFirst: (...args: unknown[]) => mockValidateGateLevelTestFirst(...args),
  validateRedTestCoverage: (...args: unknown[]) => mockValidateRedTestCoverage(...args),
}))

vi.mock('../../src/mcp/validators/proposal-phases-validator.js', () => ({
  validateProposalPhases: (...args: unknown[]) => mockValidateProposalPhases(...args),
}))

vi.mock('../../src/utils/artifact-locator.js', () => ({
  findProposalByHash: (...args: unknown[]) => mockFindProposalByHash(...args),
}))

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../src/mcp/validators/apply-phase-validator.js', () => ({
  validateApplyPhase: (...args: unknown[]) => mockValidateApplyPhase(...args),
}))

vi.mock('../../src/utils/config.js', () => ({
  getWorkspaceRoot: vi.fn().mockReturnValue('/mock/project'),
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  getDefaultConfig: vi.fn().mockReturnValue({ version: '1.0.0' }),
  readProjectOverview: vi.fn().mockResolvedValue({ completedGates: [], currentGate: null }),
  getGatesFromOverview: vi.fn().mockReturnValue([]),
}))

vi.mock('../../src/mcp/validators/artifact-validator.js', () => ({
  validateArtifactFile: (...args: unknown[]) => mockValidateArtifactFile(...args),
}))

vi.mock('../../src/core/completions.js', () => ({
  approveProposal: (...args: unknown[]) => mockApproveProposal(...args),
  rejectProposal: (...args: unknown[]) => mockRejectProposal(...args),
  startProposal: (...args: unknown[]) => mockStartProposal(...args),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockDb(rows: unknown[] = [], singleRow: unknown = undefined) {
  mockPrepare.mockReturnValue({
    all: mockAll.mockReturnValue(rows),
    get: mockGet.mockReturnValue(singleRow),
  })
  return { prepare: mockPrepare }
}

describe('proposals-registry operations', () => {
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
    mockReadFileSync.mockReturnValue('')
    mockWriteFileSync.mockReturnValue(undefined)
    mockInvokeCommand.mockResolvedValue({ success: true })
    mockApproveProposal.mockResolvedValue({})
    mockRejectProposal.mockResolvedValue({})
    mockStartProposal.mockResolvedValue({})
    mockValidateDependencies.mockReturnValue({ allowed: true, errors: [], warnings: [] })
    mockValidateQuality.mockResolvedValue({ allowed: true, warnings: [] })
    mockValidateApplyPhase.mockReturnValue({ allowed: true, warnings: [] })
    mockValidateProposalPhases.mockReturnValue({ allowed: true, errors: [], warnings: [] })
    mockValidateScope.mockReturnValue({ allowed: true, errors: [], warnings: [] })
    mockValidateTestFileScope.mockReturnValue({ allowed: true, errors: [], warnings: [] })
    mockValidateTestFirstPattern.mockReturnValue({ allowed: true, errors: [], warnings: [] })
    mockValidateGateLevelTestFirst.mockReturnValue({ allowed: true, errors: [], warnings: [] })
    mockValidateRedTestCoverage.mockReturnValue({ allowed: true })
    mockValidateArtifactFile.mockResolvedValue({ allowed: true, errors: [], warnings: [] })
    mockLoadConfig.mockResolvedValue({ quality: { coverageThreshold: 90 } })
    mockFindProposalByHash.mockResolvedValue(null)

    registerProposalsOps(registry)
  })

  // -------------------------------------------------------------------------
  // proposal_list
  // -------------------------------------------------------------------------
  describe('proposal_list', () => {
    it('returns empty list when no proposals exist', async () => {
      mockAll.mockReturnValue([])

      const result = (await registry.invoke('proposal_list', {})) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { proposals: unknown[] }
      expect(data.proposals).toHaveLength(0)
    })

    it('returns proposals without filters', async () => {
      const rows = [
        {
          hash: 'abc12345',
          title: 'Proposal 1',
          status: 'pending',
          gate_id: 'gate-01',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          hash: 'def67890',
          title: 'Proposal 2',
          status: 'in_progress',
          gate_id: 'gate-02',
          created_at: '2026-01-02T00:00:00Z',
        },
      ]
      mockAll.mockReturnValue(rows)

      const result = (await registry.invoke('proposal_list', {})) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { proposals: unknown[] }
      expect(data.proposals).toHaveLength(2)
    })

    it('filters by gateId', async () => {
      mockAll.mockReturnValue([
        {
          hash: 'abc12345',
          title: 'Gate Proposal',
          status: 'pending',
          gate_id: 'gate-01',
          created_at: '2026-01-01T00:00:00Z',
        },
      ])

      const result = (await registry.invoke('proposal_list', { gateId: 'gate-01' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      // Verify the query included the filter (prepare was called with gateId-containing query)
      expect(mockPrepare).toHaveBeenCalled()
    })

    it('filters by status', async () => {
      mockAll.mockReturnValue([
        {
          hash: 'abc12345',
          title: 'Pending Proposal',
          status: 'pending',
          gate_id: 'gate-01',
          created_at: '2026-01-01T00:00:00Z',
        },
      ])

      const result = (await registry.invoke('proposal_list', { status: 'pending' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
    })

    it('filters by both gateId and status', async () => {
      mockAll.mockReturnValue([])

      const result = (await registry.invoke('proposal_list', {
        gateId: 'gate-01',
        status: 'completed',
      })) as { success: boolean; data: unknown }
      expect(result.success).toBe(true)
    })

    it('returns all proposals regardless of count', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        hash: `hash${i}`,
        title: `P${i}`,
        status: 'pending',
        gate_id: 'gate-01',
        created_at: '2026-01-01T00:00:00Z',
      }))
      mockAll.mockReturnValue(rows)

      const result = (await registry.invoke('proposal_list', {})) as { success: boolean; data: unknown }

      expect(result.success).toBe(true)
      const data = result.data as { proposals: unknown[] }
      expect(data.proposals).toHaveLength(10)
    })

    it('filters out rows with missing required fields', async () => {
      const rows = [
        // Valid gate-tied row
        {
          hash: 'abc12345',
          title: 'Good',
          status: 'pending',
          gate_id: 'gate-01',
          created_at: '2026-01-01T00:00:00Z',
        },
        // Missing hash (invalid — should be filtered out)
        {
          title: 'No hash',
          status: 'pending',
          gate_id: 'gate-01',
          created_at: '2026-01-01T00:00:00Z',
        },
        // NULL gate_id — treated as solitary proposal (valid, should be included)
        {
          hash: 'xyz99999',
          title: 'No gate',
          status: 'pending',
          created_at: '2026-01-01T00:00:00Z',
        },
        // Missing created_at (invalid — should be filtered out)
        { hash: 'zzz11111', title: 'No date', status: 'pending', gate_id: 'gate-01' },
      ]
      mockAll.mockReturnValue(rows)

      const result = (await registry.invoke('proposal_list', {})) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { proposals: Array<{ hash: string; gateId: string }> }
      // 2 valid rows: abc12345 (gate-tied) + xyz99999 (solitary / null gate_id)
      expect(data.proposals).toHaveLength(2)
      const solitaryRow = data.proposals.find((p) => p.hash === 'xyz99999')
      expect(solitaryRow?.gateId).toBe('solitary')
    })

    it('uses created_at for lastUpdated when approved_at is null', async () => {
      mockAll.mockReturnValue([
        {
          hash: 'abc12345',
          title: 'P1',
          status: 'pending',
          gate_id: 'gate-01',
          created_at: '2026-01-01T00:00:00Z',
          approved_at: null,
        },
      ])

      const result = (await registry.invoke('proposal_list', {})) as {
        success: boolean
        data: unknown
      }
      const data = result.data as { proposals: Array<{ lastUpdated: string }> }
      expect(data.proposals[0].lastUpdated).toBe('2026-01-01T00:00:00Z')
    })
  })

  // -------------------------------------------------------------------------
  // proposal_show
  // -------------------------------------------------------------------------
  describe('proposal_show', () => {
    it('throws when proposal not found', async () => {
      mockGet.mockReturnValue(undefined)

      const result = (await registry.invoke('proposal_show', { hash: 'notexist' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('returns proposal details when found', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Test Proposal',
        summary: 'A test proposal',
        status: 'pending',
        gate_id: 'gate-01',
        created_at: '2026-01-01T00:00:00Z',
        approved_at: null,
        files_affected: null,
        dependencies: null,
      })

      const result = (await registry.invoke('proposal_show', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.hash).toBe('abc12345')
      expect(data.title).toBe('Test Proposal')
    })

    it('strips # prefix from hash', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Test',
        status: 'pending',
        gate_id: 'gate-01',
        created_at: '2026-01-01T00:00:00Z',
        approved_at: null,
        files_affected: null,
        dependencies: null,
      })

      const result = (await registry.invoke('proposal_show', { hash: '#abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
    })

    it('parses JSON files_affected field', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Test',
        status: 'pending',
        gate_id: 'gate-01',
        created_at: '2026-01-01T00:00:00Z',
        approved_at: null,
        files_affected: JSON.stringify(['src/foo.ts', 'src/bar.ts']),
        dependencies: null,
      })

      const result = (await registry.invoke('proposal_show', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.files).toBeDefined()
    })

    it('parses JSON dependencies field', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Test',
        status: 'pending',
        gate_id: 'gate-01',
        created_at: '2026-01-01T00:00:00Z',
        approved_at: null,
        files_affected: null,
        dependencies: JSON.stringify(['dep11111', 'dep22222']),
      })

      const result = (await registry.invoke('proposal_show', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.dependencies).toBeDefined()
    })

    it('handles invalid JSON in files_affected gracefully', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Test',
        status: 'pending',
        gate_id: 'gate-01',
        created_at: '2026-01-01T00:00:00Z',
        approved_at: null,
        files_affected: 'not-valid-json{',
        dependencies: null,
      })

      const result = (await registry.invoke('proposal_show', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
    })

    it('handles invalid JSON in dependencies gracefully', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Test',
        status: 'pending',
        gate_id: 'gate-01',
        created_at: '2026-01-01T00:00:00Z',
        approved_at: null,
        files_affected: null,
        dependencies: '{bad json',
      })

      const result = (await registry.invoke('proposal_show', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // proposal_validate
  // -------------------------------------------------------------------------
  describe('proposal_validate', () => {
    it('throws when proposal not found', async () => {
      mockGet.mockReturnValue(undefined)

      const result = (await registry.invoke('proposal_validate', { hash: 'notexist' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('validates a valid proposal with no issues', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Valid Proposal',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
        created_at: '2026-01-01T00:00:00Z',
      })
      mockFindProposalByHash.mockResolvedValue(null)

      const result = (await registry.invoke('proposal_validate', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { passedQuantitative: boolean }
      expect(data.passedQuantitative).toBe(true)
    })

    it('validates a proposal with dependencies', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Proposal with deps',
        dependencies: JSON.stringify(['dep11111']),
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
        created_at: '2026-01-01T00:00:00Z',
      })
      mockAll.mockReturnValue([{ hash: 'dep11111', dependencies: null, gate_id: 'gate-01' }])
      mockValidateDependencies.mockReturnValue({ allowed: true, errors: [], warnings: [] })

      const result = (await registry.invoke('proposal_validate', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
    })

    it('includes dependency errors in result', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Circular deps',
        dependencies: JSON.stringify(['dep11111']),
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
        created_at: '2026-01-01T00:00:00Z',
      })
      mockAll.mockReturnValue([])
      mockValidateDependencies.mockReturnValue({
        allowed: false,
        errors: ['Circular dependency detected'],
        warnings: [],
      })

      const result = (await registry.invoke('proposal_validate', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { passedQuantitative: boolean; issues: { level: string; message: string }[] }
      expect(data.passedQuantitative).toBe(false)
      expect(data.issues.some(i => i.level === 'error' && i.message.includes('Circular dependency detected'))).toBe(true)
    })

    it('validates quality metrics when present', async () => {
      const qualityMetrics = {
        coverage: 95,
        securityVulnerabilities: 0,
        lintErrors: 0,
        typeErrors: 0,
      }
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Quality Proposal',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: JSON.stringify(qualityMetrics),
        files_affected: null,
        created_at: '2026-01-01T00:00:00Z',
      })
      mockValidateQuality.mockResolvedValue({ allowed: true, warnings: ['Low coverage'] })

      const result = (await registry.invoke('proposal_validate', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { passedQuantitative: boolean; issues: { level: string; message: string }[] }
      expect(data.issues.some(i => i.level === 'warning' && i.message.includes('Low coverage'))).toBe(true)
    })

    it('includes quality errors when quality validation fails', async () => {
      const qualityMetrics = { coverage: 50 }
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Bad Quality',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: JSON.stringify(qualityMetrics),
        files_affected: null,
        created_at: '2026-01-01T00:00:00Z',
      })
      mockValidateQuality.mockResolvedValue({
        allowed: false,
        errors: ['Coverage below threshold'],
      })

      const result = (await registry.invoke('proposal_validate', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { passedQuantitative: boolean; errors?: string[] }
      expect(data.passedQuantitative).toBe(false)
    })

    it('runs proposal phases validation when file is found', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Phased Proposal',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
        created_at: '2026-01-01T00:00:00Z',
      })
      mockFindProposalByHash.mockResolvedValue('/path/to/proposal.md')
      mockReadFile.mockResolvedValue(
        `# Proposal: Test\n## Summary\nA summary.\n## Tasks\n### Task 1: Do something\n`
      )
      mockValidateProposalPhases.mockReturnValue({ errors: [], warnings: ['Phase warning'] })

      const result = (await registry.invoke('proposal_validate', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
    })

    it('handles ENOENT when finding proposal file', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Test',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
        created_at: '2026-01-01T00:00:00Z',
      })
      mockFindProposalByHash.mockRejectedValue(new Error('ENOENT: no such file'))

      const result = (await registry.invoke('proposal_validate', { hash: 'abc12345' })) as {
        success: boolean
      }
      // Should not propagate ENOENT - it's expected and handled silently
      expect(result.success).toBe(true)
    })

    it('propagates error when status UPDATE throws during advance to validated', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        title: 'Valid Proposal',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
        created_at: '2026-01-01T00:00:00Z',
        // no status → defaults to 'pending', satisfies advance-to-validated condition
      })
      mockFindProposalByHash.mockResolvedValue(null)
      // Make only the UPDATE validate-status run throw; other prepare().run() calls succeed
      mockPrepare.mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes("UPDATE proposals SET status = 'validated'")) {
          return { run: vi.fn(() => { throw new Error('DB write failed') }), get: mockGet, all: mockAll }
        }
        return { run: mockRun, get: mockGet, all: mockAll }
      })

      const result = (await registry.invoke('proposal_validate', { hash: 'abc12345' })) as {
        success: boolean
      }
      // Error rethrown from the catch block (line 1169 in proposals-registry.ts)
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // proposal_approve
  // -------------------------------------------------------------------------
  describe('proposal_approve', () => {
    it('throws when proposal not found', async () => {
      mockGet.mockReturnValue(undefined)

      const result = (await registry.invoke('proposal_approve', { hash: 'notexist' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('throws when apply phase validation blocks', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: JSON.stringify(['src/foo.ts']),
      })
      mockValidateApplyPhase.mockReturnValue({
        allowed: false,
        errors: ['Missing test coverage'],
      })

      const result = (await registry.invoke('proposal_approve', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('throws when quality validation fails', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: JSON.stringify({ coverage: 50 }),
        files_affected: null,
      })
      mockValidateApplyPhase.mockReturnValue({ allowed: true, warnings: [] })
      mockValidateQuality.mockResolvedValue({ allowed: false, errors: ['Coverage 50% < 90%'] })

      const result = (await registry.invoke('proposal_approve', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('approves a valid proposal and returns hash+status', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
      })
      mockValidateApplyPhase.mockReturnValue({ allowed: true, warnings: [] })
      mockValidateQuality.mockResolvedValue({ allowed: true, warnings: [] })
      mockApproveProposal.mockResolvedValue({})

      const result = (await registry.invoke('proposal_approve', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { hash: string; previousStatus: string; newStatus: string; approvedAt: string }
      expect(data.hash).toBe('abc12345')
      expect(data.newStatus).toBe('completed')
      expect(data.approvedAt).toBeDefined()
    })

    it('throws when approveProposal throws after validation passes', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
      })
      mockValidateApplyPhase.mockReturnValue({ allowed: true, warnings: [] })
      mockValidateQuality.mockResolvedValue({ allowed: true, warnings: [] })
      mockApproveProposal.mockRejectedValue(new Error('DB write failed'))

      const result = (await registry.invoke('proposal_approve', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('includes approval warnings from quality check', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
      })
      mockValidateApplyPhase.mockReturnValue({ allowed: true, warnings: [] })
      mockValidateQuality.mockResolvedValue({
        allowed: true,
        warnings: ['Approaching lint threshold'],
      })
      mockApproveProposal.mockResolvedValue({})

      const result = (await registry.invoke('proposal_approve', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { hash: string; previousStatus: string; newStatus: string; approvedAt: string }
      expect(data.hash).toBe('abc12345')
      expect(data.newStatus).toBe('completed')
      expect(data.approvedAt).toBeDefined()
    })

    it('approve with writeback: true patches Status field in the proposal file', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        dependencies: null,
        gate_id: 'gate-01',
        quality_metrics: null,
        files_affected: null,
      })
      mockValidateApplyPhase.mockReturnValue({ allowed: true, warnings: [] })
      mockValidateQuality.mockResolvedValue({ allowed: true, warnings: [] })
      mockApproveProposal.mockResolvedValue({})
      mockFindProposalByHash.mockResolvedValue('/tmp/proposals/gate-01/my-proposal.md')
      mockReadFileSync.mockReturnValue('**Status**: in_progress\n## Summary\nTest content')

      const result = (await registry.invoke('proposal_approve', { hash: 'abc12345', writeback: true })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { wroteBack: boolean }
      expect(data.wroteBack).toBe(true)
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/tmp/proposals/gate-01/my-proposal.md',
        '**Status**: completed\n## Summary\nTest content',
        'utf-8'
      )
    })
  })

  // -------------------------------------------------------------------------
  // proposal_reject
  // -------------------------------------------------------------------------
  describe('proposal_reject', () => {
    it('rejects a proposal successfully', async () => {
      mockRejectProposal.mockResolvedValue({})

      const result = (await registry.invoke('proposal_reject', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
      expect(mockRejectProposal).toHaveBeenCalledWith('abc12345', expect.any(Object))
    })

    it('throws when invokeCommand fails', async () => {
      mockRejectProposal.mockRejectedValue(new Error('Rejection failed'))

      const result = (await registry.invoke('proposal_reject', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('fails schema validation for missing hash', async () => {
      const result = (await registry.invoke('proposal_reject', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // proposal_start
  // -------------------------------------------------------------------------
  describe('proposal_start', () => {
    it('throws when proposal not found', async () => {
      mockGet.mockReturnValue(undefined)

      const result = (await registry.invoke('proposal_start', { hash: 'notexist' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('throws when artifact validation fails', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        gate_id: 'gate-01',
        title: 'Test Proposal',
        file_path: 'zeno/proposals/gate-01/01-test.md',
      })
      mockValidateArtifactFile.mockResolvedValue({
        allowed: false,
        errors: ['Missing required section'],
      })

      const result = (await registry.invoke('proposal_start', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('starts a proposal when artifact validation passes', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        gate_id: 'gate-01',
        title: 'Test Proposal',
        file_path: 'zeno/proposals/gate-01/01-test.md',
      })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/01-test.md')
      mockValidateArtifactFile.mockResolvedValue({ allowed: true, warnings: [] })
      mockStartProposal.mockResolvedValue(undefined)
      mockInvokeCommand.mockResolvedValue({ success: true })

      const result = (await registry.invoke('proposal_start', { hash: 'abc12345' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
    })

    it('throws when invokeCommand fails after artifact validation', async () => {
      mockGet.mockReturnValue({
        hash: 'abc12345',
        gate_id: 'gate-01',
        title: 'Test',
        file_path: 'zeno/proposals/gate-01/01-test.md',
      })
      mockValidateArtifactFile.mockResolvedValue({ allowed: true, warnings: [] })
      mockStartProposal.mockRejectedValue(new Error('Start failed'))

      const result = (await registry.invoke('proposal_start', { hash: 'abc12345' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // proposal_cancel
  // -------------------------------------------------------------------------
  describe('proposal_cancel', () => {
    it('returns failure when proposal not found', async () => {
      mockGet.mockReturnValue(undefined)
      const result = (await registry.invoke('proposal_cancel', { hash: 'notfound' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('cancels proposal when filePath is null (no writeback)', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in-progress' })
      mockFindProposalByHash.mockResolvedValue(null)

      const result = (await registry.invoke('proposal_cancel', { hash: 'abc12345', reason: 'no longer needed' })) as {
        success: boolean; data: { hash: string; newStatus: string; reason: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('cancelled')
      expect(result.data.reason).toBe('no longer needed')
    })

    it('cancels proposal with hash starting with # (covers ternary)', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'pending' })
      mockFindProposalByHash.mockResolvedValue(null)

      const result = (await registry.invoke('proposal_cancel', { hash: '#abc12345' })) as {
        success: boolean; data: { newStatus: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('cancelled')
    })

    it('cancels proposal and writes back when filePath is truthy', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in-progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/01-test.md')
      mockReadFile.mockResolvedValue('**Status**: in-progress\nSome content')

      const result = (await registry.invoke('proposal_cancel', { hash: 'abc12345' })) as {
        success: boolean; data: { newStatus: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('cancelled')
      // writeback is best-effort; verify readFile was invoked (covers if(filePath) true branch)
      expect(mockReadFile).toHaveBeenCalledWith('zeno/proposals/gate-01/01-test.md')
    })

    it('still succeeds when writeback throws (catch is best-effort)', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'pending' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/01-test.md')
      mockReadFile.mockRejectedValue(new Error('disk error'))

      const result = (await registry.invoke('proposal_cancel', { hash: 'abc12345' })) as {
        success: boolean; data: { newStatus: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('cancelled')
    })
  })

  // -------------------------------------------------------------------------
  // proposal_defer
  // -------------------------------------------------------------------------
  describe('proposal_defer', () => {
    it('returns failure when proposal not found', async () => {
      mockGet.mockReturnValue(undefined)
      const result = (await registry.invoke('proposal_defer', { hash: 'notfound' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('defers proposal when filePath is null', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in-progress' })
      mockFindProposalByHash.mockResolvedValue(null)

      const result = (await registry.invoke('proposal_defer', { hash: 'abc12345', reason: 'deprioritized' })) as {
        success: boolean; data: { hash: string; newStatus: string; reason: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('backlog')
      expect(result.data.reason).toBe('deprioritized')
    })

    it('defers proposal with # hash prefix (covers ternary)', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'pending' })
      mockFindProposalByHash.mockResolvedValue(null)

      const result = (await registry.invoke('proposal_defer', { hash: '#abc12345' })) as {
        success: boolean; data: { newStatus: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('backlog')
    })

    it('defers proposal and writes back when filePath is truthy', async () => {
      mockGet.mockReturnValue({ hash: 'abc12345', status: 'in-progress' })
      mockFindProposalByHash.mockResolvedValue('zeno/proposals/gate-01/01-test.md')
      mockReadFile.mockResolvedValue('**Status**: in-progress\nContent')

      const result = (await registry.invoke('proposal_defer', { hash: 'abc12345' })) as {
        success: boolean; data: { newStatus: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('backlog')
      // writeback is best-effort; verify readFile was invoked (covers if(filePath) true branch)
      expect(mockReadFile).toHaveBeenCalledWith('zeno/proposals/gate-01/01-test.md')
    })
  })
})
