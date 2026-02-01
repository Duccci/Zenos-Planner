import { describe, it, expect } from 'vitest'

describe('MCP Repository tools (integration)', () => {
  it('repos_list returns structured result or structured error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('repos_list', {})
    expect(result).toBeDefined()
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
      expect(text.toLowerCase()).toContain('error')
    } else {
      expect(result.structuredContent).toBeDefined()
    }
  })

  it('repos_detect with invalid param returns an error response', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('repos_detect', { root: 123 })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('error')
  })
})