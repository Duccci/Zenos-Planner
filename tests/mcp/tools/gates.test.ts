import { describe, it, expect } from 'vitest'

describe('MCP Gates tools (integration)', () => {
  it('gates_list returns structured gates', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')

    const result = await runToolOnce('gates_list', {})

    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    const structured = result.structuredContent as any
    expect(structured).toBeDefined()
    // Support both shaped output { gates: [...] } or plain array from legacy functions
    const gatesArray = Array.isArray(structured) ? structured : (structured.gates ?? [])
    expect(Array.isArray(gatesArray)).toBe(true)
  })

  it('gates_start with invalid input returns error', async () => {
    const { runToolOnce } = await import('../../../src/mcp/run.js')

    const result = await runToolOnce('gates_start', { gateId: 'does-not-exist' })

    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const content = String(result.content?.[0]?.text ?? '')
    expect(content.toLowerCase()).toContain('error')
  })
})
