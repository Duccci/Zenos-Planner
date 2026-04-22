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
    expect(JSON.parse((res.content[0] as any).text)).toEqual({ ok: true })
  })

  it('returns error when action handler reports failure', async () => {
    const registry = { dummy: true } as any
    const actionHandlers = {
      alpha: async () => ({
        success: false,
        error: {
          message: 'boom',
          code: 'ERR',
          context: { functionName: 'alpha_impl', issues: [{ path: 'flag', message: 'Expected boolean', code: 'invalid_type' }] },
        },
      } as FunctionResult),
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
    const parsed = JSON.parse(String(textContent?.text ?? '{}'))
    expect(String(parsed.error).toLowerCase()).toContain('boom')
    expect(parsed.code).toBe('ERR')
    expect(parsed.context).toMatchObject({
      tool: 'test_action',
      action: 'alpha',
      functionName: 'alpha_impl',
    })
    expect((parsed.context.issues as Array<{ path: string }>)[0]?.path).toBe('flag')
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
    // Mock path bypasses the { action, result } envelope — verify via content text
    expect(JSON.parse(res.content[0]!.text as string)).toEqual({ ok: true })
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

  it('returns error when actionOutputSchema throws a non-"undefined" error', async () => {
    const registry = { dummy: true } as any
    const permissiveInput = z.object({ action: z.string(), payload: z.any().optional() })

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha'] as const,
      inputSchema: permissiveInput,
      outputSchema,
      actionOutputSchema: () => { throw new Error('Schema lookup failed') },
      actionHandlers: { alpha: async () => ({ success: true, data: { ok: true } } as FunctionResult) } as any,
    }, registry)

    const res = await handler({ action: 'alpha' })
    expect(res.isError).toBe(true)
    const text = String(res.content?.find((c: any) => c.type === 'text')?.text ?? '')
    expect(text.toLowerCase()).toContain('failed to get output schema')
  })

  it('returns error when actionOutputSchema returns undefined', async () => {
    const registry = { dummy: true } as any
    const permissiveInput = z.object({ action: z.string(), payload: z.any().optional() })

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha'] as const,
      inputSchema: permissiveInput,
      outputSchema,
      actionOutputSchema: () => undefined as any,
      actionHandlers: { alpha: async () => ({ success: true, data: { ok: true } } as FunctionResult) } as any,
    }, registry)

    const res = await handler({ action: 'alpha' })
    expect(res.isError).toBe(true)
    const text = String(res.content?.find((c: any) => c.type === 'text')?.text ?? '')
    expect(text.toLowerCase()).toContain('undefined')
  })

  it('returns usage hint when action field is missing from args', async () => {
    const registry = { dummy: true } as any
    const permissiveInput = z.object({ action: z.string().optional(), payload: z.any().optional() })

    const handler = createEntityActionHandler({
      entity: 'test',
      actions: ['alpha', 'beta'] as const,
      inputSchema: permissiveInput,
      outputSchema,
      actionOutputSchema: () => z.object({ ok: z.boolean() }),
      actionHandlers: { alpha: async () => ({ success: true, data: { ok: true } } as FunctionResult), beta: async () => ({ success: true, data: { ok: true } } as FunctionResult) } as any,
    }, registry)

    const res = await handler({ payload: {} })
    expect(res.isError).toBe(true)
    const text = String(res.content?.find((c: any) => c.type === 'text')?.text ?? '')
    expect(text).toContain('action is required')
    expect(text).toContain('availableActions')
  })
})
