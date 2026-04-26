import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Consolidated proposal generation tests covering:
 * - Basic generation from gate PRD
 * - Scaffold generation (no artifact validation at generation time)
 * - Error handling and non-fatal failures
 */

// ---------------------------------------------------------------------------
// Mock dependencies with function-based mocks for flexibility
// ---------------------------------------------------------------------------

const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockFsAccess = vi.fn()
const mockExtractObjectives = vi.fn()
const mockExtractGateType = vi.fn().mockReturnValue('feature')
const mockExtractRequirements = vi.fn()
const mockDecomposeToProposals = vi.fn()
const mockCalculateProposalDependencies = vi.fn()
const mockValidateArtifactFile = vi.fn()
const mockSyncProposalsFromDisk = vi.fn()
const mockGetDatabase = vi.fn()
const mockFindGateByGateId = vi.fn()

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../src/utils/artifact-locator.js', () => ({
  findGateByGateId: (...args: unknown[]) => mockFindGateByGateId(...args),
}))

vi.mock('node:fs/promises', () => ({
  access: (...args: unknown[]) => mockFsAccess(...args),
}))

vi.mock('../../src/core/proposal-parser.js', () => ({
  extractObjectives: (...args: unknown[]) => mockExtractObjectives(...args),
  extractGateType: (...args: unknown[]) => mockExtractGateType(...args),
  extractRequirements: (...args: unknown[]) => mockExtractRequirements(...args),
}))

vi.mock('../../src/core/proposal-writer.js', () => ({
  decomposeToProposals: (...args: unknown[]) => mockDecomposeToProposals(...args),
  calculateProposalDependencies: (...args: unknown[]) => mockCalculateProposalDependencies(...args),
}))

vi.mock('../../src/mcp/validators/artifact-validator.js', () => ({
  validateArtifactFile: (...args: unknown[]) => mockValidateArtifactFile(...args),
}))

vi.mock('../../src/storage/proposal-sync.js', () => ({
  syncProposalsFromDisk: (...args: unknown[]) => mockSyncProposalsFromDisk(...args),
}))

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../src/utils/errors.js', () => ({
  ZenoError: class extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.code = code
    }
  },
}))

vi.mock('../../src/utils/config.js', () => ({
  getZenoGitDir: (root = process.cwd()) => `${root}/zeno`,
  getWorkspaceRoot: (root = process.cwd()) => root,
}))

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const GATE_PRD =
  '# Gate PRD\n\n## Objectives\n\n- Build API\n- Add Auth\n\n## Requirements\n\n- REQ-001: REST endpoints\n'

