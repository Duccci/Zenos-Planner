/**
 * Gate Consolidation Utility
 *
 * Consolidates archived proposals into gate documents to reduce context size
 * while preserving breadcrumbs for large-scale project development.
 */

import { readFile } from './file.js'
import { FileSystemError } from './errors.js'
import { readdir } from 'node:fs/promises'
import path from 'path'

export interface ConsolidatedProposal {
  hash: string
  title: string
  requirements: string[]
  summary: string
  dependencies: {
    blocks: { hash: string; description: string }[]
    requires: { hash: string; description: string }[]
  }
  implementationNotes: string
  completionSummary: {
    tasksCompleted: string
    filesModified: number
    testCoverage: string
    artifacts: string[]
    qualityMetrics: {
      coverage: string
      security: string
      lintErrors: string
      typeErrors: string
    }
  }
}

export interface GateConsolidation {
  requirementsFulfilled: { hash: string; proposalHash: string }[]
  lessonsLearned: string[]
  nextDependencies: { hash: string; description: string; proposalHash: string }[]
  highLevelDelta: {
    summary: string
    artifactsCreated: string[]
    qualityMetrics: {
      totalCoverage: string
      totalFiles: number
      totalTasks: number
    }
  }
}

/**
 * Parse a proposal markdown file and extract structured information
 */
