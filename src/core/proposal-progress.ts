/**
 * Proposal Progress Helpers
 */

export function updateTaskStatus(content: string, taskIndex: number, completed: boolean, notes?: string): string {
  const lines = content.split('\n')
  let taskCount = 0

  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.match(/^- \[[ x]\]/)) {
      if (taskCount === taskIndex) {
        lines[i] = lines[i]!.replace(/^- \[[ x]\]/, completed ? '- [x]' : '- [ ]')
        if (notes) {
          lines[i]! += ` (${notes})`
        }
        break
      }
      taskCount++
    }
  }

  return lines.join('\n')
}

export function calculateCompletionSummary(content: string) {
  const lines = content.split('\n')
  let tasksCompleted = 0
  let tasksTotal = 0

  for (const line of lines) {
    if (line.match(/^- \[[ x]\]/)) {
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
      typeErrors: 0
    }
  }
}

export function updateCompletionSummary(content: string, summary: any): string {
  const summaryText = `## Completion Summary

**Tasks Completed**: ${summary.tasksCompleted}/${summary.tasksTotal}
**Files Modified/Created**: ${summary.filesModified || 'N/A'}
### Quality Metrics
- Coverage: ${summary.qualityMetrics?.coverage || 'N/A'}%
- Security Issues: ${summary.qualityMetrics?.security || 0}
- Lint Errors: ${summary.qualityMetrics?.lintErrors || 0}
- Type Errors: ${summary.qualityMetrics?.typeErrors || 0}`

  if (content.includes('## Completion Summary')) {
    return content.replace(/(## Completion Summary[\s\S]*?)(?=\n##|\n---|\n$)/, summaryText)
  } else {
    return content + '\n\n' + summaryText
  }
}
