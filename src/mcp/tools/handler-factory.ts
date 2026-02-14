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
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
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

/**
 * Validation result interface used by runValidators and validators
 */
export interface ValidationResult {
  allowed: boolean
  errors?: string[]
  warnings?: string[]
}

/**
 * Extract mockResult from tool arguments if present (for testing)
 * Returns the mockResult value if present, or explicitly null if not found
 */
export function extractMockResult(args: unknown): unknown {
  if (
    args &&
    typeof args === 'object' &&
    'mockResult' in args &&
    (args as any).mockResult !== undefined
  ) {
    return (args as any).mockResult
  }
  return null
}

/**
 * Handle a mock result by validating against the provided Zod schema.
 * Returns a `CallToolResult` when a mock result is provided (valid or fallback), or `null` when no mock provided.
 */
export function handleMockResult(
  args: Record<string, unknown>,
  schema: ZodType
): CallToolResult | null {
  const raw = extractMockResult(args)
  if (raw === null) return null

  const parsed = parseJsonSafe(raw)
  if (parsed !== null) {
    const ok = schema.safeParse(parsed)
    if (ok.success) {
      return {
        content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
        structuredContent: ok.data as Record<string, unknown>,
      }
    }
  }

  // Fallback textual representation when mock result couldn't be validated
  const fallbackText = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)
  return {
    content: [{ type: 'text', text: fallbackText }],
    structuredContent: { output: raw },
  }
}

/**
 * Run an array of async validators sequentially and aggregate errors/warnings.
 */
export async function runValidators(
  validators: (() => Promise<ValidationResult>)[]
): Promise<ValidationResult> {
  const allErrors: string[] = []
  const allWarnings: string[] = []

  for (const v of validators) {
    try {
      const res = await v()
      if (res.errors) allErrors.push(...res.errors)
      if (res.warnings) allWarnings.push(...res.warnings)
    } catch (e) {
      // A thrown validator is considered a warning to avoid blocking progress unexpectedly
      allWarnings.push(`Validator threw: ${String(e)}`)
    }
  }

  return {
    allowed: allErrors.length === 0,
    errors: allErrors.length > 0 ? allErrors : undefined,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  }
}

/**
 * Format validation results into a consistent CallToolResult error envelope.
 */
export function formatValidationError(
  validation: ValidationResult,
  action?: string
): CallToolResult {
  const errorOutput: Record<string, unknown> = {
    action: action ?? 'action',
    error: 'Validation failed',
    validation,
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(errorOutput, null, 2) }],
    structuredContent: errorOutput,
    isError: true,
  }
}

/**
 * Convert an unknown error into a consistent CallToolResult error payload.
 */
export function handleError(error: unknown, context?: Record<string, unknown>): CallToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const payload = {
    code: 'INTERNAL_ERROR',
    message: `Handler error: ${errorMessage}`,
    timestamp: new Date().toISOString(),
    context: context ?? {},
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: { error: payload },
    isError: true,
  }
}

/**
 * Create a standardized not-implemented error response
 */
export function createNotImplementedHandler(msg?: string): CallToolResult {
  const message = msg ?? 'Not implemented.'
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  }
}
