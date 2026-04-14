/**
 * sqlite-binding failure-path tests
 *
 * The top-level vi.mock in doctor.test.ts always makes better-sqlite3 succeed,
 * so the catch block (lines 25-26) — including the `err instanceof Error`
 * ternary — is never reached in that suite (0% branch coverage).
 *
 * This file uses vi.resetModules() + vi.doMock to load the function under test
 * with a fresh module registry, forcing the dynamic import to throw and
 * covering the catch block.
 *
 * Note: Vitest wraps factory-thrown values in its own Error wrapper, so the
 * `instanceof Error` branch is always true in this test context and
 * `err.message` (not `String(err)`) is always used. Tests assert on result
 * shape rather than the vitest-generated detail text.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('checkSqliteBinding catch block', () => {
  it('returns fail when import throws an Error — result has correct shape', async () => {
    vi.doMock('better-sqlite3', () => {
      throw new Error('native binding compilation failed')
    })
    const { checkSqliteBinding } = await import(
      '../../src/cli/commands/doctor/checks/sqlite-binding.js'
    )
    const result = await checkSqliteBinding()
    expect(result.id).toBe('sqlite_binding')
    expect(result.status).toBe('fail')
    expect(typeof result.detail).toBe('string')
    expect(result.detail.length).toBeGreaterThan(0)
    expect(result.fix).toContain('npm rebuild better-sqlite3')
  })

  it('returns fail when import throws a non-Error value — still has correct shape', async () => {
    vi.resetModules()
    vi.doMock('better-sqlite3', () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'MODULE_NOT_FOUND'
    })
    const { checkSqliteBinding } = await import(
      '../../src/cli/commands/doctor/checks/sqlite-binding.js'
    )
    const result = await checkSqliteBinding()
    expect(result.id).toBe('sqlite_binding')
    expect(result.status).toBe('fail')
    expect(typeof result.detail).toBe('string')
    expect(result.fix).toContain('npm rebuild better-sqlite3')
  })

  it('detail contains only a single line (no embedded newlines)', async () => {
    vi.resetModules()
    vi.doMock('better-sqlite3', () => {
      throw new Error('line one\nline two\nline three')
    })
    const { checkSqliteBinding } = await import(
      '../../src/cli/commands/doctor/checks/sqlite-binding.js'
    )
    const result = await checkSqliteBinding()
    // detail is formed with message.split('\n')[0], so no newlines in the value
    expect(result.detail).not.toContain('\n')
  })
})
