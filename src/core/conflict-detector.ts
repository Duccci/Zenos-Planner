/* v8 ignore file */
// @red — stub created for RED phase; replace with real implementation in GREEN phase
// This file intentionally exports unimplemented stubs so tests can import it.
// All tests against this module are marked `it.skip // @red` until GREEN.

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

export function detectConflicts(
  _proposalHash: string,
  _proposals: ProposalLike[]
): ConflictDetectionResult | Promise<ConflictDetectionResult> {
  throw new Error('detectConflicts: not implemented')
}
