import { describe, it, expect } from 'vitest'
import {
  updateTaskStatus,
  calculateCompletionSummary,
  updateCompletionSummary,
} from '../../src/core/proposal-progress.js'

const sample = `# Proposal\n\n- [ ] Implement feature x\n- [x] Add tests\n\n## Completion Summary\n
**Tasks Completed**: 1/2\n`

describe('Proposal Progress', () => {
  it('updates task status', () => {
    const updated = updateTaskStatus(sample, 0, true, 'done')
    expect(updated).toContain('- [x] Implement feature x (done)')
  })

  it('updates task status without notes', () => {
    const updated = updateTaskStatus(sample, 1, false)
    expect(updated).toContain('- [ ] Add tests')
    expect(updated).not.toContain('(undefined)')
  })

  it('calculates completion summary', () => {
    const summary = calculateCompletionSummary(sample)
    expect(summary.tasksCompleted).toBe(1)
    expect(summary.tasksTotal).toBe(2)
  })

  it('updates or appends completion summary', () => {
    const newSummary = {
      tasksCompleted: 2,
      tasksTotal: 2,
      filesModified: 1,
      qualityMetrics: { coverage: 90, security: 0, lintErrors: 0, typeErrors: 0 },
    }
    const content = updateCompletionSummary(sample, newSummary)
    expect(content).toContain('**Tasks Completed**: 2/2')
  })

  it('appends completion summary when it does not exist', () => {
    const contentWithoutSummary = '# Proposal\n\n- [ ] Task 1\n- [ ] Task 2'
    const newSummary = {
      tasksCompleted: 0,
      tasksTotal: 2,
      filesModified: 0,
      qualityMetrics: { coverage: 0, security: 0, lintErrors: 0, typeErrors: 0 },
    }
    const content = updateCompletionSummary(contentWithoutSummary, newSummary)
    expect(content).toContain('## Completion Summary')
    expect(content).toContain('**Tasks Completed**: 0/2')
    expect(content).toContain(contentWithoutSummary)
  })
})
