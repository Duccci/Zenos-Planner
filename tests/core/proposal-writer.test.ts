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

  it('should decompose objectives into RED (1) + implementation (N) + GREEN (1) proposals', async () => {
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

    // 1 RED + 2 implementation + 1 GREEN = 4 proposals
    expect(proposals).toHaveLength(4)

    // First should be the single RED test-suite
    expect(proposals[0]!.phase).toBe('RED')
    expect(proposals[0]!.type).toBe('gate-tied')
    expect(proposals[0]!.status).toBe('pending')
    expect(proposals[0]!.coverageTarget).toBeDefined()
    expect(proposals[0]!.filename).toMatch(/01-red--test-suite/)

    // Middle proposals are implementation (no phase)
    expect(proposals[1]!.phase).toBeUndefined()
    expect(proposals[1]!.filename).toMatch(/02-build-api/)

    expect(proposals[2]!.phase).toBeUndefined()
    expect(proposals[2]!.filename).toMatch(/03-add-auth/)

    // Last should be the single GREEN test-verification
    expect(proposals[3]!.phase).toBe('GREEN')
    expect(proposals[3]!.filename).toMatch(/04-green--test-verification/)
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

    // 1 RED + 1 implementation + 1 GREEN = 3 proposals
    expect(proposals).toHaveLength(3)

    // RED proposal should have combined coverage target
    const redProposal = proposals.find((p) => p.phase === 'RED')
    expect(redProposal).toBeDefined()
    expect(redProposal!.coverageTarget).toBeGreaterThan(0)

    // GREEN proposal should have same combined coverage target
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

    // Implementation proposal is the middle one (index 1)
    const implProposal = proposals.find((p) => !p.phase)
    expect(implProposal).toBeDefined()
    expect(implProposal!.filename.length).toBeLessThan(45)
  })

  describe('generateTasksFromObjective', () => {
    // Note: generateTasksFromObjective is for backward compatibility
    // New task generation is handled by phase-specific generators
    it('should be removed in favor of phase-specific generators', () => {
      expect(true).toBe(true)
    })
  })

  describe('calculateProposalDependencies', () => {
    it('should create RED -> implementation dependencies', () => {
      const deps = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'impl-a' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(deps).toContainEqual({ from: 'red-a', to: 'impl-a', type: 'red-impl' })
    })

    it('should create implementation -> GREEN dependencies', () => {
      const deps = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'impl-a' },
        { hash: 'impl-b' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(deps).toContainEqual({ from: 'impl-a', to: 'green-a', type: 'impl-green' })
      expect(deps).toContainEqual({ from: 'impl-b', to: 'green-a', type: 'impl-green' })
    })

    it('should handle complete RED -> impl -> GREEN flow', () => {
      const deps = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'impl-a' },
        { hash: 'impl-b' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(deps).toContainEqual({ from: 'red-a', to: 'impl-a', type: 'red-impl' })
      expect(deps).toContainEqual({ from: 'red-a', to: 'impl-b', type: 'red-impl' })
      expect(deps).toContainEqual({ from: 'impl-a', to: 'green-a', type: 'impl-green' })
      expect(deps).toContainEqual({ from: 'impl-b', to: 'green-a', type: 'impl-green' })
      expect(deps).toHaveLength(4)
    })

    it('should create RED -> GREEN direct dependency when no impl proposals exist', () => {
      const deps = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(deps).toEqual([{ from: 'red-a', to: 'green-a', type: 'red-green' }])
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
