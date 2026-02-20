import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  decomposeToProposals,
  generateTasksFromObjective,
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

describe('proposal-writer decomposeToProposals coverage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should decompose objectives into proposals', async () => {
    const templateContent =
      'Gate: {{GATE_ID}}\nObj: {{OBJECTIVE}}\nReqs: {{REQUIREMENTS}}\nTasks: {{TASKS}}'

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

    expect(proposals).toHaveLength(2)
    expect(proposals[0]!.hash).toBe('abcdef12')
    expect(proposals[0]!.type).toBe('gate-tied')
    expect(proposals[0]!.status).toBe('pending')
    expect(proposals[0]!.summary).toBe('Build API')
    expect(proposals[1]!.summary).toBe('Add Auth')

    // Check file paths
    expect(proposals[0]!.path).toBe(path.join('/output/proposals', '01-build-api.md'))
  })

  it('should handle empty objectives', async () => {
    const proposals = await decomposeToProposals(
      'gate-02',
      [],
      [],
      'template {{GATE_ID}}',
      '/output'
    )

    expect(proposals).toHaveLength(0)
  })

  it('should handle single objective', async () => {
    const proposals = await decomposeToProposals(
      'gate-03',
      ['Setup CI/CD'],
      [{ id: 'r1', description: 'Pipeline config' }],
      '{{GATE_ID}} {{OBJECTIVE}} {{REQUIREMENTS}} {{TASKS}}',
      '/out'
    )

    expect(proposals).toHaveLength(1)
    expect(proposals[0]!.filename).toMatch(/01-setup-ci-cd/)
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
    it('should generate task checklist', () => {
      const tasks = generateTasksFromObjective('Add Feature X')
      expect(tasks).toContain('- [ ] Implement add feature x')
      expect(tasks).toContain('- [ ] Add tests for add feature x')
      expect(tasks).toContain('- [ ] Update documentation for add feature x')
    })
  })

  describe('calculateProposalDependencies', () => {
    it('should create sequential dependencies', () => {
      const deps = calculateProposalDependencies([{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }])

      expect(deps).toEqual([
        { from: 'a', to: 'b', type: 'sequential' },
        { from: 'b', to: 'c', type: 'sequential' },
      ])
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
