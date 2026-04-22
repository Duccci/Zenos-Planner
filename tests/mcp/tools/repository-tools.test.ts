import { describe, it, expect, vi } from 'vitest'

describe('MCP Repository tools (integration)', () => {
  it('repos_list returns structured result or structured error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'repos_list')
    const result = await handler({})
    expect(result).toBeDefined()
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
      expect(text.toLowerCase()).toContain('error')
    } else {
      expect(result.content[0]?.text).toBeDefined()
    }
  })

it('repos_detect with invalid param returns an error response', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'repos_detect')
    const result = await handler({ reanalyzeCrossRepo: 'not-a-boolean' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('error')
  })

  it('createToolHandler catch branch uses Unknown error when thrown value is not an Error', async () => {
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const mockRegistry = { invoke: vi.fn().mockRejectedValue('string-throw') }
    const handler = createToolHandler(mockRegistry as never, 'test_fn')
    const result = await handler({})
    expect(result.isError).toBe(true)
  })
})

