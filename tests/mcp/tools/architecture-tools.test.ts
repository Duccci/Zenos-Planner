import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FunctionRegistry } from '../../../src/integration/function-registry.js'
import { architectureHandlers } from '../../../src/mcp/tools/architecture-tools.js'

describe('MCP Architecture tools', () => {
  let mockRegistry: FunctionRegistry

  beforeEach(() => {
    mockRegistry = {
      invoke: vi.fn(),
      call: vi.fn(),
    } as unknown as FunctionRegistry
  })

  describe('diagram_action handler', () => {
    it('handles generate action with gateHash', async () => {
      const handlers = architectureHandlers(mockRegistry)
      ;(mockRegistry.invoke as any).mockResolvedValue({
        success: true,
        data: {
          diagrams: [
            {
              type: 'system-overview',
              title: 'System Overview',
              path: 'zeno/architecture/system-overview.md',
            },
          ],
        },
      })

      const result = await handlers.diagram_action({
        action: 'generate',
        gateHash: 'gate-01',
      })

      expect(mockRegistry.invoke).toHaveBeenCalled()
      // The handler may or may not set isError based on validation
      expect(result).toBeDefined()
    })

    it('handles show action with diagramType', async () => {
      const handlers = architectureHandlers(mockRegistry)
      ;(mockRegistry.invoke as any).mockResolvedValue({
        success: true,
        data: {
          diagram: {
            type: 'system-overview',
            title: 'System Overview',
            path: 'zeno/architecture/system-overview.md',
          },
          content: 'graph TD...',
        },
      })

      const result = await handlers.diagram_action({
        action: 'show',
        diagramType: 'system-overview',
      })

      expect(mockRegistry.invoke).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('returns error for missing diagram type in show action', async () => {
      const handlers = architectureHandlers(mockRegistry)

      const result = await handlers.diagram_action({
        action: 'show',
      })

      expect(result.isError).toBe(true)
    })

    it('returns error for empty diagram type', async () => {
      const handlers = architectureHandlers(mockRegistry)

      const result = await handlers.diagram_action({
        action: 'show',
        diagramType: '',
      })

      expect(result.isError).toBe(true)
    })

    it('handles invalid action type', async () => {
      const handlers = architectureHandlers(mockRegistry)

      const result = await handlers.diagram_action({
        action: 'invalid-action',
      })

      expect(result.isError).toBe(true)
    })

    it('handles non-string action', async () => {
      const handlers = architectureHandlers(mockRegistry)

      const result = await handlers.diagram_action({
        action: 123,
      })

      expect(result.isError).toBe(true)
    })

    it('handles non-string diagram type', async () => {
      const handlers = architectureHandlers(mockRegistry)

      const result = await handlers.diagram_action({
        action: 'show',
        diagramType: 123,
      })

      expect(result.isError).toBe(true)
    })

    it('handles catalogue action', async () => {
      const handlers = architectureHandlers(mockRegistry)
      ;(mockRegistry.invoke as any).mockResolvedValue({
        success: true,
        data: {
          catalogue: [
            { type: 'system-overview', category: 'core', name: 'System Overview' },
            { type: 'sequence', category: 'conditional', name: 'Sequence Diagram' },
          ],
        },
      })

      const result = await handlers.diagram_action({
        action: 'catalogue',
      })

      expect(mockRegistry.invoke).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('handles registry errors gracefully', async () => {
      const handlers = architectureHandlers(mockRegistry)
      ;(mockRegistry.invoke as any).mockRejectedValue(new Error('Registry error'))

      const result = await handlers.diagram_action({
        action: 'generate',
        gateHash: 'gate-01',
      })

      expect(result.isError).toBe(true)
    })

    it('maps diagramType parameter to type for arch_show', async () => {
      const handlers = architectureHandlers(mockRegistry)
      ;(mockRegistry.invoke as any).mockResolvedValue({
        success: true,
        data: {
          diagram: {
            type: 'data-flow',
            title: 'Data Flow',
          },
        },
      })

      await handlers.diagram_action({
        action: 'show',
        diagramType: 'data-flow',
      })

      // Verify that arch_show was called with the mapped parameter
      const calls = (mockRegistry.invoke as any).mock.calls
      const showCall = calls.find((c: any) => c[0] === 'arch_show')
      expect(showCall).toBeDefined()
      if (showCall) {
        expect(showCall[1]).toHaveProperty('type')
      }
    })
  })
})
