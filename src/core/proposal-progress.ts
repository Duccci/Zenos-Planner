/**
 * Proposal Progress Helpers
 */

export function updateTaskStatus(
  content: string,
  taskIndex: number,
  completed: boolean,
  notes?: string
): string {
  const lines = content.split('\n')

  // Find the Nth '### Task N:' section (taskIndex is 0-based)
  let sectionCount = -1
  let inTargetSection = false
  let foundSection = false

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i] ?? ''

    // Detect task section headers
    if (/^###\s+Task\s+\d+:/.exec(current)) {
      sectionCount++
      inTargetSection = sectionCount === taskIndex
      if (inTargetSection) foundSection = true
      continue
    }

    // A new ## (but not ###) heading ends the current section
    if (/^##\s/.exec(current) && !/^###/.exec(current)) {
      inTargetSection = false
    }

    // Within the target section: mark all checkboxes completed/incomplete
    if (inTargetSection && /^- \[[ x]\]/.exec(current)) {
      lines[i] = current.replace(/^- \[[ x]\]/, completed ? '- [x]' : '- [ ]')
    }
  }

  // Append notes as a line after the target task header, if supplied
  if (foundSection && notes) {
    let headerIdx = -1
    let count = -1
    for (let i = 0; i < lines.length; i++) {
      if (/^###\s+Task\s+\d+:/.exec(lines[i] ?? '')) {
        count++
        if (count === taskIndex) {
          headerIdx = i
          break
        }
      }
    }
    if (headerIdx >= 0) {
      lines.splice(headerIdx + 1, 0, `> ${notes}`)
    }
  }

  // Fallback: if no '### Task N:' sections exist, fall back to global checkbox count
  if (!foundSection) {
    let taskCount = 0
    for (let i = 0; i < lines.length; i++) {
      const current = lines[i] ?? ''
      if (/^- \[[ x]\]/.exec(current)) {
        if (taskCount === taskIndex) {
          lines[i] = current.replace(/^- \[[ x]\]/, completed ? '- [x]' : '- [ ]')
          if (notes) {
            lines[i] = (lines[i] ?? '') + ` (${notes})`
          }
          break
        }
        taskCount++
      }
    }
  }

  return lines.join('\n')
}

export function calculateCompletionSummary(content: string): {
  tasksCompleted: number
  tasksTotal: number
  filesModified: number
  qualityMetrics: { coverage: number; security: number; lintErrors: number; typeErrors: number }
} {
  const lines = content.split('\n')
  let tasksCompleted = 0
  let tasksTotal = 0

  for (const line of lines) {
    if (/^- \[[ x]\]/.exec(line)) {
      tasksTotal++
      if (line.includes('[x]')) {
        tasksCompleted++
      }
    }
  }

  return {
    tasksCompleted,
    tasksTotal,
    filesModified: 0,
    qualityMetrics: {
      coverage: 0,
      security: 0,
      lintErrors: 0,
      typeErrors: 0,
    },
  }
}

export function updateCompletionSummary(
  content: string,
  summary: {
    tasksCompleted: number
    tasksTotal: number
    filesModified: number
    qualityMetrics: { coverage: number; security: number; lintErrors: number; typeErrors: number }
  }
): string {
  const summaryText = `## Completion Summary

**Tasks Completed**: ${String(summary.tasksCompleted)}/${String(summary.tasksTotal)}
**Files Modified/Created**: ${String(summary.filesModified)}
### Quality Metrics
- Coverage: ${String(summary.qualityMetrics.coverage)}%
- Security Issues: ${String(summary.qualityMetrics.security)}
- Lint Errors: ${String(summary.qualityMetrics.lintErrors)}
- Type Errors: ${String(summary.qualityMetrics.typeErrors)}`

  if (content.includes('## Completion Summary')) {
    return content.replace(/(## Completion Summary[\s\S]*?)(?=\n##|\n---|\n$)/, summaryText)
  } else {
    return content + '\n\n' + summaryText
  }
}
