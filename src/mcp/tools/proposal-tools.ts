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

function parseJsonSafe(input: unknown) {
  try { return typeof input === 'string' ? JSON.parse(input) : input } catch { return null }
}

export function proposalHandlers(registry: FunctionRegistry) {
  return {
    async proposal_list(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('proposal_list', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = ProposalListOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async proposal_show(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('proposal_show', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = ProposalDetailSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async proposal_validate(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('proposal_validate', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = ProposalValidateOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async proposal_approve(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('proposal_approve', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = ProposalApproveOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: JSON.stringify(data, null, 2) } ], structuredContent: data }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async proposal_reject(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('proposal_reject', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = ProposalRejectOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: JSON.stringify(data, null, 2) } ], structuredContent: data }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    },

    async proposal_start(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('proposal_start', args)
      if (result.success) {
        const data = result.data as any
        const parsed = parseJsonSafe(data.output ?? data)
        if (parsed) {
          const ok = ProposalStartOutputSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: JSON.stringify(data, null, 2) } ], structuredContent: data }
      }
      return { content: [ { type: 'text', text: JSON.stringify(result.error ?? {}, null, 2) } ], isError: true }
    }
  }
}
