/**
 * Proposal Operations Registry
 *
 * Registers all proposal-related operations with the function registry.
 * Handles: list, show, start, validate, approve, reject
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { invokeCommand } from './command-invoker.js'

export function registerProposalsOps(registry: FunctionRegistry): void {
  registry.register('proposal_list', async (params) => {
    const validated = z.object({
      gateId: z.string().optional(),
      status: z.string().optional()
    }).parse(params)
    const result = await invokeCommand('proposal_list', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'List proposals, optionally filtered by gate or status',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'Optional gate ID to filter proposals',
        required: false
      },
      {
        name: 'status',
        type: 'string',
        description: 'Optional status filter: pending, in_progress, completed, rejected',
        required: false
      }
    ],
    returnType: 'Proposal[]',
    schema: z.object({
      gateId: z.string().optional(),
      status: z.string().optional()
    })
  })

  registry.register('proposal_show', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_show', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show detailed information about a specific proposal',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'ProposalDetails',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  // Create a new proposal and register it in the proposals database
  registry.register('proposal_create', async (params) => {
    const validated = z.object({
      title: z.string().min(1),
      gateId: z.string().optional(),
      requirementId: z.string().optional()
    }).parse(params)

    const result = await invokeCommand('proposal_create', validated)
    if (!result.success) {
      throw new Error(result.error)
    }

    return result
  }, {
    description: 'Create a new proposal markdown file and register it',
    parameters: [
      {
        name: 'title',
        type: 'string',
        description: 'Proposal title',
        required: true
      },
      {
        name: 'gateId',
        type: 'string',
        description: 'Optional gate ID to attach proposal to',
        required: false
      },
      {
        name: 'requirementId',
        type: 'string',
        description: 'Optional requirement id this proposal addresses',
        required: false
      }
    ],
    returnType: 'ProposalDetails',
    schema: z.object({
      title: z.string().min(1),
      gateId: z.string().optional(),
      requirementId: z.string().optional()
    })
  })

  registry.register('proposal_start', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_start', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Start implementation of a proposal (status: pending -> in_progress)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('proposal_validate', async (params) => {
    const validated = z.object({ hash: z.string(), strict: z.boolean().optional() }).parse(params)
    const result = await invokeCommand('proposal_validate', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Run automated validation checks on a proposal',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      },
      {
        name: 'strict',
        type: 'boolean',
        description: 'Treat warnings as errors and fail validation',
        required: false
      }
    ],
    returnType: 'ValidationResult',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required'),
      strict: z.boolean().optional()
    })
  })

  registry.register('proposal_approve', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_approve', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Approve a completed proposal (status: in_progress -> completed)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('proposal_reject', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('proposal_reject', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Reject a proposal (status: in_progress -> rejected)',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the proposal',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })
}
