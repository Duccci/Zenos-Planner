import { createTag, commit, pushCurrentBranch } from '../utils/git.js'
import { logger } from '../utils/logger.js'

export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

export function calculateNextGateId(currentGateId: string): string {
  const gateIdParts = currentGateId.split('-')
  const currentGateNum = parseInt(gateIdParts[1] ?? '1')
  const nextGateNum = currentGateNum + 1
  return `gate-${nextGateNum.toString().padStart(2, '0')}`
}

export function createTagName(gateId: string, gateName: string): string {
  return `${gateId}-${gateName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
}

export async function performGitCommitAndPush(options: {
  tagName?: string
  commitMessage: string
  files: string[]
  remote?: string
}): Promise<void> {
  const { tagName, commitMessage, files, remote } = options

  if (tagName) {
    await createTag(tagName, `Archive ${tagName}`)
  }

  await commit(commitMessage, files)

  try {
    await pushCurrentBranch(remote || 'origin')
  } catch (error) {
    logger.warn('Push failed but continuing with archive', error)
  }
}
