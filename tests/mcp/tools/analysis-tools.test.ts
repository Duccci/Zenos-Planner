import { describe, it, expect } from 'vitest'

describe('MCP Analysis tools (integration)', () => {
  it('analyze returns structured result or structured error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'analyze')
    const result = await handler({})
    expect(result).toBeDefined()
    // Either success with structured content, or a structured error result
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
      expect(text.toLowerCase()).toContain('error')
    } else {
      expect(result.content[0]?.text).toBeDefined()
    }
  })

  it('show_entity missing param returns validation error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'show_entity')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })
})
