import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/generation/requirement-storage.js')

import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerRequirementsOps } from '../../src/integration/requirements-registry.js'
import { RequirementStorage } from '../../src/generation/requirement-storage.js'

describe('Requirements Registry wiring', () => {
  it.skip('invokes storage.transferRequirement when req_transfer is invoked', async () => {
    const registry = new FunctionRegistry()

    // Mock the constructor
    const mockTransfer = vi.fn().mockReturnValue({
      hash: 'abcd1234',
      previousGateId: 'gate-01',
      newGateId: 'gate-02',
      transferredAt: new Date().toISOString(),
      affectedProposals: []
    })

    vi.mocked(RequirementStorage).mockImplementation(() => ({
      transferRequirement: mockTransfer
    } as any))

    registerRequirementsOps(registry)

    const res = await registry.invoke('req_transfer', { hash: 'abcd1234', gateId: 'gate-02' })

    expect(res.success).toBe(true)
    expect(res.data).toBeDefined()
    // Should have returned output shape
    const out = (res.data as any).output
    expect(out).toHaveProperty('hash', 'abcd1234')
    expect(out).toHaveProperty('previousGateId')
    expect(out).toHaveProperty('newGateId', 'gate-02')

    expect(mockTransfer).toHaveBeenCalledWith('abcd1234', 'gate-02')
  })
})