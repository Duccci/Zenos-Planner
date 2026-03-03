/**
 * Zeno Schema Initializer
 *
 * Applies the single canonical schema.sql to the database.
 * All statements use CREATE TABLE/INDEX IF NOT EXISTS, so this is fully
 * idempotent and safe to call against both fresh and existing databases.
 */

import Database from 'better-sqlite3'
import { DatabaseError } from '../utils/errors.js'
import { findProjectRoot } from '../utils/config.js'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

/**
 * Apply the canonical schema to the database.
 *
 * Reads schema.sql from the migrations directory and executes it.
 * Every statement uses CREATE TABLE/INDEX IF NOT EXISTS so the call is
 * fully idempotent — safe against both fresh and already-initialised DBs.
 *
 * @param db - Database instance
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns 1 on first apply (fresh DB), 0 if already initialised
 * @throws DatabaseError if schema.sql cannot be read or executed
 */
export async function runMigrations(
  db: Database.Database,
  projectRoot: string = process.cwd()
): Promise<number> {
  // Detect whether this is a fresh database before applying the schema
  const alreadyInitialised =
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='requirements'")
      .get() !== undefined

  const root = findProjectRoot(projectRoot) ?? projectRoot
  const schemaPath = join(root, 'src', 'storage', 'migrations', 'schema.sql')

  let sql: string
  try {
    sql = await readFile(schemaPath, 'utf-8')
  } catch (error) {
    throw new DatabaseError(
      'Failed to read schema.sql',
      'DB_MIGRATION_FAILED',
      { migrationFile: 'schema.sql', path: schemaPath },
      error instanceof Error ? error : undefined
    )
  }

  try {
    db.exec(sql)
  } catch (error) {
    throw new DatabaseError(
      'Failed to apply schema.sql',
      'DB_MIGRATION_FAILED',
      { migrationFile: 'schema.sql', path: schemaPath },
      error instanceof Error ? error : undefined
    )
  }

  // Return 1 on first apply (fresh DB), 0 if schema was already in place
  return alreadyInitialised ? 0 : 1
}
