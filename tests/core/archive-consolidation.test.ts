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

describe('Archive Consolidation', () => {
  it('generates markdown with expected sections', () => {
    const md = consolidationToMarkdown(mockConsolidation as any)
    expect(md).toContain('## Requirements Fulfilled')
    expect(md).toContain('#R1')
    expect(md).toContain('## Lessons Learned')
    expect(md).toContain('Always add tests')
    expect(md).toContain('## Next Dependencies')
    expect(md).toContain('#D1')
  })

  it('prepares full archive content', () => {
    const base = '# Gate Title\n\n**Status**: completed'
    const content = prepareArchiveContent(base, mockConsolidation as any, 'done', '2026-02-04T00:00:00.000Z')
    expect(content).toContain('**Archived**: 2026-02-04T00:00:00.000Z')
    expect(content).toContain('**Completion Notes**: done')
    expect(content).toContain('High level summary')
  })
})
