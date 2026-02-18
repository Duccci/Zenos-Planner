import { z } from 'zod'
import { GatesActionInputSchema, GatesActionOutputSchema } from './gates-action-schemas.js'
import { ProposalActionInputSchema, ProposalActionOutputSchema } from './proposal-action-schemas.js'
import { ReqActionInputSchema, ReqActionOutputSchema } from './req-action-schemas.js'
import { ArchiveActionInputSchema, ArchiveActionOutputSchema } from './archive-schemas.js'
import {
  RepositoryActionInputSchema,
  RepositoryActionOutputSchema,
} from './repository-action-schemas.js'
import { ConfigGetOutputSchema } from './config-schemas.js'

/**
 * Central tool registry: declarative mapping of MCP tools to their actions and schemas.
 * Keep entries limited to unified action tools (gates_action, proposal_action, req_action, archive_action)
 */
export const ToolRegistry = {
  gates: {
    toolName: 'gates_action',
    actions: ['list', 'show', 'create', 'generate', 'start', 'complete', 'regenerate'] as const,
    inputSchema: GatesActionInputSchema,
    outputSchema: GatesActionOutputSchema,
    description:
      'REQUIRED: Use gates_action to manage project gates. Actions: list (all gates), show (by gateId), create (new), generate (from requirements), start (pending→in_progress), complete (→completed), regenerate (after rescope).',
  },

  proposals: {
    toolName: 'proposal_action',
    actions: [
      'list',
      'show',
      'create',
      'generate',
      'validate',
      'approve',
      'reject',
      'start',
      'progress',
    ] as const,
    inputSchema: ProposalActionInputSchema,
    outputSchema: ProposalActionOutputSchema,
    description:
      'REQUIRED: Use proposal_action to manage implementation proposals. Actions: list (by gate), show (by hash), create (new for gate), generate (from gate PRD), validate (run checks), approve (merge), reject (with reason), start (create worktree), progress (update task during implementation).',
  },

  requirements: {
    toolName: 'req_action',
    actions: ['list', 'show', 'deps', 'transfer'] as const,
    inputSchema: ReqActionInputSchema,
    outputSchema: ReqActionOutputSchema,
    description:
      'REQUIRED: Use req_action to query the requirements database. Actions: list (all/by gate), show (details by hash), deps (dependency graph), transfer (move to different gate), search (full-text keyword search). Call this whenever you need requirement info.',
  },

  repositories: {
    toolName: 'repos_action',
    actions: ['list', 'detect', 'deps', 'adjust'] as const,
    inputSchema: RepositoryActionInputSchema,
    outputSchema: RepositoryActionOutputSchema,
    description:
      'REQUIRED: Use repos_action for repository management and analysis. Actions: list (view detected repositories), detect (re-run boundary detection), deps (view dependency graph), adjust (manually adjust boundaries).',
  },

  archives: {
    toolName: 'archive_action',
    actions: ['gate', 'batch'] as const,
    inputSchema: ArchiveActionInputSchema,
    outputSchema: ArchiveActionOutputSchema,
    description:
      'REQUIRED: Use archive_action to finalize completed gate work. Actions: gate (archive completed gate), batch (multiple gates).',
  },

  config: {
    toolName: 'config_get',
    actions: ['get'] as const,
    inputSchema: z.object({}).optional(),
    outputSchema: ConfigGetOutputSchema,
    description:
      'REQUIRED: Use config_get to retrieve quality thresholds and project configuration.',
  },
} as const

export type ToolRegistryType = typeof ToolRegistry
