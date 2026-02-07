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
  message: string
}

/**
 * Update proposal task progress during implementation
 */
export async function updateProposalProgress(input: ProposalUpdateProgressInput): Promise<ProposalUpdateProgressOutput> {
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
    content = updateCompletionSummary(content, completionSummary)
    await writeFile(proposalPath, content)

    return {
      success: true,
      hash,
      taskIndex,
      completed,
      completionSummary,
      message: `Updated task ${taskIndex} to ${completed ? 'completed' : 'in progress'}`
    }
  } catch (error) {
    logger.error('Failed to update proposal progress', { error, input })
    throw new ZenoError(`Progress update failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'PROGRESS_UPDATE_FAILED')
  }
}

// Helper functions moved to `proposal-locator.ts` and `proposal-progress.ts`
import { findProposalByHash } from './proposal-locator.js'
import { updateTaskStatus, calculateCompletionSummary, updateCompletionSummary } from './proposal-progress.js'
