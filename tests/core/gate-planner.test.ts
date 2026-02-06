import { describe, it, expect } from 'vitest'
import { generateNewGates } from '../../src/core/gate-planner.js'

describe('Gate Planner', () => {
  it('generates gates from requirements', async () => {
    const reqs = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, description: `req ${i}` }))
    const gates = await generateNewGates('', reqs, 5)
    expect(gates.length).toBe(3)
    expect(gates[0].id).toBe('gate-01')
  })
})