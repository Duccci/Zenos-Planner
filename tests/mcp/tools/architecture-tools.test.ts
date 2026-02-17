import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FunctionRegistry } from '../../../src/integration/function-registry.js'
import { architectureHandlers } from '../../../src/mcp/tools/architecture-tools.js'

describe('MCP Architecture tools', () => {
  let mockRegistry: FunctionRegistry

  beforeEach(() => {
    mockRegistry = {
      invoke: vi.fn(),
    } as unknown as FunctionRegistry
  })

  it('arch_action generate calls registry with correct function', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: true,
      data: {
        diagrams: [
          {
            type: 'system-overview',
            title: 'System Overview',
            description: 'System architecture diagram',
            path: 'zeno/architecture/system-overview.md',
            format: 'mermaid',
          },
        ],
        totalDiagrams: 1,
        timestamp: '2026-02-17T22:00:00Z',
        success: true,
      },
    })

    const result = await handlers.arch_action({ action: 'generate' })

    expect(mockRegistry.invoke).toHaveBeenCalledWith('arch_generate', {})
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent).toBeDefined()
    const content = result.structuredContent as any
    expect(content.diagrams).toBeDefined()
  })

  it('arch_action show calls registry with diagram type', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: true,
      data: {
        diagram: {
          type: 'system-overview',
          title: 'System Overview',
          description: 'System architecture diagram',
          path: 'zeno/architecture/system-overview.md',
          format: 'mermaid',
        },
        content: 'graph TD...',
        success: true,
      },
    })

    const result = await handlers.arch_action({
      action: 'show',
      payload: { type: 'system-overview' },
    })

    expect(mockRegistry.invoke).toHaveBeenCalledWith('arch_show', { type: 'system-overview' })
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent).toBeDefined()
  })

  it('arch_action show returns error when diagram type is missing', async () => {
    const handlers = architectureHandlers(mockRegistry)

    const result = await handlers.arch_action({
      action: 'show',
      payload: {},
    })

    expect(result.isError).toBe(true)
    // Either validation error or the custom error message
    const text = result.content?.[0] && 'text' in result.content[0] ? (result.content[0] as any).text : ''
    expect(text.toLowerCase()).toContain('error')
  })

  it('arch_action show returns error when diagram type is empty string', async () => {
    const handlers = architectureHandlers(mockRegistry)

    const result = await handlers.arch_action({
      action: 'show',
      payload: { type: '' },
    })

    expect(result.isError).toBe(true)
  })

  it('arch_action generate handles registry error', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: false,
      error: { message: 'Failed to analyze project' },
    })

    const result = await handlers.arch_action({ action: 'generate' })

    expect(result.isError).toBe(true)
    expect(result.structuredContent).toBeDefined()
    const content = result.structuredContent as any
    expect(content.error).toBeDefined()
  })

  it('arch_action show handles registry error', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: false,
      error: { message: 'Diagram not found' },
    })

    const result = await handlers.arch_action({
      action: 'show',
      payload: { type: 'unknown-type' },
    })

    expect(result.isError).toBe(true)
  })

  it('arch_action handles thrown errors during generate', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockRejectedValue(new Error('Unexpected error'))

    const result = await handlers.arch_action({ action: 'generate' })

    expect(result.isError).toBe(true)
    expect(result.structuredContent).toBeDefined()
    const content = result.structuredContent as any
    expect((content.error?.message as string) || '').toContain('Unexpected error')
  })

  it('arch_action handles invalid action', async () => {
    const handlers = architectureHandlers(mockRegistry)

    const result = await handlers.arch_action({ action: 'invalid' })

    expect(result.isError).toBe(true)
  })

  it('arch_action handles validation error for non-string action', async () => {
    const handlers = architectureHandlers(mockRegistry)

    const result = await handlers.arch_action({ action: 123 })

    expect(result.isError).toBe(true)
  })

  it('arch_action show handles non-string diagram type', async () => {
    const handlers = architectureHandlers(mockRegistry)

    const result = await handlers.arch_action({
      action: 'show',
      payload: { type: 123 },
    })

    expect(result.isError).toBe(true)
  })

  it('arch_action show handles undefined payload', async () => {
    const handlers = architectureHandlers(mockRegistry)

    const result = await handlers.arch_action({
      action: 'show',
      payload: undefined,
    })

    expect(result.isError).toBe(true)
  })
})
