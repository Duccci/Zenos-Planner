/**
 * Graphviz check
 *
 * pass: `dot -V` exits 0
 * fail: dot binary not found or exits non-zero
 *
 * Provides platform-specific install hints for macOS, Linux, and Windows.
 */

import { spawnSync } from 'node:child_process'
import type { DoctorCheckResult } from '../types.js'

function platformInstallHint(): string {
  switch (process.platform) {
    case 'darwin':
      return 'Install Graphviz via Homebrew: brew install graphviz'
    case 'linux':
      return 'Install Graphviz: sudo apt install graphviz  (Debian/Ubuntu)  or  sudo dnf install graphviz  (Fedora/RHEL)'
    case 'win32':
      return 'Install Graphviz via winget: winget install graphviz  or  choco install graphviz  — see https://graphviz.org/download/'
    default:
      return 'Install Graphviz from https://graphviz.org/download/'
  }
}

export function checkGraphviz(): DoctorCheckResult {
  const id = 'graphviz'
  const label = 'Graphviz (dot binary)'

  const result = spawnSync('dot', ['-V'], { encoding: 'utf8', timeout: 3000 })

  if (result.error != null || result.status !== 0) {
    return {
      id,
      label,
      status: 'fail',
      detail: 'dot binary not found or exited with error (required for architecture diagram generation)',
      fix: platformInstallHint(),
    }
  }

  const version = (result.stderr || result.stdout).trim()
  return {
    id,
    label,
    status: 'ok',
    detail: version || 'dot binary found',
    fix: null,
  }
}
