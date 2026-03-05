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

  it('proposal_action: list and create validations', async () => {
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = new MockFunctionRegistry() as any
    registry.setMockResult('proposal_list', { proposals: [] })

    const handlers = proposalHandlers(registry)

    const listRes = await handlers.proposal_action({ action: 'list', payload: {} })
    expect(listRes).toBeDefined()
    expect(listRes.isError).toBeUndefined()

    const createInvalid = await handlers.proposal_action({ action: 'create', payload: {} })
    expect(createInvalid.isError).toBe(true)
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

  it('archive_action: list and archive validations', async () => {
    const { archiveHandlers } = await import('../../../src/mcp/tools/archive-tools.js')
    const registry = new MockFunctionRegistry() as any
    registry.setMockResult('archive_action', {
      success: true,
      gateId: 'gate-01',
      gateName: 'Gate 1',
      status: 'completed',
      archivedAt: new Date().toISOString(),
      location: 'zeno/archives/gate-01.zip',
      gitTag: 'v1',
      consolidatedProposals: 0,
      fulfilledRequirements: 0,
      summary: 'Archived'
    })

    const handlers = archiveHandlers(registry)

    const gateRes = await handlers.archive_action({ action: 'gate', payload: { gateId: 'gate-01' } })
    expect(gateRes).toBeDefined()
    expect(gateRes.isError).toBeUndefined()

    const archiveInvalid = await handlers.archive_action({ action: 'proposal', payload: {} })
    expect(Boolean(archiveInvalid.isError)).toBe(true)
  })
})
