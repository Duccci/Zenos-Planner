/**
 * Zeno Database Layer
 *
 * Provides SQLite database connection management, initialization, and schema validation.
 * Uses better-sqlite3 synchronous API for simplicity in CLI context.
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ensureDir } from '../utils/file.js'
import { getZenoDir } from '../utils/config.js'
import { DatabaseError } from '../utils/errors.js'

/** Database instance singleton */
let dbInstance: Database.Database | null = null

/** WAL checkpoint interval timer */
let walCheckpointInterval: NodeJS.Timeout | null = null

/** Database file name */
const DB_FILE = 'requirements.db'

/**
 * Get the database file path.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Absolute path to database file
 */
export function getDatabasePath(projectRoot: string = process.cwd()): string {
  return join(getZenoDir(projectRoot), DB_FILE)
}

/**
 * Get the database connection singleton.
 * Creates connection if it doesn't exist.
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Database instance
 * @throws DatabaseError if connection fails
 */
export function getDatabase(projectRoot: string = process.cwd()): Database.Database {
  if (dbInstance !== null) {
    return dbInstance
  }

  try {
    const dbPath = getDatabasePath(projectRoot)

    // Ensure directory exists
    mkdirSync(getZenoDir(projectRoot), { recursive: true })

    // Create database connection
    dbInstance = new Database(dbPath)

    // Enable WAL mode for better concurrency
    dbInstance.pragma('journal_mode = WAL')

    // Enable foreign keys
    dbInstance.pragma('foreign_keys = ON')

    // Start periodic WAL checkpoint (every 60 seconds)
    startWalCheckpointInterval(60000)

    return dbInstance
  } catch (error) {
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
export function startWalCheckpointInterval(intervalMs: number = 60000): void {
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

  logger.debug(`WAL checkpoint interval started: every ${intervalMs}ms`)
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
    // PRAGMA wal_checkpoint(TRUNCATE) will merge WAL into database and truncate the WAL file
    const res = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() as
      | Record<string, unknown>
      | undefined

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
 * Note: Gates and proposals are file-based per Technical Decision 1.
 * Only requirements table is validated as it's the sole database-backed entity.
 */
const REQUIRED_TABLES = ['requirements']

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
 * @param projectRoot - Project root directory (default: process.cwd())
 * @returns Initialization result
 * @throws DatabaseError if initialization fails
 */
export async function initializeDatabase(
  projectRoot: string = process.cwd()
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
