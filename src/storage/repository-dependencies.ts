/* v8 ignore file */
// @red — stub created for RED phase; replace with real implementation in GREEN phase
// This file intentionally exports unimplemented stubs so tests can import it.
// All tests against this module are marked `it.skip // @red` until GREEN.

export interface RepoDependencyEdge {
  fromRepoHash: string
  targetRepoHash: string
  depType: string
  metadata?: Record<string, unknown>
}

export interface RepoDependencyGraph {
  repositories: { hash: string; name: string }[]
  edges: { from: string; to: string; depType: string }[]
}

export function addRepoDependency(
  _fromHash: string,
  _toHash: string,
  _depType: string,
  _metadata: undefined,
  _dir?: string
): void {
  throw new Error('addRepoDependency: not implemented')
}

export function getRepoDependencies(
  _repoHash: string,
  _dir?: string
): RepoDependencyEdge[] {
  throw new Error('getRepoDependencies: not implemented')
}

export function removeRepoDependency(
  _fromHash: string,
  _toHash: string,
  _depType: string,
  _dir?: string
): void {
  throw new Error('removeRepoDependency: not implemented')
}

export function getRepoDependencyGraph(_dir?: string): RepoDependencyGraph {
  throw new Error('getRepoDependencyGraph: not implemented')
}

export function detectCircularDependencies(_dir?: string): string[][] {
  throw new Error('detectCircularDependencies: not implemented')
}
