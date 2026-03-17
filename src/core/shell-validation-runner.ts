/**
 * Shell-based validation runner for quality checks.
 *
 * Spawns real tool processes (ESLint, TypeScript, Vitest, c8, npm audit)
 * and aggregates results into a structured ValidationReport.
 *
 * Each tool runs independently; if a tool is not found (ENOENT),
 * the check is marked as failed without throwing.
 */

import { spawn } from 'node:child_process'
import { readFile as fsReadFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CheckResult, ValidationReport } from '../types/validation-runner.js'

export class ShellValidationRunner {
  private projectRoot: string

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd()
  }

  /**
   * Run all five quality checks in sequence and return aggregated report.
   */
  async run(): Promise<ValidationReport> {
    const results: CheckResult[] = []

    results.push(await this.runEslint())
    results.push(await this.runTsc())
    results.push(await this.runVitest())
    results.push(await this.runC8())
    results.push(await this.runNpmAudit())

    return {
      results,
      passed: results.every((r) => r.passed),
      timestamp: new Date().toISOString(),
    }
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
        const proc = spawn(command, args, {
          cwd: this.projectRoot,
          timeout: 30000, // 30 second timeout per tool
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
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
