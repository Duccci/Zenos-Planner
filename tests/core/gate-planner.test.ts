import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getProjectRequirements,
  generateNewGates,
  rebaselineGates,
  generateSingleGate,
} from '../../src/core/gate-planner.js'

describe('gate-planner', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getProjectRequirements', () => {
    it('should return empty requirements', async () => {
      const reqs = await getProjectRequirements('/project')
      expect(reqs).toEqual([])
    })
  })

  describe('generateNewGates', () => {
    it('should generate gates from requirements', async () => {
      const reqs = [
        { id: 'r1', description: 'First requirement' },
        { id: 'r2', description: 'Second requirement' },
        { id: 'r3', description: 'Third requirement' },
        { id: 'r4', description: 'Fourth requirement' },
        { id: 'r5', description: 'Fifth requirement' },
      ]

      const gates = await generateNewGates('PRD content', reqs, 2)

      expect(gates).toHaveLength(3) // 5 reqs / 2 per gate = 3 gates
      expect(gates[0]!.id).toBe('gate-01')
      expect(gates[0]!.dependencies).toEqual([])
      expect(gates[1]!.id).toBe('gate-02')
      expect(gates[1]!.dependencies).toEqual(['gate-01'])
      expect(gates[2]!.id).toBe('gate-03')
      expect(gates[2]!.dependencies).toEqual(['gate-02'])
    })

    it('should handle single requirement', async () => {
      const gates = await generateNewGates('PRD', [{ id: 'r1', description: 'Only one' }], 5)

      expect(gates).toHaveLength(1)
      expect(gates[0]!.requirementsCount).toBe(1)
    })

    it('should handle empty requirements', async () => {
      const gates = await generateNewGates('PRD', [], 3)

      expect(gates).toHaveLength(1) // At least 1 gate
    })

    it('should set correct status and type', async () => {
      const gates = await generateNewGates('PRD', [{ id: 'r1', description: 'test' }], 1)

      expect(gates[0]!.status).toBe('pending')
      expect(gates[0]!.type).toBe('feature')
    })
  })

  describe('rebaselineGates', () => {
    it('should return empty array (stub)', async () => {
      const gates = await rebaselineGates('PRD', [])
      expect(gates).toEqual([])
    })

    it('should accept optional anchor gate', async () => {
      const gates = await rebaselineGates('PRD', [], 'gate-03')
      expect(gates).toEqual([])
    })
  })

  describe('generateSingleGate', () => {
    it('should return empty array (stub)', async () => {
      const gates = await generateSingleGate('PRD', [])
      expect(gates).toEqual([])
    })

    it('should accept optional anchor gate', async () => {
      const gates = await generateSingleGate('PRD', [], 'gate-05')
      expect(gates).toEqual([])
    })
  })
})
