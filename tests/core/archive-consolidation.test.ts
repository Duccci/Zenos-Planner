import { describe, it, expect } from 'vitest'
import { consolidationToMarkdown, prepareArchiveContent } from '../../src/core/archive-consolidation.js'

const mockConsolidation = {
  requirementsFulfilled: [{ hash: '#R1', proposalHash: 'P1' }],
  lessonsLearned: ['Always add tests'],
  nextDependencies: [{ hash: '#D1', description: 'Depends on X', proposalHash: 'P1' }],
  highLevelDelta: {
    summary: 'High level summary',
    artifactsCreated: ['artifact-a'],
    qualityMetrics: { totalCoverage: '90%', totalFiles: 3, totalTasks: 5 }
  }
}

const emptyConsolidation = {
  requirementsFulfilled: [],
  lessonsLearned: [],
  nextDependencies: [],
  highLevelDelta: {
    summary: 'Empty summary',
    artifactsCreated: [],
    qualityMetrics: { totalCoverage: '0%', totalFiles: 0, totalTasks: 0 }
  }
}

describe('Archive Consolidation', () => {
  it('generates markdown with expected sections', () => {
    const md = consolidationToMarkdown(mockConsolidation as any)
    expect(md).toContain('## Requirements Fulfilled')
    expect(md).toContain('#R1')
    expect(md).toContain('## Lessons Learned')
    expect(md).toContain('Always add tests')
    expect(md).toContain('## Next Dependencies')
    expect(md).toContain('#D1')
    expect(md).toContain('### Artifacts Created')
    expect(md).toContain('artifact-a')
  })

  it('generates markdown with empty arrays (else branches)', () => {
    const md = consolidationToMarkdown(emptyConsolidation as any)
    expect(md).toContain('No requirements fulfilled.')
    expect(md).toContain('No lessons learned documented.')
    expect(md).toContain('No next dependencies identified.')
    expect(md).not.toContain('### Artifacts Created')
    expect(md).toContain('### Quality Metrics')
  })

  it('prepares full archive content', () => {
    const base = '# Gate Title\n\n**Status**: completed'
    const content = prepareArchiveContent(base, mockConsolidation as any, 'done', '2026-02-04T00:00:00.000Z')
    expect(content).toContain('**Archived**: 2026-02-04T00:00:00.000Z')
    expect(content).toContain('**Completion Notes**: done')
    expect(content).toContain('High level summary')
  })

  it('prepares archive content without optional params (default branches)', () => {
    const base = '# Gate Title\n\n**Status**: completed'
    const content = prepareArchiveContent(base, emptyConsolidation as any)
    expect(content).toContain('**Archived**:')
    expect(content).toContain('**Completion Notes**: None')
    expect(content).toContain('Empty summary')
  })
})
