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

const ZENO_SPECIFIC_FILE_NAME_PATTERNS = [
  /(?:^|[^a-z0-9])(gate[-_\s]*(?:\d+|x{2,}))(?=$|[^a-z0-9])/i,
]

function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.split('/').pop() ?? normalized
}

/**
 * Reject file names that encode Zeno planning artifacts such as gate numbers.
 * Paths should describe the behavior being implemented, not the planning gate
 * that introduced the work.
 */
export function validateNoZenoSpecificFileNames(files: string[]): ValidationResult {
  const violations = new Map<string, string>()

  for (const file of files) {
    const fileName = getFileName(file)
    const matchedPattern = ZENO_SPECIFIC_FILE_NAME_PATTERNS.find((pattern) =>
      pattern.test(fileName)
    )
    if (!matchedPattern) continue

    matchedPattern.lastIndex = 0
    const matchResult = matchedPattern.exec(fileName)
    const match = matchResult?.[1] ?? matchResult?.[0] ?? fileName
    violations.set(file, match)
  }

  if (violations.size === 0) {
    return { allowed: true }
  }

  const offendingFiles = [...violations.entries()]
    .map(([file, match]) => `"${file}" (${match})`)
    .join(', ')

  return {
    allowed: false,
    errors: [
      'File names must describe product behavior, not Zeno planning metadata. ' +
        'Rename files to remove gate identifiers such as "gate-03" or "gate XX". ' +
        'Tests should name the functionality under test, not the gate that introduced it. ' +
        `Offending entries: ${offendingFiles}`,
    ],
  }
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

  const nameResult = validateNoZenoSpecificFileNames([
    ...context.filesAffected,
    ...context.filesModified,
  ])
  errors.push(...(nameResult.errors ?? []))

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

/**
 * Test-file pattern constants used by validateTestFileScope.
 * Centralized here so future test conventions can be added in one place.
 */
export const TEST_FILE_PATTERNS = [
  'tests/',
  '.test.ts',
  '.test.tsx',
  '.test.js',
  '.test.jsx',
  '.spec.ts',
  '.spec.tsx',
  '.spec.js',
  '.spec.jsx',
]

/**
 * Check whether a file path matches test file patterns.
 */
function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return TEST_FILE_PATTERNS.some((pattern) => normalized.includes(pattern))
}

/**
 * Validate test file scope based on proposal type.
 *
 * G10: Gate-tied proposals must NOT include test files in filesAffected
 *      (unless the proposal is the gate's dedicated test proposal).
 * G11: Solitary proposals SHOULD include at least one test file (warning if they don't).
 *
 * @param filesAffected - File paths declared in the proposal's Files Affected
 * @param isSolitary    - True for solitary proposals, false for gate-tied proposals
 */
export function validateTestFileScope(
  filesAffected: string[],
  isSolitary: boolean
): ValidationResult {
  if (!isSolitary) {
    // Gate-tied: reject if any test files are included
    const testFiles = filesAffected.filter(isTestFile)
    if (testFiles.length > 0) {
      return {
        allowed: false,
        errors: [
          'Gate-tied proposals must not include test files in Files Affected. ' +
            "Tests are handled by the gate's dedicated test proposal. " +
            `Offending entries: ${testFiles.map((f) => `"${f}"`).join(', ')}`,
        ],
      }
    }
    return { allowed: true }
  }

  // Solitary: warn if no test files are included
  const hasTestFiles = filesAffected.some(isTestFile)
  if (!hasTestFiles) {
    return {
      allowed: true,
      warnings: [
        'Solitary proposal has zero test files in Files Affected. ' +
          'Solitary proposals should include inline tests. ' +
          'Add test file paths to Files Affected if tests will be written as part of this proposal.',
      ],
    }
  }

  return { allowed: true }
}

/**
 * Validate that all filesAffected entries are markdown files.
 *
 * G12: Gate and proposal generation actions must only produce markdown artifacts.
 *      Generating .ts, .json, or other non-markdown files during generation phases
 *      is prohibited — generated content belongs in planning documents, not code.
 *
 * @param filesAffected - File paths declared as output of a generation action
 */
export function validateMarkdownOnly(filesAffected: string[]): ValidationResult {
  if (filesAffected.length === 0) {
    return { allowed: true }
  }

  const nonMarkdown = filesAffected.filter((f) => !f.trim().toLowerCase().endsWith('.md'))
  if (nonMarkdown.length > 0) {
    return {
      allowed: false,
      errors: [
        'Generation actions must only produce markdown files. ' +
          'Non-markdown files are not allowed in Files Affected during generate actions. ' +
          `Offending entries: ${nonMarkdown.map((f) => `"${f}"`).join(', ')}`,
      ],
    }
  }

  return { allowed: true }
}
