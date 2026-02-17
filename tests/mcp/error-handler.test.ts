import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMcpError, mcpErrorToToolResult, handleToolError } from '../../src/mcp/error-handler.js'

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('MCP Error Handler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps not-found errors to NOT_FOUND and provides suggestions', () => {
    const err = new Error('Resource not found: gate-01')
    const res = createMcpError(err, { id: 'gate-01' })

    expect(res.code).toBe('NOT_FOUND')
    expect(res.message).toBe(err.message)
    expect(res.suggestions).toEqual(expect.arrayContaining([expect.stringContaining('Check if the requested resource exists')]))
    expect(res.context).toEqual({ id: 'gate-01' })
  })

  it('maps validation errors to VALIDATION_FAILED', () => {
    const err = new Error('Validation failed: missing field')
    const res = createMcpError(err)

    expect(res.code).toBe('VALIDATION_ERROR')
    expect(res.suggestions).toEqual(expect.arrayContaining([expect.stringContaining('Check the input parameters')]))
  })

  it('handles non-Error input as internal error with unknown message', () => {
    const res = createMcpError('some string error' as unknown)

    expect(res.code).toBe('INTERNAL_ERROR')
    expect(res.message).toBe('Unknown error occurred')
  })

  it('converts McpError to CallToolResult with structured JSON', () => {
    const mcpErr = createMcpError(new Error('timeout while calling'))
    const toolRes = mcpErrorToToolResult(mcpErr)

    expect(toolRes.isError).toBe(true)
    expect((toolRes.content[0] as any).text).toContain(mcpErr.code)
    expect((toolRes.content[0] as any).text).toContain(mcpErr.message)
  })

  it('handleToolError includes function and arg keys in context', () => {
    const res = handleToolError(new Error('connection failed'), 'doThing', { foo: 'bar' })
    expect(res.isError).toBe(true)
    expect((res.content[0] as any).text).toContain('doThing')
    expect((res.content[0] as any).text).toContain('foo')
  })
})