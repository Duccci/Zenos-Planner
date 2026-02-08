/**
 * Apply Phase Validator
 *
 * Enforces constraints during proposal apply phase:
 * - No git operations during proposal_start/approve
 * - Changes scoped to Files Affected
 * - Quality thresholds met before approval
 */

import { ZenoConfig } from '../../utils/config.js'

export interface ApplyPhaseValidationContext {
  /** Proposal hash */
  proposalHash: string
  /** Files affected (from proposal) */
  filesAffected: string[]
  /** Files actually modified */
  filesModified: string[]
  /** Git operations detected */
  gitOperations: string[]
  /** Quality metrics */
  qualityMetrics?: {
    coverage?: number
    typeErrors?: number
    lintErrors?: number
    securityIssues?: number
  }
  /** Project configuration */
  config: ZenoConfig
}

export interface ValidationResult {
  /** Whether validation passed */
  allowed: boolean
  /** Validation errors (blocking) */
  errors?: string[]
  /** Validation warnings (non-blocking) */
  warnings?: string[]
}

/**
 * Validate apply phase constraints.
 * Ensures no git operations and changes are scoped correctly.
 */
export function validateApplyPhase(context: ApplyPhaseValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Rule 1: No git operations during apply phase
  if (context.gitOperations.length > 0) {
    errors.push(
      `Git operations detected during apply phase: ${context.gitOperations.join(', ')}. ` +
        `Git commits occur ONLY at gate completion, not during proposal implementation.`
    )
  }

  // Rule 2: Changes must be scoped to Files Affected
  const unauthorizedFiles = context.filesModified.filter(
    (file) =>
      !context.filesAffected.some((affected) => file.includes(affected) || affected.includes(file))
  )

  if (unauthorizedFiles.length > 0) {
    errors.push(
      `Files modified outside of declared scope: ${unauthorizedFiles.join(', ')}. ` +
        `Only files listed in "Files Affected" should be modified.`
    )
  }

  // Rule 3: Quality thresholds (warnings for now, can be made blocking)
  if (context.qualityMetrics) {
    const { coverage, typeErrors, lintErrors, securityIssues } = context.qualityMetrics
    const thresholds = context.config.qualityThresholds

    if (coverage !== undefined && coverage < thresholds.codeCoverage) {
      warnings.push(
        `Code coverage ${String(coverage)}% is below threshold ${String(thresholds.codeCoverage)}%`
      )
    }

    if (typeErrors !== undefined && typeErrors > thresholds.typeCheckingErrors) {
      warnings.push(
        `Type errors (${String(typeErrors)}) exceed threshold ${String(thresholds.typeCheckingErrors)}`
      )
    }

    if (lintErrors !== undefined) {
      const lintErrorRate = lintErrors / (context.filesModified.length || 1)
      if (lintErrorRate > thresholds.lintingErrorRate) {
        warnings.push(
          `Lint error rate (${lintErrorRate.toFixed(2)}) exceeds threshold ${String(thresholds.lintingErrorRate)}`
        )
      }
    }

    if (securityIssues !== undefined && securityIssues > thresholds.securityVulnerabilities) {
      errors.push(
        `Security vulnerabilities (${String(securityIssues)}) exceed threshold ${String(thresholds.securityVulnerabilities)}`
      )
    }
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
