import { describe, it, expect } from 'vitest'

describe('MCP Requirement tools (integration)', () => {
  it('req_list returns structured result', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'req_action')
    const result = await handler({ action: 'list', payload: {} })
    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toBeDefined()
  })

  it('req_show missing param returns validation error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'req_action')
    const result = await handler({ action: 'show', payload: {} })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('invalid')
  })


})