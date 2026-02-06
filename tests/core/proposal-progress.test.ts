import { describe, it, expect } from 'vitest'
import { updateTaskStatus, calculateCompletionSummary, updateCompletionSummary } from '../../src/core/proposal-progress.js'

const sample = `# Proposal\n\n- [ ] Implement feature x\n- [x] Add tests\n\n## Completion Summary\n
**Tasks Completed**: 1/2\n` 

describe('Proposal Progress', () => {
  it('updates task status', () => {
    const updated = updateTaskStatus(sample, 0, true, 'done')
    expect(updated).toContain('- [x] Implement feature x (done)')
  })

  it('calculates completion summary', () => {
    const summary = calculateCompletionSummary(sample)
    expect(summary.tasksCompleted).toBe(1)
    expect(summary.tasksTotal).toBe(2)
  })

  it('updates or appends completion summary', () => {
    const newSummary = { tasksCompleted: 2, tasksTotal: 2, filesModified: 1, qualityMetrics: { coverage: 90, security: 0, lintErrors: 0, typeErrors: 0 } }
    const content = updateCompletionSummary(sample, newSummary)
    expect(content).toContain('**Tasks Completed**: 2/2')
  })
})