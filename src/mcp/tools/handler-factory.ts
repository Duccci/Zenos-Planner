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
import type { ZodSchema } from 'zod'
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
  outputSchema: ZodSchema
) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      // If caller provided a mock result (useful for tests and local simulation),
      // try to parse and validate it against the provided schema first.
      const rawMock = (args as any)?.mockResult ?? null
      if (rawMock !== null) {
        const parsed = parseJsonSafe(rawMock)
        if (parsed !== null) {
          const validated = outputSchema.safeParse(parsed)
          if (validated.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(validated.data, null, 2) }],
              structuredContent: validated.data as Record<string, unknown>
            }
          }
        }

        // Fallback textual representation when mock result couldn't be validated
        const fallbackText = typeof rawMock === 'string' ? rawMock : JSON.stringify(rawMock, null, 2)
        return {
          content: [{ type: 'text', text: fallbackText }],
          structuredContent: { output: fallbackText }
        }
      }

      const result = await registry.invoke(functionName, args)

      if (result.success) {
        const data = result.data as unknown
        const extracted = typeof data === 'object' && data !== null && 'output' in data
          ? (data as any).output
          : data

        const parsed = parseJsonSafe(extracted)

        if (parsed !== null) {
          const validated = outputSchema.safeParse(parsed)
          if (validated.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(validated.data, null, 2) }],
              structuredContent: validated.data as Record<string, unknown>
            }
          }
        }

        const fallbackText = String(extracted ?? data)
        return {
          content: [{ type: 'text', text: fallbackText }],
          structuredContent: { output: fallbackText }
        }
      }

      const errorText = JSON.stringify(result.error ?? { message: 'Unknown error' }, null, 2)
      return {
        content: [{ type: 'text', text: errorText }],
        isError: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: 'text', text: `Handler error: ${errorMessage}` }],
        isError: true
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
export function createBasicHandler(
  registry: FunctionRegistry,
  functionName: string
) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      const result = await registry.invoke(functionName, args)

      if (result.success) {
        const data = result.data as unknown
        const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        return {
          content: [{ type: 'text', text }],
          structuredContent: (result.data ?? {}) as Record<string, unknown>
        }
      }

      const errorText = JSON.stringify(result.error ?? { message: 'Unknown error' }, null, 2)
      return {
        content: [{ type: 'text', text: errorText }],
        isError: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: 'text', text: `Handler error: ${errorMessage}` }],
        isError: true
      }
    }
  }
}
