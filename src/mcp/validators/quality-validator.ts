/**
 * Quality Validator
 *
 * Validates quality metrics against the target project's configured thresholds.
 * Metrics must be provided by the target project's quality checks
 * (e.g., test coverage reports, linting output).
 *
 * Thresholds are loaded directly from the target project's zeno/.zeno/config.json
 * via projectRoot. An explicit `config` may be passed instead (e.g., in tests).
 * Zeno does NOT invoke quality checks; the target project is responsible
 * for running and reporting its own quality metrics.
 */

import {
  findProjectRoot,
  loadConfig,
  getDefaultConfig,
  getWorkspaceRoot,
  type ZenoConfig,
} from '../../utils/config.js'
import { logger } from '../../utils/logger.js'
import type { ValidationResult } from './types.js'
export type { ValidationResult }

export interface QualityMetrics {
  /** Code coverage percentage (0-100) */
  coverage?: number
  /** Number of linting errors */
  lintErrors?: number
  /** Number of security vulnerabilities */
  securityIssues?: number
  /** Total lines of code (for calculating error rates) */
  totalLines?: number
}

/**
 * Default quality stub metrics used as fallback when actual measurements are
 * not yet available. Both gate-completion and proposal-approval validators use
 * this constant so the two workflows remain consistent.
 *
 * Replace with real metrics from your project's quality-check tooling whenever
 * possible — these stubs assume a healthy baseline.
 */
export const DEFAULT_QUALITY_STUB_METRICS: QualityMetrics = {
  coverage: 95,
  lintErrors: 0,
  securityIssues: 0,
}

export interface QualityValidationContext {
  /** Quality metrics from the target project */
  metrics: QualityMetrics
  /**
   * Root directory of the target project.
   * The validator loads zeno/.zeno/config.json from this path to read
   * the project's configured quality thresholds.
   * Walks up from cwd when omitted.
   * Ignored when `config` is provided directly.
   */
  projectRoot?: string
  /**
   * Explicit config override — skips disk load entirely.
   * Primarily used in tests or when the config is already loaded by the caller.
   * In production flows, omit this and let the validator load from `projectRoot`.
   */
  config?: ZenoConfig
}

/**
 * Validate quality metrics against the target project's configured thresholds.
 *
 * Resolution order for thresholds:
 * 1. `context.config` (explicit override) — used as-is, no file I/O
 * 2. `context.projectRoot` — loads zeno/.zeno/config.json from that directory
 * 3. cwd walk — `findProjectRoot()` walks up from cwd looking for zeno/.zeno/
 *
 * If config cannot be loaded (file missing), warns and falls back to PRD defaults
 * (90% coverage, 0 vulns, <0.01% lint) so validation still blocks bad code.
 *
 * Quality validation is REQUIRED for proposal approval. If metrics
 * don't meet thresholds, approval is blocked and the LLM must fix
 * the underlying code issues.
 */
export async function validateQuality(
  context: QualityValidationContext
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const { metrics } = context

  // Resolve quality thresholds — explicit config takes priority
  // Initialize with defaults to ensure thresholds is always defined
  let thresholds = getDefaultConfig('unknown').qualityThresholds

  if (context.config?.qualityThresholds) {
    thresholds = context.config.qualityThresholds
  } else {
    // Load from the target project's zeno/.zeno/config.json
    // Use getWorkspaceRoot() (which respects ZENO_WORKSPACE and MCP-negotiated roots)
    // as the seed for findProjectRoot so the validator targets the correct workspace
    // even when process.cwd() is the MCP server's install directory, not the project.
    const workspaceRoot = getWorkspaceRoot()
    const projectRoot = context.projectRoot ?? findProjectRoot(workspaceRoot) ?? workspaceRoot
    const root = findProjectRoot(projectRoot) ?? projectRoot

    try {
      const config = await loadConfig(root)
      thresholds = config.qualityThresholds
    } catch (err) {
      logger.warn('Could not load target project config; using PRD default thresholds', {
        projectRoot: root,
        error: String(err),
      })
      warnings.push(
        `Could not load project config from ${root}/zeno/.zeno/config.json — ` +
          `using default thresholds (coverage ≥90%, lint <0.01%, security 0).`
      )
    }
  }

  // Rule 1: Code coverage must meet threshold (blocking)
  if (metrics.coverage !== undefined) {
    if (metrics.coverage < thresholds.codeCoverage) {
      errors.push(
        `Code coverage ${metrics.coverage.toFixed(1)}% is below threshold ${String(thresholds.codeCoverage)}%. ` +
          `Increase test coverage to meet quality requirements.`
      )
    }
  } else {
    warnings.push('Code coverage not measured. Run tests with coverage reporting.')
  }

  // Rule 2: Lint errors must be below threshold (rate-based, blocking)
  if (metrics.lintErrors !== undefined && metrics.totalLines !== undefined) {
    const lintErrorRate = metrics.lintErrors / metrics.totalLines
    if (lintErrorRate > thresholds.lintingErrorRate) {
      errors.push(
        `Lint error rate (${(lintErrorRate * 100).toFixed(2)}%) exceeds threshold ` +
          `(${(thresholds.lintingErrorRate * 100).toFixed(2)}%). ` +
          `Fix linting issues to improve code quality.`
      )
    }
  } else if (metrics.lintErrors !== undefined) {
    // Fall back to absolute count if total lines not provided
    if (metrics.lintErrors > 10) {
      errors.push(
        `${String(metrics.lintErrors)} linting errors found. Reduce to meet quality standards.`
      )
    }
  }

  // Rule 3: Security vulnerabilities must be zero (blocking)
  if (metrics.securityIssues !== undefined) {
    if (metrics.securityIssues > thresholds.securityVulnerabilities) {
      errors.push(
        `Security vulnerabilities (${String(metrics.securityIssues)}) exceed threshold ${String(thresholds.securityVulnerabilities)}. ` +
          `Fix all security issues before proceeding.`
      )
    }
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Extracts quality metrics from an entity's show data, falling back to
 * DEFAULT_QUALITY_STUB_METRICS when actual measurements are unavailable.
 *
 * Shared by gate and proposal tools to avoid duplicating the extraction pattern
 * at every call-site where showData may or may not contain qualityMetrics.
 *
 * @param showData - The data object returned by the entity's show action
 */
export function extractQualityMetrics(showData: Record<string, unknown>): QualityMetrics {
  const existing = (showData['qualityMetrics'] ?? {}) as Record<string, unknown>
  return {
    coverage:
      typeof existing['testCoverage'] === 'number'
        ? existing['testCoverage']
        : DEFAULT_QUALITY_STUB_METRICS.coverage,
    lintErrors:
      typeof existing['lintErrors'] === 'number'
        ? existing['lintErrors']
        : DEFAULT_QUALITY_STUB_METRICS.lintErrors,
    securityIssues:
      typeof existing['securityIssues'] === 'number'
        ? existing['securityIssues']
        : DEFAULT_QUALITY_STUB_METRICS.securityIssues,
  }
}
