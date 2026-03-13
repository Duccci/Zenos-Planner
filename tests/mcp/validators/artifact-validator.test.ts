/**
 * Artifact Validator Coverage Tests
 *
 * Covers validateArtifact (pure function) and validateArtifactFile branches:
 * - Proposal: missing required sections, phases errors, test-first pattern,
 *   dependency validation, warnings passthrough
 * - Gate: missing Status field, missing optional sections → warnings, all valid
 * - Architecture: no diagram → error, mermaid/dot/svg → pass
 * - Unknown type → error (default branch)
 * - validateArtifactFile: success path, file read failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock all internal validators and readFile so that validateArtifact is testable
// ---------------------------------------------------------------------------

const mockValidateProposalPhases = vi.fn()
const mockValidateTestFirstPattern = vi.fn()
const mockValidateScope = vi.fn()
const mockValidateDependencies = vi.fn()
const mockReadFile = vi.fn()
const mockLoadTemplateSections = vi.fn()

vi.mock('../../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

vi.mock('../../../src/mcp/validators/proposal-phases-validator.js', () => ({
  validateProposalPhases: (...args: unknown[]) => mockValidateProposalPhases(...args),
}))

vi.mock('../../../src/mcp/validators/test-first-validator.js', () => ({
  validateTestFirstPattern: (...args: unknown[]) => mockValidateTestFirstPattern(...args),
}))

vi.mock('../../../src/mcp/validators/scope-validator.js', () => ({
  validateScope: (...args: unknown[]) => mockValidateScope(...args),
}))

vi.mock('../../../src/mcp/validators/dependency-validator.js', () => ({
  validateDependencies: (...args: unknown[]) => mockValidateDependencies(...args),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Mock only loadTemplateSections (file I/O) while keeping validateTemplateSections real.
// validateArtifact tests pass templateSections directly so they bypass loadTemplateSections.
vi.mock('../../../src/mcp/validators/template-sections-validator.js', async (importOriginal) => {
  const mod = await importOriginal() as Record<string, unknown>
  return {
    ...mod,
    loadTemplateSections: (...args: unknown[]) => mockLoadTemplateSections(...args),
  }
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Full proposal content satisfying all four required sections
const VALID_PROPOSAL = `# Proposal: Test Proposal

**Hash**: #abc12345
**Date**: 2026-01-01
**Status**: pending

## Summary

This is a test proposal summary.

---

## Context

### Why This Change

Because.

---

## Tasks

### Task 1: Do something

**Acceptance**:
- [ ] Done

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| src/test.ts | modify | Test file |

---

## Rollback

No rollback needed.
`

/**
 * Mirrors the required/optional sections from proposal-template.md.
 * Used in unit tests that call validateArtifact directly.
 */
const PROPOSAL_TEMPLATE_SECTIONS = {
  required: [
    '## Summary',
    '## Context',
    '## Tasks',
    '## Files Affected',
    '## Rollback',
  ],
  optional: ['## Implementation Notes'],
}

/**
 * Mirrors the required sections from gate-prd-template.md.
 * Used in unit tests that call validateArtifact directly.
 */
const GATE_TEMPLATE_SECTIONS = {
  required: [
    '## Overview',
    '## Objectives',
    '## Context',
    '## Requirements',
    '## Proposals',
  ],
  optional: [],
}

const VALID_GATE = `# Gate 01: Test Gate

**Status**: pending

## Overview
Gate overview.

## Objectives
- [ ] Objective 1

## Context
Context notes.

## Requirements
- REQ-001: Requirement

## Proposals
- Proposal 1
`

