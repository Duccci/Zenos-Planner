import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseProposal, consolidateGateProposals, generateConsolidationMarkdown } from '../../src/utils/gate-consolidation.js'

// TODO: Tests use vi.mock to mock file system and node:fs/promises modules
vi.mock('../../src/utils/file.js', () => ({
  readFile: vi.fn(),
  walkDir: vi.fn(),
}))

describe('Gate Consolidation Utilities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parseProposal extracts structured fields from markdown', async () => {
    const sample = `# Proposal: Sample Proposal\n**Hash**: #s123\n**Requirement**: #r1, #r2\n\n## Summary\nThis is a short summary.\n---\n\n### Dependencies\n| Hash | Type | Description |\n|------|------|-------------|\n| #rX | blocks | Blocks something |\n| #rY | requires | Requires something |\n---\n\n## Implementation Notes\n- Note one\n- Note two\n---\n\n## Completion Summary\n**Tasks Completed**: 1/3\n**Files Modified**: 4\n**Test Coverage**: 85%\n\n### Artifacts Created\n- artifact-a\n- artifact-b\n\n### Quality Metrics\nCoverage: 85%\nSecurity: 0 issues\nLint errors: 0\nType errors: 0\n`

    const { readFile } = await import('../../src/utils/file.js')
    vi.mocked(readFile).mockResolvedValueOnce(sample)

    const res = await parseProposal('zeno/proposals/archive/sample.md')

    expect(res.hash).toBe('s123')
    expect(res.title).toContain('Sample Proposal')
    expect(res.requirements).toEqual(['#r1', '#r2'])
    expect(res.summary).toContain('This is a short summary')
    expect(res.dependencies.blocks.length).toBe(1)
    expect(res.dependencies.requires.length).toBe(1)
    expect(res.implementationNotes).toContain('Note one')
    expect(res.completionSummary.filesModified).toBe(4)
    expect(res.completionSummary.testCoverage).toBe('85%')
    expect(res.completionSummary.artifacts).toEqual(['artifact-a', 'artifact-b'])
    expect(res.completionSummary.qualityMetrics.coverage).toBe('85%')
  })

  it('consolidateGateProposals collects gate-specific data and computes metrics', async () => {
    const { readFile, walkDir } = await import('../../src/utils/file.js')

    const content = `# Proposal: P\n**Hash**: #s1\n**Requirement**: #r1\n**Gate**: gate-1\n\n## Summary\nSummary here\n---\n\n## Completion Summary\n**Tasks Completed**: 2/4\n**Files Modified**: 2\n**Test Coverage**: 90%\n\n### Artifacts Created\n- A\n\n### Quality Metrics\nCoverage: 90%\nSecurity: 0\nLint errors: 0\nType errors: 0\n`

    vi.mocked(walkDir).mockResolvedValue(['zeno/proposals/gate-1/p1.md'])
    vi.mocked(readFile).mockResolvedValue(content)

    const result = await consolidateGateProposals('gate-01', 'zeno/proposals')

    expect(result.requirementsFulfilled.length).toBeGreaterThanOrEqual(1)
    expect(result.highLevelDelta.qualityMetrics.totalFiles).toBeGreaterThanOrEqual(0)
    expect(result.highLevelDelta.qualityMetrics.totalCoverage).toContain('%')
  })

  it('generateConsolidationMarkdown formats sections correctly', () => {
    const consolidation = {
      requirementsFulfilled: [{ hash: '#r1', proposalHash: 's1' }],
      lessonsLearned: ['Do X', 'Do Y'],
      nextDependencies: [{ hash: '#d1', description: 'Desc', proposalHash: 's1' }],
      highLevelDelta: {
        summary: 'summary text',
        artifactsCreated: ['A', 'B'],
        qualityMetrics: { totalCoverage: '85.00%', totalFiles: 3, totalTasks: 5 },
      },
    }

    const md = generateConsolidationMarkdown(consolidation as any)
    expect(md).toContain('## Consolidated Proposals Summary')
    expect(md).toContain('| Requirement | Proposal |')
    expect(md).toContain('### Lessons Learned')
    expect(md).toContain('| Hash | Description |')
    expect(md).toContain('**Quality Metrics**:')
  })

  it('generateConsolidationMarkdown handles all-empty consolidation (else branches)', () => {
    const empty = {
      requirementsFulfilled: [],
      lessonsLearned: [],
      nextDependencies: [],
      highLevelDelta: {
        summary: '',
        artifactsCreated: [],
        qualityMetrics: { totalCoverage: '0%', totalFiles: 0, totalTasks: 0 },
      },
    }

    const md = generateConsolidationMarkdown(empty as any)
    expect(md).toContain('*No requirements tracked in proposals.*')
    expect(md).toContain('*No implementation notes captured.*')
    expect(md).toContain('*No downstream dependencies identified.*')
    expect(md).toContain('*No artifacts tracked.*')
    expect(md).toContain('*No summary available.*')
  })

  it('parseProposal handles minimal/empty proposal content', async () => {
    const { readFile } = await import('../../src/utils/file.js')
    vi.mocked(readFile).mockResolvedValueOnce('# Minimal doc\nNo structured fields here.\n')

    const res = await parseProposal('zeno/proposals/archive/empty.md')
    expect(res.hash).toBe('')
    expect(res.title).toBe('')
    expect(res.requirements).toEqual([])
    expect(res.summary).toBe('')
    expect(res.dependencies.blocks).toEqual([])
    expect(res.dependencies.requires).toEqual([])
    expect(res.implementationNotes).toBe('')
    expect(res.completionSummary.tasksCompleted).toBe('')
    expect(res.completionSummary.filesModified).toBe(0)
  })

  it('consolidateGateProposals handles directory with subdirectories', async () => {
    const { readFile, walkDir } = await import('../../src/utils/file.js')

    const content = `# Proposal: Sub\n**Hash**: #sub1\n**Requirement**: #r1\n**Gate**: gate-2\n\n## Summary\nSummary sub\n---\n\n## Completion Summary\n**Tasks Completed**: 1/2\n**Files Modified**: 1\n**Test Coverage**: 80%\n\n### Artifacts Created\n- sub-art\n\n### Quality Metrics\nCoverage: 80%\nSecurity: 0\nLint errors: 0\nType errors: 0\n`

    // walkDir returns paths including those in subdirectories
    vi.mocked(walkDir).mockResolvedValueOnce(['zeno/proposals/subdir/p.md'])
    vi.mocked(readFile).mockResolvedValue(content)

    const result = await consolidateGateProposals('gate-02', 'zeno/proposals')
    expect(result.highLevelDelta.qualityMetrics.totalCoverage).toContain('%')
  })

  it('consolidateGateProposals returns empty when no proposals match gate', async () => {
    const { readFile, walkDir } = await import('../../src/utils/file.js')

    const content = `# Proposal: Other\n**Hash**: #o1\n**Gate**: gate-9\n\n## Summary\nOther gate\n---\n`

    vi.mocked(walkDir).mockResolvedValueOnce(['zeno/proposals/o.md'])
    vi.mocked(readFile).mockResolvedValue(content)

    const result = await consolidateGateProposals('gate-01', 'zeno/proposals')
    expect(result.requirementsFulfilled).toEqual([])
    expect(result.lessonsLearned).toEqual([])
    expect(result.highLevelDelta.qualityMetrics.totalCoverage).toBe('0%')
  })

  it('consolidateGateProposals handles readdir error gracefully', async () => {
    const { walkDir } = await import('../../src/utils/file.js')
    vi.mocked(walkDir).mockRejectedValueOnce(new Error('ENOENT'))

    // When walkDir errors, consolidateGateProposals should throw a FileSystemError
    await expect(consolidateGateProposals('gate-01', 'nonexistent')).rejects.toThrow('Failed to consolidate proposals')
  })
})