/**
 * Zeno Database Layer
 *
 * Provides SQLite database connection management, initialization, and schema validation.
 * Uses better-sqlite3 synchronous API for simplicity in CLI context.
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { ensureDir, normalizePath } from '../utils/file.js'
import { getWorkspaceRoot, getZenoDir } from '../utils/config.js'
import { DatabaseError } from '../utils/errors.js'

/** Database instance singleton */
let dbInstance: Database.Database | null = null
let dbProjectRoot: string | null = null

/** WAL checkpoint interval timer */
let walCheckpointInterval: NodeJS.Timeout | null = null

/** Database file name */
const DB_FILE = 'registry.db'

/**
 * Get the database file path.
 * @param projectRoot - Project root directory (default: active workspace root)
 * @returns Absolute path to database file
 */
export function getDatabasePath(projectRoot: string = getWorkspaceRoot()): string {
  return join(getZenoDir(projectRoot), DB_FILE)
}

/**
 * Get the database connection singleton.
 * Creates connection if it doesn't exist.
 * @param projectRoot - Project root directory (default: active workspace root)
 * @returns Database instance
 * @throws DatabaseError if connection fails
 */
export function getDatabase(projectRoot: string = getWorkspaceRoot()): Database.Database {
  const normalizedProjectRoot = normalizePath(projectRoot)
  if (dbInstance !== null && dbProjectRoot === normalizedProjectRoot) {
    return dbInstance
  }
  if (dbInstance !== null) closeDatabase()

  try {
    const dbPath = getDatabasePath(projectRoot)
    const zenoDir = getZenoDir(projectRoot)

    // Refuse to auto-create the .zeno directory.  Only the explicit init flow
    // (`initializeDatabase` / `createProjectStructure`) is allowed to create
    // it; other callers that hit a missing project must fail loudly so we do
    // not generate stray `.zeno/` directories in arbitrary working folders.
    if (!existsSync(zenoDir)) {
      throw new DatabaseError(
        `No Zeno project found at ${projectRoot} (expected ${zenoDir}). Run \`zeno init\` first.`,
        'DB_NOT_INITIALISED',
        { path: zenoDir }
      )
    }

    // Create database connection
    dbInstance = new Database(dbPath)
    dbProjectRoot = normalizedProjectRoot

    // Enable WAL mode for better concurrency
    dbInstance.pragma('journal_mode = WAL')

    // Enable foreign keys
    dbInstance.pragma('foreign_keys = ON')

    // Start periodic WAL checkpoint (every 60 seconds)
    startWalCheckpointInterval(60000)

    return dbInstance
  } catch (error) {
    if (error instanceof DatabaseError) throw error
    throw new DatabaseError(
      'Failed to connect to database',
      'DB_CONNECTION_FAILED',
      { path: getDatabasePath(projectRoot) },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Close the database connection.
 * @throws DatabaseError if close fails
 */
import { logger } from '../utils/logger.js'

/**
 * Start periodic WAL checkpoint interval.
 * Checkpoints the WAL file at regular intervals to prevent unbounded growth.
 * @param intervalMs - Checkpoint interval in milliseconds (default: 60000 = 60 seconds)
 */
export function startWalCheckpointInterval(intervalMs = 60000): void {
  // Clear any existing interval
  if (walCheckpointInterval !== null) {
    clearInterval(walCheckpointInterval)
  }

  walCheckpointInterval = setInterval(() => {
    try {
      if (dbInstance) {
        checkpointWAL(dbInstance)
      }
    } catch (err) {
      logger.debug('Periodic WAL checkpoint encountered error (non-blocking)', err)
    }
  }, intervalMs)

  // Allow process to exit even with active interval
  walCheckpointInterval.unref()

  logger.debug(`WAL checkpoint interval started: every ${String(intervalMs)}ms`)
}

/**
 * Stop the periodic WAL checkpoint interval.
 */
export function stopWalCheckpointInterval(): void {
  if (walCheckpointInterval !== null) {
    clearInterval(walCheckpointInterval)
    walCheckpointInterval = null
    logger.debug('WAL checkpoint interval stopped')
  }
}

export function checkpointWAL(db: Database.Database = getDatabase()): {
  status: 'ok' | 'blocked' | 'error'
  detail?: string
} {
  try {
    const stmt = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)')
    const res = stmt.get([]) as Record<string, unknown> | undefined

    logger.debug('WAL checkpoint executed', res ?? {})

    // If the PRAGMA returns an object with a numeric or string response, we consider it successful
    return { status: 'ok', detail: res ? JSON.stringify(res) : 'ok' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('WAL checkpoint failed or blocked', message)
    // We conservatively mark this as 'blocked' so callers can decide to retry later
    return { status: 'blocked', detail: message }
  }
}

export function closeDatabase(): void {
  // Stop periodic checkpoint interval
  stopWalCheckpointInterval()

  if (dbInstance !== null) {
    try {
      // Attempt a WAL checkpoint before closing to avoid WAL accumulation
      try {
        const checkpoint = checkpointWAL(dbInstance)
        logger.debug('Checkpoint result before close', checkpoint)
      } catch (cpErr) {
        logger.warn(
          'Failed to run WAL checkpoint before close',
          cpErr instanceof Error ? cpErr.message : cpErr
        )
      }

      dbInstance.close()
      dbInstance = null
      dbProjectRoot = null
    } catch (error) {
      throw new DatabaseError(
        'Failed to close database',
        'DB_CLOSE_FAILED',
        {},
        error instanceof Error ? error : undefined
      )
    }
  }
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  valid: boolean
  missingTables: string[]
  errors: string[]
}

/**
 * Required tables for schema validation
 *
 * Final Database Schema (Minimalist Design):
 * - requirements: Hierarchical requirements with parent-child relationships
 * - repositories: Multi-repo support for large-scale projects
 * - proposals: Proposal metadata with hash-based lookup (operational efficiency)
 *
 * NOT IN DATABASE (file-based per Technical Decision 4):
 * - gates: Stored in project.json (version-controlled, single source of truth)
 * - dependency_map: Unified dependency tracking for gates, proposals, and requirements
 * - repo_dependencies: Stored in project.json (version-controlled, single source of truth)
 * - approval_events: Tracked via proposal markdown metadata and status fields
 * - metrics_snapshots: Recomputable from git tags and codebase analysis on demand
 */
const REQUIRED_TABLES = ['requirements', 'repositories', 'proposals']

/**
 * Validate that all required tables exist in the database.
 * @param db - Database instance (default: getDatabase())
 * @returns Validation result
 */
export function validateSchema(db: Database.Database = getDatabase()): SchemaValidationResult {
  const requiredTables = REQUIRED_TABLES

  const missingTables: string[] = []
  const errors: string[] = []

  for (const table of requiredTables) {
    try {
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table) as { name: string } | undefined

      if (!result) {
        missingTables.push(table)
      }
    } catch (error) {
      errors.push(
        `Error checking table ${table}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return {
    valid: missingTables.length === 0 && errors.length === 0,
    missingTables,
    errors,
  }
}

/**
 * Database initialization result
 */
export interface DatabaseInitResult {
  created: boolean
  migrationsApplied: number
  tablesCreated: number
}

/**
 * Initialize the database: create directory, database file, and run migrations.
 * @param projectRoot - Project root directory (default: active workspace root)
 * @param options - Configuration options
 * @param options.syncProposals - Sync proposal files from disk (default: false)
 * @param options.syncRequirements - Restore requirements from version-controlled manifest (default: false)
 * @param options.syncGates - Restore gate rows from gate markdown frontmatter (default: false)
 * @returns Initialization result
 * @throws DatabaseError if initialization fails
 */
export async function initializeDatabase(
  projectRoot: string = getWorkspaceRoot(),
  options: { syncProposals?: boolean; syncRequirements?: boolean; syncGates?: boolean } = {}
): Promise<DatabaseInitResult> {
  try {
    // Ensure .zeno directory exists
    await ensureDir(getZenoDir(projectRoot))

    // Get database connection (creates file if missing)
    const db = getDatabase(projectRoot)

    // Run migrations
    const { runMigrations } = await import('./migrations.js')
    const migrationsApplied = await runMigrations(db, projectRoot)

    // Validate schema
    const validation = validateSchema(db)

    if (!validation.valid) {
      throw new DatabaseError(
        'Schema validation failed after migrations',
        'DB_SCHEMA_VALIDATION_FAILED',
        { missingTables: validation.missingTables, errors: validation.errors }
      )
    }

    // Check if database was just created
    const tableCount = db
      .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")
      .get() as { count: number }

    // Sync gate files from disk before proposals so FK constraints are satisfied.
    // Gates must exist in the DB before proposals that reference them via gate_id.
    if (options.syncGates) {
      try {
        const { syncGatesFromDisk } = await import('./gate-sync.js')
        syncGatesFromDisk(db, projectRoot)
      } catch {
        // Non-fatal: zeno/gates/ may not exist yet on a fresh project
      }
    }

    // Sync proposal files from disk if requested.
    // Only run in production contexts (CLI, MCP, init, completions).
    // Skipped during tests to prevent side effects on workspace.
    if (options.syncProposals) {
      try {
        const { syncProposalsFromDisk } = await import('./proposal-sync.js')
        syncProposalsFromDisk(db, projectRoot)
      } catch {
        // Non-fatal: proposals dir may not exist yet on a fresh project
      }
    }

    // Restore requirements from the version-controlled manifest if requested.
    // Recovers project-level and solitary-proposal requirements whose only other
    // persistence path (the DB) was wiped or has not yet been populated.
    if (options.syncRequirements) {
      try {
        const { syncRequirementsFromDisk } = await import('./requirements-sync.js')
        syncRequirementsFromDisk(db, projectRoot)
      } catch (error) {
        logger.warn(
          `Failed to sync requirements: ${error instanceof Error ? error.message : String(error)}`
        )
        // Non-fatal: manifest may not exist yet on a fresh project
      }
    }

    // Sync requirements parsed from gate markdown files.
    // Runs after gates and manifest sync so that gate rows exist (for FK) and
    // manifest requirements are already present (INSERT OR IGNORE avoids dupes).
    if (options.syncRequirements && options.syncGates) {
      try {
        const { syncGateRequirementsFromMarkdown } = await import('../integration/requirements-registry.js')
        const { RequirementStorage } = await import('../generation/requirement-storage.js')
        const storage = new RequirementStorage(db)
        // Only sync requirements for gates whose PRD markdown has been generated.
        // Planned/pending gates (prd_generated_at IS NULL) have no file on disk yet;
        // calling syncGateRequirementsFromMarkdown for them produces a spurious WARN.
        const gateRows = db.prepare('SELECT id FROM gates WHERE prd_generated_at IS NOT NULL').all() as { id: string }[]
        for (const row of gateRows) {
          syncGateRequirementsFromMarkdown(storage, row.id, projectRoot)
        }
      } catch {
        // Non-fatal: gate files may not contain parseable requirements
      }
    }

    return {
      created: tableCount.count === 0 || migrationsApplied > 0,
      migrationsApplied,
      tablesCreated: validation.missingTables.length === 0 ? REQUIRED_TABLES.length : 0,
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    throw new DatabaseError(
      'Failed to initialize database',
      'DB_INIT_FAILED',
      { projectRoot },
      error instanceof Error ? error : undefined
    )
  }
}