describe('artifact-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateProposalPhases.mockReturnValue({ errors: [], warnings: [] })
    mockValidateTestFirstPattern.mockReturnValue({ errors: [], warnings: [] })
    mockValidateScope.mockReturnValue({ errors: [], warnings: [] })
    mockValidateDependencies.mockReturnValue({ errors: [], warnings: [] })
    // Default: return empty sections so validateArtifactFile tests don't add unexpected errors.
    mockLoadTemplateSections.mockResolvedValue({ required: [], optional: [] })
  })

  // -------------------------------------------------------------------------
  // Proposal type
  // -------------------------------------------------------------------------
  describe('validateArtifact - proposal', () => {
    it('returns errors for missing required sections', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: '# Proposal: Test\n\nOnly a title, no required sections.',
        templateSections: PROPOSAL_TEMPLATE_SECTIONS,
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.some((e) => e.includes('Missing required section: "## Summary"'))).toBe(
        true
      )
      expect(result.errors!.some((e) => e.includes('Missing required section: "## Tasks"'))).toBe(
        true
      )
      expect(
        result.errors!.some((e) => e.includes('Missing required section: "## Files Affected"'))
      ).toBe(true)
    })

    it('passes when all required sections are present', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        templateSections: PROPOSAL_TEMPLATE_SECTIONS,
      })

      expect(result.allowed).toBe(true)
    })

    it('includes errors from validateProposalPhases', async () => {
      mockValidateProposalPhases.mockReturnValue({ errors: ['phase error'], warnings: [] })

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
      })

      expect(result.errors).toContain('phase error')
    })

    it('includes warnings from validateProposalPhases in result', async () => {
      mockValidateProposalPhases.mockReturnValue({ errors: [], warnings: ['phase warning'] })

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
      })

      expect(result.allowed).toBe(true)
      expect(result.warnings).toContain('phase warning')
    })

    it('calls validateTestFirstPattern even when phases check already produced an error', async () => {
      // Regression: missing-role must surface even when multi-phase error fires first.
      mockValidateProposalPhases.mockReturnValue({ errors: ['multi-phase error'], warnings: [] })
      mockValidateTestFirstPattern.mockReturnValue({
        errors: ['Gate-tied proposal is missing a **Roles** field'],
        warnings: [],
      })

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        gateId: 'gate-01',
        // no role — simulates absent **Roles** field
      })

      expect(mockValidateTestFirstPattern).toHaveBeenCalled()
      expect(result.errors).toContain('multi-phase error')
      expect(result.errors).toContain('Gate-tied proposal is missing a **Roles** field')
    })

    it('calls validateTestFirstPattern when gateId AND gateProposals are both provided', async () => {
      mockValidateTestFirstPattern.mockReturnValue({ errors: ['test-first error'], warnings: [] })

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        gateId: 'gate-01',
        hash: 'abc12345',
        role: 'implementation',
        gateProposals: [{ hash: 'abc12345', role: 'test-suite', createdAt: '2026-01-01' }],
      })

      expect(mockValidateTestFirstPattern).toHaveBeenCalled()
      expect(result.errors).toContain('test-first error')
    })

    it('calls validateTestFirstPattern when gateId is set, even without gateProposals', async () => {
      // gateProposals is optional: per-proposal role checks run whenever gateId is present;
      // gate-level structure checks are skipped (handled internally by validateTestFirstPattern)
      mockValidateTestFirstPattern.mockReturnValue({ errors: [], warnings: [] })

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        gateId: 'gate-01',
        // no gateProposals
      })

      expect(mockValidateTestFirstPattern).toHaveBeenCalled()
    })

    it('does NOT call validateTestFirstPattern when gateId is absent', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        gateProposals: [{ hash: 'abc12345', role: 'test-suite', createdAt: '2026-01-01' }],
        // no gateId
      })

      expect(mockValidateTestFirstPattern).not.toHaveBeenCalled()
    })

    it('calls validateDependencies when allNodes AND hash are both provided', async () => {
      mockValidateDependencies.mockReturnValue({ errors: ['circular dep'], warnings: [] })

      const allNodes = new Map([['abc12345', { hash: 'abc12345', dependencies: [] as string[] }]])

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        hash: 'abc12345',
        allNodes,
      })

      expect(mockValidateDependencies).toHaveBeenCalled()
      expect(result.errors).toContain('circular dep')
    })

    it('does NOT call validateDependencies when allNodes is absent', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        hash: 'abc12345',
        // no allNodes
      })

      expect(mockValidateDependencies).not.toHaveBeenCalled()
    })

    it('does NOT call validateDependencies when hash is absent', async () => {
      const allNodes = new Map([['abc12345', { hash: 'abc12345', dependencies: [] as string[] }]])

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        allNodes,
        // no hash
      })

      expect(mockValidateDependencies).not.toHaveBeenCalled()
    })

    it('includes scope errors in result', async () => {
      mockValidateScope.mockReturnValue({ errors: ['wildcard not allowed'], warnings: [] })

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
      })

      expect(result.errors).toContain('wildcard not allowed')
    })

    it('includes scope warnings when errors are empty', async () => {
      mockValidateScope.mockReturnValue({ errors: [], warnings: ['scope warning'] })

      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
      })

      expect(result.allowed).toBe(true)
      expect(result.warnings).toContain('scope warning')
    })

    // ---------------------------------------------------------
    // validateOpenQuestions (Check 7): Open Questions section
    // ---------------------------------------------------------

    it('passes when Open Questions section is present but has empty body', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL + '\n## Open Questions\n\n',
        templateSections: PROPOSAL_TEMPLATE_SECTIONS,
      })

      expect(result.allowed).toBe(true)
      expect(result.errors?.some((e) => e.includes('Open Questions'))).toBeFalsy()
    })

    it('passes when Open Questions section body is N/A', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL + '\n## Open Questions\n\nN/A\n',
        templateSections: PROPOSAL_TEMPLATE_SECTIONS,
      })

      expect(result.allowed).toBe(true)
      expect(result.errors?.some((e) => e.includes('Open Questions'))).toBeFalsy()
    })

    it('passes when Open Questions section has only resolved checkboxes', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL + '\n## Open Questions\n\n- [x] Should we use Redis? Answered yes.\n',
        templateSections: PROPOSAL_TEMPLATE_SECTIONS,
      })

      expect(result.allowed).toBe(true)
    })

    it('returns error when Open Questions section has an unresolved question', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL + '\n## Open Questions\n\n- [ ] Should we use Redis?\n',
        templateSections: PROPOSAL_TEMPLATE_SECTIONS,
      })

      expect(result.allowed).toBe(false)
      expect(result.errors!.some((e) => e.includes('unresolved question'))).toBe(true)
      expect(result.errors!.some((e) => e.includes('Should we use Redis?'))).toBe(true)
    })

    // ---------------------------------------------------------
    // extractFilesAffected: backtick-format and list-format
    // ---------------------------------------------------------

    it('extracts files from backtick-format Files Affected section', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const contentWithBackticks = `# Proposal: Backtick Test

**Hash**: #backtick001
**Date**: 2026-01-01
**Status**: pending

## Summary

Backtick-format files.

---

## Context

### Why This Change

Testing.

---

## Tasks

### Task 1: Implement

**Acceptance**:
- [ ] Done

---

## Files Affected

\`src/feature.ts\`
\`src/utils.ts\`

---

## Rollback

No rollback needed.
`

      // mockValidateScope receives filesAffected; inspect via spy
      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: contentWithBackticks,
      })

      // validateScope is called with extracted files — spy confirms backtick paths were parsed
      expect(mockValidateScope).toHaveBeenCalledWith(
        expect.objectContaining({
          filesAffected: expect.arrayContaining(['src/feature.ts', 'src/utils.ts']),
        })
      )
      expect(result.allowed).toBe(true)
    })

    it('extracts files from list-format Files Affected section', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const contentWithList = `# Proposal: List Test

**Hash**: #listfmt01
**Date**: 2026-01-01
**Status**: pending

## Summary

List-format files.

---

## Context

### Why This Change

Testing.

---

## Tasks

### Task 1: Implement

**Acceptance**:
- [ ] Done

---

## Files Affected

- src/routes/auth.ts
- src/middleware/validate.ts

---

## Rollback

No rollback needed.
`

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: contentWithList,
      })

      expect(mockValidateScope).toHaveBeenCalledWith(
        expect.objectContaining({
          filesAffected: expect.arrayContaining(['src/routes/auth.ts']),
        })
      )
      expect(result.allowed).toBe(true)
    })

    // ---------------------------------------------------------
    // generateProposalAgentChecks: gating branches
    // ---------------------------------------------------------

    it('includes dependency accuracy check when content has ## Dependencies section', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const contentWithDeps = VALID_PROPOSAL + '\n## Dependencies\n\n#abc12345def01234\n'

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: contentWithDeps,
      })

      // hasDeps=true branch: Check 4 should be DEPENDENCY ACCURACY (not UNDECLARED)
      expect(result.agentReview?.some((r) => r.includes('DEPENDENCY ACCURACY'))).toBe(true)
      expect(result.agentReview?.some((r) => r.includes('UNDECLARED DEPENDENCIES'))).toBeFalsy()
    })

    it('includes gate objective coverage check when gateObjectives provided without gatePrdPath', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        gateObjectives: 'Deploy auth service\nAdd rate limiting',
      })

      // !hasGateScopeReview && gateObjectives branch
      expect(result.agentReview?.some((r) => r.includes('GATE OBJECTIVE COVERAGE'))).toBe(true)
    })

    it('skips Files Affected check when gatePrdPath is provided (hasGateScopeReview=true)', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        gatePrdPath: '/zeno/gates/gate-01-auth.md',
      })

      // hasGateScopeReview=true: Check 3 (FILES AFFECTED COVERAGE) is suppressed
      expect(result.agentReview?.some((r) => r.includes('FILES AFFECTED COVERAGE'))).toBeFalsy()
    })
  })

  // -------------------------------------------------------------------------
  // Gate type
  // -------------------------------------------------------------------------
  describe('validateArtifact - gate', () => {
    it('returns error when Status field is missing', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\nNo status field here.',
      })

      expect(result.allowed).toBe(false)
      expect(result.errors!.some((e) => e.includes('Status field'))).toBe(true)
    })

    it('returns warnings for missing optional sections when templateSections is provided', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      // Include a minimal Objectives section with a checkbox so the structural check passes;
      // the test intent is to verify optional-section warnings, not objectives validation.
      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- [ ] Test objective',
        templateSections: {
          required: [],
          optional: ['## Objectives', '## Requirements'],
        },
      })

      // Passes (no required sections), but warns about missing optionals
      expect(result.allowed).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings!.some((w) => w.includes('Missing optional section'))).toBe(true)
    })

    it('returns warning when templateSections is absent (no file I/O)', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      // Include Objectives with a checkbox so structural check passes.
      // The test intent is to verify the templateSections-absent warning.
      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- [ ] Test objective',
      })

      expect(result.allowed).toBe(true)
      expect(result.warnings?.some((w) => w.includes('template sections not loaded'))).toBe(true)
    })

    it('passes when gate has Status and all template sections', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: VALID_GATE,
        templateSections: GATE_TEMPLATE_SECTIONS,
      })

      expect(result.allowed).toBe(true)
    })

    // ---------------------------------------------------------
    // Check 3: Objectives checkboxes (gate-specific structural)
    // ---------------------------------------------------------

    it('returns error when Objectives section is empty', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\n**Status**: pending\n\n## Objectives\n',
      })

      expect(result.allowed).toBe(false)
      expect(result.errors!.some((e) => e.includes('Objectives section is empty'))).toBe(true)
    })

    it('returns error when Objectives section has no checkboxes', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- Deliver feature\n- Write docs\n',
      })

      expect(result.allowed).toBe(false)
      expect(result.errors!.some((e) => e.includes('no checkboxes'))).toBe(true)
    })

    it('passes Objectives check when at least one checked item exists', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- [x] Already done\n',
      })

      // No Objectives error
      expect(result.errors?.some((e) => e.includes('Objectives'))).toBeFalsy()
    })

    // ---------------------------------------------------------
    // Check 4: Stale markers (TBD / TODO / FIXME etc.)
    // ---------------------------------------------------------

    it('returns error when Objectives section contains stale markers', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- [ ] TBD — define scope\n',
      })

      expect(result.allowed).toBe(false)
      expect(result.errors!.some((e) => e.includes('stale markers'))).toBe(true)
      expect(result.errors!.some((e) => e.includes('TBD'))).toBe(true)
    })

    it('returns warning (not error) when Context section contains stale markers', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content:
          '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- [ ] Real objective\n\n## Context\nTODO: add background',
      })

      expect(result.allowed).toBe(true)
      expect(result.warnings!.some((w) => w.includes('stale markers'))).toBe(true)
      expect(result.warnings!.some((w) => w.includes('TODO'))).toBe(true)
    })

    // ---------------------------------------------------------
    // Check 5: Scope Boundaries section
    // ---------------------------------------------------------

    it('returns warning when Scope Boundaries section is empty', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content:
          '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- [ ] Real objective\n\n## Scope Boundaries\n',
      })

      expect(result.allowed).toBe(true)
      expect(result.warnings!.some((w) => w.includes('Scope Boundaries section is empty'))).toBe(true)
    })

    it('returns warning when Scope Boundaries lacks explicit In Scope label', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content:
          '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- [ ] Real objective\n\n## Scope Boundaries\n- Everything related to auth\n',
      })

      expect(result.allowed).toBe(true)
      expect(result.warnings!.some((w) => w.includes('"In Scope"'))).toBe(true)
    })

    it('passes Scope Boundaries check when In Scope content is present', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content:
          '# Gate 01\n\n**Status**: pending\n\n## Objectives\n- [ ] Real objective\n\n## Scope Boundaries\n### In Scope\n- Auth module\n',
      })

      expect(result.errors?.some((e) => e.includes('Scope Boundaries'))).toBeFalsy()
      expect(result.warnings?.some((w) => w.includes('Scope Boundaries'))).toBeFalsy()
    })

    // ---------------------------------------------------------
    // Original check: Status values
    // ---------------------------------------------------------

    it('accepts all valid Status values', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')
      const statuses = ['pending', 'validated', 'in_progress', 'completed', 'rejected', 'archived']

      for (const status of statuses) {
        const result = validateArtifact({
          artifactType: 'gate',
          artifactPath: '/gate.md',
          // Objectives must have at least one checkbox to pass structural validation
          content: `# Gate 01\n\n**Status**: ${status}\n\n## Overview\n\n## Objectives\n- [ ] Item\n\n## Context\n## Requirements\n## Proposals`,
          templateSections: GATE_TEMPLATE_SECTIONS,
        })
        expect(result.allowed).toBe(true)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Architecture type
  // -------------------------------------------------------------------------
  describe('validateArtifact - architecture', () => {
    it('returns error when no diagram content is found', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'architecture',
        artifactPath: '/arch.md',
        content: '# Architecture\n\nJust some text with no diagram.',
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.some((e) => e.includes('valid diagram content'))).toBe(true)
    })

    it('passes for mermaid diagram (```mermaid block)', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'architecture',
        artifactPath: '/arch.md',
        content: '# System\n\n```mermaid\ngraph LR\n  A --> B\n```',
      })

      expect(result.allowed).toBe(true)
    })

    it('passes for DOT digraph content', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'architecture',
        artifactPath: '/arch.dot',
        content: 'digraph G {\n  A -> B;\n}',
      })

      expect(result.allowed).toBe(true)
    })

    it('passes for SVG content', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'architecture',
        artifactPath: '/arch.svg',
        content: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>',
      })

      expect(result.allowed).toBe(true)
    })

    it('passes for ```dot block', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'architecture',
        artifactPath: '/arch.md',
        content: '```dot\ndigraph G { A -> B; }\n```',
      })

      expect(result.allowed).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Unknown type (default branch)
  // -------------------------------------------------------------------------
  describe('validateArtifact - unknown type', () => {
    it('returns error for unknown artifact type (default switch branch)', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      const result = validateArtifact({
        artifactType: 'unknown' as 'proposal',
        artifactPath: '/file.md',
        content: 'content',
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('Unknown artifact type')
    })
  })

  // -------------------------------------------------------------------------
  // validateArtifactFile
  // -------------------------------------------------------------------------
  describe('validateArtifactFile', () => {
    it('reads file and validates as proposal', async () => {
      mockReadFile.mockResolvedValue(VALID_PROPOSAL)

      const { validateArtifactFile } =
        await import('../../../src/mcp/validators/artifact-validator.js')

      const result = await validateArtifactFile('/test.md', 'proposal')

      expect(mockReadFile).toHaveBeenCalledWith('/test.md')
      expect(result.allowed).toBe(true)
    })

    it('returns allowed:false when file read fails', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'))

      const { validateArtifactFile } =
        await import('../../../src/mcp/validators/artifact-validator.js')

      const result = await validateArtifactFile('/nonexistent.md', 'proposal')

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('Failed to read artifact file')
    })

    it('threads additional context through to validateArtifact', async () => {
      mockReadFile.mockResolvedValue(VALID_PROPOSAL)

      const allNodes = new Map([['abc12345', { hash: 'abc12345', dependencies: [] as string[] }]])

      const { validateArtifactFile } =
        await import('../../../src/mcp/validators/artifact-validator.js')

      const result = await validateArtifactFile('/test.md', 'proposal', {
        gateId: 'gate-01',
        hash: 'abc12345',
        allNodes,
      })

      // validateDependencies should be called because hash + allNodes provided
      expect(mockValidateDependencies).toHaveBeenCalled()
      expect(result.allowed).toBe(true)
    })

    it('reads file and validates as gate', async () => {
      mockReadFile.mockResolvedValue(VALID_GATE)

      const { validateArtifactFile } =
        await import('../../../src/mcp/validators/artifact-validator.js')

      const result = await validateArtifactFile('/gate.md', 'gate')

      expect(result.allowed).toBe(true)
    })

    it('reads file and validates as architecture', async () => {
      mockReadFile.mockResolvedValue('# Arch\n\n```mermaid\ngraph LR\n  A-->B\n```')

      const { validateArtifactFile } =
        await import('../../../src/mcp/validators/artifact-validator.js')

      const result = await validateArtifactFile('/arch.md', 'architecture')

      expect(result.allowed).toBe(true)
    })
  })
})
