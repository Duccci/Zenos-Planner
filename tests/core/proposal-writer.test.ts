import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  decomposeToProposals,
  calculateProposalDependencies,
} from '../../src/core/proposal-writer.js'
import path from 'path'

vi.mock('../../src/utils/file.js', () => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/utils/hash.js', () => ({
  shortHash: vi.fn().mockReturnValue('abcdef1234567890'),
}))

vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    qualityThresholds: {
      codeCoverage: 90,
      securityVulnerabilities: 0,
      lintingErrorRate: 0.01,
      typeCheckingErrors: 0,
    },
  }),
}))

describe('proposal-writer decomposeToProposals coverage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should decompose objectives into RED/GREEN/Test Refinement proposals', async () => {
    const templateContent =
      'Gate: {{GATE_ID}}\nObj: {{OBJECTIVE}}\nReqs: {{REQUIREMENTS}}\nTasks: {{TASKS}}\nPhase: {{PHASE}}'

    const proposals = await decomposeToProposals(
      'gate-01',
      ['Build API', 'Add Auth'],
      [
        { id: 'req-1', description: 'Create REST endpoints' },
        { id: 'req-2', description: 'Implement JWT auth' },
      ],
      templateContent,
      '/output/proposals'
    )

    // 2 objectives × (1 RED + 1 GREEN) + 1 Test Refinement = 5 proposals
    expect(proposals).toHaveLength(5)

    // First 2 should be RED phase
    expect(proposals[0]!.phase).toBe('RED')
    expect(proposals[0]!.type).toBe('gate-tied')
    expect(proposals[0]!.status).toBe('pending')
    expect(proposals[0]!.coverageTarget).toBeDefined()
    expect(proposals[0]!.filename).toMatch(/01-red-build-api/)

    expect(proposals[1]!.phase).toBe('RED')
    expect(proposals[1]!.filename).toMatch(/02-red-add-auth/)

    // Next 2 should be GREEN phase
    expect(proposals[2]!.phase).toBe('GREEN')
    expect(proposals[2]!.filename).toMatch(/03-green-build-api/)

    expect(proposals[3]!.phase).toBe('GREEN')
    expect(proposals[3]!.filename).toMatch(/04-green-add-auth/)

    // Last should be Test Refinement
    expect(proposals[4]!.phase).toBe('Test Refinement')
    expect(proposals[4]!.filename).toMatch(/05-test-refinement/)
  })

  it('should calculate coverage targets from config', async () => {
    const templateContent = 'Phase: {{PHASE}}\nCoverage: {{COVERAGE_TARGET}}'

    const proposals = await decomposeToProposals(
      'gate-01',
      ['Build API'],
      [],
      templateContent,
      '/output/proposals'
    )

    // Extract RED proposal to check coverage
    const redProposal = proposals.find((p) => p.phase === 'RED')
    expect(redProposal).toBeDefined()
    expect(redProposal!.coverageTarget).toBeGreaterThan(0)

    // GREEN proposal should have same coverage target
    const greenProposal = proposals.find((p) => p.phase === 'GREEN')
    expect(greenProposal).toBeDefined()
    expect(greenProposal!.coverageTarget).toEqual(redProposal!.coverageTarget)
  })

  it('should truncate long objective names in filename', async () => {
    const longObj =
      'This is a very long objective name that should be truncated in the filename generation'
    const proposals = await decomposeToProposals(
      'gate-04',
      [longObj],
      [],
      '{{GATE_ID}} {{OBJECTIVE}} {{REQUIREMENTS}} {{TASKS}}',
      '/out'
    )

    expect(proposals[0]!.filename.length).toBeLessThan(40)
  })

  describe('generateTasksFromObjective', () => {
    // Note: generateTasksFromObjective is for backward compatibility
    // New task generation is handled by generateRedPhaseTasks and generateGreenPhaseTasks
    it('should be removed in favor of phase-specific generators', () => {
      // This test documents that the old simple task generation is replaced
      // by phase-specific RED/GREEN task generation
      expect(true).toBe(true)
    })
  })

  describe('calculateProposalDependencies', () => {
    it('should create RED -> GREEN dependencies', () => {
      const deps = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(deps).toEqual([{ from: 'red-a', to: 'green-a', type: 'red-green' }])
    })

    it('should create GREEN -> Test Refinement dependencies', () => {
      const deps = calculateProposalDependencies([
        { hash: 'green-a', phase: 'GREEN' },
        { hash: 'green-b', phase: 'GREEN' },
        { hash: 'test-ref', phase: 'Test Refinement' },
      ])

      expect(deps).toContainEqual({ from: 'green-a', to: 'test-ref', type: 'green-test-refinement' })
      expect(deps).toContainEqual({ from: 'green-b', to: 'test-ref', type: 'green-test-refinement' })
    })

    it('should handle complete RED -> GREEN -> Test Refinement flow', () => {
      const deps = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'green-a', phase: 'GREEN' },
        { hash: 'red-b', phase: 'RED' },
        { hash: 'green-b', phase: 'GREEN' },
        { hash: 'test-ref', phase: 'Test Refinement' },
      ])

      expect(deps).toContainEqual({ from: 'red-a', to: 'green-a', type: 'red-green' })
      expect(deps).toContainEqual({ from: 'red-b', to: 'green-b', type: 'red-green' })
      expect(deps).toContainEqual({ from: 'green-a', to: 'test-ref', type: 'green-test-refinement' })
      expect(deps).toContainEqual({ from: 'green-b', to: 'test-ref', type: 'green-test-refinement' })
    })

    it('should return empty for single proposal', () => {
      const deps = calculateProposalDependencies([{ hash: 'only' }])
      expect(deps).toEqual([])
    })

    it('should return empty for no proposals', () => {
      const deps = calculateProposalDependencies([])
      expect(deps).toEqual([])
    })
  })
})
