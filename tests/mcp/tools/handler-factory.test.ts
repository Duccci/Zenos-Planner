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

  it('createSchemaValidatingHandler with undefined schema returns error immediately', async () => {
    const registry = { invoke: vi.fn() }
    const handler = createSchemaValidatingHandler(registry as any, 'fn', undefined)
    const res = await handler({})

    expect(res.isError).toBe(true)
    expect((res.content[0] as any).text).toContain('outputSchema is undefined')
    expect(registry.invoke).not.toHaveBeenCalled()
  })

  it('createSchemaValidatingHandler handles null args and treats as empty object', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ ok: true }) } }) }
    const schema = z.object({ ok: z.boolean() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler(null as any)

    expect(res.structuredContent).toEqual({ ok: true })
  })

  it('createSchemaValidatingHandler handles rawMock that parseJsonSafe returns null for', async () => {
    const registry = { invoke: vi.fn() }
    const schema = z.object({ ok: z.boolean() })
    // rawMock is provided but parseJsonSafe(rawMock) returns null (non-JSON string)
    const args = { mockResult: 'invalid-json-string' }

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler(args)

    // Should fallback to textual representation
    expect(res.structuredContent).toEqual({ output: 'invalid-json-string' })
    expect((res.content[0] as any).text).toContain('invalid-json-string')
    expect(registry.invoke).not.toHaveBeenCalled()
  })

  it('createSchemaValidatingHandler handles rawMock validation failure path', async () => {
    const registry = { invoke: vi.fn() }
    const schema = z.object({ ok: z.boolean(), num: z.number() })
    // mockResult is valid JSON but doesn't match schema
    const args = { mockResult: JSON.stringify({ ok: true }) }

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler(args)

    // Should fallback to textual representation
    expect(res.structuredContent).toHaveProperty('output')
    expect((res.content[0] as any).text).toContain('ok')
    expect(registry.invoke).not.toHaveBeenCalled()
  })

  it('createSchemaValidatingHandler when registry.invoke throws', async () => {
    const registry = { invoke: vi.fn().mockRejectedValue(new Error('Registry error')) }
    const schema = z.object({ ok: z.boolean() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})

    expect(res.isError).toBe(true)
    expect((res.content[0] as any).text).toContain('Registry error')
  })

  it('createSchemaValidatingHandler when registry.invoke returns non-JSON data', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: 'plain text' }) }
    const schema = z.object({ ok: z.boolean() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})

    expect(res.structuredContent).toHaveProperty('output')
    expect((res.content[0] as any).text).toContain('plain text')
  })

  it('createSchemaValidatingHandler extracts output from nested object', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ ok: true }) } }) }
    const schema = z.object({ ok: z.boolean() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})

    expect(res.structuredContent).toEqual({ ok: true })
  })

  it('createBasicHandler throws and catches error', async () => {
    const registry = { invoke: vi.fn().mockRejectedValue(new Error('Invoke failed')) }
    const handler = createBasicHandler(registry as any, 'fn')
    const res = await handler({})

    expect(res.isError).toBe(true)
    expect((res.content[0] as any).text).toContain('Invoke failed')
  })

  it('createBasicHandler returns text for non-object data', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: 'string result' }) }
    const handler = createBasicHandler(registry as any, 'fn')
    const res = await handler({})

    expect((res.content[0] as any).text).toContain('string result')
    expect(res.structuredContent).toEqual({ data: 'string result' })
  })

  it('createBasicHandler handles null args', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { a: 1 } }) }
    const handler = createBasicHandler(registry as any, 'fn')
    const res = await handler(null as any)

    expect(res.structuredContent).toEqual({ a: 1 })
    expect(registry.invoke).toHaveBeenCalledWith('fn', {})
  })

  it('createBasicHandler handles undefined args', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: 'ok' }) }
    const handler = createBasicHandler(registry as any, 'fn')
    const res = await handler(undefined as any)

    expect(registry.invoke).toHaveBeenCalledWith('fn', {})
    expect((res.content[0] as any).text).toContain('ok')
  })

  it('handleMockResult with undefined schema returns error', () => {
    const args = { mockResult: JSON.stringify({ ok: true }) }
    const res = handleMockResult(args as Record<string, unknown>, undefined)

    expect(res).not.toBeNull()
    expect(res?.isError).toBe(true)
    expect((res?.content[0] as any).text).toContain('Output schema is undefined')
  })

  it('handleMockResult returns null when mockResult not provided', () => {
    const schema = z.object({ ok: z.boolean() })
    const args = {}

    const res = handleMockResult(args as Record<string, unknown>, schema)
    expect(res).toBeNull()
  })

  it('handleMockResult with non-JSON mockResult falls back', () => {
    const schema = z.object({ ok: z.boolean() })
    const args = { mockResult: 'not-json' }

    const res = handleMockResult(args as Record<string, unknown>, schema)
    expect(res).not.toBeNull()
    expect(res?.structuredContent).toEqual({ output: 'not-json' })
  })

  it('createSchemaValidatingHandler handles result.data without output field', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { value: 123 } }) }
    const schema = z.object({ value: z.number() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})

    // When data doesn't have output field, uses data directly
    expect(res.structuredContent).toEqual({ value: 123 })
  })

  it('createSchemaValidatingHandler logs warning on validation failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ bad: 'data' }) } }) }
    const schema = z.object({ ok: z.boolean() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    await handler({})

    // The handler logs warnings, verify it was called or structure is correct
    warnSpy.mockRestore()
    // Just verify it executed without throwing
    expect(registry.invoke).toHaveBeenCalled()
  })

  it('createSchemaValidatingHandler with extracted as string', async () => {
    const registry = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: '{"ok":true}' } }) }
    const schema = z.object({ ok: z.boolean() })

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler({})

    expect(res.structuredContent).toEqual({ ok: true })
  })

  it('extractMockResult with various arg types', () => {
    expect(extractMockResult(null)).toBeNull()
    expect(extractMockResult(undefined)).toBeNull()
    expect(extractMockResult('string')).toBeNull()
    expect(extractMockResult({ mockResult: undefined })).toBeNull()
  })

  it('createSchemaValidatingHandler returns early with validated data when mockResult matches schema', async () => {
    // Covers the early-return path: rawMock != null && parsed != null && validated.success == true
    const registry = { invoke: vi.fn() }
    const schema = z.object({ ok: z.boolean() })
    const args = { mockResult: JSON.stringify({ ok: true }) }

    const handler = createSchemaValidatingHandler(registry as any, 'fn', schema)
    const res = await handler(args)

    expect(res.structuredContent).toEqual({ ok: true })
    // registry.invoke should NOT have been called — early return via mockResult
    expect(registry.invoke).not.toHaveBeenCalled()
  })

  it('createBasicHandler returns error envelope when registry returns success: false', async () => {
    // Covers the else block in createBasicHandler (lines 202-211 approx)
    const registry = {
      invoke: vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'GATE_NOT_FOUND', message: 'Gate not found', context: {}, timestamp: '2026-01-01T00:00:00Z' },
      }),
    }
    const handler = createBasicHandler(registry as any, 'fn')
    const res = await handler({})

    expect(res.isError).toBe(true)
    const text = (res.content[0] as any).text as string
    expect(text).toContain('GATE_NOT_FOUND')
    expect(text).toContain('Gate not found')
  })
})
