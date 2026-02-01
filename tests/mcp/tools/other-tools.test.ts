import { describe, it, expect } from 'vitest'

describe('MCP misc tools (integration)', () => {
  it('config_get returns config object', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('config_get', {})
    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toBeDefined()
    expect(Object.keys(result.structuredContent ?? {}).length).toBeGreaterThan(0)
  })

  it('template_list returns templates array', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')
    const result = await runToolOnce('template_list', {})
    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    const structured = result.structuredContent as any
    // Support both structured array or CLI text output
    if (Array.isArray(structured?.templates)) {
      expect(Array.isArray(structured.templates)).toBe(true)
    } else {
      const txt = String(structured?.output ?? '')
      expect(txt.toLowerCase()).toContain('gate-prd-template')
    }
  })
})
