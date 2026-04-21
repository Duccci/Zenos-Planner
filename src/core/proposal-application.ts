/**
 * Proposal Application Workflow
 *
 * Handles proposal implementation tracking and progress updates.
 * Responsible for: tracking task completion, updating status,
 * calculating completion metrics, and managing proposal state during implementation.
 */

import { readFile, writeFile } from '../utils/file.js'
import { logger } from '../utils/logger.js'
import { ZenoError } from '../utils/errors.js'

export interface ProposalUpdateProgressInput {
  hash: string
  taskIndex: number
  completed: boolean
  notes?: string
}

export interface ProposalUpdateProgressOutput {
  success: boolean
  hash: string
  taskIndex: number
  completed: boolean
  completionSummary?: {
    tasksCompleted: number
    tasksTotal: number
    filesModified: number
    testCoverage?: number
    qualityMetrics?: {
      coverage: number
      security: number
      lintErrors: number
      typeErrors: number
    }
  }
  /** Files from all fully-completed task sections, extracted from proposal markdown. */
  completedFiles?: string[]
  /** True when the final task completion also transitioned the proposal to completed. */
  proposalCompleted?: boolean
  /** True when all tasks are complete and the gate's Proposal Status table was updated. */
  gateStatusUpdated?: boolean
  message: string
}

/**
 * Update proposal task progress during implementation
 */
