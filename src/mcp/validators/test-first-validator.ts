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
  /** ISO timestamp; used to determine ordering within the gate */
  createdAt: string
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

export interface ValidationResult {
  allowed: boolean
  errors?: string[]
  warnings?: string[]
}

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
          'This is required for Test-First Gate Pattern enforcement.'
      )
    }
    // Solitary proposals without an explicit role are treated as solitary ΓÇö no enforcement.
    return { errors, warnings }
  }

  const testFiles = filesAffected.filter(isTestFile)
  const implFiles = filesAffected.filter(isImplementationFile)

  switch (role) {
    case 'test-suite':
      // Must contain test files; must NOT contain implementation files outside tests/
      if (testFiles.length === 0 && filesAffected.length > 0) {
        errors.push(
          'test-suite proposal must include test files (*.test.ts, *.spec.ts, or files under tests/). ' +
            'No test files found in Files Affected. ' +
            'The test-suite proposal defines the acceptance criteria as executable tests.'
        )
      }
      if (implFiles.length > 0) {
        errors.push(
          `test-suite proposal must not contain implementation files. ` +
            `Found non-test files: ${implFiles.join(', ')}. ` +
            `Remove implementation files ΓÇö this proposal only establishes the test contract.`
        )
      }
      break

    case 'implementation':
      // Must NOT contain test files
      if (testFiles.length > 0) {
        errors.push(
          `implementation proposal must not contain test files. ` +
            `Found test files: ${testFiles.join(', ')}. ` +
            `Test tasks belong in the gate's test-suite (Proposal 1) or test-cleanup (Proposal N) proposals.`
        )
      }
      if (filesAffected.length === 0) {
        warnings.push(
          'implementation proposal has no files in Files Affected. ' +
            'Ensure implementation files are listed.'
        )
      }
      break

    case 'test-cleanup':
      // Must contain test files; must NOT contain implementation files
      if (testFiles.length === 0 && filesAffected.length > 0) {
        errors.push(
          'test-cleanup proposal must include test files (*.test.ts, *.spec.ts, or files under tests/). ' +
            'No test files found in Files Affected. ' +
            'The test-cleanup proposal refines tests discovered during implementation.'
        )
      }
      if (implFiles.length > 0) {
        errors.push(
          `test-cleanup proposal must not contain implementation files. ` +
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
          `Valid roles are: test-suite, implementation, test-cleanup, solitary.`
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

  // Sort by created_at ascending so index 0 === earliest, last index === latest
  const sorted = [...gateProposals].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // Guarded by length >= 2 check above, but TypeScript needs explicit narrowing
  const first: ProposalGateSibling | undefined = sorted[0]
  const last: ProposalGateSibling | undefined = sorted[sorted.length - 1]

  const roleCount = (role: string): number => sorted.filter((p) => p.role === role).length
  const testSuiteCount = roleCount('test-suite')
  const testCleanupCount = roleCount('test-cleanup')

  // Gate must have exactly one test-suite proposal
  if (testSuiteCount === 0) {
    warnings.push(
      'Gate has no test-suite proposal. ' +
        'The first proposal in every gate should be a test-suite that defines acceptance criteria as failing tests. ' +
        'Create a test-suite proposal (role: test-suite) as Proposal 1.'
    )
  } else if (testSuiteCount > 1) {
    errors.push(
      `Gate has ${String(testSuiteCount)} test-suite proposals; expected exactly 1. ` +
        `Only the first proposal may have role: test-suite.`
    )
  }

  // Gate must have exactly one test-cleanup proposal
  if (testCleanupCount === 0) {
    warnings.push(
      'Gate has no test-cleanup proposal. ' +
        'The last proposal in every gate should be a test-cleanup that refines tests based on implementation learnings. ' +
        'Create a test-cleanup proposal (role: test-cleanup) as the final proposal.'
    )
  } else if (testCleanupCount > 1) {
    errors.push(
      `Gate has ${String(testCleanupCount)} test-cleanup proposals; expected exactly 1. ` +
        `Only the final proposal may have role: test-cleanup.`
    )
  }

  // The first proposal must be the test-suite
  if (first?.role && first.role !== 'test-suite' && testSuiteCount >= 1) {
    const testSuiteProposal = sorted.find((p) => p.role === 'test-suite')
    errors.push(
      `The first proposal in the gate (#${first.hash}) has role "${first.role}" but should be "test-suite". ` +
        `The test-suite proposal (#${testSuiteProposal?.hash ?? 'unknown'}) must be created first so ` +
        `implementation proposals can depend on it.`
    )
  }

  // The last proposal must be the test-cleanup
  if (last?.role && last.role !== 'test-cleanup' && testCleanupCount >= 1) {
    const testCleanupProposal = sorted.find((p) => p.role === 'test-cleanup')
    errors.push(
      `The last proposal in the gate (#${last.hash}) has role "${last.role}" but should be "test-cleanup". ` +
        `The test-cleanup proposal (#${testCleanupProposal?.hash ?? 'unknown'}) must be the final proposal ` +
        `so it refines tests only after all implementation is complete.`
    )
  }

  // No implementation proposal may precede the test-suite
  if (testSuiteCount === 1) {
    const testSuiteIndex = sorted.findIndex((p) => p.role === 'test-suite')
    const implementationBeforeTestSuite = sorted
      .slice(0, testSuiteIndex)
      .filter((p) => p.role === 'implementation')

    if (implementationBeforeTestSuite.length > 0) {
      errors.push(
        `Implementation proposals found before the test-suite proposal: ` +
          `${implementationBeforeTestSuite.map((p) => `#${p.hash}`).join(', ')}. ` +
          `All implementation proposals must depend on (come after) the test-suite proposal.`
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
