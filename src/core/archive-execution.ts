import { createTag, commit, pushCurrentBranch, updateSubmodulePointer } from '../utils/git.js'
import { loadConfig, getZenoGitDir } from '../utils/config.js'
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
  projectRoot?: string
}): Promise<void> {
  const { tagName, commitMessage, files, remote } = options
  const projectRoot = options.projectRoot ?? process.cwd()

  const config = await loadConfig(projectRoot).catch(() => null)
  const isSubmodule = config?.['zenoSubmodule'] === true
  // Use direct condition so TypeScript narrows config to non-null in the true branch
  const gitDir = config?.['zenoSubmodule'] === true ? getZenoGitDir(projectRoot, config) : projectRoot

  if (tagName) {
    // Tags live in the parent repo so they appear in implementation history
    await createTag(tagName, `Archive ${tagName}`, projectRoot)
  }

  await commit(commitMessage, files, gitDir)

  if (isSubmodule) {
    // Update the parent repo's submodule pointer after the submodule commit
    await updateSubmodulePointer(
      projectRoot,
      `chore(zeno): update submodule pointer after ${commitMessage.split('\n')[0] ?? commitMessage}`
    )
  }

  try {
    await pushCurrentBranch(remote ?? 'origin', gitDir)
    if (isSubmodule) {
      await pushCurrentBranch(remote ?? 'origin', projectRoot)
    }
  } catch (error) {
    logger.warn('Push failed but continuing with archive', error)
  }
}
