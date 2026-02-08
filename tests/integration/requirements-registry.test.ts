import { describe, it, expect, vi } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerRequirementsOps } from '../../src/integration/requirements-registry.js'
import { RequirementStorage } from '../../src/generation/requirement-storage.js'

describe('Requirements Registry wiring', () => {
  it('invokes storage.transferRequirement when req_transfer is invoked', async () => {
    const registry = new FunctionRegistry()

    // Spy on RequirementStorage.transferRequirement
    const spy = vi.spyOn(RequirementStorage.prototype, 'transferRequirement').mockImplementation((hash: string, gateId: string) => {
      return { hash, previousGateId: 'gate-01', newGateId: gateId, transferredAt: new Date().toISOString(), affectedProposals: [] }
    })

    registerRequirementsOps(registry)

    const res = await registry.invoke('req_transfer', { hash: 'abcd1234', gateId: 'gate-02' })

    expect(res.success).toBe(true)
    expect(res.data).toBeDefined()
    // Should have returned output shape
    const out = (res.data as any).output
    expect(out).toHaveProperty('hash', 'abcd1234')
    expect(out).toHaveProperty('previousGateId')
    expect(out).toHaveProperty('newGateId', 'gate-02')

    spy.mockRestore()
  })
})