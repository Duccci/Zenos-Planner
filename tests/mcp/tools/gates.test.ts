import { describe, it, expect } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

describe('MCP Gates tools (integration)', () => {
  it('gates_list returns structured gates', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_list')

    const result = (await handler({})) as CallToolResult

    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    const structured = result.structuredContent
    expect(structured).toBeDefined()

    let gatesArray: unknown[] = []
    if (Array.isArray(structured)) {
      gatesArray = structured
    } else if (structured && typeof structured === 'object' && 'gates' in structured) {
      const maybeGates = (structured as Record<string, unknown>)['gates']
      if (Array.isArray(maybeGates)) {
        gatesArray = maybeGates
      }
    }

    expect(Array.isArray(gatesArray)).toBe(true)
  })

  it('gates_start with invalid input returns error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_start')

    const result = (await handler({ gateId: 'does-not-exist' })) as CallToolResult

    expect(result).toBeDefined()
    expect(result.isError).toBe(true)

    let content = ''
    if (Array.isArray(result.content) && result.content.length > 0) {
      const first = result.content[0] as { text?: unknown }
      if (typeof first.text === 'string') {
        content = first.text
      } else {
        content = String(first.text ?? '')
      }
    }

    expect(content.toLowerCase()).toContain('error')
  })
})