export async function updateProposalProgress(
  input: ProposalUpdateProgressInput
): Promise<ProposalUpdateProgressOutput> {
  try {
    const projectRoot = process.cwd()
    const { hash, taskIndex, completed, notes } = input

    // Find proposal file
    const proposalPath = await findProposalByHash(hash, projectRoot)
    if (!proposalPath) {
      throw new ZenoError(`Proposal with hash ${hash} not found`, 'PROPOSAL_NOT_FOUND')
    }

    // Read current proposal content
    let content = await readFile(proposalPath)

    // Update task status
    content = updateTaskStatus(content, taskIndex, completed, notes)

    // Write back to file (update task status)
    await writeFile(proposalPath, content)

    // Calculate and persist completion summary
    const completionSummary = calculateCompletionSummary(content)
    const proposalCompleted =
      completionSummary.tasksCompleted === completionSummary.tasksTotal &&
      completionSummary.tasksTotal > 0
    content = updateCompletionSummary(content, completionSummary)

    if (proposalCompleted) {
      content = markProposalCompleted(content)
    }
    await writeFile(proposalPath, content)

    if (proposalCompleted) {
      syncProposalCompletionStatus(hash, projectRoot)
    }

    // Collect files from all fully-completed task sections
    const completedFiles = extractAllCompletedTaskFiles(content)

    // Final apply step: when all tasks are complete, sync status in the associated gate document
    let gateStatusUpdated: boolean | undefined
    if (proposalCompleted) {
      gateStatusUpdated = await syncGateProposalStatus(content, hash, projectRoot)
    }

    return {
      success: true,
      hash,
      taskIndex,
      completed,
      completionSummary,
      completedFiles,
      proposalCompleted,
      gateStatusUpdated,
      message: proposalCompleted
        ? `Updated task ${String(taskIndex)} to completed and marked proposal completed`
        : `Updated task ${String(taskIndex)} to ${completed ? 'completed' : 'in progress'}`,
    }
  } catch (error) {
    logger.error('Failed to update proposal progress', { error, input })
    throw new ZenoError(
      `Progress update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PROGRESS_UPDATE_FAILED'
    )
  }
}

// Helper functions live in `src/utils/artifact-locator.ts` and `proposal-progress.ts`
import { findProposalByHash, findGateByGateId } from '../utils/artifact-locator.js'
import { getDatabase } from '../storage/database.js'
import { normalizeHash } from '../utils/normalize.js'

/**
 * When all tasks in a proposal are complete, update the gate document's
 * Proposal Status table to reflect the proposal's current status.
 * Skips silently for solitary proposals or when the gate file cannot be found.
 *
 * @returns true when the gate file was successfully updated, false otherwise.
 */
async function syncGateProposalStatus(
  proposalContent: string,
  hash: string,
  projectRoot: string
): Promise<boolean> {
  // Extract gate ID from proposal metadata: **Gate**: gate-06 - Some Name
  const gateMatch = /\*\*Gate\*\*:\s*(gate-\d+)/i.exec(proposalContent)
  if (!gateMatch?.[1]) return false // solitary or unfilled template

  const gateId = gateMatch[1]
  const normalizedHash = hash.replace(/^#/, '')
  const proposalStatus = /\*\*Status\*\*:\s*completed/i.test(proposalContent)
    ? 'completed'
    : 'in_progress'

  try {
    const gatePath = await findGateByGateId(gateId, projectRoot)
    if (!gatePath) return false

    let gateContent = await readFile(gatePath)

    // Match the Proposal Status table row: | Any Name | #hashvalue | status | Notes |
    const escapedHash = normalizedHash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rowPattern = new RegExp(
      `(\\|[^|\\n]*\\|\\s*#${escapedHash}\\s*\\|\\s*)(\\w+)(\\s*\\|)`,
    )

    if (!rowPattern.test(gateContent)) return false

    gateContent = gateContent.replace(rowPattern, `$1${proposalStatus}$3`)
    await writeFile(gatePath, gateContent)
    return true
  } catch (error) {
    logger.warn(`Failed to sync gate proposal status for ${hash}: ${String(error)}`)
    return false
  }
}

function markProposalCompleted(proposalContent: string): string {
  const completedAt = new Date().toISOString()
  let updatedContent = proposalContent

  updatedContent = upsertFrontmatterField(updatedContent, 'status', 'completed')
  updatedContent = upsertFrontmatterField(updatedContent, 'approved_at', completedAt)
  updatedContent = upsertFrontmatterField(updatedContent, 'implemented_at', completedAt)

  if (/\*\*Status\*\*:\s*\w+/i.test(updatedContent)) {
    updatedContent = updatedContent.replace(/(\*\*Status\*\*:\s*)\w+/i, '$1completed')
  }

  if (/\*\*Implemented\*\*:\s*[^\n\r]+/i.test(updatedContent)) {
    updatedContent = updatedContent.replace(
      /(\*\*Implemented\*\*:\s*)[^\n\r]+/i,
      `$1${completedAt}`
    )
  } else if (/\*\*Status\*\*:\s*completed/i.test(updatedContent)) {
    updatedContent = updatedContent.replace(
      /\*\*Status\*\*:\s*completed/i,
      `**Status**: completed\n**Implemented**: ${completedAt}`
    )
  }

  return updatedContent
}

function upsertFrontmatterField(content: string, field: string, value: string): string {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content)
  if (!frontmatterMatch) return content

  const currentBlock = frontmatterMatch[1] ?? ''
  const fieldPattern = new RegExp(`^(\\s*${field}:\\s*).*$`, 'm')
  const updatedBlock = fieldPattern.test(currentBlock)
    ? currentBlock.replace(fieldPattern, `$1${value}`)
    : `${currentBlock}\n${field}: ${value}`

  return `${content.slice(0, frontmatterMatch.index)}---\n${updatedBlock}\n---${content.slice(frontmatterMatch.index + frontmatterMatch[0].length)}`
}

function syncProposalCompletionStatus(hash: string, projectRoot: string): void {
  const db = getDatabase(projectRoot)
  const normalizedHash = normalizeHash(hash)
  const completedAt = new Date().toISOString()
  const updateResult = db
    .prepare(
      `UPDATE proposals
       SET status = 'completed',
           approved_at = COALESCE(approved_at, ?),
           implemented_at = COALESCE(implemented_at, ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE hash = ? OR hash LIKE ?`
    )
    .run(completedAt, completedAt, normalizedHash, `${normalizedHash}%`) as {
    changes?: number
  }

  if ((updateResult.changes ?? 0) < 1) {
    throw new ZenoError(
      `Proposal with hash ${hash} could not be marked completed in the database`,
      'PROPOSAL_COMPLETION_SYNC_FAILED'
    )
  }
}
import {
  updateTaskStatus,
  calculateCompletionSummary,
  updateCompletionSummary,
  extractAllCompletedTaskFiles,
} from './proposal-progress.js'
