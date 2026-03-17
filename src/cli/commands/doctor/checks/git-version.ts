/**
 * Git version check
 *
 * pass: Git >= 2.0.0
 * fail: Git not found or version < 2.0.0
 */

import { spawnSync } from 'node:child_process'
import type { DoctorCheckResult } from '../types.js'

function parseGitVersion(raw: string): [number, number, number] | null {
  const match = /git version (\d+)\.(\d+)\.(\d+)/.exec(raw.trim())
  if (!match) return null
  return [parseInt(match[1] ?? '0', 10), parseInt(match[2] ?? '0', 10), parseInt(match[3] ?? '0', 10)]
}

export function checkGitVersion(): DoctorCheckResult {
  const id = 'git_version'
  const label = 'Git version'

  const result = spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 3000 })

  if (result.error != null || result.status !== 0) {
    return {
      id,
      label,
      status: 'fail',
      detail: 'git binary not found or exited with error',
      fix: 'Install Git >= 2.0 from https://git-scm.com',
    }
  }

  const parsed = parseGitVersion(result.stdout)
  if (!parsed) {
    return {
      id,
      label,
      status: 'fail',
      detail: `Could not parse version from: ${result.stdout.trim()}`,
      fix: 'Install Git >= 2.0 from https://git-scm.com',
    }
  }

  const [major] = parsed

  if (major >= 2) {
    return {
      id,
      label,
      status: 'ok',
      detail: result.stdout.trim(),
      fix: null,
    }
  }

  return {
    id,
    label,
    status: 'fail',
    detail: `${result.stdout.trim()} — Git 2.0+ required`,
    fix: 'Upgrade Git from https://git-scm.com',
  }
}
