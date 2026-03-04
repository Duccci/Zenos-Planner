import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('MCP Template tools (integration)', () => {
  it('template_list returns templates or textual output', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_list')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    expect(result.content[0]?.text).toBeDefined()
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

  it('template_get with empty name returns validation error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_get')
    const result = await handler({ name: '' })
    expect(result.isError).toBe(true)
  })

  it('template_get with non-string name returns error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_get')
    const result = await handler({ name: 123 })
    expect(result.isError).toBe(true)
  })

  it('template_list handles discovery errors gracefully', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_list')
    const result = await handler({})
    expect(result).toBeDefined()
    // Should either return structured content, or throw/return error
    if (result.isError) {
      expect(result.content[0]?.text).toBeDefined()
    }
  })

  it('template_get with valid name returns structured or error result', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_get')
    const result = await handler({ name: 'test-template' })
    expect(result).toBeDefined()
    // Either success with artifact, or error (template not found, etc.)
    if (result.isError) {
      expect(result.content[0]?.text).toBeDefined()
    } else {
      expect(result.content[0]?.text).toBeDefined()
    }
  })

  it('template_get with includeContext flag', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_get')
    const result = await handler({ name: 'test', includeContext: true })
    expect(result).toBeDefined()
    // Should handle the flag gracefully
    expect(result.content[0]?.text).toBeDefined()
  })

  it('template_get with includeContext as string', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_get')
    const result = await handler({ name: 'test', includeContext: 'true' })
    expect(result).toBeDefined()
    // May return structured content or error depending on whether template exists
    expect(result.content).toBeDefined()
  })

  it('template_get with includeContext as false', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'template_get')
    const result = await handler({ name: 'test', includeContext: false })
    expect(result).toBeDefined()
    expect(result.content[0]?.text).toBeDefined()
  })
})
