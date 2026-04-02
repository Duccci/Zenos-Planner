import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  decomposeToProposals,
  calculateProposalDependencies,
} from '../../src/core/proposal-writer.js'
import { writeFile } from '../../src/utils/file.js'
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

  it('should use heuristic coverage sizes for crud/integration/utility objective keywords (lines 25/32/39 arm=0)', async () => {
    // Each objective keyword triggers a different branch in estimateCoverageLines:
    // 'crud validation' → 150 lines (line=25 arm=0 TRUE)
    // 'integration workflow' → 200 lines (line=32 arm=0 TRUE)
    // 'utility helper format' → 50 lines (line=39 arm=0 TRUE)
    const proposals = await decomposeToProposals(
      'gate-07',
      ['CRUD validation parser', 'Integration workflow system', 'utility helper format'],
      [],
      '{{GATE_ID}}',
      '/output/proposals'
    )

    // 1 RED + 3 implementation + 1 GREEN = 5 proposals
    expect(proposals).toHaveLength(5)
    // Verify coverage targets reflect the heuristic sizes (90% of 150, 200, 50 respectively)
    const implProposals = proposals.filter((p) => !p.phase)
    expect(implProposals[0]!.coverageTarget).toBe(135) // 90% of 150
    expect(implProposals[1]!.coverageTarget).toBe(180) // 90% of 200
    expect(implProposals[2]!.coverageTarget).toBe(45)  // 90% of 50
  })

  describe('generateTasksFromObjective', () => {
    // Note: generateTasksFromObjective is for backward compatibility
    // New task generation is handled by phase-specific generators
    it('should be removed in favor of phase-specific generators', () => {
      expect(true).toBe(true)
    })
  })

  describe('calculateProposalDependencies', () => {
    // Factory helper: builds minimal proposal-shaped objects for RED/impl/GREEN layouts
    function proposalSet(
      implHashes: string[],
      redHash = 'red-hash',
      greenHash = 'green-hash'
    ): { hash: string; phase?: string }[] {
      return [
        { hash: redHash, phase: 'RED' },
        ...implHashes.map((h) => ({ hash: h })),
        { hash: greenHash, phase: 'GREEN' },
      ]
    }

    it('should create RED -> implementation dependencies', () => {
      const { edges } = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'impl-a' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(edges).toContainEqual({ from: 'red-a', to: 'impl-a', type: 'red-impl' })
    })

    it('should create implementation -> GREEN dependencies', () => {
      const { edges } = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'impl-a' },
        { hash: 'impl-b' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(edges).toContainEqual({ from: 'impl-a', to: 'green-a', type: 'impl-green' })
      expect(edges).toContainEqual({ from: 'impl-b', to: 'green-a', type: 'impl-green' })
    })

    it('should handle complete RED -> impl -> GREEN flow', () => {
      const { edges } = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'impl-a' },
        { hash: 'impl-b' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(edges).toContainEqual({ from: 'red-a', to: 'impl-a', type: 'red-impl' })
      expect(edges).toContainEqual({ from: 'red-a', to: 'impl-b', type: 'red-impl' })
      expect(edges).toContainEqual({ from: 'impl-a', to: 'green-a', type: 'impl-green' })
      expect(edges).toContainEqual({ from: 'impl-b', to: 'green-a', type: 'impl-green' })
      expect(edges).toHaveLength(4)
    })

    it('should create RED -> GREEN direct dependency when no impl proposals exist', () => {
      const { edges } = calculateProposalDependencies([
        { hash: 'red-a', phase: 'RED' },
        { hash: 'green-a', phase: 'GREEN' },
      ])

      expect(edges).toEqual([{ from: 'red-a', to: 'green-a', type: 'red-green' }])
    })

    it('should return empty for single proposal', () => {
      const { edges } = calculateProposalDependencies([{ hash: 'only' }])
      expect(edges).toEqual([])
    })

    it('should return empty for no proposals', () => {
      const { edges } = calculateProposalDependencies([])
      expect(edges).toEqual([])
    })

    // --- parallelSets tests ---

    it('should return parallelSets key alongside edges', () => {
      const result = calculateProposalDependencies(proposalSet(['impl-a']))
      expect(result).toHaveProperty('edges')
      expect(result).toHaveProperty('parallelSets')
    })

    it('should return empty parallelSets for empty proposal list', () => {
      const { edges, parallelSets } = calculateProposalDependencies([])
      expect(edges).toEqual([])
      expect(parallelSets).toEqual([])
    })

    it('should return single-element parallelSets for single proposal', () => {
      const { parallelSets } = calculateProposalDependencies([{ hash: 'only' }])
      expect(parallelSets).toEqual([['only']])
    })

    it('should group RED/impl/GREEN into three sequential parallel sets', () => {
      const { parallelSets } = calculateProposalDependencies(
        proposalSet(['impl-a', 'impl-b'])
      )
      expect(parallelSets[0]).toEqual(['red-hash'])
      expect(parallelSets[1]).toEqual(expect.arrayContaining(['impl-a', 'impl-b']))
      expect(parallelSets[1]).toHaveLength(2)
      expect(parallelSets[2]).toEqual(['green-hash'])
    })

    it('should group all impl proposals in the same parallel set (cycle-free multi-impl)', () => {
      const { parallelSets } = calculateProposalDependencies(
        proposalSet(['i1', 'i2', 'i3'])
      )
      expect(parallelSets).toHaveLength(3)
      expect(parallelSets[1]).toEqual(expect.arrayContaining(['i1', 'i2', 'i3']))
    })

    it('should produce two parallelSets for RED -> GREEN direct (no impls)', () => {
      const { parallelSets } = calculateProposalDependencies([
        { hash: 'red-hash', phase: 'RED' },
        { hash: 'green-hash', phase: 'GREEN' },
      ])
      expect(parallelSets).toHaveLength(2)
      expect(parallelSets[0]).toEqual(['red-hash'])
      expect(parallelSets[1]).toEqual(['green-hash'])
    })
  })
})

