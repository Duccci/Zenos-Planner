export interface ProposalConflict {
  proposalHash: string
  conflictingFiles: string[]
}

export interface ConflictDetectionResult {
  hasConflicts: boolean
  conflicts: ProposalConflict[]
}

export interface ProposalLike {
  hash: string
  repositoryId?: string
  filesAffected: string[]
}

/**
 * Detect which proposals share files with the target proposal.
 * Returns every overlapping proposal along with the shared file paths.
 * The target proposal is never reported as conflicting with itself.
 */
export function detectConflicts(
  proposalHash: string,
  proposals: ProposalLike[]
): ConflictDetectionResult {
  const target = proposals.find(p => p.hash === proposalHash)
  if (!target) {
    return { hasConflicts: false, conflicts: [] }
  }

  const targetFiles = new Set(target.filesAffected)
  const conflicts: ProposalConflict[] = []

  for (const proposal of proposals) {
    if (proposal.hash === proposalHash) continue
    const conflictingFiles = proposal.filesAffected.filter(f => targetFiles.has(f))
    if (conflictingFiles.length > 0) {
      conflicts.push({ proposalHash: proposal.hash, conflictingFiles })
    }
  }

  return { hasConflicts: conflicts.length > 0, conflicts }
}
