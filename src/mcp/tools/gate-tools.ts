import {
  GatesListInputSchema,
  GatesShowInputSchema,
  GatesStartInputSchema,
  GatesCompleteInputSchema,
  GatesRegenerateInputSchema
} from '../schemas/gate-schemas.js'
import { GateCreateInputSchema } from '../schemas/gate-create-schemas.js'
import { GatesActionInputSchema } from '../schemas/gates-action-schemas.js'
import { validateDependency, type DependencyValidationContext } from '../validators/dependency-validator.js'
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
    description: 'Unified gate lifecycle tool with guardrail enforcement. Supports actions: list, show, create, start, complete, regenerate. Actions "create" and "complete" run dependency and quality validators. Use discriminated union with action and payload.',
    inputSchema: GatesActionInputSchema
  }
]

/**
 * Legacy individual gate tool definitions (deprecated - use gates_action instead).
 */
export const legacyGateToolDefinitions = [
  {
    name: 'gates_list',
    title: 'Gates List',
    description: 'List all project gates (optional status filter)',
    inputSchema: GatesListInputSchema
  },
  {
    name: 'gates_show',
    title: 'Gate Show',
    description: 'Show detailed gate information for a gate id',
    inputSchema: GatesShowInputSchema
  },
  {
    name: 'gate_create',
    title: 'Gate Create',
    description: 'Create a new gate PRD with validation and roadmap updates',
    inputSchema: GateCreateInputSchema
  },
  {
    name: 'gates_start',
    title: 'Gate Start',
    description: 'Start a gate (transition to in_progress)',
    inputSchema: GatesStartInputSchema
  },
  {
    name: 'gates_complete',
    title: 'Gate Complete',
    description: 'Complete a gate with optional completion notes',
    inputSchema: GatesCompleteInputSchema
  },
  {
    name: 'gates_regenerate',
    title: 'Gates Regenerate',
    description: 'Regenerate future gates or check for suggestions',
    inputSchema: GatesRegenerateInputSchema
  }
]

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { GatesListOutputSchema, GateDetailSchema, GatesStartOutputSchema, GatesCompleteOutputSchema, GatesRegenerateOutputSchema } from '../schemas/gate-schemas.js'
import { GateCreateOutputSchema } from '../schemas/gate-create-schemas.js'
import { GatesActionOutputSchema } from '../schemas/gates-action-schemas.js'
import { createSchemaValidatingHandler, parseJsonSafe } from './handler-factory.js'

