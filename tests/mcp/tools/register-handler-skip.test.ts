import { describe, it, expect, vi } from 'vitest'
import { createFunctionRegistry } from '../../../src/integration/function-implementations.js'
import { registerTools } from '../../../src/mcp/tools/index.js'

describe('MCP Tools Registration (handlers)', () => {
  it('prefers handler implementations over function-based tools', () => {
    const registry = createFunctionRegistry()

    const registeredCalls: string[] = []

    const fakeServer: any = {
      registerTool: vi.fn((name: string) => {
        registeredCalls.push(name)
      })
    }

    const result = registerTools(fakeServer, registry)

    // Ensure handler-based registration wins: only one registration call for template_list
    const occurences = registeredCalls.filter(n => n === 'template_list').length
    expect(occurences).toBe(1)
    // And the result array should still contain the tool
    expect(result).toContain('template_list')
  })
})
