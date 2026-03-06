/**
 * Branch Coverage Tests - Integration Modules
 *
 * Targets uncovered branches in:
 * - src/integration/function-registry.ts (FunctionRegistry class)
 * - src/integration/function-implementations.ts (getGlobalRegistry singleton)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { FunctionRegistry } from '../../src/integration/function-registry.js'

// ──────────────────────────────────────────────────────── FunctionRegistry

describe('FunctionRegistry - branch coverage', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    registry = new FunctionRegistry()
  })

  it('invoke returns FUNCTION_NOT_FOUND when function is not registered', async () => {
    const result = await registry.invoke('nonexistent_function')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('FUNCTION_NOT_FOUND')
      expect(result.error.message).toContain('nonexistent_function')
    }
  })

  it('invoke returns INVALID_PARAMETERS when schema validation fails', async () => {
    registry.register('test_fn_schema', (params) => params, {
      description: 'test',
      parameters: [{ name: 'id', type: 'string', description: 'identifier', required: true }],
      returnType: 'object',
      schema: z.object({ id: z.string() }),
    })
    const result = await registry.invoke('test_fn_schema', { id: 42 as unknown as string })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_PARAMETERS')
      expect(result.error.context).toHaveProperty('issues')
    }
  })

  it('invoke returns success with data on valid call', async () => {
    registry.register('test_fn_ok', (params) => ({ echo: params['msg'] }), {
      description: 'echo',
      parameters: [{ name: 'msg', type: 'string', description: 'message', required: true }],
      returnType: 'object',
      schema: z.object({ msg: z.string() }),
    })
    const result = await registry.invoke<{ echo: string }>('test_fn_ok', { msg: 'hello' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ echo: 'hello' })
    }
  })

  it('invoke returns INVOCATION_ERROR when implementation throws generic Error', async () => {
    registry.register(
      'test_fn_throw',
      () => {
        throw new Error('boom')
      },
      {
        description: 'throws',
        parameters: [],
        returnType: 'void',
        schema: z.object({}),
      }
    )
    const result = await registry.invoke('test_fn_throw')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVOCATION_ERROR')
      expect(result.error.message).toContain('boom')
      expect(result.error.timestamp).toBeDefined()
    }
  })

  it('invoke preserves error code from thrown object with code property', async () => {
    registry.register(
      'test_fn_coded_error',
      () => {
        const err = new Error('custom error')
        ;(err as NodeJS.ErrnoException).code = 'CUSTOM_CODE'
        throw err
      },
      {
        description: 'throws coded error',
        parameters: [],
        returnType: 'void',
        schema: z.object({}),
      }
    )
    const result = await registry.invoke('test_fn_coded_error')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('CUSTOM_CODE')
    }
  })

  it('invoke preserves operations from thrown object with operations property', async () => {
    registry.register(
      'test_fn_ops_error',
      () => {
        const err = Object.assign(new Error('ops error'), {
          operations: [{ op: 'write', path: '/tmp/x' }],
        })
        throw err
      },
      {
        description: 'throws ops error',
        parameters: [],
        returnType: 'void',
        schema: z.object({}),
      }
    )
    const result = await registry.invoke('test_fn_ops_error')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.operations).toBeDefined()
    }
  })

  it('invoke handles async implementations that reject', async () => {
    registry.register(
      'test_fn_async_reject',
      async () => {
        await Promise.resolve()
        throw new Error('async boom')
      },
      {
        description: 'async throws',
        parameters: [],
        returnType: 'void',
        schema: z.object({}),
      }
    )
    const result = await registry.invoke('test_fn_async_reject')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('async boom')
    }
  })

  it('invoke handles non-Error thrown values (string)', async () => {
    registry.register(
      'test_fn_string_throw',
      () => {
        throw 'string error'
      },
      {
        description: 'throws string',
        parameters: [],
        returnType: 'void',
        schema: z.object({}),
      }
    )
    const result = await registry.invoke('test_fn_string_throw')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('string error')
    }
  })

  it('list returns empty array when nothing registered', () => {
    expect(registry.list()).toEqual([])
  })

  it('list returns all registered functions', () => {
    registry.register('fn_a', () => null, {
      description: 'a',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    registry.register('fn_b', () => null, {
      description: 'b',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    const list = registry.list()
    expect(list).toHaveLength(2)
    expect(list.map((f) => f.name)).toContain('fn_a')
    expect(list.map((f) => f.name)).toContain('fn_b')
  })

  it('get returns undefined for unknown function', () => {
    expect(registry.get('no_such_fn')).toBeUndefined()
  })

  it('get returns registered function', () => {
    registry.register('fn_get_test', () => null, {
      description: 'get test',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    const fn = registry.get('fn_get_test')
    expect(fn).toBeDefined()
    expect(fn?.name).toBe('fn_get_test')
  })

  it('getByCategory returns gate functions', () => {
    registry.register('gates_list', () => null, {
      description: 'gates list',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    registry.register('gates_show', () => null, {
      description: 'gates show',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    registry.register('reg_action', () => null, {
      description: 'req action',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    const gatesFns = registry.getByCategory('gates')
    expect(gatesFns.map((f) => f.name)).toContain('gates_list')
    expect(gatesFns.map((f) => f.name)).toContain('gates_show')
    expect(gatesFns.map((f) => f.name)).not.toContain('reg_action')
  })

  it('getByCategory returns empty array for unknown category', () => {
    expect(registry.getByCategory('nonexistent_category')).toEqual([])
  })

  it('getByCategory returns template functions', () => {
    registry.register('getTemplate', () => null, {
      description: 'get template',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    registry.register('loadAllTemplates', () => null, {
      description: 'load all templates',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    const templateFns = registry.getByCategory('templates')
    expect(templateFns.map((f) => f.name)).toContain('getTemplate')
    expect(templateFns.map((f) => f.name)).toContain('loadAllTemplates')
  })

  it('getByCategory returns general functions', () => {
    registry.register('status', () => null, {
      description: 'status',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    registry.register('init', () => null, {
      description: 'init',
      parameters: [],
      returnType: 'null',
      schema: z.object({}),
    })
    const generalFns = registry.getByCategory('general')
    expect(generalFns.map((f) => f.name)).toContain('status')
    expect(generalFns.map((f) => f.name)).toContain('init')
  })

  it('register overwrites existing function with same name', () => {
    registry.register('fn_overwrite', () => 'first', {
      description: 'first',
      parameters: [],
      returnType: 'string',
      schema: z.object({}),
    })
    registry.register('fn_overwrite', () => 'second', {
      description: 'second',
      parameters: [],
      returnType: 'string',
      schema: z.object({}),
    })
    const fn = registry.get('fn_overwrite')
    expect(fn?.description).toBe('second')
  })

  it('invoke passes validated params to implementation', async () => {
    let receivedParams: Record<string, unknown> = {}
    registry.register(
      'test_fn_params_pass',
      (params) => {
        receivedParams = params
        return 'ok'
      },
      {
        description: 'params pass',
        parameters: [{ name: 'x', type: 'number', description: 'x value', required: true }],
        returnType: 'string',
        schema: z.object({ x: z.number() }),
      }
    )
    await registry.invoke('test_fn_params_pass', { x: 42 })
    expect(receivedParams['x']).toBe(42)
  })

  it('invoke includes errorType in context for Error instances', async () => {
    registry.register(
      'test_fn_error_type',
      () => {
        throw new TypeError('type error')
      },
      {
        description: 'throws type error',
        parameters: [],
        returnType: 'void',
        schema: z.object({}),
      }
    )
    const result = await registry.invoke('test_fn_error_type')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.context?.['errorType']).toBe('TypeError')
    }
  })

  it('invoke preserves numeric error code from thrown object', async () => {
    registry.register(
      'test_fn_numeric_code',
      () => {
        throw Object.assign(new Error('numeric code error'), { code: 42 })
      },
      {
        description: 'throws numeric code',
        parameters: [],
        returnType: 'void',
        schema: z.object({}),
      }
    )
    const result = await registry.invoke('test_fn_numeric_code')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('42')
    }
  })
})

// ──────────────────────────────────────────────────────── function-implementations singleton

describe('function-implementations - getGlobalRegistry singleton', () => {
  it('createFunctionRegistry returns a registry with functions', async () => {
    const { createFunctionRegistry } =
      await import('../../src/integration/function-implementations.js')
    const registry = createFunctionRegistry()
    expect(registry.list().length).toBeGreaterThan(0)
  })

  it('getGlobalRegistry returns same instance on repeated calls', async () => {
    // isolate module cache so singleton is fresh
    const mod = await import('../../src/integration/function-implementations.js')
    const r1 = mod.getGlobalRegistry()
    const r2 = mod.getGlobalRegistry()
    expect(r1).toBe(r2)
  })
})
