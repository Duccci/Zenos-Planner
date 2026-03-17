/**
 * better-sqlite3 native binding check
 *
 * Attempts a dynamic require of better-sqlite3.
 * Reports compile errors with a rebuild hint.
 */

import type { DoctorCheckResult } from '../types.js'

export async function checkSqliteBinding(): Promise<DoctorCheckResult> {
  const id = 'sqlite_binding'
  const label = 'better-sqlite3 native binding'

  try {
    // Dynamic import to catch native binding failures at runtime
    await import('better-sqlite3')
    return {
      id,
      label,
      status: 'ok',
      detail: 'better-sqlite3 native binding loaded successfully',
      fix: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      id,
      label,
      status: 'fail',
      detail: `Failed to load better-sqlite3: ${message.split('\n')[0] ?? message}`,
      fix: 'Rebuild the native binding: npm rebuild better-sqlite3\nIf that fails, ensure your Node.js version matches the one used during npm install.',
    }
  }
}
