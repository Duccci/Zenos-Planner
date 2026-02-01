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
export function closeDatabase(): void {
  if (dbInstance !== null) {
    try {
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

/** Required tables for schema validation */
const REQUIRED_TABLES = [
  'gates',
  'repositories',
  'requirements',
]

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
      errors.push(`Error checking table ${table}: ${error instanceof Error ? error.message : String(error)}`)
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
      tablesCreated: validation.missingTables.length === 0 ? REQUIRED_TABLES.length - 1 : 0, // -1 for migrations table
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

