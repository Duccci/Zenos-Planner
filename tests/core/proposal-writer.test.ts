import { describe, it, expect } from 'vitest'
import { generateTasksFromObjective, calculateProposalDependencies } from '../../src/core/proposal-writer.js'

describe('Proposal Writer helpers', () => {
  it('generates tasks from objective', () => {
    const tasks = generateTasksFromObjective('Add Feature X')
    expect(tasks).toContain('Implement add feature x')
  })

  it('calculates sequential dependencies', () => {
    const proposals = [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }]
    const deps = calculateProposalDependencies(proposals as any)
    expect(deps.length).toBe(2)
    expect(deps[0]).toEqual({ from: 'a', to: 'b', type: 'sequential' })
  })
})
