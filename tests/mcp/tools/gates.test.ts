import { describe, it, expect } from 'vitest'

describe('MCP Gates tools (integration)', () => {
  it('gates_list returns structured gates', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_list')

    const result = await handler({})

    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    const structured = result.structuredContent as any
    expect(structured).toBeDefined()
    const gatesArray = Array.isArray(structured) ? structured : (structured.gates ?? [])
    expect(Array.isArray(gatesArray)).toBe(true)
  })

  it('gates_start with invalid input returns error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_start')

    const result = await handler({ gateId: 'does-not-exist' })

    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const content = String(result.content?.[0]?.text ?? '')
    expect(content.toLowerCase()).toContain('error')
  })
})