const PROPOSAL_STUB = {
  hash: 'abc12345',
  filename: '01-feature.md',
  path: 'zeno/proposals/gate-01/01-feature.md',
  type: 'gate-tied',
  status: 'pending',
  summary: 'Feature proposal',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proposal-generation', () => {
  // Setup shared mocks before each test
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations for all tests
    mockReadFile.mockResolvedValue(GATE_PRD)
    mockWriteFile.mockResolvedValue(undefined)
    mockExtractObjectives.mockReturnValue(['Build API', 'Add Auth'])
    mockExtractRequirements.mockReturnValue([{ id: 'req-1', description: 'REST endpoints' }])
    mockDecomposeToProposals.mockResolvedValue([
      {
        hash: 'abc12345',
        filename: '01-build-api.md',
        path: '/out/01-build-api.md',
        type: 'gate-tied',
        status: 'pending',
        summary: 'Build API',
      },
      {
        hash: 'def67890',
        filename: '02-add-auth.md',
        path: '/out/02-add-auth.md',
        type: 'gate-tied',
        status: 'pending',
        summary: 'Add Auth',
      },
    ])
    mockCalculateProposalDependencies.mockReturnValue({
      edges: [
        { from: 'abc12345', to: 'def67890', type: 'sequential' },
      ],
      parallelSets: [['abc12345'], ['def67890']],
    })
    mockValidateArtifactFile.mockResolvedValue({
      allowed: true,
      warnings: undefined,
      errors: undefined,
    })
    mockSyncProposalsFromDisk.mockImplementation(() => undefined)
    mockGetDatabase.mockReturnValue({ prepare: vi.fn() })
    mockFsAccess.mockResolvedValue(undefined)
    // findGateByGateId returns a plausible absolute path by default
    mockFindGateByGateId.mockImplementation(async (gateId: string) => {
      return `${process.cwd()}/zeno/gates/${gateId}-stub.md`
    })
  })

  describe('basic generation', () => {
    it('should generate proposals from gate PRD', async () => {
      const { generateProposals } = await import('../../src/core/proposal-generation.js')

      const result = await generateProposals({
        gateId: 'gate-01-core-api',
        templateName: 'proposal-template',
        outputDir: '/output/proposals',
      })

      expect(result.success).toBe(true)
      expect(result.gateId).toBe('gate-01-core-api')
      expect(result.proposalsGenerated).toBe(2)
      expect(result.proposals).toHaveLength(2)
      expect(result.dependencies).toHaveLength(1)
      expect(result.message).toContain('Generated 2 scaffold proposal')
    })

    it('should include scaffoldNotice and nextSteps in output', async () => {
      const { generateProposals } = await import('../../src/core/proposal-generation.js')

      const result = await generateProposals({
        gateId: 'gate-01-core-api',
      })

      expect(result.scaffoldNotice).toBeDefined()
      expect(result.scaffoldNotice).toContain('Do NOT delete')
      expect(result.nextSteps).toBeDefined()
      expect(result.nextSteps!.length).toBeGreaterThan(0)
    })

    it('should use default template name', async () => {
      const { generateProposals } = await import('../../src/core/proposal-generation.js')

      const result = await generateProposals({
        gateId: 'gate-02-auth-layer',
      })

      expect(result.success).toBe(true)
    })

    it('should handle read error', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('file not found'))

      const { generateProposals } = await import('../../src/core/proposal-generation.js')

      await expect(generateProposals({ gateId: 'gate-99-nonexistent' })).rejects.toThrow(
        'Proposal generation failed'
      )
    })
  })

  describe('validation loop', () => {
    it('skips validation when fs.access throws (file does not exist)', async () => {
      mockFsAccess.mockRejectedValue(new Error('ENOENT'))

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
      expect(mockValidateArtifactFile).not.toHaveBeenCalled()
    })

    it('does not validate artifact content during scaffold generation', async () => {
      // Scaffolds are intentionally incomplete; validation belongs in proposal_action:validate
      mockFsAccess.mockResolvedValue(undefined)

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
      expect(mockValidateArtifactFile).not.toHaveBeenCalled()
    })

    it('succeeds even when validator would return allowed:false (validation deferred)', async () => {
      // Validation is not run during generation; deferred to proposal_action:validate
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockResolvedValue({
        allowed: false,
        errors: ['Missing required section'],
      })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
      expect(mockValidateArtifactFile).not.toHaveBeenCalled()
    })

    it('logs warnings when validateArtifactFile returns allowed:true with warnings', async () => {
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockResolvedValue({
        allowed: true,
        warnings: ['Non-critical issue found'],
      })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
    })

    it('succeeds even when validator would throw (validation deferred)', async () => {
      // Validation is not run during generation; deferred to proposal_action:validate
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockRejectedValue(new Error('validator crashed'))

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
      expect(mockValidateArtifactFile).not.toHaveBeenCalled()
    })

    it('succeeds even when syncProposalsFromDisk throws (non-fatal)', async () => {
      mockFsAccess.mockRejectedValue(new Error('ENOENT'))
      mockSyncProposalsFromDisk.mockImplementation(() => {
        throw new Error('sync failed')
      })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
    })

    it('succeeds with multiple proposals without validating artifact content', async () => {
      const proposals = [
        {
          ...PROPOSAL_STUB,
          hash: 'hash1',
          filename: '01-a.md',
          path: 'zeno/proposals/gate-01/01-a.md',
        },
        {
          ...PROPOSAL_STUB,
          hash: 'hash2',
          filename: '02-b.md',
          path: 'zeno/proposals/gate-01/02-b.md',
        },
      ]
      mockDecomposeToProposals.mockResolvedValue(proposals)
      mockFsAccess.mockResolvedValue(undefined)

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
      expect(result.proposalsGenerated).toBe(2)
      expect(mockValidateArtifactFile).not.toHaveBeenCalled()
    })
  })

  describe('RED/GREEN guardrail validation', () => {
    it('validates GREEN must be last proposal', async () => {
      const proposals = [
        { ...PROPOSAL_STUB, hash: 'red1', phase: 'RED' },
        { ...PROPOSAL_STUB, hash: 'green1', phase: 'GREEN' },
        { ...PROPOSAL_STUB, hash: 'impl1' }, // impl after GREEN - INVALID
      ]
      mockDecomposeToProposals.mockResolvedValue(proposals)
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockResolvedValue({ allowed: true })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true) // Log warnings but don't fail
    })

    it('validates GREEN comes before RED triggers warning', async () => {
      const proposals = [
        { ...PROPOSAL_STUB, hash: 'green1', phase: 'GREEN' },
        { ...PROPOSAL_STUB, hash: 'red1', phase: 'RED' }, // RED after GREEN - INVALID
      ]
      mockDecomposeToProposals.mockResolvedValue(proposals)
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockResolvedValue({ allowed: true })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
    })

    it('validates RED must be first proposal', async () => {
      const proposals = [
        { ...PROPOSAL_STUB, hash: 'impl1', filename: '01-impl.md' },
        { ...PROPOSAL_STUB, hash: 'red1', phase: 'RED', filename: '02-red.md' },
        { ...PROPOSAL_STUB, hash: 'green1', phase: 'GREEN', filename: '03-green.md' },
      ]
      mockDecomposeToProposals.mockResolvedValue(proposals)
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockResolvedValue({ allowed: true })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true) // Warns but doesn't fail
    })

    it('allows mixed proposals without RED/GREEN phases', async () => {
      const proposals = [
        { ...PROPOSAL_STUB, hash: 'p1', filename: '01.md' },
        { ...PROPOSAL_STUB, hash: 'p2', filename: '02.md' },
      ]
      mockDecomposeToProposals.mockResolvedValue(proposals)
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockResolvedValue({ allowed: true })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
    })

    it('succeeds with proper RED-impl-GREEN sequence', async () => {
      const proposals = [
        { ...PROPOSAL_STUB, hash: 'red1', phase: 'RED', filename: '01-red.md' },
        { ...PROPOSAL_STUB, hash: 'impl1', filename: '02-impl.md' },
        { ...PROPOSAL_STUB, hash: 'green1', phase: 'GREEN', filename: '03-green.md' },
      ]
      mockDecomposeToProposals.mockResolvedValue(proposals)
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockResolvedValue({ allowed: true })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
    })

    it('handles multiple implementation proposals between RED and GREEN', async () => {
      const proposals = [
        { ...PROPOSAL_STUB, hash: 'red1', phase: 'RED', filename: '01-red.md' },
        { ...PROPOSAL_STUB, hash: 'impl1', filename: '02-impl.md' },
        { ...PROPOSAL_STUB, hash: 'impl2', filename: '03-impl.md' },
        { ...PROPOSAL_STUB, hash: 'impl3', filename: '04-impl.md' },
        { ...PROPOSAL_STUB, hash: 'green1', phase: 'GREEN', filename: '05-green.md' },
      ]
      mockDecomposeToProposals.mockResolvedValue(proposals)
      mockFsAccess.mockResolvedValue(undefined)
      mockValidateArtifactFile.mockResolvedValue({ allowed: true })

      const { generateProposals } = await import('../../src/core/proposal-generation.js')
      const result = await generateProposals({ gateId: 'gate-01' })

      expect(result.success).toBe(true)
    })
  })
})
