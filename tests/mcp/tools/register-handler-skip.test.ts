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

    // template_action was merged into diagram_action; it should no longer be registered
    expect(registeredCalls.filter(n => n === 'template_action').length).toBe(0)
    expect(result).not.toContain('template_action')
    // diagram_action covers all diagram + template operations
    expect(result).toContain('diagram_action')
  })
})
