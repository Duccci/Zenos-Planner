import { describe, it, expect } from 'vitest'

describe('MCP Requirement tools (integration)', () => {
  it('req_list returns structured result', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('req_list', {})
    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toBeDefined()
  })

  it('req_show missing param returns validation error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('req_show', {})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('invalid')
  })


})