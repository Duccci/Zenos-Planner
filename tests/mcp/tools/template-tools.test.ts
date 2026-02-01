import { describe, it, expect } from 'vitest'

describe('MCP Template tools (integration)', () => {
  it('template_list returns templates or textual output', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('template_list', {})
    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toBeDefined()
  })

  it('template_get missing param returns validation error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('template_get', {})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })
})