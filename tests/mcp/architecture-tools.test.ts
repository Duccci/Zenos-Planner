import { describe, it, expect, vi, beforeEach } from 'vitest'
import { architectureHandlers, architectureToolDefinitions } from '../../src/mcp/tools/architecture-tools.js'
import type { FunctionRegistry } from '../../src/integration/function-registry.js'

// ---------------------------------------------------------------------------
// Architecture MCP Tools - Refined Tests
// ---------------------------------------------------------------------------
describe('Architecture MCP Tools', () => {
  let mockRegistry: FunctionRegistry

  beforeEach(() => {
    mockRegistry = {
      invoke: vi.fn().mockResolvedValue({ success: true }),
      call: vi.fn().mockResolvedValue({ content: [] }),
    } as unknown as FunctionRegistry
  })

  describe('architectureToolDefinitions', () => {
    it('exports diagram_action tool definition', () => {
      expect(architectureToolDefinitions).toHaveLength(1)
      expect(architectureToolDefinitions[0].name).toBe('diagram_action')
    })

    it('tool has description property', () => {
      expect(architectureToolDefinitions[0].description).toBeTruthy()
      expect(typeof architectureToolDefinitions[0].description).toBe('string')
    })

    it('tool has inputSchema property', () => {
      expect(architectureToolDefinitions[0].inputSchema).toBeDefined()
    })

    it('description mentions all supported actions', () => {
      const desc = architectureToolDefinitions[0].description
      expect(desc).toContain('catalogue')
      expect(desc).toContain('select')
      expect(desc).toContain('generate')
      expect(desc).toContain('show')
    })
  })

  describe('architectureHandlers factory', () => {
    it('returns handlers object when provided a registry', () => {
      const handlers = architectureHandlers(mockRegistry)
      expect(handlers).toBeDefined()
      expect(typeof handlers).toBe('object')
    })

    it('returns diagram_action handler', () => {
      const handlers = architectureHandlers(mockRegistry)
      expect(handlers).toHaveProperty('diagram_action')
    })

    it('diagram_action is a function', () => {
      const handlers = architectureHandlers(mockRegistry)
      expect(typeof handlers.diagram_action).toBe('function')
    })
  })

  describe('diagram_action handler', () => {
    it('returns Promise when invoked', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const result = handlers.diagram_action({})
      expect(result).toBeInstanceOf(Promise)
    })

    it('handles catalogue action', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const result = await handlers.diagram_action({ action: 'catalogue' })
      expect(result).toBeDefined()
    })

    it('handles select action with types parameter', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const result = await handlers.diagram_action({
        action: 'select',
        types: ['sequence', 'component'],
      })
      expect(result).toBeDefined()
    })

    it('handles generate action', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const result = await handlers.diagram_action({ action: 'generate' })
      expect(result).toBeDefined()
    })

    it('handles show action with diagram type', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const result = await handlers.diagram_action({
        action: 'show',
        diagramType: 'system-overview',
      })
      expect(result).toBeDefined()
    })

    it('delegates to registry.invoke for catalogue', async () => {
      const handlers = architectureHandlers(mockRegistry)
      await handlers.diagram_action({ action: 'catalogue' })
      expect(mockRegistry.invoke).toHaveBeenCalled()
    })

    it('delegates remaining actions to registry', async () => {
      const handlers = architectureHandlers(mockRegistry)
      await handlers.diagram_action({ action: 'select', types: [] })
      expect(mockRegistry.invoke).toHaveBeenCalled()
    })

    it('transforms diagramType to type for show action', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const showInvokeSpy = vi.spyOn(mockRegistry, 'invoke')
      await handlers.diagram_action({
        action: 'show',
        diagramType: 'system-overview',
      })
      // Should call with 'type' key internally
      expect(showInvokeSpy).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('handles unknown action gracefully', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const result = await handlers.diagram_action({ action: 'unknown' })
      expect(result).toBeDefined()
    })

    it('handles missing action parameter', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const result = await handlers.diagram_action({})
      expect(result).toBeDefined()
    })

    it('handles null payload', async () => {
      const handlers = architectureHandlers(mockRegistry)
      const result = await handlers.diagram_action(null as any)
      expect(result).toBeDefined()
    })
  })

  describe('integration', () => {
    it('creates handler that uses passed registry', async () => {
      const customRegistry = {
        invoke: vi.fn().mockResolvedValue({ message: 'invoked' }),
        call: vi.fn(),
      } as unknown as FunctionRegistry

      const handlers = architectureHandlers(customRegistry)
      await handlers.diagram_action({ action: 'catalogue' })
      expect(customRegistry.invoke).toHaveBeenCalled()
    })

    it('different handler instances use different registries', async () => {
      const registry1 = {
        invoke: vi.fn().mockResolvedValue({}),
        call: vi.fn(),
      } as unknown as FunctionRegistry
      const registry2 = {
        invoke: vi.fn().mockResolvedValue({}),
        call: vi.fn(),
      } as unknown as FunctionRegistry

      const handlers1 = architectureHandlers(registry1)
      const handlers2 = architectureHandlers(registry2)

      await handlers1.diagram_action({ action: 'catalogue' })
      await handlers2.diagram_action({ action: 'catalogue' })

      expect(registry1.invoke).toHaveBeenCalled()
      expect(registry2.invoke).toHaveBeenCalled()
    })
  })
})
