/**
 * Zeno Project Versioning
 *
 * Project version is stored in zeno/.zeno/config.json as strict semver.
 *
 * Semver mapping:
 * - patch: completed proposals
 * - minor: completed gates (resets patch to 0)
 * - major: full Zeno lifecycle complete (resets minor+patch to 0)
 */

import { ValidationError } from './errors.js'

export interface Semver {
  major: number
  minor: number
  patch: number
}

export type VersionBump = 'patch' | 'minor' | 'major'

export function parseSemver(input: string): Semver {
  const trimmed = input.trim()
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(trimmed)
  if (!m) {
    throw new ValidationError(
      `Invalid version (expected major.minor.patch): ${input}`,
      'VALIDATION_VERSION_INVALID',
      { input }
    )
  }

  const major = Number(m[1])
  const minor = Number(m[2])
  const patch = Number(m[3])

  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    throw new ValidationError('Invalid version (non-integer parts)', 'VALIDATION_VERSION_INVALID', { input })
  }
  if (major < 0 || minor < 0 || patch < 0) {
    throw new ValidationError('Invalid version (negative parts)', 'VALIDATION_VERSION_INVALID', { input })
  }

  return { major, minor, patch }
}

export function formatSemver(v: Semver): string {
  return `${String(v.major)}.${String(v.minor)}.${String(v.patch)}`
}

export function bumpSemver(current: string, bump: VersionBump): string {
  const v = parseSemver(current)

  if (bump === 'patch') {
    return formatSemver({ ...v, patch: v.patch + 1 })
  }
  if (bump === 'minor') {
    return formatSemver({ ...v, minor: v.minor + 1, patch: 0 })
  }
  // major
  return formatSemver({ major: v.major + 1, minor: 0, patch: 0 })
}

