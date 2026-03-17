/**
 * Doctor Command
 *
 * Audits the local environment for all prerequisites required by Zeno's Planner:
 *   - Node.js version  (R-10)
 *   - Git version      (R-10)
 *   - Graphviz binary  (R-02)
 *   - better-sqlite3 native binding (R-03)
 *
 * Usage:
 *   zeno doctor           # renders a formatted table
 *   zeno doctor --json    # outputs raw JSON for scripting/CI
 */

import type { Command } from 'commander'
import chalk from 'chalk'
import { runAllChecks } from './doctor/runner.js'
import type { DoctorCheckResult, DoctorCheckStatus } from './doctor/types.js'

function statusSymbol(status: DoctorCheckStatus): string {
  switch (status) {
    case 'ok':
      return chalk.green('✔')
    case 'warn':
      return chalk.yellow('⚠')
    case 'fail':
      return chalk.red('✖')
  }
}

function renderTable(checks: DoctorCheckResult[]): void {
  const COL_CHECK = 28
  const COL_STATUS = 8
  const COL_DETAIL = 55
  const COL_FIX = 55

  const header = [
    'Check'.padEnd(COL_CHECK),
    'Status'.padEnd(COL_STATUS),
    'Detail'.padEnd(COL_DETAIL),
    'Fix',
  ].join('  ')

  console.log(chalk.bold(header))
  console.log('─'.repeat(COL_CHECK + COL_STATUS + COL_DETAIL + COL_FIX + 6))

  for (const check of checks) {
    const symbol = statusSymbol(check.status)
    const label = check.label.padEnd(COL_CHECK)
    const status = (symbol + ' ' + check.status).padEnd(COL_STATUS + 2)
    const detail = check.detail.slice(0, COL_DETAIL).padEnd(COL_DETAIL)
    const fix = check.fix?.split('\n')[0] ?? ''
    console.log(`${label}  ${status}  ${detail}  ${fix}`)
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description(
      'Audit local environment prerequisites (Node.js, Git, Graphviz, better-sqlite3) — addresses R-02/R-03/R-10 setup requirements'
    )
    .option('--json', 'output raw JSON for scripting/CI use')
    .action(async (options: { json?: boolean }) => {
      const report = await runAllChecks()

      if (options.json) {
        console.log(JSON.stringify(report, null, 2))
        process.exit(report.failed > 0 ? 1 : 0)
        return
      }

      console.log()
      console.log(chalk.bold("Zeno's Planner — Environment Diagnostics"))
      console.log()

      renderTable(report.checks)

      console.log()
      console.log(
        [
          chalk.green(`${report.passed.toString()} passed`),
          chalk.yellow(`${report.warned.toString()} warned`),
          chalk.red(`${report.failed.toString()} failed`),
        ].join('  ')
      )
      console.log()

      if (report.failed > 0) {
        console.error(chalk.red('One or more required checks failed. Fix the issues above before proceeding.'))
        process.exit(1)
      }
    })
}
