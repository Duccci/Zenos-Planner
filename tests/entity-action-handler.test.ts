import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { createEntityActionHandler } from '../src/mcp/tools/entity-action-handler.js'

describe('createEntityActionHandler', () => {
  const InputSchema = z.object({ action: z.string(), payload: z.any() })
  const EnvelopeSchema = z.object({ action: z.string(), result: z.any(), validation: z.any().optional() })

  it('returns mock result when provided and validated by per-action schema', async () => {
    const actionOutputSchema = (action: string) => (action === 'ok' ? z.any() : z.any())

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['ok'] as const,
      inputSchema: InputSchema,
      outputSchema: EnvelopeSchema,
      actionOutputSchema: (a) => actionOutputSchema(a),
      actionHandlers: {
        ok: async (_payload, _r) => ({ success: true, data: { hello: 'world' } }),
      },
    }, { invoke: vi.fn() } as any)

    const res = await handler({ action: 'ok', mockResult: { hello: 'mock' } })

    expect(res.structuredContent).toEqual({ hello: 'mock' })
  })

  it('blocks action when validator returns errors', async () => {
    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['change'] as const,
      inputSchema: InputSchema,
      outputSchema: EnvelopeSchema,
      actionOutputSchema: () => z.any(),
      actionHandlers: {
        change: async () => ({ success: true, data: {} }),
      },
      validators: {
        change: () => [async () => ({ allowed: false, errors: ['nope'] })],
      },
    }, { invoke: vi.fn() } as any)

    const res = await handler({ action: 'change', payload: {} })

    expect(res.isError).toBe(true)
    const sc = res.structuredContent as any
    expect(sc.validation.errors).toContain('nope')
  })

  it('invokes handler and returns envelope on success', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({ success: true, data: { ok: true } })
    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['do'] as const,
      inputSchema: InputSchema,
      outputSchema: EnvelopeSchema,
      actionOutputSchema: () => z.any(),
      actionHandlers: {
        do: async (payload, r) => r.invoke('do', payload),
      },
    }, { invoke: mockInvoke } as any)

    const res = await handler({ action: 'do', payload: { foo: 'bar' } })

    expect(res.isError).not.toBe(true)
    expect((res.structuredContent as any).action).toBe('do')
    expect((res.structuredContent as any).result).toEqual({ ok: true })
  })

  it('returns error envelope when invocation fails', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({ success: false, error: { message: 'boom' } })
    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['do'] as const,
      inputSchema: InputSchema,
      outputSchema: EnvelopeSchema,
      actionOutputSchema: () => z.any(),
      actionHandlers: {
        do: async (payload, r) => r.invoke('do', payload),
      },
    }, { invoke: mockInvoke } as any)

    const res = await handler({ action: 'do', payload: {} })

    expect(res.isError).toBe(true)
    expect((res.structuredContent as any).error.message).toBe('boom')
  })
})
