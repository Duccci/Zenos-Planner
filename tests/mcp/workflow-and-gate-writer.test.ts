import { describe, it, expect } from 'vitest'
import { createGatePrdFiles, updateGateDiagrams } from '../../src/core/gate-writer.js'

describe('createGatePrdFiles', () => {
  it('returns the same gates passed in', async () => {
    const gates = [
      { id: 'gate-01', name: 'Setup', type: 'feature', status: 'pending', requirementsCount: 3, dependencies: [] },
      { id: 'gate-02', name: 'Build', type: 'feature', status: 'pending', requirementsCount: 5, dependencies: ['gate-01'] },
    ]
    const result = await createGatePrdFiles(gates, 'gate-prd-template', '/some/project')
    expect(result).toEqual(gates)
  })

  it('handles empty gates array', async () => {
    const result = await createGatePrdFiles([], 'template', '/project')
    expect(result).toEqual([])
  })
})

describe('updateGateDiagrams', () => {
  it('returns the gate-roadmap path', async () => {
    const gates = [
      { id: 'gate-01', name: 'Setup', type: 'feature', status: 'pending', requirementsCount: 1, dependencies: [] },
    ]
    const result = await updateGateDiagrams(gates, '/project')
    expect(result).toContain('zeno/architecture/gate-roadmap.md')
  })

  it('handles empty gates array', async () => {
    const result = await updateGateDiagrams([], '/project')
    expect(Array.isArray(result)).toBe(true)
  })
})
