/**
 * Gate Generation Coverage Tests
 *
 * Tests the generateGates function across all three modes:
 * - 'new': generate new gates from PRD
 * - 'rebaseline': regenerate all gates from anchor
 * - 'single': generate a single gate
 * Plus the error path and the error message branch (Error vs string).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock all dependencies used by generateGates
// ---------------------------------------------------------------------------

const mockReadFile = vi.fn()
const mockGetProjectRequirements = vi.fn()
const mockGenerateNewGates = vi.fn()
const mockRebaselineGates = vi.fn()
const mockGenerateSingleGate = vi.fn()

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  normalizePath: (p: string) => p,
}))

vi.mock('../../src/utils/config.js', () => ({
  getZenoGitDir: vi.fn().mockReturnValue('/project/zeno'),
  readProjectOverview: vi.fn().mockResolvedValue({}),
  getGatesFromOverview: vi.fn().mockReturnValue([]),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../src/utils/errors.js', () => ({
  ZenoError: class ZenoError extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.code = code
    }
  },
}))

vi.mock('../../src/core/gate-planner.js', () => ({
  getProjectRequirements: (...args: unknown[]) => mockGetProjectRequirements(...args),
  generateNewGates: (...args: unknown[]) => mockGenerateNewGates(...args),
  rebaselineGates: (...args: unknown[]) => mockRebaselineGates(...args),
  generateSingleGate: (...args: unknown[]) => mockGenerateSingleGate(...args),
}))

vi.mock('../../src/core/gate-writer.js', () => ({
  createGatePrdFiles: (...args: unknown[]) => mockCreateGatePrdFiles(...args),
  updateGateDiagrams: (...args: unknown[]) => mockUpdateGateDiagrams(...args),
}))

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const SAMPLE_GATES = [
  {
    id: 'gate-01',
    name: 'Setup',
    type: 'feature',
    status: 'pending',
    requirementsCount: 3,
    dependencies: [],
  },
  {
    id: 'gate-02',
    name: 'Core',
    type: 'feature',
    status: 'pending',
    requirementsCount: 5,
    dependencies: ['gate-01'],
  },
]

const SAMPLE_REQUIREMENTS = [
  { id: 'req1', description: 'Build feature X', priority: 'must' },
  { id: 'req2', description: 'Add tests', priority: 'should' },
]

describe('gate-generation: generateGates', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockReadFile.mockResolvedValue('# Project PRD\n\n## Objectives\n- Build the product\n')
    mockGetProjectRequirements.mockResolvedValue(SAMPLE_REQUIREMENTS)
    mockGenerateNewGates.mockResolvedValue(SAMPLE_GATES)
    mockRebaselineGates.mockResolvedValue(SAMPLE_GATES)
    mockGenerateSingleGate.mockResolvedValue([SAMPLE_GATES[0]])
  })

  it('generates gates in "new" mode', async () => {
    const { generateGates } = await import('../../src/core/gate-generation.js')

    const result = await generateGates({ mode: 'new' })

    expect(result.success).toBe(true)
    expect(result.mode).toBe('new')
    expect(result.gatesGenerated).toBe(2)
    expect(result.gates).toHaveLength(2)
    expect(result.requirementsAttributed).toBe(2)
    expect(result.diagramsUpdated).toEqual([])
    expect(mockGenerateNewGates).toHaveBeenCalledWith(
      expect.any(String),
      SAMPLE_REQUIREMENTS,
      5 // default requirementsPerGate
    )
  })

  it('generates gates in "rebaseline" mode', async () => {
    const { generateGates } = await import('../../src/core/gate-generation.js')

    const result = await generateGates({ mode: 'rebaseline', anchorGateId: 'gate-03' })

    expect(result.success).toBe(true)
    expect(result.mode).toBe('rebaseline')
    expect(mockRebaselineGates).toHaveBeenCalledWith(
      expect.any(String),
      SAMPLE_REQUIREMENTS,
      'gate-03'
    )
    expect(mockGenerateNewGates).not.toHaveBeenCalled()
    expect(mockGenerateSingleGate).not.toHaveBeenCalled()
  })

  it('generates a single gate in "single" mode', async () => {
    const { generateGates } = await import('../../src/core/gate-generation.js')

    const result = await generateGates({ mode: 'single', anchorGateId: 'gate-05' })

    expect(result.success).toBe(true)
    expect(result.mode).toBe('single')
    expect(mockGenerateSingleGate).toHaveBeenCalledWith(
      expect.any(String),
      SAMPLE_REQUIREMENTS,
      'gate-05'
    )
    expect(mockGenerateNewGates).not.toHaveBeenCalled()
    expect(mockRebaselineGates).not.toHaveBeenCalled()
  })

  it('uses custom requirementsPerGate when provided', async () => {
    const { generateGates } = await import('../../src/core/gate-generation.js')

    const result = await generateGates({
      mode: 'new',
      requirementsPerGate: 3,
    })

    expect(result.success).toBe(true)
    expect(mockGenerateNewGates).toHaveBeenCalledWith(expect.any(String), SAMPLE_REQUIREMENTS, 3)
  })

  it('throws ZenoError when PRD file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('File not found'))

    const { generateGates } = await import('../../src/core/gate-generation.js')

    await expect(generateGates({ mode: 'new' })).rejects.toThrow('Gate generation failed')
  })

  it('throws ZenoError with non-Error thrown (String path)', async () => {
    // Throwing a non-Error string to exercise the string branch in error handling
    mockGetProjectRequirements.mockRejectedValue('database unavailable')

    const { generateGates } = await import('../../src/core/gate-generation.js')

    await expect(generateGates({ mode: 'new' })).rejects.toThrow('Gate generation failed')
  })

  it('builds correct message with gate count', async () => {
    const { generateGates } = await import('../../src/core/gate-generation.js')

    const result = await generateGates({ mode: 'new' })

    expect(result.message).toContain('2')
    expect(result.message).toContain('new')
  })
})
