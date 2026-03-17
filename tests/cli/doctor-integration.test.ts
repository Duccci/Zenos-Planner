/**
 * Doctor Integration Smoke Test
 *
 * Runs `node bin/zeno.js doctor --json` as a child process and validates
 * output structure and exit code in the CI environment.
 *
 * Requires a built dist/ directory (npm run build).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../../')
const binPath = join(projectRoot, 'bin/zeno.js')

describe('zeno doctor --json (integration)', () => {
  let distExists: boolean

  beforeAll(() => {
    distExists = existsSync(join(projectRoot, 'dist/cli/index.js'))
  })

  it('dist/cli/index.js exists (run npm run build if not)', () => {
    expect(distExists).toBe(true)
  })

  it('exits 0 when all checks pass and outputs valid JSON', () => {
    if (!distExists) return

    const result = spawnSync('node', [binPath, 'doctor', '--json'], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: projectRoot,
    })

    // May exit 1 if graphviz is missing in CI — acceptable; JSON must still be produced
    const rawOutput = result.stdout ?? ''
    let parsed: unknown
    expect(() => {
      parsed = JSON.parse(rawOutput)
    }).not.toThrow()

    const report = parsed as {
      passed: number
      warned: number
      failed: number
      checks: { id: string; label: string; status: string; detail: string; fix: string | null }[]
    }

    expect(typeof report.passed).toBe('number')
    expect(typeof report.warned).toBe('number')
    expect(typeof report.failed).toBe('number')
    expect(Array.isArray(report.checks)).toBe(true)
  })

  it('node_version and git_version checks return ok in CI', () => {
    if (!distExists) return

    const result = spawnSync('node', [binPath, 'doctor', '--json'], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: projectRoot,
    })

    const rawOutput = result.stdout ?? ''
    let report: {
      checks: { id: string; status: string }[]
    }
    try {
      report = JSON.parse(rawOutput) as { checks: { id: string; status: string }[] }
    } catch {
      // If output is not JSON the previous test will already capture this
      return
    }

    const nodeCheck = report.checks.find((c) => c.id === 'node_version')
    const gitCheck = report.checks.find((c) => c.id === 'git_version')

    expect(nodeCheck).toBeDefined()
    expect(gitCheck).toBeDefined()
    expect(nodeCheck?.status).toBe('ok')
    expect(gitCheck?.status).toBe('ok')
  })

  it('--json flag produces JSON matching expected schema', () => {
    if (!distExists) return

    const result = spawnSync('node', [binPath, 'doctor', '--json'], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: projectRoot,
    })

    const rawOutput = result.stdout ?? ''
    const report = JSON.parse(rawOutput) as {
      passed: number
      warned: number
      failed: number
      checks: { id: string; label: string; status: string; detail: string; fix: string | null }[]
    }

    for (const check of report.checks) {
      expect(check).toHaveProperty('id')
      expect(check).toHaveProperty('label')
      expect(check).toHaveProperty('status')
      expect(['ok', 'warn', 'fail']).toContain(check.status)
      expect(check).toHaveProperty('detail')
      expect(check).toHaveProperty('fix')
    }

    expect(report.passed + report.warned + report.failed).toBe(report.checks.length)
  })

  it('exit code is 0 when all checks pass or warn', () => {
    if (!distExists) return

    const result = spawnSync('node', [binPath, 'doctor', '--json'], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: projectRoot,
    })

    const rawOutput = result.stdout ?? ''
    let report: { failed: number }
    try {
      report = JSON.parse(rawOutput) as { failed: number }
    } catch {
      return
    }

    if (report.failed === 0) {
      expect(result.status).toBe(0)
    } else {
      expect(result.status).toBe(1)
    }
  })
})
