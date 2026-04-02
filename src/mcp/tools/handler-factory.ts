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

import type { ValidationResult } from '../validators/types.js'
export type { ValidationResult }

import type { FunctionRegistry } from '../../integration/function-registry.js'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'
import type { FunctionErrorResponse, FunctionResult } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../../utils/logger.js'

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
  outputSchema: ZodType | undefined
): (args: Record<string, unknown>) => Promise<CallToolResult> {
  if (!outputSchema) {
    const errorMsg = `Cannot create handler for "${functionName}": outputSchema is undefined`
    return () =>
      Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ error: errorMsg }, null, 2) }],
        isError: true,
      })
  }

  return async (args: Record<string, unknown> | null | undefined): Promise<CallToolResult> => {
    // Normalize: LLMs sometimes pass null as the top-level args object (or include
    // null values for optional fields). Treat null args the same as empty object.
    const safeArgs: Record<string, unknown> = args ?? {}

    try {
      // If caller provided a mock result (useful for tests and local simulation),
      // try to parse and validate it against the provided schema first.
      const rawMock = (safeArgs as { mockResult?: unknown }).mockResult ?? null
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

      const result = await registry.invoke(functionName, safeArgs)

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
          } else {
            logger.warn(`Output schema validation failed for "${functionName}"`, {
              issues: validated.error.issues.map(i => ({
                path: i.path.join('.') || '(root)',
                message: i.message,
                code: i.code,
              })),
            })
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
export function createBasicHandler(
  registry: FunctionRegistry,
  functionName: string
): (args: Record<string, unknown> | null | undefined) => Promise<CallToolResult> {
  return async (args: Record<string, unknown> | null | undefined): Promise<CallToolResult> => {
    const safeArgs: Record<string, unknown> = args ?? {}
    try {
      const result = await registry.invoke(functionName, safeArgs)

      if (result.success) {
        const data = result.data
        const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        const structuredContent: Record<string, unknown> =
          typeof data === 'object' && data !== null
            ? (data as Record<string, unknown>)
            : { data }
        return {
          content: [{ type: 'text', text }],
          structuredContent,
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
        isError: true,
      }
    }
  }
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
    (args as Record<string, unknown>)['mockResult'] !== undefined
  ) {
    return (args as Record<string, unknown>)['mockResult']
  }
  return null
}

/**
 * Handle a mock result by validating against the provided Zod schema.
 * Returns a `CallToolResult` when a mock result is provided (valid or fallback), or `null` when no mock provided.
 */
export function handleMockResult(
  args: Record<string, unknown>,
  schema: ZodType | undefined
): CallToolResult | null {
  // Defensive check: schema must be defined to call .safeParse()
  // Otherwise: "Cannot read properties of undefined (reading '_zod')" error
  if (!schema) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Output schema is undefined' }, null, 2) }],
      isError: true,
    }
  }

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
    structuredContent: { output: fallbackText },
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
    isError: true,
  }
}

/**
 * Convert an unknown error into a consistent CallToolResult error payload.
 * ZodError instances are expanded to include per-field issue details.
 */
export function handleError(error: unknown, context?: Record<string, unknown>): CallToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error)

  // Extract per-field details from ZodError for actionable diagnostics
  const zodIssues =
    error instanceof ZodError
      ? error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
          code: issue.code,
          ...('expected' in issue ? { expected: (issue as unknown as Record<string, unknown>)['expected'] } : {}),
          ...('received' in issue ? { received: (issue as unknown as Record<string, unknown>)['received'] } : {}),
        }))
      : undefined

  if (zodIssues) {
    logger.error('Zod validation error in handler', { issues: zodIssues, context })
  }

  const payload: Record<string, unknown> = {
    code: error instanceof ZodError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
    message: `Handler error: ${errorMessage}`,
    timestamp: new Date().toISOString(),
    context: context ?? {},
    ...(zodIssues ? { zodIssues } : {}),
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

export interface GuidanceOptions {
  preReview?: unknown
  templateInfo?: {
    name: string
    content: string
    /**
     * Explicit directive telling the receiving LLM what to do with the template.
     * Co-located on the templateInfo object so the agent does not need to correlate
     * fill instructions buried in guidance.workflow with the template content.
     */
    fillInstruction?: string
    /**
     * Canonical destination path (relative to project root) where the generated
     * file must be written.  Reduces ambiguity between template content and target path.
     */
    outputPathHint?: string
  }
}

/**
 * Inject guidance (guardrails + workflow) into a successful FunctionResult's data payload.
 *
 * Eliminates the repeated `if (result.success) { ...spread guidance... }` pattern
 * across gate, proposal, and archive action handlers.
 *
 * @param result       The FunctionResult from r.invoke().
 * @param guardrails   Narrative rules array from toNarrativeRules().
 * @param workflow     Compact workflow string from toCompactWorkflow().
 * @param options      Optional preReview and templateInfo to inject.
 */
export function withGuidance(
  result: FunctionResult,
  guardrails: unknown,
  workflow: unknown,
  options?: unknown
): FunctionResult {
  if (!result.success) return result

  // Support both legacy positional (preReview) and new options-object callers
  const opts: GuidanceOptions =
    options !== null && typeof options === 'object' && ('preReview' in options || 'templateInfo' in options)
      ? (options as GuidanceOptions)
      : { preReview: options }

  return {
    success: true,
    data: {
      ...(result.data as Record<string, unknown>),
      ...(opts.preReview !== undefined ? { preReviewSummary: opts.preReview } : {}),
      ...(opts.templateInfo ? { templateInfo: opts.templateInfo } : {}),
      guidance: { guardrails, workflow },
    },
  }
}

/**
 * Builds warning messages from a qualitative review object.
 * Collects all flaggedItems first, then appends a message for each boolean
 * field that is explicitly false.
 *
 * @param review        - The qualitative review (gate or proposal)
 * @param fieldMessages - Map of review field key → warning message when false
 */
export function buildQualitativeReviewWarnings<TReview extends { flaggedItems: string[] }>(
  review: TReview,
  fieldMessages: Partial<Record<keyof TReview & string, string>>
): string[] {
  const warnings: string[] = [...review.flaggedItems]
  for (const entry of Object.entries(fieldMessages) as [string, string | undefined][]) {
    const [field, message] = entry
    if (message !== undefined && (review[field as keyof TReview] as unknown) === false) {
      warnings.push(message)
    }
  }
  return warnings
}
