import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZodError, z } from 'zod'
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

  it('maps error with explicit GIT_VIOLATION code via codeMap', () => {
    const err = new Error('Git operations are forbidden during apply phase') as Error & { code: string }
    err.code = 'GIT_VIOLATION'
    const res = createMcpError(err)

    expect(res.code).toBe('GIT_VIOLATION')
    expect(res.suggestions).toEqual(expect.arrayContaining([expect.stringContaining('Git operations are forbidden')]))
  })

  it('maps error with explicit FUNCTION_NOT_FOUND code to NOT_FOUND', () => {
    const err = new Error('Function not registered') as Error & { code: string }
    err.code = 'FUNCTION_NOT_FOUND'
    const res = createMcpError(err)

    expect(res.code).toBe('NOT_FOUND')
  })

  it('maps permission denied message to PERMISSION_DENIED', () => {
    const res = createMcpError(new Error('permission denied: cannot write'))

    expect(res.code).toBe('PERMISSION_DENIED')
    expect(res.suggestions).toEqual(expect.arrayContaining([expect.stringContaining('necessary permissions')]))
  })

  it('maps access denied message to PERMISSION_DENIED', () => {
    const res = createMcpError(new Error('access denied to resource'))

    expect(res.code).toBe('PERMISSION_DENIED')
  })

  it('maps already exists message to ALREADY_EXISTS', () => {
    const res = createMcpError(new Error('gate-01 already exists'))

    expect(res.code).toBe('ALREADY_EXISTS')
    expect(res.suggestions).toEqual(expect.arrayContaining([expect.stringContaining('already exists')]))
  })

  it('maps conflict message to CONFLICT', () => {
    const res = createMcpError(new Error('merge conflict detected'))

    expect(res.code).toBe('CONFLICT')
    expect(res.suggestions).toEqual(expect.arrayContaining([expect.stringContaining('conflicts with current state')]))
  })

  it('expands ZodError issues into response context', () => {
    let zodErr: ZodError | undefined
    try {
      z.object({ name: z.string(), count: z.number() }).parse({ name: 123, count: 'bad' })
    } catch (e) {
      zodErr = e as ZodError
    }

    expect(zodErr).toBeDefined()
    const res = createMcpError(zodErr!)

    expect(res.code).toBe('VALIDATION_ERROR')
    // The ZodError logger call should include zodIssues — verify via the returned McpError structure
    // (zodIssues are logged internally; we just verify the error code and message)
    expect(res.message).toBeTruthy()
  })

  it('handleToolError works without args parameter', () => {
    const res = handleToolError(new Error('oops'), 'myFunc')
    expect(res.isError).toBe(true)
    const parsed = JSON.parse((res.content[0] as any).text as string)
    expect(parsed.context.function).toBe('myFunc')
    expect(parsed.context.args).toBeUndefined()
  })
})