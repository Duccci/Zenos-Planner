import { describe, it, expect, vi } from 'vitest'
import { createFunctionRegistry } from '../../../src/integration/function-implementations.js'
import { registerTools } from '../../../src/mcp/tools/index.js'

describe('MCP Tools Registration', () => {
  it('registers available functions on server', () => {
    const registry = createFunctionRegistry()

    const registered: string[] = []

    const fakeServer: any = {
      registerTool: vi.fn((name: string) => {
        registered.push(name)
      })
    }

    const result = registerTools(fakeServer, registry)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    // Ensure at least one known tool is registered
    expect(result).toContain('config_get')
    // There should be a substantial number of tools available
    expect(result.length).toBeGreaterThanOrEqual(20)
  })
})
