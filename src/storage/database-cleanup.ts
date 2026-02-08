/**
 * Database cleanup and validation utilities
 */

import Database from 'better-sqlite3'
import { existsSync, unlinkSync } from 'node:fs'
import { logger } from '../utils/logger.js'
import { getDatabasePath } from './database.js'
import { DatabaseError } from '../utils/errors.js'

export interface CleanupResult {
  deleted: number
  files: string[]
}

/**
 * Remove stale WAL and SHM files for a given database path.
 * Will attempt a WAL checkpoint first; if database appears locked or checkpoint fails,
 * deletion is skipped and reported as blocked.
 */
export function cleanupStaleFiles(dbPath: string): CleanupResult {
  const wal = `${dbPath}-wal`
  const shm = `${dbPath}-shm`
  const toCheck = [wal, shm]
  const deleted: string[] = []

  try {
    // Attempt to open a temporary read-only connection and run a checkpoint
    // If the DB is currently used by another process, the checkpoint may fail or be blocked
    try {
      const db = new Database(dbPath, { readonly: true, fileMustExist: true })
      try {
        // Try a passive checkpoint first to avoid write contention
        db.pragma('wal_checkpoint(PASSIVE)')
      } finally {
        db.close()
      }
    } catch (err) {
      logger.warn(
        'Database appears to be in use; skipping deletion of WAL/SHM files',
        err instanceof Error ? err.message : err
      )
      // If files don't exist, nothing to delete - return zero
      const existing = toCheck.filter((p) => existsSync(p))
      return { deleted: 0, files: existing }
    }

    for (const f of toCheck) {
      if (existsSync(f)) {
        unlinkSync(f)
        deleted.push(f)
        logger.info(`Deleted stale database file: ${f}`)
      }
    }

    return { deleted: deleted.length, files: deleted }
  } catch (error) {
    throw new DatabaseError(
      'Failed during stale file cleanup',
      'DB_CLEANUP_FAILED',
      { dbPath },
      error instanceof Error ? error : undefined
    )
  }
}

export interface IntegrityResult {
  integrityOk: boolean
  integrityOutput: string[]
  foreignKeyViolations: Record<string, unknown>[]
}

/**
 * Run integrity checks: PRAGMA integrity_check and PRAGMA foreign_key_check
 */
export function validateDatabaseIntegrity(dbPath?: string): IntegrityResult {
  try {
    const path = dbPath ?? getDatabasePath()
    const db = new Database(path, { readonly: true, fileMustExist: true })

    try {
      // integrity_check returns a single column with rows; in better-sqlite3 we can use all()
      const integrityRows = db.prepare('PRAGMA integrity_check').all() as Record<string, string>[]
      const integrityOutput: string[] = []

      for (const row of integrityRows) {
        // Each row's first value contains the message (often 'ok')
        const val = Object.values(row)[0]
        integrityOutput.push(String(val))
      }

      const fkViolations = db.prepare('PRAGMA foreign_key_check').all() as Record<string, unknown>[]

      const integrityOk =
        integrityOutput.length === 1 && integrityOutput[0] === 'ok' && fkViolations.length === 0

      if (!integrityOk) {
        logger.warn('Database integrity issues found', { integrityOutput, fkViolations })
      } else {
        logger.info('Database integrity check passed')
      }

      return {
        integrityOk,
        integrityOutput,
        foreignKeyViolations: fkViolations,
      }
    } finally {
      db.close()
    }
  } catch (error) {
    throw new DatabaseError(
      'Failed during database integrity validation',
      'DB_VALIDATE_FAILED',
      {},
      error instanceof Error ? error : undefined
    )
  }
}

export function cleanupDefault(): CleanupResult {
  const path = getDatabasePath()
  return cleanupStaleFiles(path)
}
