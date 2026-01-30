/**
 * LLM Integration Layer
 *
 * Provides function signatures to AI agents in various LLM API formats.
 * Supports OpenAI function calling and Anthropic tools formats.
 */

import { functionRegistry, type FunctionDefinition } from './function-registry.js'

/**
 * OpenAI function calling format
 */
export interface OpenAIFunction {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, {
        type: string
        description: string
      }>
      required: string[]
    }
  }
}

/**
 * Anthropic tools format
 */
export interface AnthropicTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
    }>
    required: string[]
  }
}

/**
 * Get all function signatures in OpenAI function calling format
 */
export function getOpenAIFunctionSignatures(): OpenAIFunction[] {
  return functionRegistry.map(convertToOpenAIFormat)
}

/**
 * Get all function signatures in Anthropic tools format
 */
export function getAnthropicToolSignatures(): AnthropicTool[] {
  return functionRegistry.map(convertToAnthropicFormat)
}

/**
 * Get function signatures filtered by category
 */
export function getFunctionSignaturesByCategory(category: string): FunctionDefinition[] {
  const categoryPrefixes: Record<string, string[]> = {
    gates: ['gates_'],
    requirements: ['req_'],
    proposals: ['proposal_'],
    architecture: ['arch_'],
    general: ['init', 'status', 'show']
  }

  const prefixes = categoryPrefixes[category] ?? []
  return functionRegistry.filter(func =>
    prefixes.some(prefix => func.name.startsWith(prefix))
  )
}

/**
 * Get specific function signature by name
 */
export function getFunctionSignature(name: string): FunctionDefinition | undefined {
  return functionRegistry.find(func => func.name === name)
}

/**
 * Convert function definition to OpenAI format
 */
function convertToOpenAIFormat(func: FunctionDefinition): OpenAIFunction {
  const properties: Record<string, { type: string; description: string }> = {}
  const required: string[] = []

  for (const param of func.parameters) {
    properties[param.name] = {
      type: param.type,
      description: param.description
    }
    if (param.required) {
      required.push(param.name)
    }
  }

  return {
    type: 'function',
    function: {
      name: func.name,
      description: func.description,
      parameters: {
        type: 'object',
        properties,
        required
      }
    }
  }
}

/**
 * Convert function definition to Anthropic format
 */
function convertToAnthropicFormat(func: FunctionDefinition): AnthropicTool {
  const properties: Record<string, { type: string; description: string }> = {}
  const required: string[] = []

  for (const param of func.parameters) {
    properties[param.name] = {
      type: param.type,
      description: param.description
    }
    if (param.required) {
      required.push(param.name)
    }
  }

  return {
    name: func.name,
    description: func.description,
    input_schema: {
      type: 'object',
      properties,
      required
    }
  }
}