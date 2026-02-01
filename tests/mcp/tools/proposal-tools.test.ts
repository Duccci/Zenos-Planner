import { describe, it, expect } from 'vitest'

describe('MCP Proposal tools (integration)', () => {
  it('proposal_list returns structured result or structured error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('proposal_list', {})
    expect(result).toBeDefined()
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
      expect(text.toLowerCase()).toContain('error')
    } else {
      expect(result.structuredContent).toBeDefined()
    }
  })

  it('proposal_validate missing param returns validation error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('proposal_validate', {})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('invalid')
  })

  it('proposal_start missing param returns validation error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('proposal_start', {})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })
})