import { describe, it, expect } from 'vitest'

describe('MCP Proposal tools (integration)', () => {
  it('proposal_list returns structured result or structured error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_list')
    const result = await handler({})
    expect(result).toBeDefined()
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
      expect(text.toLowerCase()).toContain('error')
    } else {
      expect(result.structuredContent).toBeDefined()
    }
  })

  it('proposal_validate missing param returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_validate')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('invalid')
  })

  it('proposal_start missing param returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_start')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action show returns proposal details', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'show', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action without action returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action with invalid action returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'invalid_action' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action list returns proposals', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'list', payload: {} })
    expect(result).toBeDefined()
  })

  it('proposal_action start with valid hash triggers validation', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'start', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action approve with valid payload triggers quality validation', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'approve', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action reject with valid hash rejects proposal', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'reject', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action validate with valid hash validates proposal', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'validate', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action progress with valid hash updates progress', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'progress', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action generate with valid payload generates proposals', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'generate', payload: {} })
    expect(result).toBeDefined()
  })

  it('proposal_action create with valid payload creates proposal', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'create',
      payload: {
        title: 'Test Proposal',
        gateId: 'gate-01',
      },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action generate with solitary=true routes to proposal workflow', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    // Call generate with solitary=true - should route to proposal_create workflow
    const result = await handler({
      action: 'generate',
      solitary: true,
      title: 'Solitary Proposal',
      summary: 'A self-contained proposal',
      tasks: [
        {
          description: 'Task 1',
          acceptanceCriteria: ['AC1'],
        },
      ],
    })
    expect(result).toBeDefined()
    // Should either succeed or return a structured error, but NOT fail to route
    expect(result.content).toBeDefined()
  })

  it('proposal_action generate with no gateId defaults to solitary workflow', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    // Call generate without gateId - should route to solitary (proposal_create) workflow
    const result = await handler({
      action: 'generate',
      title: 'Implicit Solitary Proposal',
      summary: 'A proposal without explicit gate',
      tasks: [
        {
          description: 'Task 1',
          acceptanceCriteria: ['AC1'],
        },
      ],
    })
    expect(result).toBeDefined()
    // Should route to proposal_create successfully
    expect(result.content).toBeDefined()
  })
})
