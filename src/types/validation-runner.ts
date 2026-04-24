/**
 * Validation runner types for shell-based quality checks.
 *
 * Defines the shape of results returned by quality-check tools.
 * Stack-specific tools (e.g. ESLint for Node, pytest for Python, cargo-test for Rust)
 * are detected at runtime from project marker files or configured in zeno/.zeno/config.json.
 */

/**
 * Configuration for a single quality check to run.
 *
 * @field tool - Identifier for the tool (e.g., "eslint", "pytest", "cargo-test")
 * @field command - Executable to spawn (e.g., "eslint", "pytest", "cargo")
 * @field args - Arguments to pass to the command
 */
export interface CheckConfig {
  tool: string
  command: string
  args: string[]
}

/**
 * Result of running a single quality-check tool.
 *
 * @field tool - Name of the quality tool (e.g., "eslint", "pytest", "cargo-test")
 * @field exitCode - Exit code from the spawned process
 * @field stdout - Captured standard output
 * @field stderr - Captured standard error
 * @field durationMs - Elapsed time in milliseconds
 * @field passed - True if tool succeeded (exit code 0)
 */
export interface CheckResult {
  tool: string
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  passed: boolean
}

/**
 * Aggregated validation report from all quality checks.
 *
 * @field results - Array of individual check results
 * @field passed - True if all checks passed
 * @field timestamp - ISO 8601 timestamp of the validation run
 */
export interface ValidationReport {
  results: CheckResult[]
  passed: boolean
  timestamp: string
}
