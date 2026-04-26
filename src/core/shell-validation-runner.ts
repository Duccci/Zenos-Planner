/**
 * Shell-based validation runner for quality checks.
 *
 * Spawns quality-check processes and aggregates results into a structured ValidationReport.
 * The set of checks to run is determined by either:
 *   1. An explicit list passed at construction time (from config.json `validation.checks`), or
 *   2. Auto-detection from project marker files (package.json → Node/TS tools,
 *      pyproject.toml → Python tools, Cargo.toml → Rust tools, go.mod → Go tools,
 *      CMakeLists.txt → C++ tools).
 *
 * Each tool runs independently; if a tool is not found (ENOENT),
 * the check is marked as failed without throwing.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile as fsReadFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CheckConfig, CheckResult, ValidationReport } from '../types/validation-runner.js'
import { getWorkspaceRoot } from '../utils/config.js'

/** Marker-file → default checks mapping for each supported stack. */
const STACK_CHECKS: {
  markers: string[]
  checks: readonly (CheckConfig | { tool: 'c8'; command: ''; args: [] })[]
}[] = [
  {
    markers: ['package.json'],
    checks: [
      { tool: 'eslint', command: 'eslint', args: ['src', '--max-warnings', '0', '--format', 'json'] },
      { tool: 'tsc', command: 'tsc', args: ['--strict', '--noEmit'] },
      { tool: 'vitest', command: 'vitest', args: ['run', '--coverage', '--coverage.reporter=json-summary'] },
      { tool: 'c8', command: '', args: [] }, // special: reads coverage-summary.json
      { tool: 'npm-audit', command: 'npm', args: ['audit', '--json'] },
    ],
  },
  {
    markers: ['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt'],
    checks: [
      { tool: 'pytest', command: 'pytest', args: ['--tb=short'] },
      { tool: 'mypy', command: 'mypy', args: ['.', '--ignore-missing-imports'] },
      { tool: 'ruff', command: 'ruff', args: ['check', '.'] },
      { tool: 'pip-audit', command: 'pip-audit', args: [] },
    ],
  },
  {
    markers: ['Cargo.toml'],
    checks: [
      { tool: 'cargo-test', command: 'cargo', args: ['test'] },
      { tool: 'cargo-clippy', command: 'cargo', args: ['clippy', '--', '-D', 'warnings'] },
      { tool: 'cargo-audit', command: 'cargo', args: ['audit'] },
    ],
  },
  {
    markers: ['go.mod'],
    checks: [
      { tool: 'go-test', command: 'go', args: ['test', './...'] },
      { tool: 'go-vet', command: 'go', args: ['vet', './...'] },
    ],
  },
  {
    markers: ['CMakeLists.txt'],
    checks: [
      { tool: 'ctest', command: 'ctest', args: ['--test-dir', '.', '--output-on-failure'] },
    ],
  },
]

export class ShellValidationRunner {
  private projectRoot: string
  private configChecks: CheckConfig[] | undefined

  constructor(projectRoot?: string, configChecks?: CheckConfig[]) {
    this.projectRoot = projectRoot ?? getWorkspaceRoot()
    this.configChecks = configChecks
  }

