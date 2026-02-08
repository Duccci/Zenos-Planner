/**
 * MCP Tool Handler Factory
 *
 * Provides factory functions for creating schema-validating MCP tool handlers.
 * Eliminates duplication in tool handler implementations by providing reusable
 * patterns for schema validation, error handling, and response formatting.
 *
 * Usage:
 *   const handler = createSchemaValidatingHandler(
 *     registry,
 *     'proposal_list',
 *     ProposalListOutputSchema
 *   )
 */

import type { FunctionRegistry } from '../../integration/function-registry.js'
import type { ZodType } from 'zod'
import type { FunctionErrorResponse } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Safely parse JSON strings or return the value as-is
 */
export function parseJsonSafe(input: unknown): unknown {
  try {
    return typeof input === 'string' ? JSON.parse(input) : input
  } catch {
    return null
  }
}

/**
 * Create a handler for a tool that invokes a registry function and validates output
 *
 * @param registry - Function registry instance
 * @param functionName - Name of function to invoke (e.g. 'proposal_list')
 * @param outputSchema - Zod schema to validate the output against
 * @returns Async handler function ready for MCP tool registration
 *
 * @example
 *   const handler = createSchemaValidatingHandler(
 *     registry,
 *     'proposal_list',
 *     ProposalListOutputSchema
 *   )
 *   // Returns function: (args) => Promise<CallToolResult>
 */
export function createSchemaValidatingHandler(
  registry: FunctionRegistry,
  functionName: string,
  outputSchema: ZodType
) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      // If caller provided a mock result (useful for tests and local simulation),
      // try to parse and validate it against the provided schema first.
      const rawMock = (args as { mockResult?: unknown }).mockResult ?? null
      if (rawMock != null) {
        const parsed = parseJsonSafe(rawMock)
        if (parsed !== null) {
          const validated = outputSchema.safeParse(parsed)
          if (validated.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(validated.data, null, 2) }],
              structuredContent: validated.data as Record<string, unknown>,
            }
          }
        }

        // Fallback textual representation when mock result couldn't be validated
        const fallbackText =
          typeof rawMock === 'string' ? rawMock : JSON.stringify(rawMock, null, 2)
        return {
          content: [{ type: 'text', text: fallbackText }],
          structuredContent: { output: fallbackText },
        }
      }

      const result = await registry.invoke(functionName, args)

      if (result.success) {
        const data = result.data
        const extracted =
          typeof data === 'object' && data !== null && 'output' in data
            ? (data as Record<string, unknown>)['output']
            : data

        const parsed = parseJsonSafe(extracted)

        if (parsed != null) {
          const validated = outputSchema.safeParse(parsed)
          if (validated.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(validated.data, null, 2) }],
              structuredContent: validated.data as Record<string, unknown>,
            }
          }
        }

        const fallbackText =
          typeof extracted === 'undefined'
            ? typeof data === 'string'
              ? data
              : JSON.stringify(data, null, 2)
            : typeof extracted === 'string'
              ? extracted
              : JSON.stringify(extracted, null, 2)
        return {
          content: [{ type: 'text', text: fallbackText }],
          structuredContent: { output: fallbackText },
        }
      } else {
        // Non-success result: return structured error envelope per unified schema
        const err: FunctionErrorResponse = result.error
        const errorPayload = {
          code: err.code,
          message: err.message,
          context: err.context,
          timestamp: err.timestamp ?? new Date().toISOString(),
          operations: err.operations,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }],
          structuredContent: { error: errorPayload },
          isError: true,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const payload = {
        code: 'INTERNAL_ERROR',
        message: `Handler error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        context: { functionName },
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: { error: payload },
        isError: true,
      }
    }
  }
}

/**
 * Create a simple handler for tools that don't require schema validation
 *
 * Useful for tools that return simple text output or don't need structured validation.
 *
 * @param registry - Function registry instance
 * @param functionName - Name of function to invoke
 * @returns Async handler function
 *
 * @example
 *   const handler = createBasicHandler(registry, 'gates_regenerate')
 */
export function createBasicHandler(registry: FunctionRegistry, functionName: string) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      const result = await registry.invoke(functionName, args)

      if (result.success) {
        const data = result.data
        const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        return {
          content: [{ type: 'text', text }],
          structuredContent: result.data as Record<string, unknown>,
        }
      } else {
        const err: FunctionErrorResponse = result.error
        const errorPayload = {
          code: err.code,
          message: err.message,
          context: err.context,
          timestamp: err.timestamp ?? new Date().toISOString(),
          operations: err.operations,
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }],
          structuredContent: { error: errorPayload },
          isError: true,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const payload = {
        code: 'INTERNAL_ERROR',
        message: `Handler error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        context: { functionName },
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: { error: payload },
        isError: true,
      }
    }
  }
}
