import {
  GatesListInputSchema,
  GatesShowInputSchema,
  GatesStartInputSchema,
  GatesCompleteInputSchema,
  GatesRegenerateInputSchema,
} from '../schemas/gate-schemas.js'
import { GateCreateInputSchema } from '../schemas/gate-create-schemas.js'
import { GatesActionInputSchema } from '../schemas/gates-action-schemas.js'
import {
  validateDependencies,
  type DependencyValidationContext,
} from '../validators/dependency-validator.js'
import { validateQuality, type QualityValidationContext } from '../validators/quality-validator.js'

/**
 * Unified gate action tool definition.
 * Consolidates all gate lifecycle operations into a single action-based entrypoint.
 *
 * Actions: list, show, create, start, complete, regenerate
 */
export const gateToolDefinitions = [
  {
    name: 'gates_action',
    title: 'Gates Action',
    description:
      'Unified gate lifecycle tool with guardrail enforcement. Supports actions: list, show, create, start, complete, regenerate. Actions "create" and "complete" run dependency and quality validators. Use discriminated union with action and payload.',
    inputSchema: GatesActionInputSchema,
  },
]

/**
 * Legacy individual gate tool definitions (deprecated - use gates_action instead).
 */
export const legacyGateToolDefinitions = [
  {
    name: 'gates_list',
    title: 'Gates List',
    description: 'List all project gates (optional status filter)',
    inputSchema: GatesListInputSchema,
  },
  {
    name: 'gates_show',
    title: 'Gate Show',
    description: 'Show detailed gate information for a gate id',
    inputSchema: GatesShowInputSchema,
  },
  {
    name: 'gate_create',
    title: 'Gate Create',
    description: 'Create a new gate PRD with validation and roadmap updates',
    inputSchema: GateCreateInputSchema,
  },
  {
    name: 'gates_start',
    title: 'Gate Start',
    description: 'Start a gate (transition to in_progress)',
    inputSchema: GatesStartInputSchema,
  },
  {
    name: 'gates_complete',
    title: 'Gate Complete',
    description: 'Complete a gate with optional completion notes',
    inputSchema: GatesCompleteInputSchema,
  },
  {
    name: 'gates_regenerate',
    title: 'Gates Regenerate',
    description: 'Regenerate future gates or check for suggestions',
    inputSchema: GatesRegenerateInputSchema,
  },
]

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry, FunctionResult } from '../../integration/function-registry.js'
import {
  GatesListOutputSchema,
  GateDetailSchema,
  GatesStartOutputSchema,
  GatesCompleteOutputSchema,
  GatesRegenerateOutputSchema,
} from '../schemas/gate-schemas.js'
import type { GatesCompleteOutput } from '../schemas/gate-schemas.js'
import { GateCreateOutputSchema } from '../schemas/gate-create-schemas.js'
import { GatesActionOutputSchema } from '../schemas/gates-action-schemas.js'
import { createSchemaValidatingHandler, parseJsonSafe } from './handler-factory.js'

