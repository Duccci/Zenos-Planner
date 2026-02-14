import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { createEntityActionHandler } from '../../../src/mcp/tools/entity-action-handler.js'
import type { FunctionResult } from '../../../src/integration/function-registry.js'

describe('createEntityActionHandler (unit)', () => {
  const inputSchema = z.object({ action: z.enum(['alpha', 'beta']), payload: z.any().optional() })
  const outputSchema = z.object({ action: z.string(), result: z.object({ ok: z.boolean() }) })
  const actionOutputSchema = () => z.object({ ok: z.boolean() })

  it('returns not-implemented when registry is not provided', async () => {
    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha', 'beta'] as const,
      inputSchema,
      outputSchema,
      actionOutputSchema: () => z.object({ ok: z.boolean() }),
      actionHandlers: { alpha: async () => ({ success: true, data: { ok: true } } as FunctionResult), beta: async () => ({ success: true, data: { ok: true } } as FunctionResult) }
    })

    const res = await handler({ action: 'alpha' } as Record<string, unknown>)
    expect(res.isError).toBe(true)
    const textContent = res.content?.find((c: any) => c.type === 'text') as { type: 'text'; text: string } | undefined
    const text = String(textContent?.text ?? '')
    expect(text.toLowerCase()).toContain('requires registry')
  })

  it('dispatches to action handler and validates output envelope', async () => {
    const registry = { dummy: true } as any
    const actionHandlers = {
      alpha: async (payload: Record<string, unknown> | undefined) => ({ success: true, data: { ok: true } } as FunctionResult),
      beta: async () => ({ success: true, data: { ok: false } } as FunctionResult),
    }

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha', 'beta'] as const,
      inputSchema,
      outputSchema,
      actionOutputSchema: () => z.object({ ok: z.boolean() }),
      actionHandlers: actionHandlers as any,
    }, registry)

    const res = await handler({ action: 'alpha', payload: {} })
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toHaveProperty('action', 'alpha')
    expect((res.structuredContent as any).result).toEqual({ ok: true })
  })

  it('returns error when action handler reports failure', async () => {
    const registry = { dummy: true } as any
    const actionHandlers = {
      alpha: async () => ({ success: false, error: { message: 'boom', code: 'ERR' } } as FunctionResult),
      beta: async () => ({ success: true, data: { ok: true } } as FunctionResult),
    }

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha', 'beta'] as const,
      inputSchema,
      outputSchema,
      actionOutputSchema: () => z.object({ ok: z.boolean() }),
      actionHandlers: actionHandlers as any,
    }, registry)

    const res = await handler({ action: 'alpha' })
    expect(res.isError).toBe(true)
    const textContent = res.content?.find((c: any) => c.type === 'text') as { type: 'text'; text: string } | undefined
    const text = String(textContent?.text ?? '')
    expect(text.toLowerCase()).toContain('boom')
  })

  it('runs validators and returns validation error when validators fail', async () => {
    const registry = { dummy: true } as any
    const actionHandlers = {
      alpha: async () => ({ success: true, data: { ok: true } } as FunctionResult),
      beta: async () => ({ success: true, data: { ok: true } } as FunctionResult),
    }

    const validators = {
      alpha: (_payload: Record<string, unknown> | undefined) => [
        async () => ({ allowed: true }),
        async () => ({ allowed: false, errors: ['not-allowed'] }),
      ],
    }

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha', 'beta'] as const,
      inputSchema,
      outputSchema,
      actionOutputSchema: () => z.object({ ok: z.boolean() }),
      actionHandlers: actionHandlers as any,
      validators: validators as any,
    }, registry)

    const res = await handler({ action: 'alpha' })
    expect(res.isError).toBe(true)
    const textContent = res.content?.find((c: any) => c.type === 'text') as { type: 'text'; text: string } | undefined
    const text = String(textContent?.text ?? '')
    expect(text.toLowerCase()).toContain('validation')
  })

  it('honors per-action mockResult when provided and validates against actionOutputSchema', async () => {
    const registry = { dummy: true } as any
    const actionHandlers = {
      alpha: async () => ({ success: true, data: { ok: true } } as FunctionResult),
      beta: async () => ({ success: true, data: { ok: false } } as FunctionResult),
    }

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha', 'beta'] as const,
      inputSchema,
      outputSchema,
      actionOutputSchema: () => z.object({ ok: z.boolean() }),
      actionHandlers: actionHandlers as any,
    }, registry)

    const mockJson = JSON.stringify({ ok: true })
    const res = await handler({ action: 'alpha', mockResult: mockJson })
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toEqual({ ok: true })
  })

  it('returns error for unknown action', async () => {
    const registry = { dummy: true } as any

    // Use an input schema that accepts arbitrary action strings so parsing succeeds
    const permissiveInput = z.object({ action: z.string(), payload: z.any().optional() })

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha', 'beta'] as const,
      inputSchema: permissiveInput,
      outputSchema,
      actionOutputSchema: () => z.object({ ok: z.boolean() }),
      actionHandlers: { alpha: async () => ({ success: true, data: { ok: true } } as FunctionResult), beta: async () => ({ success: true, data: { ok: true } } as FunctionResult) } as any,
    }, registry)

    const res = await handler({ action: 'gamma' } as any)
    expect(res.isError).toBe(true)
    const textContent = res.content?.find((c: any) => c.type === 'text') as { type: 'text'; text: string } | undefined
    const text = String(textContent?.text ?? '')
    expect(text.toLowerCase()).toContain('unknown')
  })
})
