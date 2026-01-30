/**
 * LLM Layer Tests
 */

import { describe, it, expect } from 'vitest'
import {
  getOpenAIFunctionSignatures,
  getAnthropicToolSignatures,
  getFunctionSignaturesByCategory,
  getFunctionSignature
} from '../../src/integration/llm-layer.js'

describe('LLM Layer', () => {
  describe('OpenAI Function Signatures', () => {
    it('should generate valid OpenAI function signatures', () => {
      const signatures = getOpenAIFunctionSignatures()

      expect(Array.isArray(signatures)).toBe(true)
      expect(signatures.length).toBeGreaterThan(0)

      for (const sig of signatures) {
        expect(sig).toHaveProperty('type', 'function')
        expect(sig).toHaveProperty('function')
        expect(sig.function).toHaveProperty('name')
        expect(sig.function).toHaveProperty('description')
        expect(sig.function).toHaveProperty('parameters')

        expect(sig.function.parameters).toHaveProperty('type', 'object')
        expect(sig.function.parameters).toHaveProperty('properties')
        expect(sig.function.parameters).toHaveProperty('required')

        expect(typeof sig.function.name).toBe('string')
        expect(typeof sig.function.description).toBe('string')
        expect(Array.isArray(sig.function.parameters.required)).toBe(true)
      }
    })

    it('should include required parameters in required array', () => {
      const signatures = getOpenAIFunctionSignatures()

      for (const sig of signatures) {
        const required = sig.function.parameters.required
        const properties = Object.keys(sig.function.parameters.properties)

        // All required params should be in properties
        for (const req of required) {
          expect(properties).toContain(req)
        }
      }
    })
  })

  describe('Anthropic Tool Signatures', () => {
    it('should generate valid Anthropic tool signatures', () => {
      const tools = getAnthropicToolSignatures()

      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)

      for (const tool of tools) {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('input_schema')

        expect(tool.input_schema).toHaveProperty('type', 'object')
        expect(tool.input_schema).toHaveProperty('properties')
        expect(tool.input_schema).toHaveProperty('required')

        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
        expect(Array.isArray(tool.input_schema.required)).toBe(true)
      }
    })
  })

  describe('Function Filtering', () => {
    it('should filter functions by category', () => {
      const gates = getFunctionSignaturesByCategory('gates')
      const proposals = getFunctionSignaturesByCategory('proposals')
      const requirements = getFunctionSignaturesByCategory('requirements')

      expect(gates.length).toBeGreaterThan(0)
      expect(proposals.length).toBeGreaterThan(0)
      expect(requirements.length).toBeGreaterThan(0)

      // Check that gates functions start with 'gates_'
      for (const func of gates) {
        expect(func.name.startsWith('gates_')).toBe(true)
      }

      // Check that proposal functions start with 'proposal_'
      for (const func of proposals) {
        expect(func.name.startsWith('proposal_')).toBe(true)
      }

      // Check that req functions start with 'req_'
      for (const func of requirements) {
        expect(func.name.startsWith('req_')).toBe(true)
      }
    })

    it('should return empty array for unknown category', () => {
      const unknown = getFunctionSignaturesByCategory('nonexistent')
      expect(unknown).toEqual([])
    })
  })

  describe('Function Lookup', () => {
    it('should find existing functions', () => {
      const initFunc = getFunctionSignature('init')
      const gatesListFunc = getFunctionSignature('gates_list')

      expect(initFunc).toBeDefined()
      expect(gatesListFunc).toBeDefined()

      expect(initFunc?.name).toBe('init')
      expect(gatesListFunc?.name).toBe('gates_list')
    })

    it('should return undefined for non-existent functions', () => {
      const nonexistent = getFunctionSignature('nonexistent_function')
      expect(nonexistent).toBeUndefined()
    })
  })

  describe('Signature Consistency', () => {
    it('should have consistent signatures between OpenAI and Anthropic', () => {
      const openaiSigs = getOpenAIFunctionSignatures()
      const anthropicTools = getAnthropicToolSignatures()

      expect(openaiSigs.length).toBe(anthropicTools.length)

      for (let i = 0; i < openaiSigs.length; i++) {
        const openai = openaiSigs[i]
        const anthropic = anthropicTools[i]

        expect(openai.function.name).toBe(anthropic.name)
        expect(openai.function.description).toBe(anthropic.description)

        // Check parameters match
        const openaiProps = Object.keys(openai.function.parameters.properties)
        const anthropicProps = Object.keys(anthropic.input_schema.properties)

        expect(openaiProps.sort()).toEqual(anthropicProps.sort())
        expect(openai.function.parameters.required.sort()).toEqual(anthropic.input_schema.required.sort())
      }
    })
  })
})