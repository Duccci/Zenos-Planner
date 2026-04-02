/**
 * Workflow Operations Registry
 *
 * Registers all workflow-related operations with the function registry.
 * Handles: generateProposals, updateProposalProgress, generateGates
 */

import { FunctionRegistry } from './function-registry.js'
import { generateProposals, updateProposalProgress, generateGates } from '../core/workflow-logic.js'
import { logger } from '../utils/logger.js'
import { 
  ProposalGenerateInputSchema, 
  ProposalUpdateProgressInputSchema, 
  GateGenerateInputSchema 
} from '../mcp/schemas/workflow-schemas.js'

export function registerWorkflowOps(registry: FunctionRegistry): void {
  registry.register('generateProposals', async (params) => {
    const validated = ProposalGenerateInputSchema.parse(params)
    const result = await generateProposals(validated)

    // Reconcile gate PRD so the Proposals section reflects newly created proposals
    if (validated.gateId) {
      try {
        const { reconcileGatePRD } = await import('../core/gate-prd-reconciler.js')
        await reconcileGatePRD(validated.gateId, process.cwd())
      } catch (err) {
        logger.warn(`Failed to reconcile gate PRD after proposal generation for ${validated.gateId}: ${String(err)}`)
      }
    }

    return result
  }, {
    description: 'Generate proposals for a gate based on requirements and context',
    parameters: [
      {
        name: 'gateId',
        type: 'string',
        description: 'The gate ID to generate proposals for',
        required: true
      },
      {
        name: 'context',
        type: 'string',
        description: 'Additional context for proposal generation',
        required: false
      }
    ],
    returnType: 'ProposalGenerationResult',
    schema: ProposalGenerateInputSchema
  })

  registry.register('updateProposalProgress', async (params) => {
    const validated = ProposalUpdateProgressInputSchema.parse(params)
    return await updateProposalProgress(validated)
  }, {
    description: 'Update progress on a proposal with status and notes',
    parameters: [
      {
        name: 'hash',
        type: 'string',
        description: 'The proposal hash to update',
        required: true
      },
      {
        name: 'status',
        type: 'string',
        description: 'New status for the proposal',
        required: true
      },
      {
        name: 'notes',
        type: 'string',
        description: 'Progress notes or completion details',
        required: false
      }
    ],
    returnType: 'ProposalUpdateResult',
    schema: ProposalUpdateProgressInputSchema
  })

  registry.register('generateGates', async (params) => {
    const validated = GateGenerateInputSchema.parse(params)
    return await generateGates(validated)
  }, {
    description: 'Generate new gates based on project requirements and current state',
    parameters: [
      {
        name: 'context',
        type: 'string',
        description: 'Context for gate generation',
        required: false
      },
      {
        name: 'scope',
        type: 'string',
        description: 'Scope of work for the new gates',
        required: false
      }
    ],
    returnType: 'GateGenerationResult',
    schema: GateGenerateInputSchema
  })
}