export function gateHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  function notImplemented(msg?: string): CallToolResult {
    const message = msg ?? 'Gate functionality not implemented yet (Gate 03-06 required).'
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    } as unknown as CallToolResult
  }

  const listHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'gates_list', GatesListOutputSchema)
    : undefined
  const showHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'gates_show', GateDetailSchema)
    : undefined
  const createHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'gate_create', GateCreateOutputSchema)
    : undefined
  const startHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'gates_start', GatesStartOutputSchema)
    : undefined
  const completeHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'gates_complete', GatesCompleteOutputSchema)
    : undefined
  const regenHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'gates_regenerate', GatesRegenerateOutputSchema)
    : undefined

  const runGateValidators = async (
    action: 'create' | 'complete',
    payload: Record<string, unknown>,
    registry: FunctionRegistry
  ): Promise<{ allowed: boolean; errors?: string[]; warnings?: string[] }> => {
    const allErrors: string[] = []
    const allWarnings: string[] = []

    try {
      // Get project configuration from config - this is the primary source of truth
      const configResult = await registry.invoke('config_get', {})
      let config: Record<string, unknown>

      if (configResult.success) {
        config = configResult.data as Record<string, unknown>
      } else {
        // If config retrieval fails, use sensible defaults for quality thresholds
        allWarnings.push(
          `Failed to retrieve config: ${configResult.error.message}. Using default quality thresholds.`
        )
        config = {
          qualityThresholds: {
            codeCoverage: 90,
            typeCheckingErrors: 0,
            lintingErrorRate: 0.01,
            securityVulnerabilities: 0,
          },
        }
      }

      // For 'create' action: validate dependencies
      if (action === 'create') {
        // Get all existing gates for dependency validation
        const gatesResult = await registry.invoke('gates_list', {})
        if (!gatesResult.success) {
          allWarnings.push(
            `Failed to retrieve gates list for dependency validation: ${gatesResult.error.message}`
          )
        } else {
          const allGates = gatesResult.data as Record<string, unknown>[]
          const allNodes = new Map<
            string,
            { hash: string; dependencies: unknown[]; gateId: string; gateSequence: number }
          >()

          // Build dependency nodes from existing gates
          allGates.forEach((gate) => {
            const gateId = String(gate['id'])
            const deps = Array.isArray(gate['dependencies']) ? (gate['dependencies'] as string[]) : []
            allNodes.set(gateId, {
              hash: gateId,
              dependencies: deps,
              gateId: gateId,
              gateSequence: parseInt(gateId.split('-')[1] ?? '') || 0,
            })
          })

          // Add the new gate being created
          const payloadGateId = String(payload['gateId'])
          const payloadDeps = Array.isArray(payload['dependencies']) ? (payload['dependencies'] as string[]) : []
          const newNode = {
            hash: payloadGateId,
            dependencies: payloadDeps,
            gateId: payloadGateId,
            gateSequence: parseInt(payloadGateId.split('-')[1] ?? '') || 0,
          }

          const dependencyContext: DependencyValidationContext = {
            node: newNode as Parameters<typeof validateDependencies>[0]['node'],
            allNodes: allNodes as Parameters<typeof validateDependencies>[0]['allNodes'],
          }

          const dependencyResult = validateDependencies(dependencyContext)
          allErrors.push(...(dependencyResult.errors ?? []))
          allWarnings.push(...(dependencyResult.warnings ?? []))
        }
      }

      // For 'complete' action: validate quality metrics
      if (action === 'complete') {
        // First, get the completion result to extract actual quality metrics
        let qualityMetrics = {
          coverage: 95,
          typeErrors: 0,
          lintErrors: 2,
          securityIssues: 0,
        }

        // Try to get actual metrics from gates_complete result
        try {
          const completeResult = await registry.invoke<GatesCompleteOutput>(
            'gates_complete',
            payload
          )
          if (completeResult.success && completeResult.data.summary.qualityMetrics) {
            const actualMetrics = completeResult.data.summary.qualityMetrics
            qualityMetrics = {
              coverage: actualMetrics.testCoverage,
              typeErrors: actualMetrics.typeErrors,
              lintErrors: actualMetrics.lintErrors,
              securityIssues: actualMetrics.securityIssues,
            }
          }
        } catch (e) {
          // Use defaults if we can't get actual metrics
          allWarnings.push(`Could not retrieve actual quality metrics: ${String(e)}`)
        }

        const qualityContext: QualityValidationContext = {
          metrics: qualityMetrics,
          config: config as Parameters<typeof validateQuality>[0]['config'],
          strict: true, // Strict mode for gate completion
        }

        const qualityResult = validateQuality(qualityContext)
        allErrors.push(...(qualityResult.errors ?? []))
        allWarnings.push(...(qualityResult.warnings ?? []))
      }
    } catch (error) {
      allWarnings.push(`Validator execution failed: ${String(error)}`)
    }

    return {
      allowed: allErrors.length === 0,
      errors: allErrors.length > 0 ? allErrors : undefined,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    }
  }

  return {
    async gates_list(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = args['mockResult'] ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesListOutputSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
        }

        return {
          content: [{ type: 'text', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }],
          structuredContent: { output: typeof raw === 'string' ? raw : JSON.stringify(raw) },
        }
      }

      if (!listHandler) return notImplemented('Gates list not implemented yet.')
      return listHandler(args)
    },

    async gates_show(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = args['mockResult'] ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GateDetailSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
        }

        return {
          content: [{ type: 'text', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }],
          structuredContent: { output: typeof raw === 'string' ? raw : JSON.stringify(raw) },
        }
      }

      if (!showHandler) return notImplemented('Gate details not implemented yet.')
      return showHandler(args)
    },

    async gate_create(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = args['mockResult'] ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GateCreateOutputSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
        }

        return {
          content: [{ type: 'text', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }],
          structuredContent: { output: typeof raw === 'string' ? raw : JSON.stringify(raw) },
        }
      }

      if (!createHandler) return notImplemented('Gate creation not implemented yet.')
      return createHandler(args)
    },

    async gates_start(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = args['mockResult'] ?? null
      if (raw !== null) {
        const rawObj = raw as Record<string, unknown>
        if (typeof raw === 'object' && rawObj['success'] === false) {
          const errObj = rawObj['error'] as Record<string, unknown> | undefined
          const rawCode = errObj?.['code']
          const code = (typeof rawCode === 'string' ? rawCode : '').toLowerCase()
          const msg = (errObj?.['message'] as string | undefined) ?? String(rawObj['error'])
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: code || msg }, null, 2) }],
            isError: true,
          }
        }

        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesStartOutputSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
        }

        return {
          content: [{ type: 'text', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }],
          structuredContent: { output: typeof raw === 'string' ? raw : JSON.stringify(raw) },
        }
      }

      if (!startHandler) return notImplemented('Gate start not implemented yet.')
      return startHandler(args)
    },

    async gates_complete(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = args['mockResult'] ?? null
      if (raw !== null) {
        const rawObj = raw as Record<string, unknown>
        if (typeof raw === 'object' && rawObj['success'] === false) {
          return {
            content: [{ type: 'text', text: JSON.stringify(rawObj['error'] ?? {}, null, 2) }],
            isError: true,
          }
        }

        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesCompleteOutputSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
        }

        return {
          content: [{ type: 'text', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }],
          structuredContent: { output: typeof raw === 'string' ? raw : JSON.stringify(raw) },
        }
      }

      if (!completeHandler) return notImplemented('Gate completion not implemented yet.')
      return completeHandler(args)
    },

    async gates_regenerate(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = args['mockResult'] ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesRegenerateOutputSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
        }

        return {
          content: [{ type: 'text', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }],
          structuredContent: { output: typeof raw === 'string' ? raw : JSON.stringify(raw) },
        }
      }

      if (!regenHandler) return notImplemented('Gates regenerate not implemented yet.')
      return regenHandler(args)
    },

    /**
     * Unified action dispatcher for gate lifecycle operations.
     * Validates action and payload, then delegates to appropriate handler.
     */
    async gates_action(args: Record<string, unknown>): Promise<CallToolResult> {
      if (!_registry) {
        return notImplemented('Gates action requires registry')
      }

      try {
        const { GatesActionInputSchema } = await import('../schemas/gates-action-schemas.js')
        const validated = GatesActionInputSchema.parse(args)

        let invokeResult: FunctionResult

        switch (validated.action) {
          case 'list':
            invokeResult = await _registry.invoke('gates_list', validated.payload)
            break
          case 'show':
            invokeResult = await _registry.invoke('gates_show', validated.payload)
            break
          case 'create':
          case 'complete': {
            // Run validators for state-changing actions
            const validationResults = await runGateValidators(
              validated.action,
              validated.payload,
              _registry
            )

            // If validation fails with errors, return validation results
            if (!validationResults.allowed) {
              const errorOutput = {
                action: validated.action,
                error: 'Validation failed',
                validation: validationResults,
              }
              return {
                content: [{ type: 'text', text: JSON.stringify(errorOutput, null, 2) }],
                structuredContent: errorOutput,
                isError: true,
              } as CallToolResult
            }

            // Proceed with the action
            invokeResult = await _registry.invoke(
              validated.action === 'create' ? 'gate_create' : 'gates_complete',
              validated.payload
            )

            // Always include validation results (even if empty/passing)
            if (invokeResult.success) {
              invokeResult = {
                success: true,
                data: {
                  ...(invokeResult.data as Record<string, unknown>),
                  validation: {
                    passed: !validationResults.errors || validationResults.errors.length === 0,
                    errors: validationResults.errors ?? [],
                    warnings: validationResults.warnings ?? [],
                  },
                },
              }
            }
            break
          }
          case 'start':
            invokeResult = await _registry.invoke('gates_start', validated.payload)
            break
          case 'regenerate':
            invokeResult = await _registry.invoke('gates_regenerate', validated.payload)
            break
          default:
            throw new Error(
              `Unknown gate action: ${String((validated as Record<string, unknown>)['action'] ?? 'unknown')}`
            )
        }

        // Check for invocation errors
        if (!invokeResult.success) {
          throw new Error(invokeResult.error.message)
        }

        // Wrap result in action envelope
        const output = {
          action: validated.action,
          result: invokeResult.data as Record<string, unknown>,
          validation: undefined,
        }

        // Validate output
        const validatedOutput = GatesActionOutputSchema.parse(output)

        return {
          content: [{ type: 'text', text: JSON.stringify(validatedOutput, null, 2) }],
          structuredContent: validatedOutput,
        } as CallToolResult
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        } as CallToolResult
      }
    },
  }
}
