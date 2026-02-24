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
import { existsSync, readdirSync } from 'node:fs'
import { loadConfig } from '../utils/config.js'
import { getZenoDir } from '../utils/config.js'
import { consolidateGateProposals } from '../utils/gate-consolidation.js'
import { validateGateReady, validateProposalReady } from './archive-validation.js'
import { prepareArchiveContent } from './archive-consolidation.js'
import {
  getCurrentTimestamp,
  calculateNextGateId,
  createTagName,
  performGitCommitAndPush,
} from './archive-execution.js'
import { logger } from '../utils/logger.js'
import { stripAnsi } from '../utils/ansi-strip.js'
import { ArchiveGateOutput, ArchiveProposalOutput, ArchiveBatchOutput } from '../mcp/schemas/archive-schemas.js'
import { captureMetricsSnapshot } from './metrics-capture.js'

// Helper functions moved to `archive-consolidation.ts` and `archive-execution.ts`

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
export async function archiveGate(
  gateId: string,
  completionNotes?: string
): Promise<ArchiveGateOutput> {
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
  const nameMatch = /# (.+)/.exec(content)
  const gateName = nameMatch?.[1]?.trim() ?? gateId

  // Step 4: Consolidate proposals using dedicated utility
  const consolidation = await consolidateGateProposals(
    gateId,
    join(getZenoDir(), '..', 'proposals')
  )

  // Step 5: Update gate content with consolidation
  const updatedContent = prepareArchiveContent(content, consolidation, completionNotes, timestamp)

  // Step 6: Write to archive
  await writeFile(archivePath, updatedContent)

  // Step 7: Git operations
  const tagName = createTagName(gateId, gateName)

  const commitMessage = stripAnsi(`chore(${gateId}): Archive gate: ${gateName}

Consolidated ${String(consolidation.requirementsFulfilled.length)} requirements fulfilled
${String(consolidation.nextDependencies.length)} next dependencies identified
${completionNotes ? `Notes: ${completionNotes}` : ''}`)

  await performGitCommitAndPush({
    tagName,
    commitMessage,
    files: [archivePath],
    remote: config.git?.remote,
  })

  // Step 8: Capture metrics snapshot (non-fatal)
  await captureMetricsSnapshot(gateId)

  // Step 9: Calculate dependencies
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
    summary: `Archived ${gateId}: ${gateName}`,
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
 * Moves proposal from active location to archive and updates metadata.
 * Handles both gate-tied and solitary proposals.
 */
export async function archiveProposal(
  proposalHash: string,
  completionNotes?: string
): Promise<ArchiveProposalOutput> {
  logger.info(`Starting proposal archive for ${proposalHash}`)

  // Step 1: Validate using dedicated validation module
  const proposalInfo = await validateProposalReady(proposalHash)

  const timestamp = getCurrentTimestamp()
  const proposalsBaseDir = join(getZenoDir(), '..', 'proposals')
  const archiveDir = join(proposalsBaseDir, 'archive')

  // Step 2: Find and move proposal file
  let sourcePath: string
  if (proposalInfo.type === 'gate-tied' && proposalInfo.gateId) {
    sourcePath = join(proposalsBaseDir, proposalInfo.gateId, `${proposalHash}.md`)
  } else {
    sourcePath = join(proposalsBaseDir, 'solitary', `${proposalHash}.md`)
  }

  if (!existsSync(sourcePath)) {
    throw new Error(`Proposal file not found at ${sourcePath}`)
  }

  // Step 3: Read proposal content
  const content = await readFile(sourcePath, 'utf-8')

  // Step 4: Create archive directory if needed
  await mkdir(archiveDir, { recursive: true })

  // Step 5: Prepare archival metadata
  const archivePath = join(archiveDir, `${proposalHash}.md`)
  const archivalDate = new Date().toISOString().split('T')[0] ?? new Date().toLocaleDateString()

  // Add archival metadata to the proposal
  const archiveMetadata = `

---

**Archival Metadata**:
- Archived Date: ${archivalDate}
- Archive Location: zeno/proposals/archive/
${completionNotes !== undefined ? `- Completion Notes: ${completionNotes}` : ''}`

  const updatedContent = content + archiveMetadata

  // Step 6: Check for pre-existing archives with same hash to prevent duplicates
  const archiveFiles = readdirSync(archiveDir).filter((f) => f.startsWith(proposalHash))
  const duplicates = archiveFiles.filter((f) => f !== `${proposalHash}.md`)
  if (duplicates.length > 0) {
    logger.warn(`Detected duplicate archive files for hash ${proposalHash}:`, duplicates)
    // Remove duplicates before writing the canonical version
    for (const dup of duplicates) {
      const dupPath = join(archiveDir, dup)
      try {
        await import('node:fs/promises').then((fs) => fs.unlink(dupPath))
        logger.info(`Removed duplicate archive file: ${dup}`)
      } catch (err) {
        logger.warn(`Failed to remove duplicate: ${dup}`, err)
      }
    }
  }

  // Step 7: Write to archive
  await writeFile(archivePath, updatedContent)

  // Step 8: Git commit
  const commitMessage = stripAnsi(
    `chore(proposal): Archive proposal ${proposalHash} - ${proposalInfo.title}

- Moved from zeno/proposals/${proposalInfo.gateId ?? 'solitary'}/ to zeno/proposals/archive/
- Added archival metadata${completionNotes !== undefined ? `\n- Completion Notes: ${completionNotes}` : ''}`
  )

  await performGitCommitAndPush({
    commitMessage,
    files: [archivePath],
  })

  const result: ArchiveProposalOutput = {
    success: true,
    proposalHash,
    proposalTitle: proposalInfo.title,
    proposalType: proposalInfo.type,
    gateId: proposalInfo.gateId,
    status: 'completed',
    archivedAt: timestamp,
    location: archivePath,
    summary: `Archived proposal ${proposalHash}: ${proposalInfo.title}`,
  }

  logger.info(`Proposal archive completed for ${proposalHash}`)
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
  artifacts: (
    | { type: 'gate'; gateId: string }
    | { type: 'proposal'; proposalHash: string }
  )[],
  completionNotes?: string
): Promise<ArchiveBatchOutput> {
  logger.info(`Starting batch archive for ${String(artifacts.length)} artifacts`)

  const results: ArchiveBatchOutput['results'] = []
  let successCount = 0

  for (const artifact of artifacts) {
    try {
      if (artifact.type === 'gate') {
        const result = await archiveGate(artifact.gateId, completionNotes)
        results.push({
          success: true,
          artifactType: 'gate',
          artifactId: artifact.gateId,
          output: result,
        })
        successCount++
      } else {
        const result = await archiveProposal(artifact.proposalHash, completionNotes)
        results.push({
          success: true,
          artifactType: 'proposal',
          artifactId: artifact.proposalHash,
          output: result,
        })
        successCount++
      }
    } catch (error) {
      const artifactId =
        artifact.type === 'gate' ? artifact.gateId : artifact.proposalHash
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to archive ${artifact.type} ${artifactId}`, error)

      results.push({
        success: false,
        artifactType: artifact.type === 'gate' ? 'gate' : 'proposal',
        artifactId,
        error: errorMsg,
      })
    }
  }

  const result: ArchiveBatchOutput = {
    success: successCount > 0,
    archivedCount: successCount,
    results,
    summary: `Archived ${String(successCount)}/${String(artifacts.length)} artifacts`,
  }

  logger.info(
    `Batch archive completed: ${String(successCount)}/${String(artifacts.length)} successful`
  )
  return result
}
