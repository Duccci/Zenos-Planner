import { describe, it, expect } from 'vitest'
import {
  updateTaskStatus,
  calculateCompletionSummary,
  updateCompletionSummary,
  extractTaskFiles,
  extractAllCompletedTaskFiles,
} from '../../src/core/proposal-progress.js'

const sample = `# Proposal\n\n- [ ] Implement feature x\n- [x] Add tests\n\n## Completion Summary\n
**Tasks Completed**: 1/2\n`

const sampleWithSections = `# Proposal

## Tasks

### Task 1: Implement feature
- [ ] Write the code
- [ ] Add error handling

### Task 2: Add tests
- [ ] Unit tests
- [ ] Integration tests

## Completion Summary
`

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

  it('updates task status in a task-section format', () => {
    const updated = updateTaskStatus(sampleWithSections, 0, true)
    expect(updated).toContain('- [x] Write the code')
    expect(updated).toContain('- [x] Add error handling')
    // Task 2 should be unchanged
    expect(updated).toContain('- [ ] Unit tests')
  })

  it('appends notes after the task header in task-section format', () => {
    const updated = updateTaskStatus(sampleWithSections, 1, true, 'completed via integration test')
    expect(updated).toContain('> completed via integration test')
    expect(updated).toContain('- [x] Unit tests')
    expect(updated).toContain('- [x] Integration tests')
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

// ── Fixture for extractTaskFiles / extractAllCompletedTaskFiles ──────────────

const sampleWithFiles = `# Proposal

## Tasks

### Task 1: Implement feature
**File(s)**: \`src/feature.ts\` | \`src/helpers.ts\`
- [x] Write the code
- [x] Add error handling

### Task 2: Add tests
**File(s)**: \`tests/feature.test.ts\`
- [ ] Unit tests
- [ ] Integration tests

### Task 3: Update docs
**File(s)**: \`README.md\`
- [x] Update readme

## Completion Summary
`

describe('extractTaskFiles', () => {
  it('returns file paths for a task section that has File(s) line', () => {
    const files = extractTaskFiles(sampleWithFiles, 0)
    expect(files).toEqual(['src/feature.ts', 'src/helpers.ts'])
  })

  it('returns file paths for the second task section', () => {
    const files = extractTaskFiles(sampleWithFiles, 1)
    expect(files).toEqual(['tests/feature.test.ts'])
  })

  it('returns empty array when taskIndex is out of range', () => {
    const files = extractTaskFiles(sampleWithFiles, 99)
    expect(files).toEqual([])
  })

  it('returns empty array when there are no task sections', () => {
    const content = '# Proposal\n\n- [x] Do something\n'
    const files = extractTaskFiles(content, 0)
    expect(files).toEqual([])
  })

  it('returns empty array when task section has no File(s) line', () => {
    const content = `# Proposal\n\n### Task 1: No files\n- [x] Just a checkbox\n`
    const files = extractTaskFiles(content, 0)
    expect(files).toEqual([])
  })
})

describe('extractAllCompletedTaskFiles', () => {
  it('returns files only from fully-completed task sections', () => {
    // Task 1 is fully checked (2/2), Task 2 has unchecked boxes (0/2), Task 3 is fully checked (1/1)
    const files = extractAllCompletedTaskFiles(sampleWithFiles)
    expect(files).toContain('src/feature.ts')
    expect(files).toContain('src/helpers.ts')
    expect(files).toContain('README.md')
    expect(files).not.toContain('tests/feature.test.ts')
  })

  it('deduplicates files referenced in multiple completed tasks', () => {
    const content = `# Proposal

### Task 1: First
**File(s)**: \`src/shared.ts\`
- [x] Done

### Task 2: Second
**File(s)**: \`src/shared.ts\`
- [x] Done
`
    const files = extractAllCompletedTaskFiles(content)
    expect(files.filter((f) => f === 'src/shared.ts')).toHaveLength(1)
  })

  it('returns empty array when no tasks are completed', () => {
    const content = `# Proposal

### Task 1: Pending
**File(s)**: \`src/todo.ts\`
- [ ] Not done yet
`
    const files = extractAllCompletedTaskFiles(content)
    expect(files).toEqual([])
  })

  it('returns empty array when there are no task sections', () => {
    const content = '# Proposal\n\n- [x] Some checkbox\n'
    const files = extractAllCompletedTaskFiles(content)
    expect(files).toEqual([])
  })

  it('returns empty array when task sections have no checkboxes', () => {
    const content = `# Proposal\n\n### Task 1: Header only\nNo checkboxes here.\n`
    const files = extractAllCompletedTaskFiles(content)
    expect(files).toEqual([])
  })

  it('caps task section end at a ## non-task heading so files outside are excluded', () => {
    // The ## boundary branch (lines ~168-171) is only hit when a ## heading follows a task section
    const content = [
      '# Proposal',
      '',
      '### Task 1: Do work',
      '**File(s)**: `src/a.ts`',
      '- [x] Done',
      '',
      '## Implementation Notes',
      'Extra content not part of task',
    ].join('\n')

    const files = extractAllCompletedTaskFiles(content)
    // Task 1 is fully completed and its file should be included
    expect(files).toContain('src/a.ts')
  })
})
