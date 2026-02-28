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

## Proposal Type

Solitary

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%

---

## Single-Phase Requirement

Single phase only.

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
    '## Proposal Type',
    '## Coverage & Estimates',
    '## Single-Phase Requirement',
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

    it('does NOT call validateTestFirstPattern when gateProposals is absent', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')

      validateArtifact({
        artifactType: 'proposal',
        artifactPath: '/test.md',
        content: VALID_PROPOSAL,
        gateId: 'gate-01',
        // no gateProposals
      })

      expect(mockValidateTestFirstPattern).not.toHaveBeenCalled()
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

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\n**Status**: pending',
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

      const result = validateArtifact({
        artifactType: 'gate',
        artifactPath: '/gate.md',
        content: '# Gate 01\n\n**Status**: pending',
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

    it('accepts all valid Status values', async () => {
      const { validateArtifact } = await import('../../../src/mcp/validators/artifact-validator.js')
      const statuses = ['pending', 'in_progress', 'completed', 'rejected', 'archived']

      for (const status of statuses) {
        const result = validateArtifact({
          artifactType: 'gate',
          artifactPath: '/gate.md',
          content: `# Gate 01\n\n**Status**: ${status}\n\n## Overview\n## Objectives\n## Context\n## Requirements\n## Proposals`,
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

      const result = await validateArtifactFile('/test.md', 'proposal', 'all', {
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