  /**
   * Run quality checks and return aggregated report.
   *
   * Uses config-provided checks when available; otherwise auto-detects
   * the project stack from marker files and selects applicable tools.
   * Returns passed=true with empty results when no applicable tools are found.
   */
  async run(): Promise<ValidationReport> {
    const checks = this.configChecks?.length ? this.configChecks : this.detectChecks()
    const results: CheckResult[] = []

    for (const check of checks) {
      if (check.tool === 'c8') {
        results.push(await this.runC8())
      } else {
        results.push(await this.runTool(check.command, check.args, check.tool))
      }
    }

    return {
      results,
      passed: results.length === 0 || results.every((r) => r.passed),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Detect applicable quality checks by probing for stack marker files.
   * Returns checks for every detected stack (projects can use multiple stacks).
   */
  detectChecks(): CheckConfig[] {
    const checks: CheckConfig[] = []

    for (const stack of STACK_CHECKS) {
      const detected = stack.markers.some((marker) =>
        existsSync(join(this.projectRoot, marker))
      )
      if (detected) {
        for (const check of stack.checks) {
          checks.push({ tool: check.tool, command: check.command, args: [...check.args] })
        }
      }
    }

    return checks
  }

  /**
   * Run ESLint to check for linting errors.
   */
  async runEslint(): Promise<CheckResult> {
    return this.runTool('eslint', ['src', '--max-warnings', '0', '--format', 'json'], 'eslint')
  }

  /**
   * Run TypeScript compiler in strict mode (no emit, just type check).
   */
  async runTsc(): Promise<CheckResult> {
    return this.runTool('tsc', ['--strict', '--noEmit'], 'tsc')
  }

  /**
   * Run Vitest with coverage to collect test results.
   */
  async runVitest(): Promise<CheckResult> {
    return this.runTool(
      'vitest',
      ['run', '--coverage', '--coverage.reporter=json-summary'],
      'vitest'
    )
  }

  /**
   * Run c8 coverage (typically as part of vitest, but also independently measurable).
   * This reads the coverage summary JSON that vitest generates.
   */
  async runC8(): Promise<CheckResult> {
    const startTime = Date.now()
    const tool = 'c8'

    try {
      // Try to read the coverage-summary.json that vitest generates
      const coveragePath = join(this.projectRoot, 'coverage', 'coverage-summary.json')
      await fsReadFile(coveragePath, 'utf8')

      // If file is readable, c8 check passes (vitest handles the actual run)
      return {
        tool,
        exitCode: 0,
        stdout: `Coverage summary read from ${coveragePath}`,
        stderr: '',
        durationMs: Date.now() - startTime,
        passed: true,
      }
    } catch {
      // Coverage file not found or parse error; treat as informational warning
      return {
        tool,
        exitCode: 1,
        stdout: '',
        stderr: 'Coverage summary not found. Run vitest with coverage first.',
        durationMs: Date.now() - startTime,
        passed: false,
      }
    }
  }

  /**
   * Run npm audit to check for security vulnerabilities.
   */
  async runNpmAudit(): Promise<CheckResult> {
    return this.runTool('npm', ['audit', '--json'], 'npm-audit')
  }

  /**
   * Generic tool runner using spawn.
   * Accumulates stdout/stderr and resolves on close.
   * Does not throw; instead marks result.passed = false on ENOENT or non-zero exit.
   */
  private runTool(command: string, args: string[], toolName: string): Promise<CheckResult> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      let stdout = ''
      let stderr = ''

      try {
        const resolvedCommand =
          process.platform === 'win32' ? `${command}.cmd` : command
        const proc = spawn(resolvedCommand, args, {
          cwd: this.projectRoot,
          timeout: 30000, // 30 second timeout per tool
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        })

        // Accumulate stdout
        proc.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8')
        })

        // Accumulate stderr
        proc.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8')
        })

        // Handle process completion
        proc.on('close', (code: number | null) => {
          const exitCode = code ?? 1
          resolve({
            tool: toolName,
            exitCode,
            stdout,
            stderr,
            durationMs: Date.now() - startTime,
            passed: exitCode === 0,
          })
        })

        // Handle spawn errors (e.g., command not found)
        proc.on('error', (error: Error) => {
          resolve({
            tool: toolName,
            exitCode: 1,
            stdout: '',
            stderr: error.message,
            durationMs: Date.now() - startTime,
            passed: false,
          })
        })
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error)
        resolve({
          tool: toolName,
          exitCode: 1,
          stdout: '',
          stderr: err,
          durationMs: Date.now() - startTime,
          passed: false,
        })
      }
    })
  }
}
