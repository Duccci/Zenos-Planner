/**
 * Test-First Gate Pattern Validator
 *
 * Enforces the three-role proposal structure within each gate:
 *   Proposal 1  ΓÇö role: test-suite   ΓåÆ only test files; tests expected to fail (RED phase)
 *   Proposals 2-N-1 ΓÇö role: implementation ΓåÆ only implementation files; no test files
 *   Proposal N  ΓÇö role: test-cleanup ΓåÆ only test files; all tests must pass (GREEN phase)
 *   Solitary    ΓÇö role: solitary     ΓåÆ must include test files (self-contained)
 *
 * Checks performed:
 *   1. Per-proposal: files in filesAffected match the declared role
 *   2. Gate-level: gate has exactly one test-suite (first) and one test-cleanup (last)
 */

/** Identifies test-related file paths */
function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return (
    /\.test\.[a-z]+$/.test(normalized) ||
    /\.spec\.[a-z]+$/.test(normalized) ||
    normalized.includes('/__tests__/') ||
    normalized.includes('/tests/') ||
    normalized.startsWith('tests/')
  )
}

/** Identifies implementation file paths (non-test source files) */
function isImplementationFile(filePath: string): boolean {
  return !isTestFile(filePath)
}

// ---------------------------------------------------------------------------

export interface ProposalGateSibling {
  hash: string
  /** Role extracted from proposal file, undefined if not set */
  role: string | undefined
  /** ISO timestamp; used to determine ordering within the gate when filePath is absent */
  createdAt: string
  /**
   * Absolute path to the proposal file on disk.
   * When present, basename ordering is used in place of createdAt so that
   * a proposal's lastUpdated timestamp (which changes on status transitions)
   * cannot alter its position in the gate sequence.
   */
  filePath?: string
}

export interface TestFirstValidationContext {
  /** Hash of the proposal being validated */
  proposalHash: string
  /**
   * Role declared in the proposal file header (**Role** field).
   * undefined when the field is absent (treated as unset for gate-tied proposals).
   */
  role: string | undefined
  /** true when the proposal is tied to a gate (gateId is present) */
  isGateTied: boolean
  /** Files declared in the proposal's Files Affected table */
  filesAffected: string[]
  /**
   * All proposals in the same gate, ordered by created_at ASC.
   * Only populated for gate-tied proposals when siblings can be loaded.
   */
  gateProposals?: ProposalGateSibling[]
}

import type { ValidationResult } from './types.js'
export type { ValidationResult }

// ---------------------------------------------------------------------------
// Per-proposal role checks
// ---------------------------------------------------------------------------

function validateRoleFileConsistency(
  role: string | undefined,
  filesAffected: string[],
  isGateTied: boolean
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (!role) {
    if (isGateTied) {
      warnings.push(
        'Gate-tied proposal is missing a **Role** field. ' +
          'Set role to one of: test-suite, implementation, or test-cleanup. ' +
          'This is required for Test-First Gate Pattern enforcement (testing replaces test-suite/test-cleanup, feature replaces implementation).'
      )
    }
    // Solitary proposals without an explicit role are treated as solitary ΓÇö no enforcement.
    return { errors, warnings }
  }

  const testFiles = filesAffected.filter(isTestFile)
  const implFiles = filesAffected.filter(isImplementationFile)

  switch (role) {
    case 'testing':
      // Must contain test files; must NOT contain implementation files outside tests/
      if (testFiles.length === 0 && filesAffected.length > 0) {
        errors.push(
          'testing proposal must include test files (*.test.ts, *.spec.ts, or files under tests/). ' +
            'No test files found in Files Affected. ' +
            'The testing proposal defines the acceptance criteria as executable tests.'
        )
      }
      if (implFiles.length > 0) {
        errors.push(
          `testing proposal must not contain implementation files. ` +
            `Found non-test files: ${implFiles.join(', ')}. ` +
            `Remove implementation files — this proposal only establishes the test contract.`
        )
      }
      break

    case 'feature':
      // Must NOT contain test files
      if (testFiles.length > 0) {
        errors.push(
          `feature proposal must not contain test files. ` +
            `Found test files: ${testFiles.join(', ')}. ` +
            `Test tasks belong in the gate's testing proposals.`
        )
      }
      if (filesAffected.length === 0) {
        warnings.push(
          'feature proposal has no files in Files Affected. ' +
            'Ensure implementation files are listed.'
        )
      }
      break

    case 'cleanup':
      // Must contain test files; must NOT contain implementation files
      if (testFiles.length === 0 && filesAffected.length > 0) {
        errors.push(
          'cleanup proposal must include test files (*.test.ts, *.spec.ts, or files under tests/). ' +
            'No test files found in Files Affected. ' +
            'The cleanup proposal refines tests and verifies all tests pass.'
        )
      }
      if (implFiles.length > 0) {
        errors.push(
          `cleanup proposal must not contain implementation files. ` +
            `Found non-test files: ${implFiles.join(', ')}. ` +
            `Only test refinements are permitted here; implementation is complete.`
        )
      }
      break

    case 'solitary':
      // Should contain test files (warning, not error ΓÇö may be docs/config)
      if (testFiles.length === 0 && filesAffected.length > 0) {
        warnings.push(
          'solitary proposal has no test files in Files Affected. ' +
            'Solitary proposals should be self-contained and include tests inline. ' +
            'Add test files unless this change is purely non-code (config, docs).'
        )
      }
      break

    default:
      warnings.push(
        `Unknown proposal role "${role}". ` +
          `Valid roles are: testing, feature, cleanup, documentation, solitary.`
      )
  }

  return { errors, warnings }
}

