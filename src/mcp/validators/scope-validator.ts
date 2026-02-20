/**
 * Scope Validator
 *
 * Validates that modified files match the Files Affected list.
 * Rejects unrelated refactoring or scope expansion.
 */

import type { ValidationResult } from './types.js'
export type { ValidationResult }

export interface ScopeValidationContext {
  /** Files declared in proposal's "Files Affected" */
  filesAffected: string[]
  /** Files actually modified */
  filesModified: string[]
  /** Allow test file additions (default: true) */
  allowTestFiles?: boolean
}

/**
 * Detect wildcard or directory-only entries in Files Affected.
 * Proposals must list explicit file paths, not globs or directories.
 */
function validateExplicitPaths(filesAffected: string[]): string[] {
  const errors: string[] = []
  for (const entry of filesAffected) {
    if (entry.includes('*')) {
      errors.push(`Wildcard not allowed in Files Affected: "${entry}". List each file explicitly.`)
    } else if (entry.endsWith('/')) {
      errors.push(
        `Directory reference not allowed in Files Affected: "${entry}". Use explicit file paths.`
      )
    }
  }
  return errors
}

/**
 * Validate that file modifications are within declared scope.
 * Prevents unrelated refactoring and scope creep.
 */
export function validateScope(context: ScopeValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const allowTestFiles = context.allowTestFiles ?? true

  // Reject wildcard/directory entries in Files Affected
  errors.push(...validateExplicitPaths(context.filesAffected))

  // Normalize paths for comparison
  const normalizedAffected = context.filesAffected.map((f) => f.replace(/\\/g, '/').toLowerCase())
  const normalizedModified = context.filesModified.map((f) => f.replace(/\\/g, '/').toLowerCase())

  // Check each modified file (exact path match after normalization)
  for (const modifiedFile of normalizedModified) {
    const isInScope = normalizedAffected.includes(modifiedFile)

    // Allow test files if flag is set
    const isTestFile =
      modifiedFile.includes('.test.') ||
      modifiedFile.includes('.spec.') ||
      modifiedFile.includes('/tests/')

    if (!isInScope) {
      if (isTestFile && allowTestFiles) {
        // Test files are allowed but should be warned about if not declared
        if (!normalizedAffected.some((f) => f.includes('test'))) {
          warnings.push(`Test file modified but not listed in Files Affected: ${modifiedFile}`)
        }
      } else {
        errors.push(
          `File modified outside of declared scope: ${modifiedFile}. ` +
            `This file is not listed in "Files Affected" and should not be modified.`
        )
      }
    }
  }

  // Warn if declared files weren't actually modified
  for (const affectedFile of normalizedAffected) {
    const wasModified = normalizedModified.includes(affectedFile)

    if (!wasModified) {
      warnings.push(`File declared in "Files Affected" but not modified: ${affectedFile}`)
    }
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
