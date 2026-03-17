/**
 * Node.js version check
 *
 * pass: Node.js >= 24.0.0
 * warn: Node.js >= 20.0.0 and < 24.0.0
 * fail: Node.js < 20.0.0 or not found
 */

import { spawnSync } from 'node:child_process'
import type { DoctorCheckResult } from '../types.js'

/** Parse a semver tuple [major, minor, patch] from a version string like "v24.5.1" */
function parseSemver(raw: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(raw.trim())
  if (!match) return null
  return [parseInt(match[1] ?? '0', 10), parseInt(match[2] ?? '0', 10), parseInt(match[3] ?? '0', 10)]
}

export function checkNodeVersion(): DoctorCheckResult {
  const id = 'node_version'
  const label = 'Node.js version'

  const result = spawnSync('node', ['--version'], { encoding: 'utf8', timeout: 3000 })

  if (result.error != null || result.status !== 0) {
    return {
      id,
      label,
      status: 'fail',
      detail: 'node binary not found or exited with error',
      fix: 'Install Node.js >= 24 from https://nodejs.org',
    }
  }

  const parsed = parseSemver(result.stdout)
  if (!parsed) {
    return {
      id,
      label,
      status: 'fail',
      detail: `Could not parse version from: ${result.stdout.trim()}`,
      fix: 'Install Node.js >= 24 from https://nodejs.org',
    }
  }

  const [major] = parsed

  if (major >= 24) {
    return {
      id,
      label,
      status: 'ok',
      detail: `Node.js ${result.stdout.trim()} (>= 24 required)`,
      fix: null,
    }
  }

  if (major >= 20) {
    return {
      id,
      label,
      status: 'warn',
      detail: `Node.js ${result.stdout.trim()} — works but Node.js 24+ is recommended`,
      fix: 'Upgrade to Node.js >= 24 from https://nodejs.org or via nvm: nvm install 24',
    }
  }

  return {
    id,
    label,
    status: 'fail',
    detail: `Node.js ${result.stdout.trim()} — minimum supported version is 20 (24 recommended)`,
    fix: 'Upgrade to Node.js >= 24 from https://nodejs.org or via nvm: nvm install 24',
  }
}
