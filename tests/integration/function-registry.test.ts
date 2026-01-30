/**
 * Function Registry Tests
 */

import { describe, it, expect } from 'vitest'
import { functionRegistry, type FunctionDefinition } from '../../src/integration/function-registry.js'

describe('Function Registry', () => {
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

  it('should include core Zeno functions', () => {
    const functionNames = functionRegistry.map(f => f.name)

    // Core project management
    expect(functionNames).toContain('init')
    expect(functionNames).toContain('status')
    expect(functionNames).toContain('gates_list')
    expect(functionNames).toContain('gates_show')

    // Requirements management
    expect(functionNames).toContain('req_list')
    expect(functionNames).toContain('req_show')
    expect(functionNames).toContain('req_status')

    // Proposal management
    expect(functionNames).toContain('proposal_list')
    expect(functionNames).toContain('proposal_show')
    expect(functionNames).toContain('proposal_start')
    expect(functionNames).toContain('proposal_validate')
    expect(functionNames).toContain('proposal_approve')
  })

  it('should have examples for each function', () => {
    for (const func of functionRegistry) {
      expect(func.examples.length).toBeGreaterThan(0)
      for (const example of func.examples) {
        expect(typeof example).toBe('string')
        expect(example.length).toBeGreaterThan(0)
      }
    }
  })

  it('should have proper parameter requirements', () => {
    for (const func of functionRegistry) {
      const requiredParams = func.parameters.filter(p => p.required)
      const optionalParams = func.parameters.filter(p => !p.required)

      // All parameters should be either required or optional
      expect(requiredParams.length + optionalParams.length).toBe(func.parameters.length)

      // Required params should come first (convention)
      if (requiredParams.length > 0 && optionalParams.length > 0) {
        const lastRequiredIndex = func.parameters.findLastIndex(p => p.required)
        const firstOptionalIndex = func.parameters.findIndex(p => !p.required)
        expect(lastRequiredIndex).toBeLessThan(firstOptionalIndex)
      }
    }
  })
})