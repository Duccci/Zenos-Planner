import { describe, it, expect } from 'vitest'
import { extractObjectives, extractRequirements } from '../../src/core/proposal-parser.js'

const sampleGate = `# Gate: Example

## Objectives
- Implement feature A
- Add logging support

## Requirements
- #abcd1234: Add API endpoint
- #ef567890: Update DB schema

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
    expect(reqs[0].id).toBe('abcd1234')
    expect(reqs[1].id).toBe('ef567890')
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

  it('extractRequirements filters out entries with no valid 8-char hash', () => {
    // Lines with # but no valid 8-char alphanumeric hash trigger hashMatch?.[1] ?? '' path
    // Use 3-char and 5-char fragments that are too short to match [a-z0-9]{8}
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
})
