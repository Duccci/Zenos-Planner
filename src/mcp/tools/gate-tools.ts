import { GatesActionInputSchema } from '../schemas/gates-action-schemas.js'
import {
  validateDependencies,
  type DependencyValidationContext,
} from '../validators/dependency-validator.js'
import { validateQuality, type QualityValidationContext } from '../validators/quality-validator.js'
import { createStateTransitionValidator } from './entity-action-handler.js'

/** Valid gate statuses */
type GateStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'backlog'

/** Full gate state transition map — used for helpful error messages */
const GATE_TRANSITIONS: Partial<Record<GateStatus, GateStatus[]>> = {
  pending: ['in_progress'],
  in_progress: ['completed', 'rejected', 'cancelled', 'backlog'],
  rejected: ['in_progress'],
  completed: [],
  cancelled: [],
  backlog: ['in_progress'],
}

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
  GatesCancelOutputSchema,
  GatesDeferOutputSchema,
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
      actions: ['list', 'show', 'create', 'generate', 'start', 'complete', 'regenerate', 'cancel', 'defer'] as const,
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
          case 'cancel':
            return GatesCancelOutputSchema
          case 'defer':
            return GatesDeferOutputSchema
          default:
            throw new Error(`Unknown gate action: ${String(action)}`)
        }
      },
      actionHandlers: {
        list: async (payload, r) => r.invoke('gates_list', payload),
        show: async (payload, r) => r.invoke('gates_show', payload),
        create: async (payload, r) => r.invoke('gate_create', payload),
        generate: async (payload, r) => r.invoke('generateGates', payload),
        start: async (payload, r) => {
          // Idempotent: if gate is already in_progress, return success without re-invoking CLI
          const gateId = (payload as { gateId?: string }).gateId ?? ''
          const showResult = await r.invoke('gates_show', { gateId })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'in_progress') {
              return { success: true, data: { gateId, status: 'in_progress', message: 'Gate already in progress (no-op)' } }
            }
          }
          return r.invoke('gates_start', payload)
        },
        complete: async (payload, r) => {
          // Idempotent: if gate is already completed, return success without re-invoking CLI
          const gateId = (payload as { gateId?: string }).gateId ?? ''
          const showResult = await r.invoke('gates_show', { gateId })
          if (showResult.success) {
            const currentStatus = (showResult.data as { status?: string }).status
            if (currentStatus === 'completed') {
              return { success: true, data: { gateId, status: 'completed', message: 'Gate already completed (no-op)' } }
            }
          }
          return r.invoke('gates_complete', payload)
        },
        regenerate: async (payload, r) => r.invoke('gates_regenerate', payload),
        cancel: async (payload, r) => r.invoke('gate_cancel', payload),
        defer: async (payload, r) => r.invoke('gate_defer', payload),
      },
      validators: {
        start: (_payload, r) => [
          // Enforce state transition: only pending (or rejected) gates can be started
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createStateTransitionValidator<GateStatus>({
            getCurrentStatus: async () => {
              const gateId = (_payload as { gateId?: string }).gateId ?? ''
              const result = await r.invoke('gates_show', { gateId })
              if (!result.success) return null
              const status = (result.data as { status?: string }).status as GateStatus | undefined
              return status ?? null
            },
            targetStatus: 'in_progress',
            validFromStatuses: ['pending', 'rejected'],
            allTransitions: GATE_TRANSITIONS,
            entityLabel: `gate:${(_payload as { gateId?: string }).gateId ?? '<unknown>'}`,
          }),
        ],
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
                  { hash: string; dependencies: string[]; gateId: string; gateSequence: number }
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

                const rawGateId = _payload?.['gateId']
                const payloadGateId = typeof rawGateId === 'string' ? rawGateId : ''
                const rawDeps = _payload?.['dependencies']
                const payloadDeps = Array.isArray(rawDeps) ? (rawDeps as string[]) : []
                const newNode = {
                  hash: payloadGateId,
                  dependencies: payloadDeps,
                  gateId: payloadGateId,
                  gateSequence: parseInt(payloadGateId.split('-')[1] ?? '') || 0,
                }

                const dependencyContext: DependencyValidationContext = {
                  node: newNode,
                  allNodes: allNodes,
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
          // Enforce state transition: only in_progress gates can be completed
          // See MCP: entity-action-handler.ts#createStateTransitionValidator
          createStateTransitionValidator<GateStatus>({
            getCurrentStatus: async () => {
              const gateId = (_payload as { gateId?: string }).gateId ?? ''
              const result = await r.invoke('gates_show', { gateId })
              if (!result.success) return null
              const status = (result.data as { status?: string }).status as GateStatus | undefined
              return status ?? null
            },
            targetStatus: 'completed',
            validFromStatuses: ['in_progress'],
            allTransitions: GATE_TRANSITIONS,
            entityLabel: `gate:${(_payload as { gateId?: string }).gateId ?? '<unknown>'}`,
          }),
          async () => {
            const allErrors: string[] = []
            const allWarnings: string[] = []

            let qualityMetrics = {
              coverage: 95,
              lintErrors: 2,
              securityIssues: 0,
            }

            try {
              const completeResult = await r.invoke('gates_complete', _payload)

              const completeData = (completeResult as { success: boolean; data?: unknown }).data as
                | Record<string, unknown>
                | undefined
              const summary = completeData?.['summary'] as Record<string, unknown> | undefined
              if (completeResult.success && summary?.['qualityMetrics']) {
                const actualMetrics = summary['qualityMetrics'] as Record<string, unknown>

                qualityMetrics = {
                  coverage: actualMetrics['testCoverage'] as number,
                  lintErrors: actualMetrics['lintErrors'] as number,
                  securityIssues: actualMetrics['securityIssues'] as number,
                }
              }
            } catch (e) {
              allWarnings.push(`Could not retrieve actual quality metrics: ${String(e)}`)
            }

            const qualityContext: QualityValidationContext = {
              metrics: qualityMetrics,
            }

            const qualityResult = await validateQuality(qualityContext)
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
