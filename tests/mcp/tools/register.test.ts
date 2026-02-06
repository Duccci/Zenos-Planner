import { describe, it, expect, vi } from 'vitest'
import { createFunctionRegistry } from '../../../src/integration/function-implementations.js'
import { registerTools } from '../../../src/mcp/tools/index.js'

describe('MCP Tools Registration', () => {
  it('registers configured handler tools on server', () => {
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
    // Ensure at least one known handler-provided tool is registered
    expect(result).toContain('config_get')
    // There should be a reasonable number of handler tools
    expect(result.length).toBeGreaterThanOrEqual(12)
  })
})
