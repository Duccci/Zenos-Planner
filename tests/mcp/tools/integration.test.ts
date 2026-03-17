import { describe, it, expect } from 'vitest'

describe('MCP entity-action integration smoke tests', () => {
  // Minimal mock registry used by other integration tests in this area
  class MockFunctionRegistry {
    private mockResults = new Map<string, any>()
    setMockResult(fn: string, data: any) { this.mockResults.set(fn, data) }
    async invoke(functionName: string, params: any) {
      if (!this.mockResults.has(functionName)) {
        return { success: false, error: { code: 'NOT_MOCKED', message: `No mock for ${functionName}` } }
      }
      return { success: true, data: this.mockResults.get(functionName) }
    }
  }

  it('gates_action: list (valid) and show (invalid) paths', async () => {
    const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')
    const registry = new MockFunctionRegistry() as any
    // Mock the underlying registry functions used by gates_action
    registry.setMockResult('gates_list', { gates: [] })

    const handlers = gateHandlers(registry)

    const listRes = await handlers.gates_action({ action: 'list', payload: {} })
    expect(listRes).toBeDefined()
    expect(listRes.isError).toBeUndefined()

    const showInvalid = await handlers.gates_action({ action: 'show', payload: {} })
    expect(showInvalid.isError).toBe(true)
  })

  it('proposal_action: list and invalid action validations', async () => {
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = new MockFunctionRegistry() as any
    registry.setMockResult('proposal_list', { proposals: [], parallelSets: [] })

    const handlers = proposalHandlers(registry)

    const listRes = await handlers.proposal_action({ action: 'list', payload: {} })
    expect(listRes).toBeDefined()
    expect(listRes.isError).toBeUndefined()

    const generateInvalid = await handlers.proposal_action({ action: 'generate', payload: {} })
    expect(generateInvalid.isError).toBe(true)
  })

  it('reg_action: list and show validations', async () => {
    const { requirementHandlers } = await import('../../../src/mcp/tools/requirement-tools.js')
    const registry = new MockFunctionRegistry() as any
    registry.setMockResult('reg_action', { requirements: [] })

    const handlers = requirementHandlers(registry)

    const listRes = await handlers.reg_action({ action: 'list', payload: {} })
    expect(listRes).toBeDefined()
    expect(listRes.isError).toBeUndefined()

    const showInvalid = await handlers.reg_action({ action: 'show', payload: {} })
    expect(showInvalid.isError).toBe(true)
  })
})
