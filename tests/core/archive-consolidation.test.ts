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
    const base = '# Gate Title\n\n**Status**: in_progress'
    const content = prepareArchiveContent(base, mockConsolidation as any, 'done', '2026-02-04T00:00:00.000Z')
    expect(content).toContain('**Status**: completed')
    expect(content).toContain('**Completed**: 2026-02-04')
    expect(content).toContain('**Archived**: 2026-02-04T00:00:00.000Z')
    expect(content).toContain('**Completion Notes**: done')
    expect(content).toContain('High level summary')
  })

  it('prepares archive content without optional params (default branches)', () => {
    const base = '# Gate Title\n\n**Status**: pending'
    const content = prepareArchiveContent(base, emptyConsolidation as any)
    expect(content).toContain('**Status**: completed')
    expect(content).toContain('**Completed**:')
    expect(content).toContain('**Archived**:')
    expect(content).toContain('**Completion Notes**: None')
    expect(content).toContain('Empty summary')
  })

  it('updates Status from in_progress to completed', () => {
    const base = '# Gate Title\n**Status**: in_progress\n**Type**: feature'
    const content = prepareArchiveContent(base, emptyConsolidation as any)
    expect(content).toContain('**Status**: completed')
    expect(content).not.toContain('**Status**: in_progress')
  })

  it('updates Status from pending to completed', () => {
    const base = '# Gate Title\n**Status**: pending\n**Type**: feature'
    const content = prepareArchiveContent(base, emptyConsolidation as any)
    expect(content).toContain('**Status**: completed')
    expect(content).not.toContain('**Status**: pending')
  })

  it('adds Completed date after Status line', () => {
    const base = '# Gate Title\n**Status**: in_progress\n**Type**: feature'
    const content = prepareArchiveContent(base, emptyConsolidation as any, undefined, '2026-01-15T12:30:45Z')
    expect(content).toMatch(/\*\*Status\*\*: completed\n\*\*Completed\*\*: 2026-01-15/)
  })

  it('updates existing Completed date if present', () => {
    const base = '# Gate Title\n**Status**: in_progress\n**Completed**: 2026-01-01'
    const content = prepareArchiveContent(base, emptyConsolidation as any, undefined, '2026-02-10T00:00:00Z')
    expect(content).toContain('**Completed**: 2026-02-10')
    expect(content).not.toContain('**Completed**: 2026-01-01')
  })
})
