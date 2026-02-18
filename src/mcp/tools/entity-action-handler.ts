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
): (args: Record<string, unknown>) => Promise<CallToolResult> {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    if (!registry) return createNotImplementedHandler(`${config.entity} action requires registry`)

    try {
      const validated = config.inputSchema.parse(args) as { action?: T } & Record<string, unknown>

      // Return usage guidance when no action is provided
      if (!validated.action) {
        const usage = {
          error: 'action is required',
          tool: `${config.entity}_action`,
          availableActions: config.actions,
          usage: `Call this tool with { "action": "<one of the above>" } plus any required fields for that action. Check the tool's input schema description for per-action field requirements.`,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(usage, null, 2) }],
          structuredContent: usage,
          isError: true,
        }
      }

      const action = validated.action

      // If caller provided a mock result, validate against per-action schema
      const mock = handleMockResult(args, config.actionOutputSchema(action))
      if (mock) return mock

      // Validate action
      if (!config.actions.includes(action)) {
        throw new Error(`Unknown ${config.entity} action: ${action}`)
      }

      // Args without the `action` discriminator passed as the payload to handlers
      const { action: _action, ...payload } = validated

      // Run validators if provided
      if (config.validators?.[action] !== undefined) {
        const vFactory = config.validators[action]
        if (vFactory) {
          const validators = vFactory(payload as Record<string, unknown>, registry)
          const validationResults = await runValidators(validators)

          if (!validationResults.allowed) {
            return formatValidationError(validationResults, action)
          }
        }
      }

      // Invoke action handler
      const handler = config.actionHandlers[action]
      if (!handler) throw new Error(`Handler for action ${action} not found`)

      const invokeResult = await handler(payload as Record<string, unknown>, registry)

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
        action: action,
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
