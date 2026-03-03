import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { createSchemaValidatingHandler, createBasicHandler, parseJsonSafe, extractMockResult, handleMockResult, runValidators, formatValidationError, createNotImplementedHandler, handleError } from '../../../src/mcp/tools/handler-factory.js'

describe('Handler Factory', () => {
  it('parseJsonSafe returns parsed object for valid json and null for invalid', () => {
    expect(parseJsonSafe('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonSafe('not-json')).toBeNull()
    expect(parseJsonSafe({ x: 1 })).toEqual({ x: 1 })
  })

  it('createSchemaValidatingHandler returns structured content when schema matches', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ ok: true, n: 1 }) } }) }
    const schema = z.object({ ok: z.boolean(), n: z.number() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})

    expect(res.structuredContent).toEqual({ ok: true, n: 1 })
    expect((res.content[0] as any).text).toContain('"ok": true')
  })

  it('createSchemaValidatingHandler returns fallback when output not valid per schema', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ wrong: true }) } }) }
    const schema = z.object({ ok: z.boolean() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})

    expect(res.structuredContent).toHaveProperty('output')
    expect((res.content[0] as any).text).toContain('"wrong":')
  })

  it('createSchemaValidatingHandler returns error when registry fails', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: false, error: { message: 'boom' } }) }
    const schema = z.object({})

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})

    expect(res.isError).toBe(true)
    expect((res.content[0] as any).text).toContain('boom')
  })

  it('createBasicHandler returns text and structuredContent for success', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { a: 1 } }) }
    const handler = createBasicHandler(registry as any, 'fn')
    const res = await handler({})

    expect(res.structuredContent).toEqual({ a: 1 })
    expect((res.content[0] as any).text).toContain('"a": 1')
  })

  it('extractMockResult extracts mockResult when present', () => {
    expect(extractMockResult({ mockResult: { a: 1 } })).toEqual({ a: 1 })
    expect(extractMockResult({})).toBeNull()
  })

  it('handleMockResult returns validated CallToolResult when schema matches', () => {
    const schema = z.object({ ok: z.boolean(), n: z.number() })
    const args = { mockResult: JSON.stringify({ ok: true, n: 5 }) }

    const res = handleMockResult(args as Record<string, unknown>, schema)
    expect(res).not.toBeNull()
    expect(res?.structuredContent).toEqual({ ok: true, n: 5 })
  })

  it('handleMockResult returns fallback when mock does not match schema', () => {
    const schema = z.object({ ok: z.boolean() })
    const args = { mockResult: JSON.stringify({ wrong: true }) }

    const res = handleMockResult(args as Record<string, unknown>, schema)
    expect(res).not.toBeNull()
    expect(res?.structuredContent).toHaveProperty('output')
  })

  it('runValidators aggregates errors and warnings', async () => {
    const v1 = async () => ({ allowed: true } as const)
    const v2 = async () => ({ allowed: false, errors: ['fail'], warnings: ['w'] })

    const res = await runValidators([v1, v2])
    expect(res.allowed).toBe(false)
    expect(res.errors).toEqual(['fail'])
    expect(res.warnings).toEqual(['w'])
  })

  it('formatValidationError and createNotImplementedHandler produce error envelopes', () => {
    const vr = { allowed: false, errors: ['x'] }
    const err = formatValidationError(vr, 'create')
    expect(err.isError).toBe(true)
    expect(err.structuredContent && (err.structuredContent as any).validation).toBeDefined()

    const ni = createNotImplementedHandler('nope')
    expect(ni.isError).toBe(true)
    expect((ni.content[0] as any).text).toContain('nope')
  })

  it('handleError returns structured internal error payload', () => {
    const res = handleError(new Error('boom'), { ctx: 1 })
    expect(res.isError).toBe(true)
    const sc = res.structuredContent as any
    expect(sc.error).toBeDefined()
    expect(String((sc.error.message as string)).toLowerCase()).toContain('boom')
  })

  it('runValidators treats thrown validator as warning and continues', async () => {
    const v1 = async () => ({ allowed: true } as const)
    const v2 = async () => { throw new Error('oops') }

    const res = await runValidators([v1, v2 as any])
    expect(res.allowed).toBe(true)
    expect(res.warnings && res.warnings.some((w) => String(w).toLowerCase().includes('threw'))).toBeTruthy()
  })

  it('handleMockResult accepts non-string mockResult (object) and falls back correctly', () => {
    const schema = z.object({ ok: z.boolean() })
    const args = { mockResult: { ok: false } }

    const res = handleMockResult(args as Record<string, unknown>, schema)
    expect(res).not.toBeNull()
    expect(res?.structuredContent).toEqual({ ok: false })
  })

  // Additional branch coverage tests
  it('createSchemaValidatingHandler with undefined schema returns error immediately', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: {} }) }
    const handler = createSchemaValidatingHandler(registry as any, 'fn', null as any)
    const res = await handler({})
    expect(res.isError).toBe(true)
    expect((res.content[0] as any).text).toContain('outputSchema is undefined')
  })

  it('createSchemaValidatingHandler with null args normalizes to empty object', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ ok: true }) } }) }
    const schema = z.object({ ok: z.boolean() })
    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler(null as any)
    expect(res.structuredContent).toEqual({ ok: true })
    expect(registry.invoke).toHaveBeenCalledWith('fn', {})
  })

  it('createSchemaValidatingHandler with valid mockResult in args uses it first', async () => {
    const registry = { invoke: vi.fn() }
    const schema = z.object({ ok: z.boolean() })
    const mockResult = { ok: false }
    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({ mockResult: JSON.stringify(mockResult) })
    expect(res.structuredContent).toEqual(mockResult)
    expect(registry.invoke).not.toHaveBeenCalled()
  })

  it('createSchemaValidatingHandler extracts output from result.data', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ ok: true }) } }) }
    const schema = z.object({ ok: z.boolean() })
    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})
    expect(res.structuredContent).toEqual({ ok: true })
  })

  it('createSchemaValidatingHandler handles non-object data', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: 'plain string result' }) }
    const schema = z.object({ ok: z.boolean() }).optional()
    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})
    expect((res.content[0] as any).text).toContain('plain string result')
  })

  it('createBasicHandler returns error when registry fails', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: false, error: { code: 'ERROR', message: 'test error', context: {}, timestamp: '2026-02-24' } }) }
    const handler = createBasicHandler(registry as any, 'fn')
    const res = await handler({})
    expect(res.isError).toBe(true)
    expect((res.content[0] as any).text).toContain('test error')
  })

  it('createBasicHandler handles internal handler error', async () => {
    const registry = { invoke: vi.fn().mockRejectedValue(new Error('handler crash')) }
    const handler = createBasicHandler(registry as any, 'fn')
    const res = await handler({})
    expect(res.isError).toBe(true)
    expect((res.content[0] as any).text).toContain('handler crash')
  })

  it('createSchemaValidatingHandler includes error context in response', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: false, error: { code: 'VALIDATION', message: 'invalid', context: { field: 'name' }, timestamp: '2026-02-24' } }) }
    const schema = z.object({})
    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})
    const sc = res.structuredContent as any
    expect(sc.error?.context?.field).toBe('name')
  })

  it('handleMockResult returns null when no mockResult present', () => {
    const schema = z.object({ ok: z.boolean() })
    const res = handleMockResult({}, schema)
    expect(res).toBeNull()
  })

  it('handleMockResult with undefined schema returns error', () => {
    const res = handleMockResult({ mockResult: 'test' }, undefined as any)
    expect(res).not.toBeNull()
    expect(res?.isError).toBe(true)
  })

  it('runValidators returns allowed:true when all validators pass', async () => {
    const v1 = async () => ({ allowed: true } as const)
    const v2 = async () => ({ allowed: true } as const)
    const res = await runValidators([v1, v2])
    expect(res.allowed).toBe(true)
  })

  it('runValidators returns allowed:false when any validator fails', async () => {
    const v1 = async () => ({ allowed: true } as const)
    const v2 = async () => ({ allowed: false, errors: ['fail'] })
    const res = await runValidators([v1, v2])
    expect(res.allowed).toBe(false)
  })

  it('createSchemaValidatingHandler with mockResult fallback when invalid JSON', async () => {
    const registry = { invoke: vi.fn() }
    const schema = z.object({ ok: z.boolean() })
    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({ mockResult: 'not-json-string' })
    expect(res.structuredContent).toHaveProperty('output')
  })

  it('createSchemaValidatingHandler handles registry.invoke throwing (catch block)', async () => {
    const registry = { invoke: vi.fn().mockRejectedValue(new Error('registry crash')) }
    const schema = z.object({ ok: z.boolean() })
    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})
    expect(res.isError).toBe(true)
    const sc = res.structuredContent as any
    expect(sc.error?.code).toBe('INTERNAL_ERROR')
    expect(String(sc.error?.message)).toContain('registry crash')
  })

  it('createSchemaValidatingHandler handles registry.invoke throwing non-Error (catch block)', async () => {
    const registry = { invoke: vi.fn().mockRejectedValue('string-error') }
    const schema = z.object({ ok: z.boolean() })
    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})
    expect(res.isError).toBe(true)
    const sc = res.structuredContent as any
    expect(String(sc.error?.message)).toContain('string-error')
  })

  it('withGuidance returns result unchanged when result.success is false', async () => {
    const { withGuidance } = await import('../../../src/mcp/tools/handler-factory.js')
    const failedResult = { success: false as const, error: { code: 'ERR', message: 'fail' } }
    const out = withGuidance(failedResult, ['rule'], 'workflow', { phase: 'generate' })
    expect(out.success).toBe(false)
    expect((out as any).data).toBeUndefined()
  })

  it('withGuidance merges guidance into successful result', async () => {
    const { withGuidance } = await import('../../../src/mcp/tools/handler-factory.js')
    const successResult = { success: true as const, data: { existing: 'value' } }
    const out = withGuidance(successResult, ['rule1'], 'step1', { phase: 'generate' })
    expect(out.success).toBe(true)
    expect((out as any).data.existing).toBe('value')
    expect((out as any).data.guidance).toBeDefined()
    expect((out as any).data.preReviewSummary).toBeDefined()
  })

  it('withGuidance omits preReviewSummary when preReview is undefined', async () => {
    const { withGuidance } = await import('../../../src/mcp/tools/handler-factory.js')
    const successResult = { success: true as const, data: { x: 1 } }
    const out = withGuidance(successResult, [], 'wf')
    expect((out as any).data.preReviewSummary).toBeUndefined()
    expect((out as any).data.guidance).toBeDefined()
  })
})
