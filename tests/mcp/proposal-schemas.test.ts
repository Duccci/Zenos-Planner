import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  ProposalListOutputSchema,
} from '../../src/mcp/schemas/proposal-schemas.js'

describe('ProposalListOutputSchema — parallelSets and parallelSetIndex', () => {
  it.skip('should parse a valid output with parallelSets', () => { // @red
    const result = ProposalListOutputSchema.parse({
      proposals: [],
      parallelSets: [],
    })
    expect(result.parallelSets).toEqual([])
  })

  it.skip('should parse a valid output with nested parallelSets', () => { // @red
    const result = ProposalListOutputSchema.parse({
      proposals: [],
      parallelSets: [['hash-a'], ['hash-b', 'hash-c'], ['hash-d']],
    })
    expect(result.parallelSets).toHaveLength(3)
    expect(result.parallelSets[1]).toEqual(['hash-b', 'hash-c'])
  })

  it.skip('should reject missing parallelSets (required field)', () => { // @red
    expect(() =>
      ProposalListOutputSchema.parse({
        proposals: [],
        // parallelSets intentionally omitted
      })
    ).toThrow(ZodError)
  })

  it.skip('should accept proposals with optional parallelSetIndex: 0', () => { // @red
    const result = ProposalListOutputSchema.parse({
      proposals: [
        {
          hash: '#abc12345',
          title: 'Test Proposal',
          status: 'pending',
          gateId: 'gate-01',
          tasksCompleted: 0,
          totalTasks: 1,
          lastUpdated: new Date().toISOString(),
          parallelSetIndex: 0,
        },
      ],
      parallelSets: [['#abc12345']],
    })
    expect(result.proposals[0]!.parallelSetIndex).toBe(0)
  })

  it.skip('should reject proposals with non-numeric parallelSetIndex', () => { // @red
    expect(() =>
      ProposalListOutputSchema.parse({
        proposals: [
          {
            hash: '#abc12345',
            title: 'Test Proposal',
            status: 'pending',
            gateId: 'gate-01',
            tasksCompleted: 0,
            totalTasks: 1,
            lastUpdated: new Date().toISOString(),
            parallelSetIndex: 'bad',
          },
        ],
        parallelSets: [],
      })
    ).toThrow(ZodError)
  })
})
