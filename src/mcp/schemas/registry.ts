import { z } from 'zod'
import { GatesActionInputSchema, GatesActionOutputSchema } from './gates-action-schemas.js'
import { ProposalActionInputSchema, ProposalActionOutputSchema } from './proposal-action-schemas.js'
import { ReqActionInputSchema, ReqActionOutputSchema } from './req-action-schemas.js'
import { ArchiveActionInputSchema, ArchiveActionOutputSchema } from './archive-schemas.js'
import { ConfigGetOutputSchema } from './config-schemas.js'

/**
 * Central tool registry: declarative mapping of MCP tools to their actions and schemas.
 * Keep entries limited to unified action tools (gates_action, proposal_action, req_action, archive_action)
 */
export const ToolRegistry = {
  gates: {
    toolName: 'gates_action',
    actions: ['list', 'show', 'create', 'start', 'complete', 'regenerate'] as const,
    inputSchema: GatesActionInputSchema,
    outputSchema: GatesActionOutputSchema,
    description: 'Unified gate lifecycle: list, show, create, start, complete, regenerate',
  },

  proposals: {
    toolName: 'proposal_action',
    actions: ['list', 'show', 'create', 'validate', 'approve', 'reject', 'start'] as const,
    inputSchema: ProposalActionInputSchema,
    outputSchema: ProposalActionOutputSchema,
    description: 'Unified proposal lifecycle and management',
  },

  requirements: {
    toolName: 'req_action',
    actions: ['list', 'show', 'deps', 'transfer'] as const,
    inputSchema: ReqActionInputSchema,
    outputSchema: ReqActionOutputSchema,
    description: 'Unified requirement actions: list, show, deps, transfer',
  },

  archives: {
    toolName: 'archive_action',
    actions: ['gate', 'proposal', 'batch'] as const,
    inputSchema: ArchiveActionInputSchema,
    outputSchema: ArchiveActionOutputSchema,
    description: 'Unified archive actions: gate, proposal, batch',
  },

  config: {
    toolName: 'config_get',
    actions: ['get'] as const,
    inputSchema: z.object({}).optional(),
    outputSchema: ConfigGetOutputSchema,
    description: 'Get configuration and quality thresholds',
  },
} as const

export type ToolRegistryType = typeof ToolRegistry
