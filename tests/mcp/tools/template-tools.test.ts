import { describe, it, expect } from 'vitest'

describe('MCP Template tools (integration)', () => {
  it('template_list returns templates or textual output', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_list')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toBeDefined()
  })

  it('template_get missing param returns validation error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_get')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })
})