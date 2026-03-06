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
 * SQLite CHECK constraints cannot be altered in-place; changing them requires
 * a full table rebuild (the "12-step procedure" from the SQLite docs).
 *
 * This function detects whether the proposals table is missing `validated` from
 * its status CHECK constraint (the pre-gate-05 schema) and, if so, rebuilds the
 * table in a single transaction to add it.  All existing rows are preserved;
 * status values that were never valid (`cancelled`, `backlog`) are coerced to
 * their nearest canonical equivalents before the rename.
 */
function patchProposalStatusConstraint(db: Database.Database): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='proposals'")
    .get() as { sql: string } | undefined

  if (!row) return // table doesn't exist yet — schema.sql will create it correctly

  // If the current definition already includes 'validated' we're done.
  if (row.sql.includes("'validated'")) return

  db.transaction(() => {
    db.exec('PRAGMA foreign_keys = OFF')

    // 1. Recreate with the full, correct constraint list.
    db.exec(`
      CREATE TABLE proposals_v2 (
        id               TEXT      PRIMARY KEY,
        gate_id          TEXT      REFERENCES gates(id),
        requirement_id   TEXT      REFERENCES requirements(id),
        title            TEXT      NOT NULL,
        status           TEXT      NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'validated', 'approved', 'rejected', 'in_progress', 'completed')),
        hash             TEXT      UNIQUE NOT NULL,
        created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at      TIMESTAMP,
        started_by       TEXT,
        started_at       TIMESTAMP,
        approved_by      TEXT,
        rejected_by      TEXT,
        rejected_at      TIMESTAMP,
        implemented_at   TIMESTAMP
      )
    `)

    // 2. Copy all rows, coercing any stale status values that were never in the
    //    old constraint either (safety net for hand-edited files).
    db.exec(`
      INSERT INTO proposals_v2
        SELECT id, gate_id, requirement_id, title,
          CASE status
            WHEN 'cancelled' THEN 'rejected'
            WHEN 'backlog'   THEN 'pending'
            ELSE status
          END,
          hash, created_at, updated_at, approved_at,
          started_by, started_at, approved_by,
          rejected_by, rejected_at, implemented_at
        FROM proposals
    `)

    // 3. Swap tables.
    db.exec('DROP TABLE proposals')
    db.exec('ALTER TABLE proposals_v2 RENAME TO proposals')

    // 4. Recreate indexes (schema.sql uses IF NOT EXISTS so this is idempotent).
    db.exec('CREATE INDEX IF NOT EXISTS idx_proposals_hash        ON proposals(hash)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_proposals_gate_id     ON proposals(gate_id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_proposals_status      ON proposals(status)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_proposals_started_by  ON proposals(started_by)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_proposals_approved_by ON proposals(approved_by)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_proposals_rejected_by ON proposals(rejected_by)')

    db.exec('PRAGMA foreign_keys = ON')
  })()
}

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

  // Patch stale CHECK constraints that cannot be fixed by CREATE TABLE IF NOT EXISTS.
  // Must run before schema.sql so the table is in the correct shape when the
  // idempotent CREATE TABLE statements are evaluated.
  patchProposalStatusConstraint(db)

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
