/**
 * Gate Consolidation Orchestrator
 *
 * Orchestrates gate archival workflow by delegating to specialized modules:
 * - Archive validation (pre-flight checks)
 * - Consolidation (requirements and lessons learned)
 * - Git operations (commits and tags)
 * - Dependency updates (next gate and proposals)
 *
 * This module implements the archive workflow as specified in zeno-archive.prompt.md
 * without duplicating logic from other modules.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig } from '../utils/config.js'
import { getZenoDir } from '../utils/config.js'
import { consolidateGateProposals } from '../utils/gate-consolidation.js'
import { validateGateReady, validateProposalReady } from './archive-validation.js'
import { prepareArchiveContent } from './archive-consolidation.js'
import { getCurrentTimestamp, calculateNextGateId, createTagName, performGitCommitAndPush } from './archive-execution.js'
import { logger } from '../utils/logger.js'
import {
  ArchiveGateOutput,
  ArchiveProposalOutput,
  ArchiveBatchOutput
} from '../mcp/schemas/archive-schemas.js'

// Helper functions moved to `archive-consolidation.ts` and `archive-execution.ts`

/**
 * Extract a short (2-3 sentence) summary from proposal markdown content
 */
function extractSummary(content: string): string | null {
  if (!content) return null
  // Try to find '## Summary' or '## Summary' header, else take first paragraph
  const summaryMatch = content.match(/##+\s*Summary\s*\n([\s\S]*?)(?:\n##|\n#|$)/i)
  const raw = summaryMatch ? (summaryMatch[1] ?? '').trim() : null
  const paragraph = raw || content.split('\n\n')[0]
  if (!paragraph) return null
  // Return first 2 sentences
  const sentences = paragraph.replace(/\n/g, ' ').split(/(?<=[.!?])\s+/)
  return sentences.slice(0, 2).join(' ').trim()
}

/**
 * Update or create the solitary consolidation file under zeno/gates/archive/solitary.md
 */
async function updateSolitaryConsolidation(hash: string, title: string, summary: string, completedAt: string) {
  const zenoDir = getZenoDir()
  const archiveDir = join(zenoDir, 'gates', 'archive')
  const filePath = join(archiveDir, 'solitary.md')
  await mkdir(archiveDir, { recursive: true })
  let existing = ''
  try {
    existing = await readFile(filePath, 'utf-8')
  } catch {
    existing = `# Solitary Proposal Archive\n\n` // create base
  }

  const entry = [`### ${title} (${hash})`, `**Completed**: ${completedAt}`, '', summary, '', '---', ''].join('\n')

  const updated = `${existing.trim()}\n\n${entry}`
  await writeFile(filePath, updated)
}


// ============================================================================
// ARCHIVE GATE ORCHESTRATOR
// ============================================================================

/**
 * Archive a completed gate
 *
 * Orchestrates:
 * 1. Validation via archive-validation module
 * 2. Consolidation via gate-consolidation utility
 * 3. Git operations (commit, tag, push)
 * 4. Dependency updates (next gate calculation)
 */
export async function archiveGate(gateId: string, completionNotes?: string): Promise<ArchiveGateOutput> {
  logger.info(`Starting gate archive for ${gateId}`)

  // Step 1: Validate using dedicated validation module
  await validateGateReady(gateId)

  const config = await loadConfig()
  const timestamp = getCurrentTimestamp()

  // Step 2: Prepare paths
  const gatesDir = join(getZenoDir(), '..', 'gates')
  const archiveDir = join(gatesDir, 'archive')
  const gatePath = join(gatesDir, `${gateId}.md`)
  const archivePath = join(archiveDir, `${gateId}.md`)

  await mkdir(archiveDir, { recursive: true })

  // Step 3: Read and extract gate metadata
  const content = await readFile(gatePath, 'utf-8')
  const nameMatch = content.match(/# (.+)/)
  const gateName = nameMatch?.[1]?.trim() ?? gateId

  // Step 4: Consolidate proposals using dedicated utility
  const consolidation = await consolidateGateProposals(gateId, join(getZenoDir(), '..', 'proposals'))

  // Step 5: Update gate content with consolidation
  const updatedContent = prepareArchiveContent(content, consolidation, completionNotes, timestamp)

  // Step 6: Write to archive
  await writeFile(archivePath, updatedContent)

  // Step 7: Git operations
  const tagName = createTagName(gateId, gateName)

  const commitMessage = `chore(${gateId}): Archive gate: ${gateName}

Consolidated ${consolidation.requirementsFulfilled.length} requirements fulfilled
${consolidation.nextDependencies.length} next dependencies identified
${completionNotes ? `Notes: ${completionNotes}` : ''}`

  await performGitCommitAndPush({ tagName, commitMessage, files: [archivePath], remote: config.git?.remote })

  // Step 8: Calculate dependencies
  const nextGateId = calculateNextGateId(gateId)

  const result: ArchiveGateOutput = {
    success: true,
    gateId,
    gateName,
    status: 'completed',
    archivedAt: timestamp,
    location: archivePath,
    gitTag: tagName,
    consolidatedProposals: consolidation.requirementsFulfilled.length,
    fulfilledRequirements: consolidation.requirementsFulfilled.length,
    nextGateId,
    summary: `Archived ${gateId}: ${gateName}`
  }

  logger.info(`Gate archive completed for ${gateId}`)
  return result
}

// ============================================================================
// ARCHIVE PROPOSAL ORCHESTRATOR
// ============================================================================

/**
 * Archive a completed proposal
 *
 * Orchestrates:
 * 1. Validation via archive-validation module
 * 2. File operations (move to archive, update metadata)
 * 3. Git operations (commit and push)
 */
export async function archiveProposal(hash: string, completionNotes?: string): Promise<ArchiveProposalOutput> {
  logger.info(`Starting proposal archive for ${hash}`)

  // Step 1: Validate using dedicated validation module
  const { type, gateId, title } = await validateProposalReady(hash)

  const config = await loadConfig()
  const timestamp = getCurrentTimestamp()

  // Step 2: Determine paths
  const proposalsDir = join(getZenoDir(), '..', 'proposals')
  let sourcePath: string
  let archivePath: string

  if (type === 'gate-tied' && gateId) {
    sourcePath = join(proposalsDir, gateId, `${hash}.md`)
    archivePath = join(proposalsDir, 'archive', gateId, `${hash}.md`)
    await mkdir(join(proposalsDir, 'archive', gateId), { recursive: true })
  } else {
    sourcePath = join(proposalsDir, 'solitary', `${hash}.md`)
    archivePath = join(proposalsDir, 'archive', 'solitary', `${hash}.md`)
    await mkdir(join(proposalsDir, 'archive', 'solitary'), { recursive: true })
  }

  // Step 3: Read and update content
  const content = await readFile(sourcePath, 'utf-8')
  let updatedContent = content.replace(
    /\*\*Status\*\*: completed/,
    `**Status**: completed\n**Archived**: ${timestamp}\n**Archived By**: system`
  )

  if (completionNotes) {
    updatedContent += `\n\n**Completion Notes**: ${completionNotes}`
  }

  updatedContent += '\n\n## Completion Summary\n\n'
  updatedContent += `**Tasks Completed**: [Check content for task completion]\n`
  updatedContent += `**Files Modified**: [Check git history]\n`
  updatedContent += `**Commits**: [Check git history]\n`

  // Step 4: Write to archive
  await writeFile(archivePath, updatedContent)

  // If solitary proposal, update consolidation index for solitary archives
  if (type !== 'gate-tied') {
    try {
      const summary = extractSummary(content) || (completionNotes ?? '')
      await updateSolitaryConsolidation(hash, title, summary, timestamp)
    } catch (err) {
      logger.warn(`Failed to update solitary consolidation for ${hash}: ${err}`)
    }
  }

  // Step 5: Git operations
  const commitMessage = `chore(${type === 'gate-tied' ? gateId : 'solitary'}): Archive proposal: ${title} (${hash})

${completionNotes ? `Notes: ${completionNotes}` : ''}
Archived ${type} proposal to ${archivePath}`

  await performGitCommitAndPush({ commitMessage, files: [archivePath], remote: config.git?.remote })

  const result: ArchiveProposalOutput = {
    success: true,
    hash,
    title,
    type,
    gateId,
    archivedAt: timestamp,
    location: archivePath,
    updatedRequirements: [],
    unblockedProposals: [],
    gateStatus: type === 'gate-tied' && gateId ? 'in_progress' : 'n/a',
    summary: `Archived ${type} proposal ${hash}: ${title}`
  }

  logger.info(`Proposal archive completed for ${hash}`)
  return result
}

// ============================================================================
// ARCHIVE BATCH ORCHESTRATOR
// ============================================================================

/**
 * Archive multiple artifacts in batch
 *
 * Orchestrates archival of multiple gates and proposals,
 * continuing on error and reporting results for each artifact.
 */
export async function archiveBatch(
  artifacts: Array<{ type: 'gate'; gateId: string } | { type: 'proposal'; hash: string }>,
  completionNotes?: string
): Promise<ArchiveBatchOutput> {
  logger.info(`Starting batch archive for ${artifacts.length} artifacts`)

  const results: Array<ArchiveGateOutput | ArchiveProposalOutput> = []
  let successCount = 0

  for (const artifact of artifacts) {
    try {
      if (artifact.type === 'gate') {
        const result = await archiveGate(artifact.gateId, completionNotes)
        results.push(result)
        successCount++
      } else {
        const result = await archiveProposal(artifact.hash, completionNotes)
        results.push(result)
        successCount++
      }
    } catch (error) {
      logger.error(
        `Failed to archive ${artifact.type} ${artifact.type === 'gate' ? artifact.gateId : artifact.hash}`,
        error
      )
      // Continue with other artifacts
    }
  }

  const result: ArchiveBatchOutput = {
    success: successCount > 0,
    archivedCount: successCount,
    results,
    summary: `Archived ${successCount}/${artifacts.length} artifacts`
  }

  logger.info(`Batch archive completed: ${successCount}/${artifacts.length} successful`)
  return result
}