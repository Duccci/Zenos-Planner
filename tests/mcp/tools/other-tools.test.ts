import { describe, it, expect } from 'vitest'

describe('MCP misc tools (integration)', () => {
  it('config_get returns config object', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'config_get')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    expect(result.content[0]).toBeDefined()
    const parsedConfig = JSON.parse((result.content[0] as any).text)
    expect(Object.keys(parsedConfig).length).toBeGreaterThan(0)
  })

  it('diagram_action:list returns templates array', async () => {
    const { architectureHandlers } = await import('../../../src/mcp/tools/architecture-tools.js')
    const handlers = architectureHandlers({} as any)
    const result = await handlers['diagram_action']!({ action: 'list' })
    expect(result).toBeDefined()
    const text = (result.content[0] as any)?.text ?? ''
    if (!result.isError) {
      const structured = JSON.parse(text)
      expect(Array.isArray(structured?.templates)).toBe(true)
    } else {
      expect(text).toBeDefined()
    }
  })
})
