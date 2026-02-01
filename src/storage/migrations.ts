/**
 * Zeno Migration System
 *
 * File-based migration system that applies numbered SQL files in order.
 * Tracks applied migrations in a migrations table.
 */

import Database from 'better-sqlite3'
import { readFile } from '../utils/file.js'
import { DatabaseError } from '../utils/errors.js'
import { findProjectRoot } from '../utils/config.js'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'

/** Migration record */
export interface Migration {
  id: number
  name: string
  appliedAt: string
}

/**
 * Initialize the migrations table if it doesn't exist.
 * @param db - Database instance
 */
function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

/**
 * Get list of applied migrations.
 * @param db - Database instance
 * @returns Array of applied migrations
 */
export function getAppliedMigrations(db: Database.Database): Migration[] {
  ensureMigrationsTable(db)

  const rows = db.prepare('SELECT id, name, applied_at as appliedAt FROM migrations ORDER BY id').all() as {
    id: number
    name: string
    appliedAt: string
  }[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    appliedAt: row.appliedAt,
  }))
}

/**
 * Get list of migration files from the migrations directory.
 * @param projectRoot - Project root directory
 * @returns Array of migration file names sorted by ID
 */
async function getMigrationFiles(projectRoot: string): Promise<string[]> {
  // Resolve project root (use findProjectRoot when possible) so the migrations
  // directory is located correctly even if the current working directory is
  // not the repository root (e.g., background jobs or different spawn points).
  const projectRootResolved = findProjectRoot(projectRoot) ?? projectRoot
  const migrationsDir = join(projectRootResolved, 'src', 'storage', 'migrations')

  try {
    const files = await readdir(migrationsDir)
    const migrationFiles = files
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => {
        // Extract numeric prefix (e.g., "001_" from "001_initial_schema.sql")
        const aNum = parseInt(a.split('_')[0] ?? '0', 10)
        const bNum = parseInt(b.split('_')[0] ?? '0', 10)
        return aNum - bNum
      })

    return migrationFiles
  } catch (error) {
    throw new DatabaseError(
      'Failed to read migrations directory',
      'DB_MIGRATIONS_READ_FAILED',
      { path: migrationsDir },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Get migration status (applied vs pending).
 * @param db - Database instance
 * @param projectRoot - Project root directory
 * @returns Object with applied and pending migrations
 */
export async function getMigrationStatus(
  db: Database.Database,
  projectRoot: string = process.cwd()
): Promise<{ applied: Migration[]; pending: string[] }> {
  ensureMigrationsTable(db)

  const applied = getAppliedMigrations(db)
  const allFiles = await getMigrationFiles(projectRoot)

  const appliedNames = new Set(applied.map((m) => m.name))
  const pending = allFiles.filter((file) => !appliedNames.has(file))

  return { applied, pending }
}

/**
 * Apply a single migration file.
 * @param db - Database instance
 * @param migrationFile - Migration file name
 * @param projectRoot - Project root directory
 * @throws DatabaseError if migration fails
 */
async function applyMigration(
  db: Database.Database,
  migrationFile: string,
  projectRoot: string
): Promise<void> {
  const migrationsDir = join(projectRoot, 'src', 'storage', 'migrations')
  const migrationPath = join(migrationsDir, migrationFile)

  try {
    const sql = await readFile(migrationPath)

    // Run migration in transaction
    const transaction = db.transaction(() => {
      db.exec(sql)

      // Record migration
      const migrationId = parseInt(migrationFile.split('_')[0] ?? '0', 10)
      db.prepare('INSERT INTO migrations (id, name) VALUES (?, ?)').run(migrationId, migrationFile)
    })

    transaction()
  } catch (error) {
    throw new DatabaseError(
      `Failed to apply migration: ${migrationFile}`,
      'DB_MIGRATION_FAILED',
      { migrationFile, path: migrationPath },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Run all pending migrations.
 * @param db - Database instance
 * @param projectRoot - Project root directory
 * @returns Number of migrations applied
 * @throws DatabaseError if any migration fails
 */
export async function runMigrations(
  db: Database.Database,
  projectRoot: string = process.cwd()
): Promise<number> {
  ensureMigrationsTable(db)

  const status = await getMigrationStatus(db, projectRoot)

  if (status.pending.length === 0) {
    return 0
  }

  let appliedCount = 0

  for (const migrationFile of status.pending) {
    await applyMigration(db, migrationFile, projectRoot)
    appliedCount++
  }

  return appliedCount
}

