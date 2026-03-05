/**
 * Repository Storage
 *
 * CRUD module for the `repositories` table.
 * Follows the metrics-storage.ts functional pattern:
 *   - no classes, exported pure functions
 *   - optional projectRoot for DB resolution
 *   - parameterized SQL throughout
 */

import { resolve } from 'path'
import { getDatabase } from './database.js'
import { logger } from '../utils/logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Domain model (camelCase) */
export interface Repository {
  hash: string
  name: string
  type: 'main' | 'service' | 'library' | 'tool' | 'app'
  path: string
  metadata?: Record<string, unknown>
}

/** Raw DB row (snake_case) */
interface RepositoryRow {
  id: string
  name: string
  type: string
  path: string
  hash: string
  metadata: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToRepository(row: RepositoryRow): Repository {
  return {
    hash: row.hash,
    name: row.name,
    type: row.type as Repository['type'],
    path: row.path,
    ...(row.metadata
      ? { metadata: JSON.parse(row.metadata) as Record<string, unknown> }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

function validatePath(p: string): void {
  // Resolve to absolute and check that raw string contains no traversal sequence
  resolve(p) // throws on truly invalid paths on Windows
  if (p.includes('..')) {
    throw new Error(
      `Invalid path: path traversal sequences (..) are not allowed: ${p}`
    )
  }
}

// ---------------------------------------------------------------------------
// SQL constants
// ---------------------------------------------------------------------------

const INSERT_SQL = `
  INSERT INTO repositories (id, name, type, path, hash, metadata)
  VALUES (@id, @name, @type, @path, @hash, @metadata)
`

const SELECT_BY_HASH_SQL = `SELECT * FROM repositories WHERE hash = ?`
const SELECT_ALL_SQL = `SELECT * FROM repositories ORDER BY created_at ASC`
const SELECT_BY_TYPE_SQL = `SELECT * FROM repositories WHERE type = ? ORDER BY created_at ASC`
const DELETE_SQL = `DELETE FROM repositories WHERE hash = ?`

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Persist a repository. The caller supplies the hash; it is used as the PK `id` too.
 * @throws if path contains `..` traversal sequences
 * @throws if hash already exists (UNIQUE constraint)
 */
export function saveRepository(
  data: Omit<Repository, 'id'> & { hash: string },
  projectRoot?: string
): void {
  validatePath(data.path)
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  db.prepare(INSERT_SQL).run({
    id: data.hash,
    name: data.name,
    type: data.type,
    path: data.path,
    hash: data.hash,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
  })
  logger.debug(`Saved repository "${data.name}" (hash=${data.hash})`)
}

/** Look up a repository by its hash. Returns undefined if not found. */
export function getRepositoryByHash(
  hash: string,
  projectRoot?: string
): Repository | undefined {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const row = db.prepare(SELECT_BY_HASH_SQL).get(hash) as RepositoryRow | undefined
  return row ? rowToRepository(row) : undefined
}

/**
 * List all repositories, optionally filtered by type.
 * @param typeFilter - Optional type filter ('main' | 'service' | 'library' | 'tool' | 'app')
 */
export function listRepositories(
  typeFilter?: string,
  projectRoot?: string
): Repository[] {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const rows: RepositoryRow[] = typeFilter
    ? (db.prepare(SELECT_BY_TYPE_SQL).all(typeFilter) as RepositoryRow[])
    : (db.prepare(SELECT_ALL_SQL).all() as RepositoryRow[])
  return rows.map(rowToRepository)
}

/** Update mutable fields of a repository by hash. No-op if no fields provided. */
export function updateRepository(
  hash: string,
  updates: Partial<Pick<Repository, 'name' | 'type' | 'path' | 'metadata'>>,
  projectRoot?: string
): void {
  if (updates.path) validatePath(updates.path)

  const setClauses: string[] = []
  const params: Record<string, unknown> = {}
  params['hash'] = hash

  if (updates.name !== undefined) {
    setClauses.push('name = @name')
    params['name'] = updates.name
  }
  if (updates.type !== undefined) {
    setClauses.push('type = @type')
    params['type'] = updates.type
  }
  if (updates.path !== undefined) {
    setClauses.push('path = @path')
    params['path'] = updates.path
  }
  if (updates.metadata !== undefined) {
    setClauses.push('metadata = @metadata')
    params['metadata'] = JSON.stringify(updates.metadata)
  }

  if (setClauses.length === 0) return

  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const sql = `UPDATE repositories SET ${setClauses.join(', ')} WHERE hash = @hash`
  db.prepare(sql).run(params)
  logger.debug(`Updated repository hash=${hash}`)
}

/** Delete a repository by hash. No-op if the hash does not exist. */
export function deleteRepository(
  hash: string,
  projectRoot?: string
): void {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  db.prepare(DELETE_SQL).run(hash)
  logger.debug(`Deleted repository hash=${hash}`)
}