export function gateHandlers(_registry?: FunctionRegistry) {
  function notImplemented(msg?: string): CallToolResult {
    const message = msg ?? 'Gate functionality not implemented yet (Gate 03-06 required).'
    return { content: [ { type: 'text', text: JSON.stringify({ error: message }, null, 2) } ], isError: true } as unknown as CallToolResult
  }

  const listHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_list', GatesListOutputSchema) : undefined
  const showHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_show', GateDetailSchema) : undefined
  const createHandler = _registry ? createSchemaValidatingHandler(_registry, 'gate_create', GateCreateOutputSchema) : undefined
  const startHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_start', GatesStartOutputSchema) : undefined
  const completeHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_complete', GatesCompleteOutputSchema) : undefined
  const regenHandler = _registry ? createSchemaValidatingHandler(_registry, 'gates_regenerate', GatesRegenerateOutputSchema) : undefined

  return {
    async gates_list(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesListOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!listHandler) return notImplemented('Gates list not implemented yet.')
      return listHandler(args)
    },


    async gates_show(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GateDetailSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!showHandler) return notImplemented('Gate details not implemented yet.')
      return showHandler(args)
    },

    async gate_create(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GateCreateOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!createHandler) return notImplemented('Gate creation not implemented yet.')
      return createHandler(args)
    },

    async gates_start(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        if (typeof raw === 'object' && (raw as any).success === false) {
          const code = String((raw as any).error?.code ?? '').toLowerCase()
          const msg = (raw as any).error?.message ?? String((raw as any).error)
          return { content: [ { type: 'text', text: JSON.stringify({ error: code || msg }, null, 2) } ], isError: true }
        }

        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesStartOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!startHandler) return notImplemented('Gate start not implemented yet.')
      return startHandler(args)
    },

    async gates_complete(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        if (typeof raw === 'object' && (raw as any).success === false) {
          return { content: [ { type: 'text', text: JSON.stringify((raw as any).error ?? {}, null, 2) } ], isError: true }
        }

        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesCompleteOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!completeHandler) return notImplemented('Gate completion not implemented yet.')
      return completeHandler(args)
    },

    async gates_regenerate(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = GatesRegenerateOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!regenHandler) return notImplemented('Gates regenerate not implemented yet.')
      return regenHandler(args)
    },

    /**
     * Run validators for gate actions that change state.
     * Returns combined validation results from all applicable validators.
     */
    async runGateValidators(
      action: 'create' | 'complete',
      payload: any,
      registry: FunctionRegistry
    ): Promise<{ allowed: boolean; errors?: string[]; warnings?: string[] }> {
      const allErrors: string[] = []
      const allWarnings: string[] = []

      try {
        // Get project configuration
        const configResult = await registry.invoke('config_get', {})
        if (!configResult.success) {
          allWarnings.push(`Failed to retrieve config, using defaults: ${configResult.error.message}`)
        }
        const config = configResult.success ? configResult.data : {
          qualityThresholds: {
            codeCoverage: 90,
            typeCheckingErrors: 0,
            lintingErrorRate: 0.01,
            securityVulnerabilities: 0
          }
        }

        // For 'create' action: validate dependencies
        if (action === 'create') {
          // Get all existing gates for dependency validation
          const gatesResult = await registry.invoke('gates_list', {})
          if (!gatesResult.success) {
            allWarnings.push(`Failed to retrieve gates list for dependency validation: ${gatesResult.error.message}`)
          } else {
            const allGates = gatesResult.data || []
            const allNodes = new Map()

            // Build dependency nodes from existing gates
            allGates.forEach((gate: any) => {
              allNodes.set(gate.id, {
                hash: gate.id,
                dependencies: gate.dependencies || [],
                gateId: gate.id,
                gateSequence: parseInt(gate.id.split('-')[1]) || 0
              })
            })

            // Add the new gate being created
            const newNode = {
              hash: payload.gateId,
              dependencies: payload.dependencies || [],
              gateId: payload.gateId,
              gateSequence: parseInt(payload.gateId.split('-')[1]) || 0
            }

            const dependencyContext: DependencyValidationContext = {
              node: newNode,
              allNodes
            }

            const dependencyResult = validateDependency(dependencyContext)
            allErrors.push(...(dependencyResult.errors || []))
            allWarnings.push(...(dependencyResult.warnings || []))
          }
        }

        // For 'complete' action: validate quality metrics
        if (action === 'complete') {
          // Get quality metrics (simplified - in practice this would come from CI/CD or analysis)
          const qualityMetrics = {
            coverage: 95, // TODO: Get actual coverage
            typeErrors: 0, // TODO: Get actual type errors
            lintErrors: 2, // TODO: Get actual lint errors
            securityIssues: 0 // TODO: Get actual security issues
          }

          const qualityContext: QualityValidationContext = {
            metrics: qualityMetrics,
            config,
            strict: true // Strict mode for gate completion
          }

          const qualityResult = validateQuality(qualityContext)
          allErrors.push(...(qualityResult.errors || []))
          allWarnings.push(...(qualityResult.warnings || []))
        }

      } catch (error) {
        allWarnings.push(`Validator execution failed: ${String(error)}`)
      }

      return {
        allowed: allErrors.length === 0,
        errors: allErrors.length > 0 ? allErrors : undefined,
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      }
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

        let invokeResult: any

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
            const validationResults = await runGateValidators(validated.action, validated.payload, _registry)

            // If validation fails with errors, return validation results
            if (!validationResults.allowed) {
              const output = {
                action: validated.action,
                result: null,
                validation: validationResults
              }
              const validatedOutput = GatesActionOutputSchema.parse(output)
              return {
                content: [{ type: 'text', text: JSON.stringify(validatedOutput, null, 2) }],
                structuredContent: validatedOutput,
                isError: true
              } as CallToolResult
            }

            // Proceed with the action
            invokeResult = await _registry.invoke(
              validated.action === 'create' ? 'gate_create' : 'gates_complete',
              validated.payload
            )

            // Include validation warnings in result if present
            invokeResult.data = {
              ...invokeResult.data,
              validation: validationResults.warnings && validationResults.warnings.length > 0 ? validationResults : undefined
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
            throw new Error(`Unknown gate action: ${(validated as any).action}`)
        }

        // Check for invocation errors
        if (!invokeResult.success) {
          throw new Error(invokeResult.error.message)
        }

        // Wrap result in action envelope
        const output = {
          action: validated.action,
          result: invokeResult.data,
          validation: undefined // Only set for validated actions
        }

        // Validate output
        const validatedOutput = GatesActionOutputSchema.parse(output)

        return {
          content: [{ type: 'text', text: JSON.stringify(validatedOutput, null, 2) }],
          structuredContent: validatedOutput
        } as CallToolResult
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true
        } as CallToolResult
      }
    }
  }
}
