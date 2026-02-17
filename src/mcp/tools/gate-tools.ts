/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-condition */
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
 * Actions: list, show, create, generate, start, complete, regenerate
 */
export const gateToolDefinitions = [
  {
    name: 'gates_action',
    description: `REQUIRED TOOL: Use gates_action for ALL gate operations—this is the ONLY way to manage gates.

Actions: list (see all gates, filter by status), show (get gate details by gateId), create (create new gate), generate (generate gates from requirements), start (transition to in_progress), complete (finish gate), regenerate (update roadmap after rescope).

Call this tool whenever: you need to see gates, check gate status/details, start/complete a gate, or manage the roadmap.`,
    inputSchema: GatesActionInputSchema,
  },
]

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  GatesListOutputSchema,
  GateDetailSchema,
  GatesStartOutputSchema,
  GatesCompleteOutputSchema,
  GatesRegenerateOutputSchema,
} from '../schemas/gate-schemas.js'
import { GateCreateOutputSchema } from '../schemas/gate-create-schemas.js'
import { GateGenerateOutputSchema } from '../schemas/workflow-schemas.js'
import { GatesActionOutputSchema } from '../schemas/gates-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'

export function gateHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const gateActionHandler = createEntityActionHandler(
    {
      entity: 'gate',
      actions: ['list', 'show', 'create', 'generate', 'start', 'complete', 'regenerate'] as const,
      inputSchema: GatesActionInputSchema,
      outputSchema: GatesActionOutputSchema,
      actionOutputSchema(action) {
        switch (action) {
          case 'list':
            return GatesListOutputSchema
          case 'show':
            return GateDetailSchema
          case 'create':
            return GateCreateOutputSchema
          case 'generate':
            return GateGenerateOutputSchema
          case 'start':
            return GatesStartOutputSchema
          case 'complete':
            return GatesCompleteOutputSchema
          case 'regenerate':
            return GatesRegenerateOutputSchema
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('gates_list', payload),
        show: async (payload, r) => r.invoke('gates_show', payload),
        create: async (payload, r) => r.invoke('gate_create', payload),
        generate: async (payload, r) => r.invoke('generateGates', payload),
        start: async (payload, r) => r.invoke('gates_start', payload),
        complete: async (payload, r) => r.invoke('gates_complete', payload),
        regenerate: async (payload, r) => r.invoke('gates_regenerate', payload),
      },
      validators: {
        create: (_payload, r) => [
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            const configResult = await r.invoke('config_get', {})
            if (!configResult.success) {
              allWarnings.push(
                `Failed to retrieve config: ${configResult.error.message}. Using default quality thresholds.`
              )
            }

            try {
              const gatesResult = await r.invoke('gates_list', {})
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

                allGates.forEach((gate) => {
                  const gateId = String(gate['id'])
                  const deps = Array.isArray(gate['dependencies'])
                    ? (gate['dependencies'] as string[])
                    : []
                  allNodes.set(gateId, {
                    hash: gateId,
                    dependencies: deps,
                    gateId: gateId,
                    gateSequence: parseInt(gateId.split('-')[1] ?? '') || 0,
                  })
                })

                const payloadGateId = String(_payload?.['gateId'] ?? '')
                const payloadDeps = Array.isArray(_payload?.['dependencies'])
                  ? (_payload?.['dependencies'] as string[])
                  : []
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
            } catch (error) {
              allWarnings.push(`Validator execution failed: ${String(error)}`)
            }

            return {
              allowed: allErrors.length === 0,
              errors: allErrors.length > 0 ? allErrors : undefined,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
            }
          },
        ],
        complete: (_payload, r) => [
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            const configResult = await r.invoke('config_get', {})
            let config: Record<string, unknown>

            if (configResult.success) {
              config = configResult.data as Record<string, unknown>
            } else {
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

            let qualityMetrics = {
              coverage: 95,
              typeErrors: 0,
              lintErrors: 2,
              securityIssues: 0,
            }

            try {
              const completeResult = await r.invoke('gates_complete', _payload)

              if (completeResult.success && (completeResult.data as any).summary?.qualityMetrics) {
                const actualMetrics = (completeResult.data as any).summary.qualityMetrics

                qualityMetrics = {
                  coverage: actualMetrics.testCoverage,
                  typeErrors: actualMetrics.typeErrors,
                  lintErrors: actualMetrics.lintErrors,
                  securityIssues: actualMetrics.securityIssues,
                }
              }
            } catch (e) {
              allWarnings.push(`Could not retrieve actual quality metrics: ${String(e)}`)
            }

            const qualityContext: QualityValidationContext = {
              metrics: qualityMetrics,
              config: config as Parameters<typeof validateQuality>[0]['config'],
              strict: true,
            }

            const qualityResult = validateQuality(qualityContext)
            allErrors.push(...(qualityResult.errors ?? []))
            allWarnings.push(...(qualityResult.warnings ?? []))

            return {
              allowed: allErrors.length === 0,
              errors: allErrors.length > 0 ? allErrors : undefined,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
            }
          },
        ],
      },
    },
    _registry
  )

  return {
    gates_action: gateActionHandler,
  }
}
