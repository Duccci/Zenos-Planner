import { describe, it, expect } from 'vitest'
import { extractObjectives, extractRequirements, parseProposalMetadata } from '../../src/core/proposal-parser.js'

const sampleGate = `# Gate: Example

## Objectives
- Implement feature A
- Add logging support

## Requirements
- #abcd12340ef56789: Add API endpoint
- #ef5678901234abcd: Update DB schema

---
`

describe('Proposal Parser', () => {
  it('extracts objectives', () => {
    const objectives = extractObjectives(sampleGate)
    expect(objectives).toEqual(['Implement feature A', 'Add logging support'])
  })

  it('extracts requirements', () => {
    const reqs = extractRequirements(sampleGate)
    expect(reqs.length).toBe(2)
    expect(reqs[0].id).toBe('abcd12340ef56789')
    expect(reqs[1].id).toBe('ef5678901234abcd')
  })

  // ---------------------------------------------------------------------------
  // Branch coverage: early-return paths and nullish fallbacks
  // ---------------------------------------------------------------------------

  it('extractObjectives returns [] when Objectives section is absent', () => {
    const content = '# Gate\n\nNo objectives section here.'
    const result = extractObjectives(content)
    expect(result).toEqual([])
  })

  it('extractObjectives returns [] of non-list lines when section exists but has no bullets', () => {
    const content = '# Gate\n\n## Objectives\nPlain prose line\n\n## Requirements\n'
    const result = extractObjectives(content)
    // Plain prose doesn't start with '- ', so filter removes it
    expect(result).toEqual([])
  })

  it('extractRequirements returns [] when Requirements section is absent', () => {
    const content = '# Gate\n\n## Objectives\n- Obj 1\n'
    const result = extractRequirements(content)
    expect(result).toEqual([])
  })

  it('extractRequirements filters out entries with no valid 16-char hash', () => {
    // Lines with # but no valid 16-char alphanumeric hash trigger hashMatch?.[1] ?? '' path
    // Use 3-char and 5-char fragments that are too short to match [a-z0-9]{16}
    const content =
      '# Gate\n\n## Requirements\n- #abc: too short (3 chars)\n- #12345: five chars\n\n---\n'
    const result = extractRequirements(content)
    // Both should be filtered by .filter((req) => req.id) since id is '' for invalid hashes
    expect(result).toEqual([])
  })

  it('extractObjectives handles content that has Objectives section at end (no trailing section)', () => {
    // Trailing newline ensures the \n$ lookahead in the regex can match
    const content = '# Gate\n\n## Objectives\n- Final objective\n'
    const result = extractObjectives(content)
    expect(result).toEqual(['Final objective'])
  })

  it('parseProposalMetadata extracts hash with # prefix', () => {
    const content = '**Hash**: #d26021701\n'
    const result = parseProposalMetadata(content)
    expect(result.hash).toBe('d26021701')
  })

  it('parseProposalMetadata extracts hash without # prefix', () => {
    const content = '**Hash**: d26021701\n'
    const result = parseProposalMetadata(content)
    expect(result.hash).toBe('d26021701')
  })

  it('parseProposalMetadata extracts title from first heading', () => {
    const content = '# Proposal: Test Proposal\n\nContent here'
    const result = parseProposalMetadata(content)
    expect(result.title).toBe('Proposal: Test Proposal')
  })

  it('parseProposalMetadata extracts status', () => {
    const content = '**Status**: pending\n'
    const result = parseProposalMetadata(content)
    expect(result.status).toBe('pending')
  })

  it('parseProposalMetadata extracts gate', () => {
    const content = '**Gate**: gate-01\n'
    const result = parseProposalMetadata(content)
    expect(result.gate).toBe('gate-01')
  })

  it('parseProposalMetadata extracts all fields from complete proposal', () => {
    const content = `# Proposal: Complete Test

**Hash**: #abc12345
**Status**: in_progress
**Gate**: gate-05

## Summary
Test summary here
`
    const result = parseProposalMetadata(content)
    expect(result.hash).toBe('abc12345')
    expect(result.title).toBe('Proposal: Complete Test')
    expect(result.status).toBe('in_progress')
    expect(result.gate).toBe('gate-05')
  })

  it('parseProposalMetadata returns undefined for missing fields', () => {
    const content = '# Some Title\n\nJust content, no metadata'
    const result = parseProposalMetadata(content)
    expect(result.hash).toBeUndefined()
    expect(result.status).toBeUndefined()
    expect(result.gate).toBeUndefined()
    expect(result.title).toBe('Some Title')
  })

  it('parseProposalMetadata handles solitary gate', () => {
    const content = '**Gate**: solitary\n'
    const result = parseProposalMetadata(content)
    expect(result.gate).toBe('solitary')
  })

  it('parseProposalMetadata is case-insensitive for field names', () => {
    const content = '**hash**: #test1234\n**STATUS**: completed\n'
    const result = parseProposalMetadata(content)
    expect(result.hash).toBe('test1234')
    expect(result.status).toBe('completed')
  })

  // ---------------------------------------------------------------------------
  // extractObjectives — sectioned (### heading) format
  // ---------------------------------------------------------------------------

  it('extractObjectives treats ### headings in Objectives as top-level objectives', () => {
    const content = `# Gate 06

## Objectives

### Repository Declaration & Storage

- [ ] Create repositories table in SQLite
- [ ] Implement CRUD operations

### Cross-Repo Dependencies

- [ ] Implement dependency tracking
- [ ] Build visualization

## Context
`
    const result = extractObjectives(content)
    expect(result).toEqual([
      'Repository Declaration & Storage',
      'Cross-Repo Dependencies',
    ])
  })

  it('extractObjectives ignores indented nested bullets in flat-list format', () => {
    const content = `# Gate 07

## Objectives

- [ ] Top-level objective A
  - [ ] Nested sub-item (should be excluded)
  - [ ] Another nested sub-item (should be excluded)
- [ ] Top-level objective B

## Context
`
    const result = extractObjectives(content)
    expect(result).toEqual(['Top-level objective A', 'Top-level objective B'])
  })

  it('extractObjectives prefers ### headings over flat bullets when both are present', () => {
    const content = `# Gate

## Objectives

### Group A

- [ ] Bullet under group A

### Group B

- [ ] Bullet under group B

## Context
`
    const result = extractObjectives(content)
    // Headings take priority — individual bullets are detail, not proposal units
    expect(result).toEqual(['Group A', 'Group B'])
  })

  it('extractObjectives strips checkboxes from flat bullets', () => {
    const content = `# Gate

## Objectives

- [ ] Pending objective
- [x] Completed objective

## Context
`
    const result = extractObjectives(content)
    expect(result).toEqual(['Pending objective', 'Completed objective'])
  })
})
