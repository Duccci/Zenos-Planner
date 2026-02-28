/**
 * Template Sections Validator Tests
 *
 * Covers:
 *   parseTemplateSections  - required vs optional heading detection
 *   validateTemplateSections - error on missing required, warning on missing optional
 *   loadTemplateSections    - file I/O with cache, falls back gracefully on missing file
 *   clearTemplateSectionsCache - cache invalidation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseTemplateSections,
  validateTemplateSections,
  loadTemplateSections,
  clearTemplateSectionsCache,
} from '../../../src/mcp/validators/template-sections-validator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMPLATE_WITH_OPTIONAL = `
# Proposal Template

## Summary

Required section content.

## Tasks

Required tasks content.

## Files Affected

Required files content.

## Dependencies

Required deps content.

## Implementation Notes

[Optional: You may omit this section if not needed.]

## Rollback

Required rollback content.
`.trimStart()

const TEMPLATE_ALL_REQUIRED = `
# Gate Template

## Objectives

Objectives content.

## Context

Context content.
`.trimStart()

// ---------------------------------------------------------------------------
// parseTemplateSections
// ---------------------------------------------------------------------------

describe('parseTemplateSections', () => {
  it('classifies headings without [Optional marker as required', () => {
    const result = parseTemplateSections(TEMPLATE_WITH_OPTIONAL)
    expect(result.required).toContain('## Summary')
    expect(result.required).toContain('## Tasks')
    expect(result.required).toContain('## Files Affected')
    expect(result.required).toContain('## Dependencies')
    expect(result.required).toContain('## Rollback')
  })

  it('classifies heading whose body starts with [Optional as optional', () => {
    const result = parseTemplateSections(TEMPLATE_WITH_OPTIONAL)
    expect(result.optional).toContain('## Implementation Notes')
    expect(result.required).not.toContain('## Implementation Notes')
  })

  it('returns empty arrays for template with no ## headings', () => {
    const result = parseTemplateSections('# Title\n\n### Only h3 here\n\nsome text\n')
    expect(result.required).toHaveLength(0)
    expect(result.optional).toHaveLength(0)
  })

  it('handles template where all sections are required', () => {
    const result = parseTemplateSections(TEMPLATE_ALL_REQUIRED)
    expect(result.required).toContain('## Objectives')
    expect(result.required).toContain('## Context')
    expect(result.optional).toHaveLength(0)
  })

  it('trims whitespace from heading names', () => {
    const template = `## Summary  \n\nSome content.\n\n## Tasks\n\nMore content.\n`
    const result = parseTemplateSections(template)
    expect(result.required).toContain('## Summary')
    expect(result.required).toContain('## Tasks')
  })
})

// ---------------------------------------------------------------------------
// validateTemplateSections
// ---------------------------------------------------------------------------

describe('validateTemplateSections', () => {
  const sections = {
    required: ['## Summary', '## Tasks', '## Files Affected'],
    optional: ['## Implementation Notes'],
  }

  it('passes when all required sections are present', () => {
    const content = '## Summary\n\nFoo\n\n## Tasks\n\nBar\n\n## Files Affected\n\nBaz\n'
    const result = validateTemplateSections(content, sections)
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('reports error for each missing required section', () => {
    const content = '## Summary\n\nFoo\n'
    const result = validateTemplateSections(content, sections)
    expect(result.allowed).toBe(false)
    expect(result.errors).toHaveLength(2)
    expect(result.errors![0]).toContain('## Tasks')
    expect(result.errors![1]).toContain('## Files Affected')
  })

  it('reports warning for missing optional section', () => {
    const content = '## Summary\n\nFoo\n\n## Tasks\n\nBar\n\n## Files Affected\n\nBaz\n'
    const result = validateTemplateSections(content, sections)
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings![0]).toContain('Missing optional section')
    expect(result.warnings![0]).toContain('## Implementation Notes')
  })

  it('no warnings when optional section is present', () => {
    const content =
      '## Summary\n\nFoo\n\n## Tasks\n\nBar\n\n## Files Affected\n\nBaz\n\n## Implementation Notes\n\nOpt\n'
    const result = validateTemplateSections(content, sections)
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeUndefined()
  })

  it('reports both errors and warnings when required missing and optional missing', () => {
    const content = '## Summary\n\nFoo\n'
    const result = validateTemplateSections(content, {
      required: ['## Summary', '## Tasks'],
      optional: ['## Implementation Notes'],
    })
    expect(result.allowed).toBe(false)
    expect(result.errors).toHaveLength(1) // ## Tasks missing
    expect(result.warnings).toHaveLength(1) // ## Implementation Notes missing
  })

  it('passes with no required/optional sections defined', () => {
    const result = validateTemplateSections('anything', { required: [], optional: [] })
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
    expect(result.warnings).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// loadTemplateSections (file I/O, cache)
// ---------------------------------------------------------------------------

const mockReadFile = vi.fn()

vi.mock('../../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

describe('loadTemplateSections', () => {
  beforeEach(() => {
    clearTemplateSectionsCache()
    mockReadFile.mockReset()
  })

  afterEach(() => {
    clearTemplateSectionsCache()
  })

  it('reads proposal-template.md for proposal artifact type', async () => {
    mockReadFile.mockResolvedValueOnce(TEMPLATE_WITH_OPTIONAL)
    const result = await loadTemplateSections('proposal', '/fake/root')
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining('proposal-template.md')
    )
    expect(result.required).toContain('## Summary')
    expect(result.optional).toContain('## Implementation Notes')
  })

  it('reads gate-prd-template.md for gate artifact type', async () => {
    mockReadFile.mockResolvedValueOnce(TEMPLATE_ALL_REQUIRED)
    await loadTemplateSections('gate', '/fake/root')
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining('gate-prd-template.md')
    )
  })

  it('caches result so second call skips file read', async () => {
    mockReadFile.mockResolvedValueOnce(TEMPLATE_WITH_OPTIONAL)
    await loadTemplateSections('proposal', '/fake/root')
    await loadTemplateSections('proposal', '/fake/root')
    expect(mockReadFile).toHaveBeenCalledTimes(1)
  })

  it('after clearTemplateSectionsCache, re-reads the file', async () => {
    mockReadFile.mockResolvedValue(TEMPLATE_WITH_OPTIONAL)
    await loadTemplateSections('proposal', '/fake/root')
    clearTemplateSectionsCache()
    await loadTemplateSections('proposal', '/fake/root')
    expect(mockReadFile).toHaveBeenCalledTimes(2)
  })

  it('throws when file cannot be read', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT: no such file'))
    await expect(loadTemplateSections('proposal', '/missing/root')).rejects.toThrow('ENOENT')
  })
})