export async function parseProposal(proposalPath: string): Promise<ConsolidatedProposal> {
  const content = await readFile(proposalPath)

  // Extract header metadata
  const hashMatch = /\*\*Hash\*\*:\s*#([^\s]+)/.exec(content)
  const titleMatch = /# Proposal:\s*(.+)/.exec(content)
  const requirementMatch = /\*\*Requirement\*\*:\s*(.+)/.exec(content)

  const hash = hashMatch?.[1] ?? ''
  const title = titleMatch?.[1]?.trim() ?? ''
  const requirements = requirementMatch?.[1]
    ? requirementMatch[1]
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.startsWith('#'))
    : []

  // Extract Summary section
  const summaryStart = content.indexOf('## Summary')
  const summaryEnd = content.indexOf('---', summaryStart + 1)
  const summary =
    summaryStart !== -1 && summaryEnd !== -1
      ? content
          .slice(summaryStart, summaryEnd)
          .replace(/## Summary\s*/i, '')
          .trim()
      : ''

  // Extract Dependencies table
  const dependencies: ConsolidatedProposal['dependencies'] = { blocks: [], requires: [] }
  const depsStart = content.indexOf('### Dependencies')
  if (depsStart !== -1) {
    const depsEnd = content.indexOf('---', depsStart + 1)
    const depsSection = content.slice(depsStart, depsEnd !== -1 ? depsEnd : undefined)
    const tableMatch = /\|([^|]+)\|([^|]+)\|([^|]+)\|/g.exec(depsSection)
    if (tableMatch) {
      // Re-run global regex to collect all rows
      const rowRegex = /\|([^|]+)\|([^|]+)\|([^|]+)\|/g
      const rows: string[] = []
      let m: RegExpExecArray | null
      while ((m = rowRegex.exec(depsSection)) !== null) {
        rows.push(m[0])
      }
      for (const row of rows.slice(1)) {
        // Skip header row
        const cells = row.split('|').map((c) => c.trim()).filter((c) => c && c !== 'Hash' && c !== 'Type' && c !== 'Description')
        if (cells.length >= 3) {
          const depHash = cells[0]
          const depType = cells[1]?.toLowerCase()
          const depDesc = cells[2]
          if (depHash && depHash.startsWith('#') && depType && depDesc) {
            const entry = { hash: depHash, description: depDesc }
            if (depType === 'blocks') {
              dependencies.blocks.push(entry)
            } else if (depType === 'requires') {
              dependencies.requires.push(entry)
            }
          }
        }
      }
    }
  }

  // Extract Implementation Notes
  const implNotesStart = content.indexOf('## Implementation Notes')
  const implNotesEnd = content.indexOf('---', implNotesStart + 1)
  const implementationNotes =
    implNotesStart !== -1 && implNotesEnd !== -1
      ? content
          .slice(implNotesStart, implNotesEnd)
          .replace(/## Implementation Notes\s*/i, '')
          .trim()
      : ''

  // Extract Completion Summary
  const completionStart = content.indexOf('## Completion Summary')
  const completionEnd = content.indexOf('##', completionStart + 1)
  const completionSection =
    completionStart !== -1
      ? content.slice(completionStart, completionEnd !== -1 ? completionEnd : undefined)
      : ''

  const tasksMatch = /\*\*Tasks Completed\*\*:\s*(.+)/.exec(completionSection)
  const filesMatch = /\*\*Files Modified\*\*:\s*(\d+)/.exec(completionSection)
  const coverageMatch = /\*\*Test Coverage\*\*:\s*(.+)/.exec(completionSection)
  const artifactsMatch = /### Artifacts Created\s*([\s\S]*?)(?=###|$)/.exec(completionSection)
  const qualityMatch = /### Quality Metrics\s*([\s\S]*?)(?=###|$)/.exec(completionSection)

  const artifacts: string[] = []
  if (artifactsMatch?.[1]) {
    const artifactLines = artifactsMatch[1].split('\n').filter((l) => l.trim().startsWith('-'))
    artifacts.push(...artifactLines.map((l) => l.replace(/^-\s*/, '').trim()))
  }

  const qualityMetrics = {
    coverage: '',
    security: '',
    lintErrors: '',
    typeErrors: '',
  }
  if (qualityMatch?.[1]) {
    const coverageLine = /Coverage:\s*(.+)/.exec(qualityMatch[1])
    const securityLine = /Security:\s*(.+)/.exec(qualityMatch[1])
    const lintLine = /Lint errors:\s*(.+)/.exec(qualityMatch[1])
    const typeLine = /Type errors:\s*(.+)/.exec(qualityMatch[1])
    qualityMetrics.coverage = coverageLine?.[1]?.trim() ?? ''
    qualityMetrics.security = securityLine?.[1]?.trim() ?? ''
    qualityMetrics.lintErrors = lintLine?.[1]?.trim() ?? ''
    qualityMetrics.typeErrors = typeLine?.[1]?.trim() ?? ''
  }

  return {
    hash,
    title,
    requirements,
    summary,
    dependencies,
    implementationNotes,
    completionSummary: {
      tasksCompleted: tasksMatch?.[1]?.trim() ?? '',
      filesModified: filesMatch?.[1] ? parseInt(filesMatch[1], 10) : 0,
      testCoverage: coverageMatch?.[1]?.trim() ?? '',
      artifacts,
      qualityMetrics,
    },
  }
}

/**
 * Consolidate all archived proposals for a gate
 */
export async function consolidateGateProposals(
  gateId: string,
  proposalsDir = 'zeno/proposals'
): Promise<GateConsolidation> {
  const proposals: ConsolidatedProposal[] = []
  const requirementsFulfilled: { hash: string; proposalHash: string }[] = []
  const lessonsLearned: string[] = []
  const nextDependencies: { hash: string; description: string; proposalHash: string }[] = []
  const artifactsCreated: string[] = []
  let totalFiles = 0
  let totalTasks = 0
  const coverageValues: number[] = []

  try {
    // Read all files recursively from the proposals directory
    // This supports both flat structure (for completed/archived) and gate-based structure (for active)
    const getAllFiles = async (dir: string): Promise<string[]> => {
      const allFiles: string[] = []
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            allFiles.push(...(await getAllFiles(fullPath)))
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            allFiles.push(fullPath)
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
      return allFiles
    }

    const proposalFiles = await getAllFiles(proposalsDir)

    for (const proposalPath of proposalFiles) {
      const proposal = await parseProposal(proposalPath)

      // Check if this proposal belongs to the gate
      const content = await readFile(proposalPath)
      const gateMatch = /\*\*Gate\*\*:\s*gate-(\d+)/.exec(content)
      if (gateMatch?.[1]) {
        const proposalGateId = `gate-${gateMatch[1].padStart(2, '0')}`
        if (proposalGateId === gateId) {
          proposals.push(proposal)

          // Collect requirements fulfilled
          for (const req of proposal.requirements) {
            requirementsFulfilled.push({ hash: req, proposalHash: proposal.hash })
          }

          // Collect lessons learned from implementation notes
          if (proposal.implementationNotes) {
            const notes = proposal.implementationNotes
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l && !l.startsWith('-') && /^\d+\./.exec(l) === null)
            lessonsLearned.push(...notes)
          }

          // Collect next dependencies (what this proposal blocks)
          for (const dep of proposal.dependencies.blocks) {
            nextDependencies.push({
              hash: dep.hash,
              description: dep.description,
              proposalHash: proposal.hash,
            })
          }

          // Collect artifacts
          artifactsCreated.push(...proposal.completionSummary.artifacts)

          // Aggregate metrics
          totalFiles += proposal.completionSummary.filesModified
          const tasksMatch = /(\d+)\/(\d+)/.exec(proposal.completionSummary.tasksCompleted)
          if (tasksMatch?.[2]) {
            totalTasks += parseInt(tasksMatch[2], 10)
          }
          const coverageMatch = /(\d+\.?\d*)%/.exec(proposal.completionSummary.testCoverage)
          if (coverageMatch?.[1]) {
            coverageValues.push(parseFloat(coverageMatch[1]))
          }
        }
      }
    }

    // Calculate average coverage
    const avgCoverage =
      coverageValues.length > 0
        ? (coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length).toFixed(2)
        : '0'

    // Deduplicate lessons learned
    const uniqueLessons = Array.from(new Set(lessonsLearned))

    // Create high-level delta summary
    const summaries = proposals.map((p) => p.summary).filter((s) => s)
    const highLevelSummary = summaries.join(' ')

    return {
      requirementsFulfilled: Array.from(
        new Map(requirementsFulfilled.map((r) => [r.hash, r])).values()
      ),
      lessonsLearned: uniqueLessons,
      nextDependencies: Array.from(
        new Map(nextDependencies.map((d) => [d.hash, d])).values()
      ),
      highLevelDelta: {
        summary: highLevelSummary,
        artifactsCreated: Array.from(new Set(artifactsCreated)),
        qualityMetrics: {
          totalCoverage: `${avgCoverage}%`,
          totalFiles,
          totalTasks,
        },
      },
    }
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error
    }
    throw new FileSystemError(
      `Failed to consolidate proposals for ${gateId}`,
      'FS_CONSOLIDATION_FAILED',
      { path: proposalsDir, cause: error }
    )
  }
}

