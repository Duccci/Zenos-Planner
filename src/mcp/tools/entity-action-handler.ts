/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { ZodType } from 'zod'
import type { FunctionRegistry, FunctionResult } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  handleMockResult,
  runValidators,
  formatValidationError,
  handleError,
  createNotImplementedHandler,
} from './handler-factory.js'
import type { ValidationResult } from './handler-factory.js'

export interface EntityActionConfig<T extends string> {
  entity: string
  actions: T[]
  inputSchema: ZodType
  outputSchema: ZodType
  // Returns the per-action output schema used for validating mock results and action outputs
  actionOutputSchema: (action: T) => ZodType
  // Handler that performs the actual action by invoking registry functions and returns FunctionResult
  actionHandlers: Record<
    T,
    (
      payload: Record<string, unknown> | undefined,
      registry: FunctionRegistry
    ) => Promise<FunctionResult>
  >
  // Optional validators per action. Returns an array of validator functions to be run with runValidators
  validators?: Partial<
    Record<
      T,
      (
        payload: Record<string, unknown> | undefined,
        registry: FunctionRegistry
      ) => (() => Promise<ValidationResult>)[]
    >
  >
}

export function createEntityActionHandler<T extends string>(
  config: EntityActionConfig<T>,
  registry?: FunctionRegistry
) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    if (!registry) return createNotImplementedHandler(`${config.entity} action requires registry`)

    try {
      const validated = config.inputSchema.parse(args) as { action: T; payload: unknown }

      // If caller provided a mock result, validate against per-action schema
      const mock = handleMockResult(args, config.actionOutputSchema(validated.action))
      if (mock) return mock

      // Validate action
      if (!config.actions.includes(validated.action)) {
        throw new Error(`Unknown ${config.entity} action: ${validated.action}`)
      }

      // Run validators if provided
      if (config.validators?.[validated.action] !== undefined) {
        const vFactory = config.validators[validated.action]
        if (vFactory) {
          const validators = vFactory(
            validated.payload as Record<string, unknown> | undefined,
            registry
          )
          const validationResults = await runValidators(validators)

          if (!validationResults.allowed) {
            return formatValidationError(validationResults, validated.action)
          }
        }
      }

      // Invoke action handler
      const handler = config.actionHandlers[validated.action]
      if (!handler) throw new Error(`Handler for action ${validated.action} not found`)

      const invokeResult = await handler(
        validated.payload as Record<string, unknown> | undefined,
        registry
      )

      if (!invokeResult.success) {
        const err = invokeResult.error
        return {
          content: [
            { type: 'text', text: JSON.stringify({ error: err?.message ?? 'Unknown' }, null, 2) },
          ],
          structuredContent: { error: err ?? { message: 'Unknown error' } },
          isError: true,
        }
      }

      const output = {
        action: validated.action,
        result: invokeResult.data as Record<string, unknown>,
      }

      // Validate final envelope against supplied output schema
      const validatedOutput = config.outputSchema.parse(output)

      return {
        content: [{ type: 'text', text: JSON.stringify(validatedOutput, null, 2) }],
        structuredContent: validatedOutput as Record<string, unknown>,
      }
    } catch (e) {
      return handleError(e)
    }
  }
}
