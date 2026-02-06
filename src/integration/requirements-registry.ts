/**
 * Requirement Operations Registry
 *
 * Registers all requirement-related operations with the function registry.
 * Handles: list, show, deps, transfer
 */

import { z } from 'zod'
import { FunctionRegistry } from './function-registry.js'
import { invokeCommand } from './command-invoker.js'

export function registerRequirementsOps(registry: FunctionRegistry): void {
  registry.register('req_list', async (params) => {
    const validated = z.object({
      gateId: z.string().optional(),
      project: z.boolean().optional()
    }).parse(params)
    const result = await invokeCommand('req_list', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'List requirements, optionally filtered by gate or project-wide',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'Optional gate ID to filter requirements',
        required: false
      },
      {
        name: 'project',
        type: 'boolean',
        description: 'If true, list project-level requirements only',
        required: false
      }
    ],
    returnType: 'Requirement[]',
    schema: z.object({
      gateId: z.string().optional(),
      project: z.boolean().optional()
    })
  })

  registry.register('req_show', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('req_show', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show detailed information about a specific requirement',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      }
    ],
    returnType: 'RequirementDetails',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('req_deps', async (params) => {
    const validated = z.object({ hash: z.string() }).parse(params)
    const result = await invokeCommand('req_deps', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }, {
    description: 'Show dependency graph for a requirement',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      }
    ],
    returnType: 'DependencyGraph',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required')
    })
  })

  registry.register('req_transfer', async (params) => {
    const validated = z.object({
      hash: z.string(),
      gateId: z.string()
    }).parse(params)
    const result = await invokeCommand('req_transfer', validated)
    if (!result.success) {
      throw new Error(result.error)
    }
  }, {
    description: 'Transfer a requirement to another gate',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The hash identifier of the requirement',
        required: true
      },
      {
        name: 'gateId',
        type: 'string',
        description: 'The target gate ID',
        required: true
      }
    ],
    returnType: 'void',
    schema: z.object({
      hash: z.string().min(1, 'Hash is required'),
      gateId: z.string().min(1, 'Gate ID is required')
    })
  })
}
