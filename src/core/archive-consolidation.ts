import { type GateConsolidation } from '../utils/gate-consolidation.js'

/**
 * Archive Consolidation Helpers
 */

export function consolidationToMarkdown(consolidation: GateConsolidation): string {
  let md = '\n## Requirements Fulfilled\n\n'
  if (consolidation.requirementsFulfilled.length > 0) {
    md += '| Requirement | Proposal |\n|-------------|----------|\n'
    for (const req of consolidation.requirementsFulfilled) {
      md += `| ${req.hash} | ${req.proposalHash} |\n`
    }
  } else {
    md += 'No requirements fulfilled.\n'
  }

  md += '\n## Lessons Learned\n\n'
  if (consolidation.lessonsLearned.length > 0) {
    for (const lesson of consolidation.lessonsLearned) {
      md += `- ${lesson}\n`
    }
  } else {
    md += 'No lessons learned documented.\n'
  }

  md += '\n## Next Dependencies\n\n'
  if (consolidation.nextDependencies.length > 0) {
    md += '| Dependency | Description | Proposal |\n|------------|-------------|----------|\n'
    for (const dep of consolidation.nextDependencies) {
      md += `| ${dep.hash} | ${dep.description} | ${dep.proposalHash} |\n`
    }
  } else {
    md += 'No next dependencies identified.\n'
  }

  md += '\n## High-Level Delta\n\n'
  md += `${consolidation.highLevelDelta.summary}\n\n`

  if (consolidation.highLevelDelta.artifactsCreated.length > 0) {
    md += '### Artifacts Created\n\n'
    for (const artifact of consolidation.highLevelDelta.artifactsCreated) {
      md += `- ${artifact}\n`
    }
    md += '\n'
  }

  md += '### Quality Metrics\n\n'
  md += `- **Coverage**: ${consolidation.highLevelDelta.qualityMetrics.totalCoverage}\n`
  md += `- **Files Modified**: ${String(consolidation.highLevelDelta.qualityMetrics.totalFiles)}\n`
  md += `- **Tasks Completed**: ${String(consolidation.highLevelDelta.qualityMetrics.totalTasks)}\n`

  return md
}

export function prepareArchiveContent(
  originalContent: string,
  consolidation: GateConsolidation,
  completionNotes?: string,
  timestamp?: string
): string {
  const ts = timestamp ?? new Date().toISOString()
  const completedDate = ts.split('T')[0] // Extract date portion (YYYY-MM-DD)
  
  // Update Status from in_progress/pending to completed
  let updatedContent = originalContent.replace(
    /\*\*Status\*\*:\s*(pending|in_progress|completed|rejected)/,
    '**Status**: completed'
  )
  
  // Add/update Completed date if not already present
  if (!updatedContent.includes('**Completed**:')) {
    // Insert Completed date after Status line
    updatedContent = updatedContent.replace(
      /(\*\*Status\*\*: completed)/,
      `$1\n**Completed**: ${String(completedDate)}`
    )
  } else {
    // Update existing Completed date
    updatedContent = updatedContent.replace(
      /\*\*Completed\*\*: \d{4}-\d{2}-\d{2}/,
      `**Completed**: ${String(completedDate)}`
    )
  }
  
  updatedContent += '\n\n## Archive Summary\n\n'
  updatedContent += `**Archived**: ${ts}\n`
  updatedContent += `**Completion Notes**: ${completionNotes ?? 'None'}\n\n`
  updatedContent += consolidationToMarkdown(consolidation)
  return updatedContent
}
