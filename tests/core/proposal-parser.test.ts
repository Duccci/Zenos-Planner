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
})
