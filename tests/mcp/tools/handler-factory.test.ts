import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { createSchemaValidatingHandler, createBasicHandler, parseJsonSafe } from '../../../src/mcp/tools/handler-factory.js'

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
})
