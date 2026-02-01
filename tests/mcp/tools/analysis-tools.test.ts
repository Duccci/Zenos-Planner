import { describe, it, expect } from 'vitest'

describe('MCP Analysis tools (integration)', () => {
  it('analyze returns structured result or structured error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('analyze', {})
    expect(result).toBeDefined()
    // Either success with structured content, or a structured error result
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
      expect(text.toLowerCase()).toContain('error')
    } else {
      expect(result.structuredContent).toBeDefined()
    }
  })

  it('show_entity missing param returns validation error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('show_entity', {})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })
})