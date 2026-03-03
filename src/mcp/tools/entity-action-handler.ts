/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { ZodType } from 'zod'
import { ZodError } from 'zod'
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
import { logger } from '../../utils/logger.js'

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
      // LLMs often pass `null` for optional fields they don't intend to set.
      // Zod `.optional()` accepts `undefined` but not `null`, so strip top-level
      // null values before parsing to avoid spurious validation failures.
      const cleanArgs = Object.fromEntries(
        Object.entries(args).filter(([, v]) => v !== null)
      )
      const validated = config.inputSchema.parse(cleanArgs) as { action?: T } & Record<string, unknown>

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

      // CRITICAL: Validate action membership BEFORE calling actionOutputSchema.
      // Some actionOutputSchema implementations throw or return undefined for invalid actions.
      // This must be validated first to prevent: "Cannot read properties of undefined (reading '_zod')"
      // error that occurs when Zod tries to call .safeParse() on undefined.
      if (!config.actions.includes(action)) {
        throw new Error(`Unknown ${config.entity} action: ${action}`)
      }

      // Get the schema for this action - safe to call now that action is validated
      let actionSchema: ZodType
      try {
        actionSchema = config.actionOutputSchema(action)
        if (!actionSchema) {
          throw new Error(`actionOutputSchema returned undefined for action: ${action}`)
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('actionOutputSchema returned undefined')) {
          throw error
        }
        // Re-throw other schema-related errors with context
        throw new Error(`Failed to get output schema for action "${action}": ${error instanceof Error ? error.message : String(error)}`)
      }

      // If caller provided a mock result, validate against per-action schema
      const mock = handleMockResult(args, actionSchema)
      if (mock) return mock

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

      // Validate final envelope against supplied output schema (internal integrity check).
      config.outputSchema.parse(output)

      // Both channels carry the same payload so MCP clients that render both
      // content text and structuredContent do not present the data twice.
      return {
        content: [{ type: 'text', text: JSON.stringify(invokeResult.data, null, 2) }],
        structuredContent: invokeResult.data as Record<string, unknown>,
      }
    } catch (e) {
      if (e instanceof ZodError) {
        logger.error(`Zod validation error in ${config.entity}_action`, {
          issues: e.issues.map((issue) => ({
            path: issue.path.join('.') || '(root)',
            message: issue.message,
            code: issue.code,
          })),
          receivedArgs: args,
        })
      } else {
        logger.error(`Unexpected error in ${config.entity}_action`, {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        })
      }
      return handleError(e)
    }
  }
}

/**
 * State transition definition for an entity.
 * Maps each source status to the statuses it can transition to.
 */
export type StateTransitionMap<TStatus extends string> = Partial<Record<TStatus, TStatus[]>>

/**
 * Options for creating a state transition validator.
 */
export interface StateTransitionValidatorOptions<TStatus extends string> {
  /**
   * Function that resolves the entity's current status.
   * Returns null if the entity was not found (validator will allow the action to
   * proceed so the action handler can produce the canonical "not found" error).
   */
  getCurrentStatus: () => Promise<TStatus | null>
  /** The status this action is expected to transition the entity TO */
  targetStatus: TStatus
  /** Statuses from which this transition is permitted */
  validFromStatuses: TStatus[]
  /** Full transition map used to build the helpful "valid transitions" hint in errors */
  allTransitions: StateTransitionMap<TStatus>
  /** Human-readable label for the entity (e.g. "gate:gate-01", "proposal:#abc123") */
  entityLabel: string
}

/**
 * Create a reusable validator function that enforces valid state transitions.
 *
 * Behaviour:
 *  - Already at target state → `allowed: true` with an informational warning (idempotent no-op)
 *  - Valid source state      → `allowed: true`
 *  - Invalid source state    → `allowed: false` with a descriptive error that lists valid next actions
 *  - Entity not found        → `allowed: true` (let the action handler report the canonical error)
 *
 * // See MCP: entity-action-handler.ts#createStateTransitionValidator
 */
export function createStateTransitionValidator<TStatus extends string>(
  options: StateTransitionValidatorOptions<TStatus>
): () => Promise<ValidationResult> {
  return async (): Promise<ValidationResult> => {
    let currentStatus: TStatus | null
    try {
      currentStatus = await options.getCurrentStatus()
    } catch {
      // If we cannot determine current status, allow the action handler to decide
      return { allowed: true }
    }

    // Entity not found; let the action handler produce the canonical error
    if (currentStatus === null) {
      return { allowed: true }
    }

    // Idempotent: already at the target state — no-op, return success
    if (currentStatus === options.targetStatus) {
      return {
        allowed: true,
        warnings: [
          `${options.entityLabel} is already ${options.targetStatus}; transition is a no-op`,
        ],
      }
    }

    // Check valid source states
    if (!options.validFromStatuses.includes(currentStatus)) {
      const validTargets = options.allTransitions[currentStatus] ?? []
      const validTargetsMsg = validTargets.length > 0 ? validTargets.join(', ') : 'none'
      return {
        allowed: false,
        errors: [
          `${options.entityLabel}:${currentStatus} cannot transition to ${options.targetStatus}. ` +
            `Valid transitions from ${currentStatus}: ${validTargetsMsg}`,
        ],
      }
    }

    return { allowed: true }
  }
}
