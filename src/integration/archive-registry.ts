/**
 * Archive Operations Registry
 *
 * Registers all archive-related operations with the function registry.
 * Handles: archive_gate, archive_proposal, archive_batch
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'

export function registerArchiveOps(registry: FunctionRegistry): void {
  registry.register('archive_gate', async (params) => {
    const validated = z.object({
      gateId: z.string(),
      completionNotes: z.string().optional()
    }).parse(params)

    const { archiveGate } = await import('../core/archive-logic.js')
    return await archiveGate(validated.gateId, validated.completionNotes)
  }, {
    description: 'Archive a completed gate with consolidation and git tagging',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The ID of the gate to archive (e.g., "gate-01")',
        required: true
      },
      {
        name: 'completionNotes',
        type: 'string',
        description: 'Optional completion notes',
        required: false
      }
    ],
    returnType: 'ArchiveGateOutput',
    schema: z.object({
      gateId: z.string().min(1, 'Gate ID is required'),
      completionNotes: z.string().optional()
    })
  })

  registry.register('archive_proposal', async (params) => {
    const validated = z.object({
      hash: z.string().regex(/^[a-z0-9]{8}$/),
      completionNotes: z.string().optional()
    }).parse(params)

    const { archiveProposal } = await import('../core/archive-logic.js')
    return await archiveProposal(validated.hash, validated.completionNotes)
  }, {
    description: 'Archive a completed proposal and update dependent artifacts',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The 8-character hash of the proposal to archive',
        required: true
      },
      {
        name: 'completionNotes',
        type: 'string',
        description: 'Optional completion notes',
        required: false
      }
    ],
    returnType: 'ArchiveProposalOutput',
    schema: z.object({
      hash: z.string().regex(/^[a-z0-9]{8}$/, 'Must be 8-character hash'),
      completionNotes: z.string().optional()
    })
  })

  registry.register('archive_batch', async (params) => {
    const validated = z.object({
      artifacts: z.array(z.union([
        z.object({
          type: z.literal('gate'),
          gateId: z.string()
        }),
        z.object({
          type: z.literal('proposal'),
          hash: z.string().regex(/^[a-z0-9]{8}$/)
        })
      ])),
      completionNotes: z.string().optional()
    }).parse(params)

    const { archiveBatch } = await import('../core/archive-logic.js')
    return await archiveBatch(validated.artifacts, validated.completionNotes)
  }, {
    description: 'Archive multiple completed gates and proposals in batch',
    parameters: [
      {
        name: 'artifacts',
        type: 'array',
        description: 'Array of artifacts to archive',
        required: true
      },
      {
        name: 'completionNotes',
        type: 'string',
        description: 'Optional completion notes',
        required: false
      }
    ],
    returnType: 'ArchiveBatchOutput',
    schema: z.object({
      artifacts: z.array(z.union([
        z.object({
          type: z.literal('gate'),
          gateId: z.string()
        }),
        z.object({
          type: z.literal('proposal'),
          hash: z.string().regex(/^[a-z0-9]{8}$/)
        })
      ])),
      completionNotes: z.string().optional()
    })
  })
}
