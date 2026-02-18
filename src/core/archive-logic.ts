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
import { validateGateReady } from './archive-validation.js'
import { prepareArchiveContent } from './archive-consolidation.js'
import {
  getCurrentTimestamp,
  calculateNextGateId,
  createTagName,
  performGitCommitAndPush,
} from './archive-execution.js'
import { logger } from '../utils/logger.js'
import { stripAnsi } from '../utils/ansi-strip.js'
import { ArchiveGateOutput, ArchiveBatchOutput } from '../mcp/schemas/archive-schemas.js'
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
// ARCHIVE BATCH ORCHESTRATOR
// ============================================================================

/**
 * Archive multiple artifacts in batch
 *
 * Orchestrates archival of multiple gates and proposals,
 * continuing on error and reporting results for each artifact.
 */
export async function archiveBatch(
  artifacts: { type: 'gate'; gateId: string }[],
  completionNotes?: string
): Promise<ArchiveBatchOutput> {
  logger.info(`Starting batch archive for ${String(artifacts.length)} artifacts`)

  const results: ArchiveGateOutput[] = []
  let successCount = 0

  for (const artifact of artifacts) {
    try {
      const result = await archiveGate(artifact.gateId, completionNotes)
      results.push(result)
      successCount++
    } catch (error) {
      logger.error(`Failed to archive gate ${artifact.gateId}`, error)
      // Continue with other artifacts
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
