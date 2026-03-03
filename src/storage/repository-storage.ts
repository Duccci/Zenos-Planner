/* v8 ignore file */
// @red — stub created for RED phase; replace with real implementation in GREEN phase
// This file intentionally exports unimplemented stubs so tests can import it.
// All tests against this module are marked `it.skip // @red` until GREEN.

export interface Repository {
  hash: string
  name: string
  type: 'main' | 'service' | 'library' | 'tool' | 'app'
  path: string
  metadata?: Record<string, unknown>
}

export function saveRepository(
  _data: Omit<Repository, 'id'> & { hash: string },
  _dir?: string
): void {
  throw new Error('saveRepository: not implemented')
}

export function getRepositoryByHash(
  _hash: string,
  _dir?: string
): Repository | undefined {
  throw new Error('getRepositoryByHash: not implemented')
}

export function listRepositories(
  _type?: string,
  _dir?: string
): Repository[] {
  throw new Error('listRepositories: not implemented')
}

export function updateRepository(
  _hash: string,
  _updates: Partial<Pick<Repository, 'name' | 'type' | 'path' | 'metadata'>>,
  _dir?: string
): void {
  throw new Error('updateRepository: not implemented')
}

export function deleteRepository(_hash: string, _dir?: string): void {
  throw new Error('deleteRepository: not implemented')
}
