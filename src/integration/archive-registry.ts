/**
 * Archive Operations Registry
 *
 * Registers all archive-related operations with the function registry.
 * Handles: archive_gate, archive_proposal, archive_batch
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'

export function registerArchiveOps(registry: FunctionRegistry): void {
  // Unified archive_action that dispatches to gate/batch implementations
  registry.register(
    'archive_action',
    async (params) => {
      const validated = z.object({ action: z.string(), payload: z.any().optional() }).parse(params)

      switch (validated.action) {
        case 'gate': {
          const payload = z
            .object({ gateId: z.string(), completionNotes: z.string().optional() })
            .parse(validated.payload ?? {})
          const { archiveGate } = await import('../core/archive-logic.js')
          const result = await archiveGate(payload.gateId, payload.completionNotes)
          return result
        }

        case 'batch': {
          const payload = z
            .object({
              artifacts: z.array(z.object({ type: z.literal('gate'), gateId: z.string() })),
              completionNotes: z.string().optional(),
            })
            .parse(validated.payload)
          const { archiveBatch } = await import('../core/archive-logic.js')
          const result = await archiveBatch(payload.artifacts, payload.completionNotes)
          return result
        }

        default:
          return {
            success: false,
            error: {
              message: `Unknown archive_action: ${validated.action}`,
              code: 'UNKNOWN_ACTION',
            },
          }
      }
    },
    {
      description: 'Unified archive action (gate|proposal|batch)',
      parameters: [
        {
          name: 'action',
          type: 'string',
          description: 'Archive action to perform',
          required: true,
        },
        {
          name: 'payload',
          type: 'object',
          description: 'Action-specific payload',
          required: false,
        },
      ],
      returnType: 'any',
      schema: z.object({ action: z.string(), payload: z.any().optional() }),
    }
  )
}
