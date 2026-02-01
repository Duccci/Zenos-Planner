/**
 * Function Registry Tests
 *
 * Comprehensive tests for function registration, invocation, validation,
 * and error handling. Covers sync/async functions, parameter validation,
 * and error wrapping.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { FunctionRegistry, type FunctionErrorResponse, functionRegistry, type FunctionDefinition } from '../../src/integration/function-registry.js'

describe('Function Registry Signatures', () => {
  it('should export a non-empty function registry', () => {
    expect(functionRegistry).toBeDefined()
    expect(Array.isArray(functionRegistry)).toBe(true)
    expect(functionRegistry.length).toBeGreaterThan(0)
  })

  it('should have valid function definitions', () => {
    for (const func of functionRegistry) {
      expect(func).toHaveProperty('name')
      expect(func).toHaveProperty('description')
      expect(func).toHaveProperty('parameters')
      expect(func).toHaveProperty('returnType')
      expect(func).toHaveProperty('examples')

      expect(typeof func.name).toBe('string')
      expect(func.name.length).toBeGreaterThan(0)
      expect(typeof func.description).toBe('string')
      expect(func.description.length).toBeGreaterThan(0)
      expect(Array.isArray(func.parameters)).toBe(true)
      expect(typeof func.returnType).toBe('string')
      expect(Array.isArray(func.examples)).toBe(true)
    }
  })

  it('should have unique function names', () => {
    const names = functionRegistry.map(f => f.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(names.length)
  })

  it('should have valid parameters', () => {
    for (const func of functionRegistry) {
      for (const param of func.parameters) {
        expect(param).toHaveProperty('name')
        expect(param).toHaveProperty('type')
        expect(param).toHaveProperty('description')
        expect(param).toHaveProperty('required')

        expect(typeof param.name).toBe('string')
        expect(typeof param.type).toBe('string')
        expect(typeof param.description).toBe('string')
        expect(typeof param.required).toBe('boolean')
      }
    }
  })

  it('should have consistent naming conventions for most functions', () => {
    const validSnakeCasePattern = /^[a-z_]+$/
    const validCamelCasePattern = /^[a-z][a-zA-Z0-9]*$/
    for (const func of functionRegistry) {
      const isSnakeCase = validSnakeCasePattern.test(func.name)
      const isCamelCase = validCamelCasePattern.test(func.name)
      expect(isSnakeCase || isCamelCase).toBe(true, `Function name ${func.name} doesn't match naming conventions`)
    }
  })

  it('should have gate operation signatures', () => {
    const gateOps = ['gates_list', 'gates_show', 'gates_start', 'gates_complete']
    for (const op of gateOps) {
      expect(functionRegistry.some(f => f.name === op)).toBe(true, `Missing function signature: ${op}`)
    }
  })

  it('should have requirement operation signatures', () => {
    const reqOps = ['req_list', 'req_show', 'req_deps', 'req_transfer']
    for (const op of reqOps) {
      expect(functionRegistry.some(f => f.name === op)).toBe(true, `Missing function signature: ${op}`)
    }
  })

  it('should have proposal operation signatures', () => {
    const propOps = ['proposal_list', 'proposal_show', 'proposal_start', 'proposal_validate']
    for (const op of propOps) {
      expect(functionRegistry.some(f => f.name === op)).toBe(true, `Missing function signature: ${op}`)
    }
  })

  it('should have valid parameter arrays', () => {
    for (const func of functionRegistry) {
      expect(Array.isArray(func.parameters)).toBe(true, `Function ${func.name} has invalid parameters`)
      for (const param of func.parameters) {
        expect(param.name).toBeDefined()
        expect(param.type).toBeDefined()
      }
    }
  })

  it('should have all required architecture operations', () => {
    const archOps = ['arch_generate', 'arch_show']
    for (const op of archOps) {
      expect(functionRegistry.some(f => f.name === op)).toBe(true)
    }
  })
})

describe('FunctionRegistry Class', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    registry = new FunctionRegistry()
  })

  // ============================================================================
  // Registration Tests
  // ============================================================================

  describe('register', () => {
    it('should register a sync function', () => {
      const impl = () => 'result'
      registry.register('test_sync', impl, {
        description: 'A test sync function',
        parameters: [],
        returnType: 'string',
        schema: z.object({})
      })

      expect(registry.get('test_sync')).toBeDefined()
      expect(registry.get('test_sync')?.name).toBe('test_sync')
    })

    it('should register an async function', () => {
      const impl = async () => Promise.resolve('async result')
      registry.register('test_async', impl, {
        description: 'A test async function',
        parameters: [],
        returnType: 'Promise<string>',
        schema: z.object({})
      })

      expect(registry.get('test_async')).toBeDefined()
    })

    it('should store function metadata', () => {
      const params = [
        { name: 'param1', type: 'string', description: 'First param', required: true }
      ]
      registry.register('test_meta', () => undefined, {
        description: 'Test metadata',
        parameters: params,
        returnType: 'void',
        schema: z.object({ param1: z.string() })
      })

      const func = registry.get('test_meta')
      expect(func?.description).toBe('Test metadata')
      expect(func?.parameters).toEqual(params)
      expect(func?.returnType).toBe('void')
    })

    it('should allow registering multiple functions', () => {
      registry.register('func1', () => 1, {
        description: 'First function',
        parameters: [],
        returnType: 'number',
        schema: z.object({})
      })

      registry.register('func2', () => 2, {
        description: 'Second function',
        parameters: [],
        returnType: 'number',
        schema: z.object({})
      })

      expect(registry.list().length).toBe(2)
    })
  })

  // ============================================================================
  // Invocation Tests
  // ============================================================================

  describe('invoke', () => {
    it('should invoke a registered sync function', async () => {
      registry.register('add', (params) => {
        const p = params as { a: number; b: number }
        return p.a + p.b
      }, {
        description: 'Add two numbers',
        parameters: [
          { name: 'a', type: 'number', description: 'First number', required: true },
          { name: 'b', type: 'number', description: 'Second number', required: true }
        ],
        returnType: 'number',
        schema: z.object({ a: z.number(), b: z.number() })
      })

      const result = await registry.invoke<number>('add', { a: 2, b: 3 })
      expect(result.success).toBe(true)
      expect(result.data).toBe(5)
    })

    it('should invoke a registered async function', async () => {
      registry.register('asyncAdd', async (params) => {
        const p = params as { a: number; b: number }
        return Promise.resolve(p.a + p.b)
      }, {
        description: 'Async add',
        parameters: [
          { name: 'a', type: 'number', description: 'First', required: true },
          { name: 'b', type: 'number', description: 'Second', required: true }
        ],
        returnType: 'number',
        schema: z.object({ a: z.number(), b: z.number() })
      })

      const result = await registry.invoke<number>('asyncAdd', { a: 4, b: 6 })
      expect(result.success).toBe(true)
      expect(result.data).toBe(10)
    })

    it('should return error for non-existent function', async () => {
      const result = await registry.invoke('nonexistent')
      expect(result.success).toBe(false)
      expect((result.error as FunctionErrorResponse).code).toBe('FUNCTION_NOT_FOUND')
    })

    it('should validate parameters before invocation', async () => {
      registry.register('typed', (params) => params, {
        description: 'Typed function',
        parameters: [
          { name: 'value', type: 'string', description: 'A string', required: true }
        ],
        returnType: 'object',
        schema: z.object({ value: z.string() })
      })

      // Invalid parameter type
      const result = await registry.invoke('typed', { value: 123 })
      expect(result.success).toBe(false)
      expect((result.error as FunctionErrorResponse).code).toBe('INVALID_PARAMETERS')
    })

    it('should catch and report function errors', async () => {
      registry.register('throwing', () => {
        throw new Error('Test error')
      }, {
        description: 'Throws an error',
        parameters: [],
        returnType: 'void',
        schema: z.object({})
      })

      const result = await registry.invoke('throwing')
      expect(result.success).toBe(false)
      expect((result.error as FunctionErrorResponse).code).toBe('INVOCATION_ERROR')
      expect((result.error as FunctionErrorResponse).message).toContain('Test error')
    })
  })

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('validation', () => {
    it('should validate required parameters', async () => {
      registry.register('required', (params) => params, {
        description: 'Requires param',
        parameters: [
          { name: 'required_param', type: 'string', description: 'Required', required: true }
        ],
        returnType: 'object',
        schema: z.object({ required_param: z.string() })
      })

      // Missing required parameter
      const result = await registry.invoke('required', {})
      expect(result.success).toBe(false)
      expect((result.error as FunctionErrorResponse).code).toBe('INVALID_PARAMETERS')
    })

    it('should accept optional parameters', async () => {
      registry.register('optional', (params) => params, {
        description: 'Has optional',
        parameters: [
          { name: 'optional_param', type: 'string', description: 'Optional', required: false }
        ],
        returnType: 'object',
        schema: z.object({ optional_param: z.string().optional() })
      })

      const result = await registry.invoke('optional', {})
      expect(result.success).toBe(true)
    })

    it('should validate string type', async () => {
      registry.register('stringFunc', (params) => params, {
        description: 'String validator',
        parameters: [
          { name: 'text', type: 'string', description: 'Text', required: true }
        ],
        returnType: 'object',
        schema: z.object({ text: z.string() })
      })

      // Valid
      const valid = await registry.invoke('stringFunc', { text: 'hello' })
      expect(valid.success).toBe(true)

      // Invalid
      const invalid = await registry.invoke('stringFunc', { text: 123 })
      expect(invalid.success).toBe(false)
    })

    it('should validate number type', async () => {
      registry.register('numFunc', (params) => params, {
        description: 'Number validator',
        parameters: [
          { name: 'num', type: 'number', description: 'Number', required: true }
        ],
        returnType: 'object',
        schema: z.object({ num: z.number() })
      })

      // Valid
      const valid = await registry.invoke('numFunc', { num: 42 })
      expect(valid.success).toBe(true)

      // Invalid
      const invalid = await registry.invoke('numFunc', { num: 'not a number' })
      expect(invalid.success).toBe(false)
    })

    it('should validate boolean type', async () => {
      registry.register('boolFunc', (params) => params, {
        description: 'Boolean validator',
        parameters: [
          { name: 'flag', type: 'boolean', description: 'Flag', required: true }
        ],
        returnType: 'object',
        schema: z.object({ flag: z.boolean() })
      })

      // Valid
      const valid = await registry.invoke('boolFunc', { flag: true })
      expect(valid.success).toBe(true)

      // Invalid
      const invalid = await registry.invoke('boolFunc', { flag: 'true' })
      expect(invalid.success).toBe(false)
    })

    it('should validate enum values', async () => {
      registry.register('enumFunc', (params) => params, {
        description: 'Enum validator',
        parameters: [
          { name: 'status', type: 'string', description: 'Status', required: true }
        ],
        returnType: 'object',
        schema: z.object({ status: z.enum(['active', 'inactive']) })
      })

      // Valid
      const valid = await registry.invoke('enumFunc', { status: 'active' })
      expect(valid.success).toBe(true)

      // Invalid
      const invalid = await registry.invoke('enumFunc', { status: 'unknown' })
      expect(invalid.success).toBe(false)
    })
  })

  // ============================================================================
  // List and Get Tests
  // ============================================================================

  describe('list', () => {
    it('should return empty list for new registry', () => {
      expect(registry.list()).toEqual([])
    })

    it('should return all registered functions', () => {
      registry.register('func1', () => undefined, {
        description: 'First',
        parameters: [],
        returnType: 'void',
        schema: z.object({})
      })

      registry.register('func2', () => undefined, {
        description: 'Second',
        parameters: [],
        returnType: 'void',
        schema: z.object({})
      })

      const list = registry.list()
      expect(list.length).toBe(2)
      expect(list.some(f => f.name === 'func1')).toBe(true)
      expect(list.some(f => f.name === 'func2')).toBe(true)
    })
  })

  describe('get', () => {
    it('should return registered function', () => {
      registry.register('myFunc', () => 'result', {
        description: 'My function',
        parameters: [],
        returnType: 'string',
        schema: z.object({})
      })

      const func = registry.get('myFunc')
      expect(func).toBeDefined()
      expect(func?.name).toBe('myFunc')
      expect(func?.description).toBe('My function')
    })

    it('should return undefined for non-existent function', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })
  })

  // ============================================================================
  // Category Tests
  // ============================================================================

  describe('getByCategory', () => {
    beforeEach(() => {
      registry.register('gates_list', () => [], {
        description: 'List gates',
        parameters: [],
        returnType: 'Gate[]',
        schema: z.object({})
      })

      registry.register('gates_show', () => ({}), {
        description: 'Show gate',
        parameters: [],
        returnType: 'Gate',
        schema: z.object({})
      })

      registry.register('req_list', () => [], {
        description: 'List requirements',
        parameters: [],
        returnType: 'Requirement[]',
        schema: z.object({})
      })

      registry.register('status', () => ({}), {
        description: 'Get status',
        parameters: [],
        returnType: 'Status',
        schema: z.object({})
      })
    })

    it('should filter functions by gate category', () => {
      const gates = registry.getByCategory('gates')
      expect(gates.length).toBe(2)
      expect(gates.every(f => f.name.startsWith('gates_'))).toBe(true)
    })

    it('should filter functions by requirement category', () => {
      const reqs = registry.getByCategory('requirements')
      expect(reqs.length).toBe(1)
      expect(reqs[0]?.name).toBe('req_list')
    })

    it('should filter functions by general category', () => {
      const general = registry.getByCategory('general')
      expect(general.length).toBeGreaterThan(0)
      expect(general.some(f => f.name === 'status')).toBe(true)
    })

    it('should return empty array for unknown category', () => {
      expect(registry.getByCategory('unknown')).toEqual([])
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should wrap validation errors with context', async () => {
      registry.register('validate_test', (params) => params, {
        description: 'Validation test',
        parameters: [
          { name: 'email', type: 'string', description: 'Email', required: true }
        ],
        returnType: 'object',
        schema: z.object({
          email: z.string().email('Invalid email format')
        })
      })

      const result = await registry.invoke('validate_test', { email: 'not-an-email' })
      expect(result.success).toBe(false)
      expect((result.error as FunctionErrorResponse).code).toBe('INVALID_PARAMETERS')
      expect((result.error as FunctionErrorResponse).context).toBeDefined()
    })

    it('should include error context in invocation errors', async () => {
      registry.register('context_error', () => {
        throw new Error('Specific error message')
      }, {
        description: 'Error with context',
        parameters: [],
        returnType: 'void',
        schema: z.object({})
      })

      const result = await registry.invoke('context_error')
      expect(result.success).toBe(false)
      const error = result.error as FunctionErrorResponse
      expect(error.code).toBe('INVOCATION_ERROR')
      expect(error.context?.functionName).toBe('context_error')
    })

    it('should provide helpful error messages', async () => {
      registry.register('missing_param', (params) => params, {
        description: 'Missing parameter',
        parameters: [
          { name: 'name', type: 'string', description: 'Name', required: true }
        ],
        returnType: 'object',
        schema: z.object({ name: z.string() })
      })

      const result = await registry.invoke('missing_param', {})
      expect(result.success).toBe(false)
      expect((result.error as FunctionErrorResponse).message).toContain('validation')
    })
  })

  // ============================================================================
  // Return Value Tests
  // ============================================================================

  describe('return values', () => {
    it('should return success status true on successful invocation', async () => {
      registry.register('success', () => 'ok', {
        description: 'Success',
        parameters: [],
        returnType: 'string',
        schema: z.object({})
      })

      const result = await registry.invoke('success')
      expect(result.success).toBe(true)
      expect('data' in result).toBe(true)
    })

    it('should return success status false on error', async () => {
      registry.register('error', () => {
        throw new Error('error')
      }, {
        description: 'Error',
        parameters: [],
        returnType: 'void',
        schema: z.object({})
      })

      const result = await registry.invoke('error')
      expect(result.success).toBe(false)
      expect('error' in result).toBe(true)
    })

    it('should preserve function return value', async () => {
      const testObj = { key: 'value', nested: { prop: 123 } }
      registry.register('returnObj', () => testObj, {
        description: 'Return object',
        parameters: [],
        returnType: 'object',
        schema: z.object({})
      })

      const result = await registry.invoke('returnObj')
      expect(result.success).toBe(true)
      expect((result as any).data).toEqual(testObj)
    })

    it('should handle null and undefined returns', async () => {
      registry.register('returnNull', () => null, {
        description: 'Return null',
        parameters: [],
        returnType: 'null',
        schema: z.object({})
      })

      registry.register('returnUndefined', () => undefined, {
        description: 'Return undefined',
        parameters: [],
        returnType: 'undefined',
        schema: z.object({})
      })

      const nullResult = await registry.invoke('returnNull')
      expect(nullResult.success).toBe(true)

      const undefinedResult = await registry.invoke('returnUndefined')
      expect(undefinedResult.success).toBe(true)
    })
  })

  // ============================================================================
  // Type Inference Tests
  // ============================================================================

  describe('type inference', () => {
    it('should support generic return types', async () => {
      registry.register('generic', () => ({ id: 1, name: 'test' }), {
        description: 'Generic',
        parameters: [],
        returnType: 'T',
        schema: z.object({})
      })

      const result = await registry.invoke<{ id: number; name: string }>('generic')
      expect(result.success).toBe(true)
      expect((result.data as any).id).toBe(1)
      expect((result.data as any).name).toBe('test')
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle function name with underscores', async () => {
      registry.register('test_function_name', () => 'result', {
        description: 'Underscore name',
        parameters: [],
        returnType: 'string',
        schema: z.object({})
      })

      const result = await registry.invoke('test_function_name')
      expect(result.success).toBe(true)
    })

    it('should handle empty parameter objects', async () => {
      registry.register('noParams', () => 'ok', {
        description: 'No parameters',
        parameters: [],
        returnType: 'string',
        schema: z.object({})
      })

      const result = await registry.invoke('noParams', {})
      expect(result.success).toBe(true)
    })

    it('should handle extra parameters gracefully', async () => {
      registry.register('ignoreExtra', (params) => {
        const p = params as { required: string }
        return p.required
      }, {
        description: 'Ignore extra params',
        parameters: [
          { name: 'required', type: 'string', description: 'Required', required: true }
        ],
        returnType: 'string',
        schema: z.object({ required: z.string() }).strict()
      })

      // Zod strict mode will reject extra properties
      const result = await registry.invoke('ignoreExtra', { required: 'ok', extra: 'value' })
      expect(result.success).toBe(false)
    })

    it('should preserve function behavior over multiple invocations', async () => {
      let callCount = 0
      registry.register('counter', () => {
        callCount++
        return callCount
      }, {
        description: 'Counter',
        parameters: [],
        returnType: 'number',
        schema: z.object({})
      })

      const result1 = await registry.invoke<number>('counter')
      const result2 = await registry.invoke<number>('counter')

      expect((result1.data as number) + 1).toBe(result2.data as number)
    })
  })
})