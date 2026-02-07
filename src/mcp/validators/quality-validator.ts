/**
 * Quality Validator
 *
 * Validates quality metrics against configured thresholds:
 * - Code coverage >= threshold
 * - Type errors == 0
 * - Lint errors < threshold
 * - Security vulnerabilities == 0
 */

import { ZenoConfig } from '../../utils/config.js'

export interface QualityMetrics {
  /** Code coverage percentage (0-100) */
  coverage?: number
  /** Number of type checking errors */
  typeErrors?: number
  /** Number of linting errors */
  lintErrors?: number
  /** Number of security vulnerabilities */
  securityIssues?: number
  /** Total lines of code (for calculating error rates) */
  totalLines?: number
}

export interface QualityValidationContext {
  /** Quality metrics to validate */
  metrics: QualityMetrics
  /** Project configuration with thresholds */
  config: ZenoConfig
  /** Whether to treat warnings as errors (strict mode) */
  strict?: boolean
}

export interface ValidationResult {
  allowed: boolean
  errors?: string[]
  warnings?: string[]
}

/**
 * Validate quality metrics against configured thresholds.
 * Uses config_get() thresholds instead of hard-coded values.
 */
export function validateQuality(context: QualityValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { metrics, config, strict = false } = context

  // Provide sensible defaults if config is missing or incomplete
  const thresholds = config.qualityThresholds || {
    codeCoverage: 90,
    typeCheckingErrors: 0,
    lintingErrorRate: 0.01,
    securityVulnerabilities: 0
  }

  // Rule 1: Code coverage must meet threshold
  if (metrics.coverage !== undefined) {
    if (metrics.coverage < thresholds.codeCoverage) {
      const message =
        `Code coverage ${metrics.coverage.toFixed(1)}% is below threshold ${thresholds.codeCoverage}%. ` +
        `Increase test coverage to meet quality standards.`

      if (strict) {
        errors.push(message)
      } else {
        warnings.push(message)
      }
    }
  } else {
    warnings.push('Code coverage not measured. Run tests with coverage reporting.')
  }

  // Rule 2: Type errors must be zero
  if (metrics.typeErrors !== undefined) {
    if (metrics.typeErrors > thresholds.typeCheckingErrors) {
      errors.push(
        `Type checking errors (${metrics.typeErrors}) exceed threshold ${thresholds.typeCheckingErrors}. ` +
          `Fix all type errors before proceeding.`
      )
    }
  }

  // Rule 3: Lint errors must be below threshold (rate-based)
  if (metrics.lintErrors !== undefined && metrics.totalLines !== undefined) {
    const lintErrorRate = metrics.lintErrors / metrics.totalLines
    if (lintErrorRate > thresholds.lintingErrorRate) {
      const message =
        `Lint error rate (${(lintErrorRate * 100).toFixed(2)}%) exceeds threshold ` +
        `(${(thresholds.lintingErrorRate * 100).toFixed(2)}%). ` +
        `Fix linting issues to improve code quality.`

      if (strict) {
        errors.push(message)
      } else {
        warnings.push(message)
      }
    }
  } else if (metrics.lintErrors !== undefined) {
    // Fall back to absolute count if total lines not provided
    if (metrics.lintErrors > 10) {
      warnings.push(
        `${metrics.lintErrors} linting errors found. Consider reducing to improve code quality.`
      )
    }
  }

  // Rule 4: Security vulnerabilities must be zero
  if (metrics.securityIssues !== undefined) {
    if (metrics.securityIssues > thresholds.securityVulnerabilities) {
      errors.push(
        `Security vulnerabilities (${metrics.securityIssues}) exceed threshold ${thresholds.securityVulnerabilities}. ` +
          `Fix all security issues before proceeding. Run security scans and address findings.`
      )
    }
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