// ---------------------------------------------------------------------------
// Gate-level structure checks
// ---------------------------------------------------------------------------

function validateGateStructure(
  proposalHash: string,
  gateProposals: ProposalGateSibling[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (gateProposals.length < 2) {
    // Can't enforce three-role structure with fewer than 2 proposals; skip.
    return { errors, warnings }
  }

  // Sort by filename (basename) when a filePath is available — this gives a stable
  // ordering based on the numeric prefix (01-, 08-…) that is unaffected by status
  // transitions that update lastUpdated. Fall back to createdAt when no path exists.
  const getBasename = (fp: string): string => fp.split(/[/\\]/).pop() ?? fp
  const sorted = [...gateProposals].sort((a, b) => {
    if (a.filePath && b.filePath) {
      return getBasename(a.filePath).localeCompare(getBasename(b.filePath))
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  // Guarded by length >= 2 check above, but TypeScript needs explicit narrowing
  const first: ProposalGateSibling | undefined = sorted[0]

  const roleCount = (role: string): number => sorted.filter((p) => p.role === role).length
  const testingCount = roleCount('testing')
  const cleanupCount = roleCount('cleanup')

  // Gate must have at least one testing proposal
  if (testingCount === 0) {
    warnings.push(
      'Gate has no testing proposal. ' +
        'The first proposal in every gate should be a testing proposal that defines acceptance criteria as failing tests. ' +
        'Create a testing proposal (role: testing) as Proposal 1.'
    )
  } else if (testingCount > 2) {
    // Two testing proposals are typical: one RED (first) and one GREEN (last)
    // More than two may indicate redundancy, but is not an error
    warnings.push(
      `Gate has ${String(testingCount)} testing proposals. ` +
        `Typical structure has one testing proposal first (RED) and one last (GREEN).`
    )
  }

  // Typical gate structure has at least one cleanup proposal (GREEN/final testing)
  // unless the gate has only a single testing proposal (solitary test gate)
  if (testingCount > 0 && cleanupCount === 0 && sorted.length > 1) {
    warnings.push(
      'Gate has no cleanup proposal for final testing verification. ' +
        'Typical gate structure has a cleanup proposal (role: cleanup) as the last proposal to verify all tests pass after implementation. ' +
        'Consider adding a cleanup proposal.'
    )
  }

  // No feature proposal may precede a testing proposal
  if (testingCount >= 1 && first?.role === 'testing') {
    const testingIndex = sorted.findIndex((p) => p.role === 'testing')
    const featureBeforeTesting = sorted
      .slice(0, testingIndex)
      .filter((p) => p.role === 'feature')

    if (featureBeforeTesting.length > 0) {
      errors.push(
        `Feature proposals found before a testing proposal: ` +
          `${featureBeforeTesting.map((p) => `#${p.hash}`).join(', ')}. ` +
          `All feature proposals must depend on (come after) the testing proposal.`
      )
    }
  }

  // proposalHash retained for future per-proposal gate-position checks
  void proposalHash

  return { errors, warnings }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Validate that a proposal follows the Test-First Gate Pattern.
 *
 * Checks:
 * 1. Role-file consistency: files in filesAffected match the declared role.
 * 2. Gate structure: gate has one test-suite first, one test-cleanup last (if gate proposals provided).
 */
export function validateTestFirstPattern(context: TestFirstValidationContext): ValidationResult {
  // Solitary proposals are self-contained and do not participate in the
  // Test-First Gate Pattern. Skip all checks.
  if (!context.isGateTied) {
    return { allowed: true }
  }

  const errors: string[] = []
  const warnings: string[] = []

  // 1. Per-proposal role/file consistency
  const roleResult = validateRoleFileConsistency(
    context.role,
    context.filesAffected,
    context.isGateTied
  )
  errors.push(...roleResult.errors)
  warnings.push(...roleResult.warnings)

  // 2. Gate-level structure (only when sibling data is available)
  if (context.gateProposals && context.gateProposals.length > 0) {
    const gateResult = validateGateStructure(context.proposalHash, context.gateProposals)
    errors.push(...gateResult.errors)
    warnings.push(...gateResult.warnings)
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validates the gate-level Test-First Gate Pattern for all proposals in a gate.
 * Intended for use at gate completion time to verify the overall gate structure
 * is correct before sealing the gate.
 *
 * Does NOT check per-proposal file consistency ΓÇö that is enforced at approve time.
 * Only checks structural constraints: exactly one test-suite (first), one test-cleanup (last).
 */
export function validateGateLevelTestFirst(gateProposals: ProposalGateSibling[]): {
  allowed: boolean
  errors?: string[]
  warnings?: string[]
} {
  if (gateProposals.length === 0) {
    return { allowed: true }
  }

  const result = validateGateStructure('gate-level-check', gateProposals)

  return {
    allowed: result.errors.length === 0,
    errors: result.errors.length > 0 ? result.errors : undefined,
    warnings: result.warnings.length > 0 ? result.warnings : undefined,
  }
}

// ---------------------------------------------------------------------------
// RED test coverage check
// ---------------------------------------------------------------------------

export interface ImplementationProposalFiles {
  /** Hash of an implementation (or any sibling) proposal */
  hash: string
  /** Files declared in the proposal's Files Affected table */
  filesAffected: string[]
}

export interface RedTestCoverageContext {
  /** Hash of the RED/test-suite proposal being validated */
  proposalHash: string
  /** Files declared in the RED proposal's Files Affected (expected to be test files) */
  redTestFiles: string[]
  /** Sibling proposals in the same gate whose files need RED test coverage */
  implementationProposals: ImplementationProposalFiles[]
}

/**
 * Derives the bare module basename from a file path, stripping directory and extension.
 * e.g. "src/core/my-module.ts" -> "my-module"
 */
function moduleBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const filename = normalized.slice(normalized.lastIndexOf('/') + 1)
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename
}

/**
 * Returns true when at least one test file in `testFiles` appears to cover `implFile`.
 * A test file covers an impl file when the test file's basename starts with the impl
 * file's module name (e.g. "my-module.test.ts" covers "my-module.ts").
 */
function hasTestCoverage(implFile: string, testFiles: string[]): boolean {
  const baseName = moduleBaseName(implFile)
  if (!baseName) return false

  return testFiles.some((tf) => {
    const normalizedTf = tf.replace(/\\/g, '/')
    const tfFilename = normalizedTf.slice(normalizedTf.lastIndexOf('/') + 1)
    // Accept: "baseName.test.ts", "baseName.spec.ts", "baseName.test.js", etc.
    return tfFilename.startsWith(baseName + '.')
  })
}

/**
 * For a RED (test-suite) proposal, verify that every new implementation file
 * declared in sibling proposals has a corresponding test file in this proposal's
 * Files Affected list.
 *
 * Iterates through all sibling proposals, collects their non-test files, and checks
 * that the RED proposal contains a matching test file for each. This ensures the RED
 * test suite establishes acceptance criteria for every file that implementation
 * proposals will create before implementation begins.
 */
export function validateRedTestCoverage(context: RedTestCoverageContext): ValidationResult {
  const errors: string[] = []

  // Collect all non-test files from sibling proposals that lack test coverage
  const uncoveredEntries: { file: string; proposalHash: string }[] = []

  for (const proposal of context.implementationProposals) {
    for (const file of proposal.filesAffected) {
      if (isImplementationFile(file) && !hasTestCoverage(file, context.redTestFiles)) {
        uncoveredEntries.push({ file, proposalHash: proposal.hash })
      }
    }
  }

  if (uncoveredEntries.length > 0) {
    const fileList = uncoveredEntries
      .map((e) => `  - ${e.file} (from proposal #${e.proposalHash})`)
      .join('\n')
    errors.push(
      `RED test suite is missing coverage for ${String(uncoveredEntries.length)} implementation ` +
        `file(s) declared in sibling proposals. Add test files for:\n${fileList}\n` +
        `Every file a sibling proposal creates must have a corresponding *.test.ts (or *.spec.ts) ` +
        `entry in this RED proposal's Files Affected so acceptance criteria exist before implementation begins.`
    )
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}
