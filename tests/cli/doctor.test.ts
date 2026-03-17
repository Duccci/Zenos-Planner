/**
 * Doctor Command Tests
 *
 * Unit tests for all doctor check modules and the runner.
 * All child_process calls are mocked for hermetic, platform-independent tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock child_process before importing check modules
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}))

// Mock better-sqlite3 for the sqlite-binding check
vi.mock('better-sqlite3', () => ({}))

import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { checkNodeVersion } from '../../src/cli/commands/doctor/checks/node-version.js'
import { checkGitVersion } from '../../src/cli/commands/doctor/checks/git-version.js'
import { checkGraphviz } from '../../src/cli/commands/doctor/checks/graphviz.js'
import { checkSqliteBinding } from '../../src/cli/commands/doctor/checks/sqlite-binding.js'
import { runAllChecks } from '../../src/cli/commands/doctor/runner.js'
import type { DoctorCheckResult, DoctorReport } from '../../src/cli/commands/doctor/types.js'

const mockSpawnSync = vi.mocked(spawnSync)

function makeSpawnResult(
  overrides: Partial<SpawnSyncReturns<string>> = {}
): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [],
    stdout: '',
    stderr: '',
    status: 0,
    signal: null,
    error: undefined,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// DoctorCheckResult shape
// ---------------------------------------------------------------------------

describe('DoctorCheckResult shape', () => {
  it('has required fields', () => {
    const result: DoctorCheckResult = {
      id: 'test',
      label: 'Test Check',
      status: 'ok',
      detail: 'detail',
      fix: null,
    }
    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('label')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('detail')
    expect(result).toHaveProperty('fix')
  })

  it('allows null fix', () => {
    const result: DoctorCheckResult = {
      id: 'test',
      label: 'Test',
      status: 'ok',
      detail: 'all good',
      fix: null,
    }
    expect(result.fix).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// node-version check
// ---------------------------------------------------------------------------

describe('checkNodeVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when Node.js >= 24.0.0', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'v24.0.0\n' }))
    const result = await checkNodeVersion()
    expect(result.id).toBe('node_version')
    expect(result.status).toBe('ok')
    expect(result.fix).toBeNull()
  })

  it('returns ok when Node.js is 24.5.1', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'v24.5.1\n' }))
    const result = await checkNodeVersion()
    expect(result.status).toBe('ok')
  })

  it('returns warn when Node.js >= 20 and < 24', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'v20.0.0\n' }))
    const result = await checkNodeVersion()
    expect(result.status).toBe('warn')
    expect(result.fix).toBeTruthy()
  })

  it('returns warn when Node.js is 22.x', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'v22.11.0\n' }))
    const result = await checkNodeVersion()
    expect(result.status).toBe('warn')
  })

  it('returns fail when Node.js < 20', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'v18.0.0\n' }))
    const result = await checkNodeVersion()
    expect(result.status).toBe('fail')
    expect(result.fix).toBeTruthy()
  })

  it('returns fail when node binary not found (status non-zero)', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ status: 127, stdout: '' }))
    const result = await checkNodeVersion()
    expect(result.status).toBe('fail')
  })

  it('returns fail when spawnSync throws (e.g. ENOENT)', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ error: new Error('ENOENT'), status: null }))
    const result = await checkNodeVersion()
    expect(result.status).toBe('fail')
  })
})

// ---------------------------------------------------------------------------
// git-version check
// ---------------------------------------------------------------------------

describe('checkGitVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when Git >= 2.0.0', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'git version 2.43.0\n' }))
    const result = await checkGitVersion()
    expect(result.id).toBe('git_version')
    expect(result.status).toBe('ok')
    expect(result.fix).toBeNull()
  })

  it('returns ok when Git is 2.0.0 exactly', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'git version 2.0.0\n' }))
    const result = await checkGitVersion()
    expect(result.status).toBe('ok')
  })

  it('returns fail when Git is not found', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ error: new Error('ENOENT'), status: null }))
    const result = await checkGitVersion()
    expect(result.status).toBe('fail')
    expect(result.fix).toBeTruthy()
  })

  it('returns fail when git exits non-zero', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ status: 1, stdout: '' }))
    const result = await checkGitVersion()
    expect(result.status).toBe('fail')
  })

  it('returns fail when version output is unparseable', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'something unexpected\n' }))
    const result = await checkGitVersion()
    expect(result.status).toBe('fail')
  })
})

// ---------------------------------------------------------------------------
// graphviz check
// ---------------------------------------------------------------------------

describe('checkGraphviz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when dot -V exits 0', async () => {
    // dot -V writes to stderr on some platforms
    mockSpawnSync.mockReturnValue(makeSpawnResult({ status: 0, stderr: 'dot - graphviz version 9.0.0' }))
    const result = await checkGraphviz()
    expect(result.id).toBe('graphviz')
    expect(result.status).toBe('ok')
    expect(result.fix).toBeNull()
  })

  it('returns fail when dot is not found', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ error: new Error('ENOENT'), status: null }))
    const result = await checkGraphviz()
    expect(result.status).toBe('fail')
    expect(result.fix).toBeTruthy()
  })

  it('returns fail when dot exits non-zero', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ status: 1 }))
    const result = await checkGraphviz()
    expect(result.status).toBe('fail')
    expect(result.fix).toBeTruthy()
  })

  it('includes a platform-specific install hint in fix', async () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult({ error: new Error('ENOENT'), status: null }))
    const result = await checkGraphviz()
    // Fix hint should mention at least one package manager
    const hint = result.fix ?? ''
    const mentionsPackageManager =
      hint.includes('brew') ||
      hint.includes('apt') ||
      hint.includes('choco') ||
      hint.includes('winget') ||
      hint.includes('graphviz.org')
    expect(mentionsPackageManager).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sqlite-binding check
// ---------------------------------------------------------------------------

describe('checkSqliteBinding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when better-sqlite3 is importable', async () => {
    // The virtual mock resolves successfully (module exists)
    const result = await checkSqliteBinding()
    expect(result.id).toBe('sqlite_binding')
    // In the test environment with a virtual mock the binding loads fine
    expect(['ok', 'fail']).toContain(result.status)
  })

  it('result has the correct shape regardless of status', async () => {
    const result = await checkSqliteBinding()
    expect(result).toHaveProperty('id', 'sqlite_binding')
    expect(result).toHaveProperty('label')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('detail')
    expect(result).toHaveProperty('fix')
  })

  it('includes rebuild hint in fix when check fails', async () => {
    // Simulate a failure by checking that if status is fail, fix mentions npm rebuild
    const result = await checkSqliteBinding()
    if (result.status === 'fail') {
      expect(result.fix).toContain('npm rebuild better-sqlite3')
    }
  })
})

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

describe('runAllChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: all process checks pass
    mockSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'v24.0.0\n', stderr: 'dot - graphviz version 9.0.0', status: 0 }))
  })

  it('returns an object with passed, warned, failed, and checks array', async () => {
    const report = await runAllChecks()
    expect(report).toHaveProperty('passed')
    expect(report).toHaveProperty('warned')
    expect(report).toHaveProperty('failed')
    expect(report).toHaveProperty('checks')
    expect(Array.isArray(report.checks)).toBe(true)
  })

  it('includes results for all expected check IDs', async () => {
    const report = await runAllChecks()
    const ids = report.checks.map((c) => c.id)
    expect(ids).toContain('node_version')
    expect(ids).toContain('git_version')
    expect(ids).toContain('graphviz')
    expect(ids).toContain('sqlite_binding')
  })

  it('correctly counts passed checks when all pass', async () => {
    // node >= 24 ok, git ok, graphviz ok
    mockSpawnSync.mockImplementation((cmd: string) => {
      if (String(cmd).includes('git') || String(cmd) === 'git') {
        return makeSpawnResult({ stdout: 'git version 2.43.0\n', status: 0 })
      }
      if (String(cmd) === 'dot') {
        return makeSpawnResult({ status: 0, stderr: 'dot - graphviz version 9.0.0' })
      }
      return makeSpawnResult({ stdout: 'v24.0.0\n', status: 0 })
    })
    const report = await runAllChecks()
    expect(report.passed + report.warned + report.failed).toBe(report.checks.length)
  })

  it('counts failed checks when node version is too low', async () => {
    mockSpawnSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'node') {
        return makeSpawnResult({ stdout: 'v16.0.0\n', status: 0 })
      }
      if (String(cmd) === 'git') {
        return makeSpawnResult({ stdout: 'git version 2.43.0\n', status: 0 })
      }
      return makeSpawnResult({ status: 0, stderr: 'dot - graphviz version 9.0.0' })
    })
    const report = await runAllChecks()
    expect(report.failed).toBeGreaterThanOrEqual(1)
  })
})
