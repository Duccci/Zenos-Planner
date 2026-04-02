/**
 * Doctor runner
 *
 * Aggregates all diagnostic checks and returns a structured report.
 */

import { checkNodeVersion } from './checks/node-version.js'
import { checkGitVersion } from './checks/git-version.js'
import { checkGraphviz } from './checks/graphviz.js'
import { checkSqliteBinding } from './checks/sqlite-binding.js'
import { checkTemplateDrift } from './checks/template-drift.js'
import type { DoctorReport } from './types.js'

export async function runAllChecks(): Promise<DoctorReport> {
  const checks = await Promise.all([
    Promise.resolve(checkNodeVersion()),
    Promise.resolve(checkGitVersion()),
    Promise.resolve(checkGraphviz()),
    checkSqliteBinding(),
    Promise.resolve(checkTemplateDrift()),
  ])

  let passed = 0
  let warned = 0
  let failed = 0

  for (const check of checks) {
    if (check.status === 'ok') passed++
    else if (check.status === 'warn') warned++
    else failed++
  }

  return { passed, warned, failed, checks }
}
