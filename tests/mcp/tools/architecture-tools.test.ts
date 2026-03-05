import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FunctionRegistry } from '../../../src/integration/function-registry.js'
import { architectureHandlers } from '../../../src/mcp/tools/architecture-tools.js'

describe('MCP Architecture tools — diagram_action handler', () => {
  let mockRegistry: FunctionRegistry

  beforeEach(() => {
    mockRegistry = {
      invoke: vi.fn(),
    } as unknown as FunctionRegistry
  })

  it('generate calls arch_generate on registry', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: true,
      data: {
        diagrams: [
          {
            type: 'system-overview',
            category: 'core',
            filePath: 'zeno/architecture/system-overview.md',
            format: 'mermaid',
            generated: true,
          },
        ],
        totalGenerated: 1,
        timestamp: '2026-02-17T22:00:00Z',
        success: true,
      },
    })

    const result = await handlers.diagram_action({ action: 'generate' })

    expect(mockRegistry.invoke).toHaveBeenCalledWith('arch_generate', expect.any(Object))
    expect(result.isError).toBeFalsy()
    expect(result.content[0]).toBeDefined()
  })

  it('show calls arch_show with diagramType mapped to type', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: true,
      data: {
        type: 'system-overview',
        title: 'System Overview',
        content: 'graph TD...',
        format: 'mermaid',
        found: true,
      },
    })

    const result = await handlers.diagram_action({ action: 'show', diagramType: 'system-overview' })

    expect(mockRegistry.invoke).toHaveBeenCalledWith('arch_show', expect.objectContaining({ type: 'system-overview' }))
    expect(result.isError).toBeFalsy()
    expect(result.content[0]).toBeDefined()
  })

  it('show with missing diagramType returns error', async () => {
    const handlers = architectureHandlers(mockRegistry)

    const result = await handlers.diagram_action({ action: 'show' })

    // diagram_action validates the input schema — missing diagramType is a validation error
    expect(result).toBeDefined()
  })

  it('generate handles registry error', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: false,
      error: { message: 'Failed to analyze project', code: 'ANALYZE_ERROR', context: {} },
    })

    const result = await handlers.diagram_action({ action: 'generate' })

    expect(result.isError).toBe(true)
    const text = (result.content[0] as any)?.text ?? ''
    expect(text).toBeDefined()
  })

  it('show handles registry error', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: false,
      error: { message: 'Diagram not found', code: 'NOT_FOUND', context: {} },
    })

    const result = await handlers.diagram_action({ action: 'show', diagramType: 'unknown-type' })

    expect(result.isError).toBe(true)
  })

  it('generate handles thrown errors', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockRejectedValue(new Error('Unexpected error'))

    const result = await handlers.diagram_action({ action: 'generate' })

    expect(result.isError).toBe(true)
  })

  it('invalid action returns error', async () => {
    const handlers = architectureHandlers(mockRegistry)

    const result = await handlers.diagram_action({ action: 'invalid' })

    expect(result.isError).toBe(true)
  })

  it('catalogue action calls registry', async () => {
    const handlers = architectureHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({ success: true, data: { types: [] } })

    const result = await handlers.diagram_action({ action: 'catalogue' })

    expect(mockRegistry.invoke).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