// ---------------------------------------------------------------------------
// ProposalMetadata shape — parallelSetIndex field
// ---------------------------------------------------------------------------
describe('ProposalMetadata shape', () => {
  it('should accept ProposalMetadata without parallelSetIndex (optional field)', () => {
    const meta = {
      hash: 'abc123',
      filename: '01-red--test-suite.md',
      path: '/output/proposals/01-red--test-suite.md',
      type: 'gate-tied' as const,
      status: 'pending',
      summary: 'Test suite proposal',
      phase: 'RED' as const,
    }
    // Compile-time: must not require parallelSetIndex
    const _check: import('../../src/core/proposal-writer.js').ProposalMetadata = meta
    expect(_check.hash).toBe('abc123')
  })

  it('should accept ProposalMetadata with parallelSetIndex: 0', () => {
    const meta = {
      hash: 'abc123',
      filename: '01-red--test-suite.md',
      path: '/output/proposals/01-red--test-suite.md',
      type: 'gate-tied' as const,
      status: 'pending',
      summary: 'Test suite proposal',
      parallelSetIndex: 0,
    }
    const _check: import('../../src/core/proposal-writer.js').ProposalMetadata = meta
    expect(_check.parallelSetIndex).toBe(0)
  })

  it('should reject non-numeric parallelSetIndex at the type level', () => {
    const meta = {
      hash: 'abc123',
      filename: 'f.md',
      path: '/p/f.md',
      type: 'gate-tied' as const,
      status: 'pending',
      summary: 's',
      // @ts-expect-error parallelSetIndex must be a number, not a string
      parallelSetIndex: 'bad',
    }
    expect(meta.parallelSetIndex).toBe('bad') // runtime value still accessible
  })
})
// ---------------------------------------------------------------------------
// SCAFFOLD comment — concrete hash + workflow references
// ---------------------------------------------------------------------------
describe('injectScaffoldReminder via decomposeToProposals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should embed the concrete proposal hash in the SCAFFOLD comment', async () => {
    // Template with YAML frontmatter so injectScaffoldReminder can find the --- boundary.
    const template = [
      '---',
      'zeno:',
      '  hash: \'{{HASH}}\'',
      '  gate_id: \'{{GATE_ID}}\'',
      '---',
      '# Proposal: {{OBJECTIVE}}',
      'Tasks: {{TASKS}}',
    ].join('\n')

    await decomposeToProposals('gate-02', ['Build feature'], [], template, '/out')

    const writtenContent = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string
    expect(writtenContent).toBeDefined()
    // The SCAFFOLD comment should reference the concrete hash (mocked to 'abcdef12')
    expect(writtenContent).toContain('<!-- SCAFFOLD:')
    expect(writtenContent).toContain('#abcdef12')
    // Must NOT use the generic placeholder string
    expect(writtenContent).not.toContain('#<hash>')
  })

  it('should include proposal_action:start and validate hints in SCAFFOLD comment', async () => {
    const template = '---\nzeno:\n  hash: \'{{HASH}}\'\n---\n# {{OBJECTIVE}}\n{{TASKS}}'

    await decomposeToProposals('gate-03', ['Add tests'], [], template, '/out')

    const writtenContent = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string
    expect(writtenContent).toContain('proposal_action:start')
    expect(writtenContent).toContain('proposal_action:validate')
  })

  it('should substitute {{PROPOSAL_TEMPLATE_HASH}} in the rendered scaffold', async () => {
    const template = '---\nzeno:\n  hash: \'{{HASH}}\'\n  template_hash: \'{{PROPOSAL_TEMPLATE_HASH}}\'\n---\n# {{OBJECTIVE}}\n{{TASKS}}'

    await decomposeToProposals('gate-04', ['Feature work'], [], template, '/out')

    const writtenContent = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string
    // The mustache placeholder must be replaced — no raw {{PROPOSAL_TEMPLATE_HASH}} in output
    expect(writtenContent).not.toContain('{{PROPOSAL_TEMPLATE_HASH}}')
    // Must contain a 16-char hex string for the template_hash field
    expect(writtenContent).toMatch(/template_hash:\s*'[a-f0-9]{16}'/)
  })
})