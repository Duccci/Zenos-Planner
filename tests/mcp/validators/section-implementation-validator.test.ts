/**
 * Section Implementation Validator Tests
 *
 * Covers:
 *   parseSectionSpecs            — section spec extraction from templates
 *   validateSectionImplementation — quantitative + qualitative checks
 *   loadSectionSpecs / cache     — I/O helper and cache management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseSectionSpecs,
  validateSectionImplementation,
  loadSectionSpecs,
  clearSectionSpecsCache,
  extractLLMInstructionFragments,
  extractScaffoldFingerprints,
} from '../../../src/mcp/validators/section-implementation-validator.js'

// ---------------------------------------------------------------------------
// Template fixtures
// ---------------------------------------------------------------------------

const PROPOSAL_TEMPLATE = `
# Proposal: {{OBJECTIVE}}

**Hash**: #{{HASH}}
**Status**: pending

## Summary

[2-3 sentence description of what this proposal accomplishes. Focus on the outcome, not the process.]

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

- [ ] Implement the widget
- [ ] Add tests

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| [path/to/file.ts] | create | [short description] |

## Dependencies

| Hash    | Type     | Description                        |
| ------- | -------- | ---------------------------------- |
| #[hash] | requires | [What this proposal depends on]    |

## Implementation Notes

[Optional: Additional notes for the implementer about approach, risks, or constraints.]
`.trimStart()

const GATE_TEMPLATE = `
# Gate [XX]: [Gate Name]

**Status**: pending

## Overview

[2-3 sentences describing what this gate accomplishes.]

## Objectives

- [ ] [Objective with measurable outcome]
- [ ] [Objective with measurable outcome]

## Context

### What Was Completed Before This Gate

[Summarize previous gate deliverables.]

## Requirements

| Hash | Name | Type | Priority |
| ---- | ---- | ---- | -------- |
| #[hash] | [req] | functional | must |

## Scope Boundaries

**In Scope**:
[List specific features, modules, or capabilities included in this gate.]
`.trimStart()

// ---------------------------------------------------------------------------
// parseSectionSpecs
// ---------------------------------------------------------------------------

describe('parseSectionSpecs', () => {
  it('returns a spec for every ## heading', () => {
    const specs = parseSectionSpecs(PROPOSAL_TEMPLATE)
    const headings = specs.map((s) => s.heading)
    expect(headings).toContain('## Summary')
    expect(headings).toContain('## Tasks')
    expect(headings).toContain('## Files Affected')
    expect(headings).toContain('## Dependencies')
    expect(headings).toContain('## Implementation Notes')
  })

  it('marks [Optional sections as optional', () => {
    const specs = parseSectionSpecs(PROPOSAL_TEMPLATE)
    const notes = specs.find((s) => s.heading === '## Implementation Notes')
    expect(notes?.isOptional).toBe(true)
  })

  it('marks required sections as not optional', () => {
    const specs = parseSectionSpecs(PROPOSAL_TEMPLATE)
    const summary = specs.find((s) => s.heading === '## Summary')
    expect(summary?.isOptional).toBe(false)
  })

  it('detects bracket placeholders in the template body', () => {
    const specs = parseSectionSpecs(PROPOSAL_TEMPLATE)
    const summary = specs.find((s) => s.heading === '## Summary')
    // "[2-3 sentence description...]" should be counted
    expect(summary?.placeholderCount).toBeGreaterThan(0)
  })

  it('detects requiresCheckboxes when template body has checkboxes', () => {
    const specs = parseSectionSpecs(PROPOSAL_TEMPLATE)
    const tasks = specs.find((s) => s.heading === '## Tasks')
    expect(tasks?.requiresCheckboxes).toBe(true)
  })

  it('detects requiresTable when template body has a markdown table', () => {
    const specs = parseSectionSpecs(PROPOSAL_TEMPLATE)
    const files = specs.find((s) => s.heading === '## Files Affected')
    expect(files?.requiresTable).toBe(true)
  })

  it('sets a positive minWords threshold', () => {
    const specs = parseSectionSpecs(PROPOSAL_TEMPLATE)
    for (const spec of specs) {
      expect(spec.minWords).toBeGreaterThan(0)
    }
  })

  it('ignores h3 and lower headings', () => {
    const template = `
## Overview

Content here.

### Sub-heading

Sub content.

## Objectives

More content.
`.trimStart()
    const specs = parseSectionSpecs(template)
    expect(specs.map((s) => s.heading)).not.toContain('### Sub-heading')
  })

  it('strips HTML comments before counting placeholders', () => {
    const template = `
## Summary

[2-3 sentence description]

<!-- LLM instructions: ignore this
{{INTERNAL_VAR}}
-->
`.trimStart()
    const specs = parseSectionSpecs(template)
    const summary = specs.find((s) => s.heading === '## Summary')
    // {{INTERNAL_VAR}} is inside comment so should NOT be counted
    // [2-3 sentence description] should be counted
    expect(summary?.placeholderCount).toBe(1)
  })

  it('returns empty array for template with no ## headings', () => {
    expect(parseSectionSpecs('# Only H1\n\nSome text\n')).toEqual([])
  })

  it('parses gate template correctly', () => {
    const specs = parseSectionSpecs(GATE_TEMPLATE)
    const headings = specs.map((s) => s.heading)
    expect(headings).toContain('## Overview')
    expect(headings).toContain('## Objectives')
    expect(headings).toContain('## Context')
    expect(headings).toContain('## Requirements')
    expect(headings).toContain('## Scope Boundaries')
  })
})

// ---------------------------------------------------------------------------
// validateSectionImplementation
// ---------------------------------------------------------------------------

const SPECS = parseSectionSpecs(PROPOSAL_TEMPLATE)

describe('validateSectionImplementation', () => {
  describe('fully implemented document', () => {
    const GOOD_DOC = `
# Proposal: Add widget renderer

**Hash**: #abc123def456789a
**Status**: pending

## Summary

This proposal adds a new widget renderer to the generation pipeline. It introduces
a typed \`WidgetRenderer\` class and integrates it with the existing diagram catalogue.
The implementation follows the existing pattern established in diagram-generator-base.ts.

## Tasks

- [x] Implement WidgetRenderer class in src/generation/widget-renderer.ts
- [x] Register it in diagram-catalogue.ts
- [x] Add unit tests in tests/generation/widget-renderer.test.ts

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/generation/widget-renderer.ts | create | New renderer class |
| src/generation/diagram-catalogue.ts | modify | Register new renderer |

## Dependencies

*No dependencies.*
`.trimStart()

    it('returns allowed: true', () => {
      const result = validateSectionImplementation(GOOD_DOC, SPECS)
      expect(result.allowed).toBe(true)
    })

    it('returns an overallScore', () => {
      const result = validateSectionImplementation(GOOD_DOC, SPECS)
      expect(typeof result.overallScore).toBe('number')
      expect(result.overallScore).toBeGreaterThan(0)
      expect(result.overallScore).toBeLessThanOrEqual(100)
    })

    it('produces no errors', () => {
      const result = validateSectionImplementation(GOOD_DOC, SPECS)
      expect(result.errors).toBeUndefined()
    })
  })

  describe('document with unreplaced bracket placeholders', () => {
    const PLACEHOLDER_DOC = `
## Summary

[2-3 sentence description of what this proposal accomplishes. Focus on the outcome.]

## Tasks

- [ ] Implement stuff

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/foo.ts | create | A real description |

## Dependencies

*No dependencies.*
`.trimStart()

    it('reports errors for placeholders in required sections', () => {
      const result = validateSectionImplementation(PLACEHOLDER_DOC, SPECS)
      expect(result.errors?.some((e) => /placeholder/i.test(e))).toBe(true)
    })

    it('sets allowed: false', () => {
      const result = validateSectionImplementation(PLACEHOLDER_DOC, SPECS)
      expect(result.allowed).toBe(false)
    })

    it('generates a sectionScore for the affected section with placeholderCount > 0', () => {
      const result = validateSectionImplementation(PLACEHOLDER_DOC, SPECS)
      const summaryScore = result.sectionScores.find((s) => s.section === '## Summary')
      expect(summaryScore?.placeholderCount).toBeGreaterThan(0)
    })

    it('penalises score for the placeholder section', () => {
      const result = validateSectionImplementation(PLACEHOLDER_DOC, SPECS)
      const summaryScore = result.sectionScores.find((s) => s.section === '## Summary')
      expect(summaryScore?.score).toBeLessThan(100)
    })
  })

  describe('document with stale markers', () => {
    const STALE_DOC = `
## Summary

This proposal implements the new TBD module. We'll address FIXME issues in future.

## Tasks

- [ ] Real task here

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/foo.ts | modify | Fix the TBD handler |

## Dependencies

*No dependencies.*
`.trimStart()

    it('reports warnings for stale markers', () => {
      const result = validateSectionImplementation(STALE_DOC, SPECS)
      const allMessages = [...(result.warnings ?? []), ...(result.errors ?? [])]
      expect(allMessages.some((m) => /stale/i.test(m))).toBe(true)
    })

    it('reduces section score for stale markers', () => {
      const result = validateSectionImplementation(STALE_DOC, SPECS)
      const summaryScore = result.sectionScores.find((s) => s.section === '## Summary')
      expect(summaryScore?.score).toBeLessThan(100)
    })

    it('does not flag lowercase technical uses of "placeholder" as stale markers', () => {
      const doc = `
## Summary

Extend the existing describe block. Verify that renderProposalTemplate correctly
replaces a template placeholder with content, and omits the placeholder when
data is absent. Use bracket placeholders like [description] only in the template.

## Tasks

- [ ] Test that the placeholder is replaced with real content
- [ ] Test that SQL placeholders (?) are generated correctly

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| tests/foo.test.ts | modify | Add placeholder tests |

## Dependencies

*No dependencies.*
`.trimStart()
      const result = validateSectionImplementation(doc, SPECS)
      const allMessages = [...(result.warnings ?? []), ...(result.errors ?? [])]
      expect(allMessages.some((m) => /stale/i.test(m))).toBe(false)
    })
  })

  describe('document with empty sections', () => {
    it('returns score 0 for an empty section', () => {
      const doc = `
## Summary


## Tasks

- [ ] Real task here

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/foo.ts | modify | do something |

## Dependencies

*No dependencies.*
`.trimStart()
      const result = validateSectionImplementation(doc, SPECS)
      const summaryScore = result.sectionScores.find((s) => s.section === '## Summary')
      expect(summaryScore?.score).toBe(0)
      expect(summaryScore?.hasContent).toBe(false)
    })

    it('reports error for empty required section', () => {
      const doc = `
## Summary


## Tasks

- [ ] Real task

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/foo.ts | create | A thing |

## Dependencies

*No dependencies.*
`.trimStart()
      const result = validateSectionImplementation(doc, SPECS)
      expect(result.errors?.some((e) => /Summary/i.test(e))).toBe(true)
    })
  })

  describe('optional sections with placeholders', () => {
    const DOC_WITH_OPTIONAL_PLACEHOLDER = `
## Summary

This proposal refactors the gate writer to support batched writes. It reduces I/O
overhead by grouping writes into a single transaction. The change is backward compatible.

## Tasks

- [ ] Refactor gate-writer.ts to batch writes

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/core/gate-writer.ts | modify | Batch write support |

## Dependencies

*No dependencies.*

## Implementation Notes

[Optional: Additional notes for the implementer about approach, risks, or constraints.]
`.trimStart()

    it('produces a warning (not an error) for optional section with placeholder', () => {
      const result = validateSectionImplementation(DOC_WITH_OPTIONAL_PLACEHOLDER, SPECS)
      // Should be in warnings, not errors
      const hasError = result.errors?.some((e) => /Implementation Notes/i.test(e))
      const hasWarn = result.warnings?.some((w) => /Implementation Notes/i.test(w))
      expect(hasError).toBeFalsy()
      expect(hasWarn).toBe(true)
    })
  })

  describe('absent sections', () => {
    it('skips scoring for absent sections (presence is checked elsewhere)', () => {
      const doc = `
## Summary

This is a real summary about the work being done here.
`.trimStart()
      // Sections not in doc should not appear in sectionScores
      const result = validateSectionImplementation(doc, SPECS)
      const scored = result.sectionScores.map((s) => s.section)
      expect(scored).toContain('## Summary')
      // Tasks, Files etc. absent → not in sectionScores
      expect(scored).not.toContain('## Tasks')
    })
  })

  describe('overallScore', () => {
    it('is 100 when no sections are present to score (vacuous pass)', () => {
      const result = validateSectionImplementation('# Heading only\n\nNo h2 sections.\n', SPECS)
      expect(result.overallScore).toBe(100)
      expect(result.sectionScores).toHaveLength(0)
    })

    it('is an integer in 0–100 range', () => {
      const result = validateSectionImplementation(
        `
## Summary

[placeholder text]

## Tasks

- [ ] do something

## Files Affected

| File | Action | Desc |
| ---- | ------ | ---- |
| src/a.ts | create | real |

## Dependencies

*No dependencies.*
`.trimStart(),
        SPECS
      )
      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(100)
      expect(Number.isInteger(result.overallScore)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// loadSectionSpecs / cache
// ---------------------------------------------------------------------------

describe('loadSectionSpecs', () => {
  let originalReadFile: typeof import('../../../src/utils/file.js').readFile

  beforeEach(() => {
    clearSectionSpecsCache()
    vi.resetModules()
  })

  afterEach(() => {
    clearSectionSpecsCache()
    vi.restoreAllMocks()
  })

  it('loads and parses specs from the proposal template', async () => {
    const specs = await loadSectionSpecs('proposal')
    expect(specs.length).toBeGreaterThan(0)
    expect(specs.some((s) => s.heading === '## Summary')).toBe(true)
  })

  it('loads and parses specs from the gate template', async () => {
    const specs = await loadSectionSpecs('gate')
    expect(specs.length).toBeGreaterThan(0)
    expect(specs.some((s) => s.heading === '## Overview' || specs.some((s2) => s2.heading === '## Objectives'))).toBe(true)
  })

  it('returns the same array reference on repeated calls (cache hit)', async () => {
    const first = await loadSectionSpecs('proposal')
    const second = await loadSectionSpecs('proposal')
    expect(first).toBe(second)
  })

  it('re-reads after clearSectionSpecsCache', async () => {
    const first = await loadSectionSpecs('proposal')
    clearSectionSpecsCache()
    const second = await loadSectionSpecs('proposal')
    // Different array instance after cache clear
    expect(first).not.toBe(second)
    // But same content
    expect(first.map((s) => s.heading)).toEqual(second.map((s) => s.heading))
  })
})

// ---------------------------------------------------------------------------
// extractLLMInstructionFragments
// ---------------------------------------------------------------------------

describe('extractLLMInstructionFragments', () => {
  it('returns empty array when no HTML comments are present', () => {
    const body = `
## Summary

This is real content with no comments.
`.trimStart()
    expect(extractLLMInstructionFragments(body)).toEqual([])
  })

  it('extracts lines from HTML comment blocks', () => {
    const body = `
<!-- LLM Instructions — describe the goal succinctly without restating the heading line -->
Content here.
`.trimStart()
    const fragments = extractLLMInstructionFragments(body)
    expect(fragments.length).toBeGreaterThan(0)
    expect(fragments[0]).toContain('LLM Instructions')
  })

  it('skips lines shorter than 20 chars', () => {
    const body = `<!-- short\nThis is a long enough line for extraction purposes here -->`.trimStart()
    const fragments = extractLLMInstructionFragments(body)
    // 'short' is too short; the long line should be captured
    expect(fragments.every((f) => f.length >= 20)).toBe(true)
  })

  it('skips decoration-only lines (all dashes/equals/stars)', () => {
    const body = `<!--\n------\n=====\nThis is a meaningful instruction line here\n-->`.trimStart()
    const fragments = extractLLMInstructionFragments(body)
    expect(fragments.every((f) => !/^[-=*\s]+$/.test(f))).toBe(true)
  })

  it('truncates each fragment to 60 chars', () => {
    const longLine = 'A'.repeat(100)
    const body = `<!-- ${longLine} -->`
    const fragments = extractLLMInstructionFragments(body)
    expect(fragments.every((f) => f.length <= 60)).toBe(true)
  })

  it('extracts from multiple comment blocks', () => {
    const body = `
<!-- First LLM instruction block for the generator guidance provided -->
Content.
<!-- Second LLM instruction block to guide the second section output -->
More content.
`.trimStart()
    const fragments = extractLLMInstructionFragments(body)
    expect(fragments.length).toBe(2)
  })

  it('caps at 6 fragments per comment block', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}: instruction text for guidance`).join('\n')
    const body = `<!--\n${lines}\n-->`
    const fragments = extractLLMInstructionFragments(body)
    expect(fragments.length).toBeLessThanOrEqual(6)
  })
})

// ---------------------------------------------------------------------------
// extractScaffoldFingerprints
// ---------------------------------------------------------------------------

describe('extractScaffoldFingerprints', () => {
  it('returns empty array for empty body', () => {
    expect(extractScaffoldFingerprints('')).toEqual([])
  })

  it('returns empty array for pure markdown structure', () => {
    const body = `
## Heading

| col1 | col2 |
| ---- | ---- |

---
`.trimStart()
    expect(extractScaffoldFingerprints(body)).toEqual([])
  })

  it('extracts instructional-prose lines of sufficient length', () => {
    const body = `
Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

- [ ] Do something
`.trimStart()
    const fps = extractScaffoldFingerprints(body)
    expect(fps.some((f) => f.startsWith('Atomic, LLM-executable tasks.'))).toBe(true)
  })

  it('skips checkbox list items', () => {
    const body = `
- [ ] Implement the widget renderer class
- [x] Add unit tests for the widget renderer
`.trimStart()
    expect(extractScaffoldFingerprints(body)).toEqual([])
  })

  it('skips short lines (<25 chars after trimming)', () => {
    const body = `Short line.\n`
    expect(extractScaffoldFingerprints(body)).toEqual([])
  })

  it('skips lines with fewer than 4 words', () => {
    const body = `This three words.\nAnother short one.\n`
    // "This three words." and "Another short one." are each < 4 words
    expect(extractScaffoldFingerprints(body)).toEqual([])
  })

  it('skips a line that is only a bracket placeholder', () => {
    const body = `[2-3 sentence description of the proposal outcome]\n`
    expect(extractScaffoldFingerprints(body)).toEqual([])
  })

  it('deduplicates identical fingerprints', () => {
    const line = 'Atomic, LLM-executable tasks. Each should be done in one session.'
    const body = `${line}\n${line}\n`
    const fps = extractScaffoldFingerprints(body)
    // Should only appear once
    expect(fps.length).toBe(1)
  })

  it('truncates fingerprints to 45 chars', () => {
    const long = 'This is a very long instructional prose line that exceeds forty-five characters'
    const fps = extractScaffoldFingerprints(long + '\n')
    expect(fps.every((f) => f.length <= 45)).toBe(true)
  })

  it('strips leading list markers before creating fingerprint', () => {
    const body = `- Atomic, LLM-executable tasks. Completable in a single implementation session.\n`
    const fps = extractScaffoldFingerprints(body)
    // Should not start with "- "
    expect(fps.every((f) => !f.startsWith('- '))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// parseSectionSpecs — new fields: llmInstructionFragments + scaffoldFingerprints
// ---------------------------------------------------------------------------

describe('parseSectionSpecs – dynamic fields', () => {
  const TEMPLATE_WITH_LLM_COMMENTS = `
## Summary

<!-- LLM Instructions — write a concise outcome-focused summary paragraph here -->

[2-3 sentence description of what this proposal accomplishes.]

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

- [ ] Implement the feature
- [ ] Add unit tests
`.trimStart()

  it('populates llmInstructionFragments from HTML comment blocks', () => {
    const specs = parseSectionSpecs(TEMPLATE_WITH_LLM_COMMENTS)
    const summary = specs.find((s) => s.heading === '## Summary')
    expect(summary?.llmInstructionFragments.length).toBeGreaterThan(0)
    expect(summary?.llmInstructionFragments[0]).toContain('LLM Instructions')
  })

  it('does not populate llmInstructionFragments for sections without comments', () => {
    const specs = parseSectionSpecs(TEMPLATE_WITH_LLM_COMMENTS)
    // NOTE: TEMPLATE_WITH_LLM_COMMENTS Tasks section has no comment
    const tasks = specs.find((s) => s.heading === '## Tasks')
    expect(tasks?.llmInstructionFragments).toEqual([])
  })

  it('populates scaffoldFingerprints dynamically from template prose lines', () => {
    const specs = parseSectionSpecs(TEMPLATE_WITH_LLM_COMMENTS)
    const tasks = specs.find((s) => s.heading === '## Tasks')
    // The "Atomic, LLM-executable tasks..." line should be captured
    expect(tasks?.scaffoldFingerprints.some((f) => f.startsWith('Atomic'))).toBe(true)
  })

  it('does not include placeholder-only lines in scaffoldFingerprints', () => {
    const specs = parseSectionSpecs(TEMPLATE_WITH_LLM_COMMENTS)
    const summary = specs.find((s) => s.heading === '## Summary')
    // "[2-3 sentence description...]" is a bracket placeholder and should not be a fingerprint
    expect(summary?.scaffoldFingerprints.every((f) => !f.startsWith('['))).toBe(true)
  })

  it('does not include LLM comment content in scaffoldFingerprints', () => {
    const specs = parseSectionSpecs(TEMPLATE_WITH_LLM_COMMENTS)
    const summary = specs.find((s) => s.heading === '## Summary')
    // Comment lines are stripped before scaffold extraction; should not overlap
    const llmContent = summary?.llmInstructionFragments[0]
    if (llmContent) {
      expect(summary?.scaffoldFingerprints.some((f) => f.includes(llmContent))).toBe(false)
    }
  })

  it('real proposal template has llmInstructionFragments on relevant sections', async () => {
    const specs = await loadSectionSpecs('proposal')
    // At least one section in the real template should have LLM instruction fragments
    const hasSomeFragments = specs.some((s) => s.llmInstructionFragments.length > 0)
    expect(hasSomeFragments).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateSectionImplementation — LLM instruction bleed detection
// ---------------------------------------------------------------------------

describe('validateSectionImplementation – LLM instruction bleed', () => {
  const TEMPLATE_WITH_LLM = `
## Summary

<!-- LLM Instructions — write a concise outcome-focused summary paragraph here focused on results -->

[2-3 sentence description of what this proposal accomplishes.]

## Tasks

- [ ] Implement the feature

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/x.ts | create | [description] |

## Dependencies

*None.*
`.trimStart()

  const SPECS_WITH_LLM = parseSectionSpecs(TEMPLATE_WITH_LLM)

  it('detects error when LLM instruction fragment is present verbatim in a required section', () => {
    // The artifact body contains the LLM instruction fragment literally
    const LLM_FRAGMENT = 'LLM Instructions — write a concise outcome-focused summary'
    const doc = `
## Summary

${LLM_FRAGMENT} paragraph here focused on results.
This is some real content added after the bleed.

## Tasks

- [x] Implemented the feature

## Files Affected

| File | Action | Description |
| ---- | ------ | ------------ |
| src/x.ts | create | The new file |

## Dependencies

*None.*
`.trimStart()

    const result = validateSectionImplementation(doc, SPECS_WITH_LLM)
    // Should flag the bleed
    const allMessages = [...(result.errors ?? []), ...(result.warnings ?? [])]
    expect(allMessages.some((m) => /LLM instruction/i.test(m))).toBe(true)
  })

  it('reduces score when LLM instruction bleed is detected', () => {
    const LLM_FRAGMENT = 'LLM Instructions — write a concise outcome-focused summary paragraph'
    const doc = `
## Summary

${LLM_FRAGMENT} here focused on results.

## Tasks

- [x] Done.

## Files Affected

| File | Action | Description |
| ---- | ------ | ------------ |
| src/x.ts | modify | Real description |

## Dependencies

*None.*
`.trimStart()

    const result = validateSectionImplementation(doc, SPECS_WITH_LLM)
    const summaryScore = result.sectionScores.find((s) => s.section === '## Summary')
    expect(summaryScore?.score).toBeLessThan(100)
  })

  it('includes llmBleed field on the sectionScore when bleed detected', () => {
    const LLM_FRAGMENT = 'LLM Instructions — write a concise outcome-focused summary paragraph here'
    const doc = `
## Summary

${LLM_FRAGMENT} focused on results.

## Tasks

- [x] Done implementation.

## Files Affected

| File | Action | Description |
| ---- | ------ | ------------ |
| src/x.ts | create | Real desc |

## Dependencies

*None.*
`.trimStart()

    const result = validateSectionImplementation(doc, SPECS_WITH_LLM)
    const summaryScore = result.sectionScores.find((s) => s.section === '## Summary')
    expect(summaryScore?.llmBleed).toBeDefined()
    expect(summaryScore?.llmBleed?.length).toBeGreaterThan(0)
  })

  it('does not flag a clean section with no LLM bleed', () => {
    const doc = `
## Summary

This proposal introduces a new caching layer to the artifact validation service.
It reduces repeated file reads by storing parsed results in a module-level Map.
The change is fully backward compatible with existing call sites.

## Tasks

- [x] Add module-level cache Map
- [x] Update loadSectionSpecs to check cache first

## Files Affected

| File | Action | Description |
| ---- | ------ | ------------ |
| src/mcp/validators/section-implementation-validator.ts | modify | Add caching |

## Dependencies

*None.*
`.trimStart()

    const result = validateSectionImplementation(doc, SPECS_WITH_LLM)
    const summaryScore = result.sectionScores.find((s) => s.section === '## Summary')
    expect(summaryScore?.llmBleed ?? []).toHaveLength(0)
    expect(summaryScore?.score).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// validateSectionImplementation — dynamic scaffold fingerprint matching
// ---------------------------------------------------------------------------

describe('validateSectionImplementation – dynamic scaffold fingerprints', () => {
  const SCAFFOLD_TEMPLATE = `
## Summary

[2-3 sentence description of what this proposal accomplishes.]

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

- [ ] Implement the feature

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| [path/to/file.ts] | create | [short description] |

## Dependencies

*None.*
`.trimStart()

  const SCAFFOLD_SPECS = parseSectionSpecs(SCAFFOLD_TEMPLATE)

  it('warns when template scaffold line appears unchanged in the artifact', () => {
    // The scaffold fingerprint "Atomic, LLM-executable tasks. Each task" should be detected
    const doc = `
## Summary

This proposal implements the new caching layer for the validator service.

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

- [ ] Implement caching

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/validator.ts | modify | Add caching |

## Dependencies

*None.*
`.trimStart()

    const result = validateSectionImplementation(doc, SCAFFOLD_SPECS)
    const allMessages = [...(result.errors ?? []), ...(result.warnings ?? [])]
    expect(allMessages.some((m) => /scaffold/i.test(m))).toBe(true)
  })

  it('does not warn when scaffold lines have been replaced with real content', () => {
    const doc = `
## Summary

This proposal introduces lazy caching to the section spec loader. The change avoids
redundant file reads across multiple validation calls in a single process lifetime.
All existing tests continue to pass unchanged.

## Tasks

- [x] Add module-level Map cache after loadSectionSpecs function definition
- [x] Return early from cache on second invocation

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| src/mcp/validators/section-implementation-validator.ts | modify | Add spec cache |

## Dependencies

*None.*
`.trimStart()

    const result = validateSectionImplementation(doc, SCAFFOLD_SPECS)
    const allMessages = [...(result.errors ?? []), ...(result.warnings ?? [])]
    const scaffoldWarnings = allMessages.filter((m) => /scaffold/i.test(m))
    expect(scaffoldWarnings).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// extractScaffoldFingerprints — inline placeholder false-positive regression
// ---------------------------------------------------------------------------

describe('extractScaffoldFingerprints – inline bracket placeholder lines', () => {
  it('does not fingerprint a line whose invariant prefix is followed by an inline placeholder', () => {
    // Template line: diagram path + inline [placeholder] — the prefix is invariant
    // and MUST remain in real artifacts after the placeholder is filled.
    const templateSection = `
## Architecture Updates

- System Overview: \`zeno/architecture/system-overview.md\` - [describe specific changes]
- Data Flow: \`zeno/architecture/data-flow.md\` - [describe specific changes]
`.trimStart()

    const specs = parseSectionSpecs(templateSection)
    const archSpec = specs.find((s) => s.heading === '## Architecture Updates')
    expect(archSpec).toBeDefined()

    // Neither path prefix should appear as a scaffold fingerprint
    const fps = archSpec!.scaffoldFingerprints
    expect(fps.some((fp) => fp.startsWith('System Overview:'))).toBe(false)
    expect(fps.some((fp) => fp.startsWith('Data Flow:'))).toBe(false)
  })

  it('does not warn when the invariant path prefix of a diagram line is present after placeholder is filled', () => {
    const template = `
## Architecture Updates

- System Overview: \`zeno/architecture/system-overview.md\` - [describe specific changes]
- Data Flow: \`zeno/architecture/data-flow.md\` - [describe specific changes]
`.trimStart()

    const specs = parseSectionSpecs(template)

    const artifact = `
## Architecture Updates

- System Overview: \`zeno/architecture/system-overview.md\` - Add approval workflow module
- Data Flow: \`zeno/architecture/data-flow.md\` - Add approval/rejection feedback flow
`.trimStart()

    const result = validateSectionImplementation(artifact, specs)
    const allMessages = [...(result.errors ?? []), ...(result.warnings ?? [])]
    expect(allMessages.some((m) => /scaffold/i.test(m))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// extractScaffoldFingerprints — HTML comment lines are not scaffold
// ---------------------------------------------------------------------------

describe('extractScaffoldFingerprints – HTML comment process-invariant lines', () => {
  it('does not fingerprint process-invariant sub-bullets wrapped in HTML comments', () => {
    // Template wraps "keep verbatim" process rules in HTML comments so they never
    // become scaffold fingerprints even when gate PRDs copy them verbatim.
    const templateSection = `
## Implementation Steps

1. **Define Acceptance Tests**
   - Write tests that define the gate's acceptance criteria
   <!-- Tests establish the contract before implementation begins -->

4. **Test Cleanup**
   <!-- Refine tests, add edge cases, ensure coverage \u226590% -->
   <!-- Validates all gate deliverables meet quality thresholds -->
`.trimStart()

    const specs = parseSectionSpecs(templateSection)
    const implSpec = specs.find((s) => s.heading === '## Implementation Steps')
    expect(implSpec).toBeDefined()

    const fps = implSpec!.scaffoldFingerprints
    expect(fps.some((fp) => fp.startsWith('Tests establish the contract'))).toBe(false)
    expect(fps.some((fp) => fp.startsWith('Refine tests, add edge cases'))).toBe(false)
    expect(fps.some((fp) => fp.startsWith('Validates all gate deliverables'))).toBe(false)
  })

  it('does not warn when gate PRD keeps process-invariant sub-bullets verbatim', () => {
    const template = `
## Implementation Steps

1. **Define Acceptance Tests**
   - Write tests that define the gate's acceptance criteria
   <!-- Tests establish the contract before implementation begins -->

4. **Test Cleanup**
   <!-- Refine tests, add edge cases, ensure coverage \u226590% -->
   <!-- Validates all gate deliverables meet quality thresholds -->
`.trimStart()

    const specs = parseSectionSpecs(template)

    const artifact = `
## Implementation Steps

1. **Define Acceptance Tests**
   - Write tests for approval/rejection commands, status tracking, and audit trail
   - Tests establish the contract before implementation begins

4. **Test Cleanup**
   - Refine tests, add edge cases, ensure coverage \u226590%
   - Validates all gate deliverables meet quality thresholds
`.trimStart()

    const result = validateSectionImplementation(artifact, specs)
    const allMessages = [...(result.errors ?? []), ...(result.warnings ?? [])]
    expect(allMessages.some((m) => /scaffold/i.test(m))).toBe(false)
  })
})