/**
 * Generate markdown section for consolidated proposals
 */
export function generateConsolidationMarkdown(consolidation: GateConsolidation): string {
  const sections: string[] = []

  sections.push('## Consolidated Proposals Summary')
  sections.push('')
  sections.push(
    '*This section consolidates information from all archived proposals for this gate to reduce context size while preserving key breadcrumbs.*'
  )
  sections.push('')

  // Requirements Fulfilled
  sections.push('### Requirements Fulfilled')
  sections.push('')
  if (consolidation.requirementsFulfilled.length > 0) {
    sections.push('| Requirement | Proposal |')
    sections.push('|-------------|----------|')
    for (const req of consolidation.requirementsFulfilled) {
      sections.push(`| ${req.hash} | #${req.proposalHash} |`)
    }
  } else {
    sections.push('*No requirements tracked in proposals.*')
  }
  sections.push('')

  // Lessons Learned
  sections.push('### Lessons Learned')
  sections.push('')
  if (consolidation.lessonsLearned.length > 0) {
    for (const lesson of consolidation.lessonsLearned) {
      sections.push(`- ${lesson}`)
    }
  } else {
    sections.push('*No implementation notes captured.*')
  }
  sections.push('')

  // Next Dependencies
  sections.push('### Next Dependencies')
  sections.push('')
  sections.push(
    '*Proposals that are unblocked by this gate (identified from proposal dependency tables):*'
  )
  sections.push('')
  if (consolidation.nextDependencies.length > 0) {
    sections.push('| Hash | Description |')
    sections.push('|------|-------------|')
    for (const dep of consolidation.nextDependencies) {
      sections.push(`| ${dep.hash} | ${dep.description} |`)
    }
  } else {
    sections.push('*No downstream dependencies identified.*')
  }
  sections.push('')

  // High-Level Delta
  sections.push('### High-Level Delta')
  sections.push('')
  sections.push('**Summary**:')
  sections.push(consolidation.highLevelDelta.summary || '*No summary available.*')
  sections.push('')
  sections.push('**Artifacts Created**:')
  if (consolidation.highLevelDelta.artifactsCreated.length > 0) {
    for (const artifact of consolidation.highLevelDelta.artifactsCreated) {
      sections.push(`- ${artifact}`)
    }
  } else {
    sections.push('*No artifacts tracked.*')
  }
  sections.push('')
  sections.push('**Quality Metrics**:')
  sections.push(
    `- Total Coverage: ${consolidation.highLevelDelta.qualityMetrics.totalCoverage}`
  )
  sections.push(
    `- Total Files Modified: ${String(consolidation.highLevelDelta.qualityMetrics.totalFiles)}`
  )
  sections.push(
    `- Total Tasks Completed: ${String(consolidation.highLevelDelta.qualityMetrics.totalTasks)}`
  )
  sections.push('')

  return sections.join('\n')
}

