import { ProposalListInputSchema, ProposalShowInputSchema, ProposalValidateInputSchema, ProposalApproveInputSchema, ProposalRejectInputSchema, ProposalStartInputSchema } from '../schemas/proposal-schemas.js'

export const proposalToolDefinitions = [
  {
    name: 'proposal_list',
    title: 'Proposal List',
    description: 'List proposals optionally filtered by gate or status',
    inputSchema: ProposalListInputSchema
  },
  {
    name: 'proposal_show',
    title: 'Proposal Show',
    description: 'Show detailed proposal information',
    inputSchema: ProposalShowInputSchema
  },
  {
    name: 'proposal_validate',
    title: 'Proposal Validate',
    description: 'Validate proposal structure and dependencies',
    inputSchema: ProposalValidateInputSchema
  },
  {
    name: 'proposal_approve',
    title: 'Proposal Approve',
    description: 'Approve a proposal',
    inputSchema: ProposalApproveInputSchema
  },
  {
    name: 'proposal_reject',
    title: 'Proposal Reject',
    description: 'Reject a proposal with reason',
    inputSchema: ProposalRejectInputSchema
  },
  {
    name: 'proposal_start',
    title: 'Proposal Start',
    description: 'Start working on an approved proposal',
    inputSchema: ProposalStartInputSchema
  }
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ProposalListOutputSchema, ProposalDetailSchema, ProposalValidateOutputSchema, ProposalApproveOutputSchema, ProposalRejectOutputSchema, ProposalStartOutputSchema } from '../schemas/proposal-schemas.js'
import { createSchemaValidatingHandler } from './handler-factory.js'

export function proposalHandlers(registry: FunctionRegistry) {
  return {
    proposal_list: createSchemaValidatingHandler(registry, 'proposal_list', ProposalListOutputSchema),
    proposal_show: createSchemaValidatingHandler(registry, 'proposal_show', ProposalDetailSchema),
    proposal_validate: createSchemaValidatingHandler(registry, 'proposal_validate', ProposalValidateOutputSchema),
    proposal_approve: createSchemaValidatingHandler(registry, 'proposal_approve', ProposalApproveOutputSchema),
    proposal_reject: createSchemaValidatingHandler(registry, 'proposal_reject', ProposalRejectOutputSchema),
    proposal_start: createSchemaValidatingHandler(registry, 'proposal_start', ProposalStartOutputSchema)
  }
}
