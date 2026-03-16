import { z } from 'zod'
import {
  ReqListOutputSchema,
  ReqShowOutputSchema,
  ReqDepsWrapperSchema,
  ReqTransferOutputSchema,
  ReqSearchOutputSchema,
  ReqInheritOutputSchema,
  ReqTraceOutputSchema,
  ReqUpdateOutputSchema,
} from './requirement-schemas.js'

// ============================================================================
// DB MAINTENANCE OUTPUT SCHEMAS
// ============================================================================

export const DbSyncOutputSchema = z.object({
  before: z.number().describe('Proposal row count before sync'),
  after: z.number().describe('Proposal row count after sync'),
  added: z.number().describe('Rows inserted from disk files'),
  orphansRemoved: z.number().describe('Orphaned DB rows deleted'),
  removedHashes: z.array(z.string()).describe('Hashes of removed orphaned rows'),
  message: z.string(),
})
export type DbSyncOutput = z.infer<typeof DbSyncOutputSchema>

export const DbStatusOutputSchema = z.object({
  total: z.number().describe('Total proposals in DB'),
  onDisk: z.number().describe('Unique proposal hashes found on disk'),
  orphaned: z.number().describe('DB rows with no matching .md file'),
  orphanedHashes: z.array(z.string()).describe('Hashes of orphaned rows'),
  byStatus: z.record(z.string(), z.number()).describe('Count of proposals per status'),
  message: z.string(),
})
export type DbStatusOutput = z.infer<typeof DbStatusOutputSchema>

export const PurgeOrphansOutputSchema = z.object({
  removed: z.number().describe('Rows deleted (0 when dryRun=true)'),
  dryRun: z.boolean(),
  gateId: z.string().nullable().describe('Gate ID filter, or null when not filtering by gate'),
  solitary: z.boolean().describe('True when only solitary (gate_id = NULL) proposals were targeted'),
  orphans: z.array(
    z.object({
      hash: z.string(),
      title: z.string(),
      status: z.string(),
      gateId: z.string().nullable(),
    })
  ).describe('All detected orphaned rows'),
  message: z.string(),
})
export type PurgeOrphansOutput = z.infer<typeof PurgeOrphansOutputSchema>

export const ResetGateOutputSchema = z.object({
  gateId: z.string(),
  deletedCount: z.number().describe('Rows deleted from DB for this gate'),
  resyncedCount: z.number().describe('Rows re-inserted from disk after reset'),
  message: z.string(),
})
export type ResetGateOutput = z.infer<typeof ResetGateOutputSchema>

export const RegenerateOutputSchema = z.object({
  removed: z.boolean().describe('Whether the existing DB file was deleted before re-init'),
  dbPath: z.string().describe('Absolute path to the registry database file'),
  migrationsApplied: z.number().describe('Number of migrations applied during re-init'),
  message: z.string(),
})
export type RegenerateOutput = z.infer<typeof RegenerateOutputSchema>

/**
 * Flat, self-documenting input schema for the reg_action tool.
 *
 * action required for all calls:
 *   list     — list requirements; optional: gateId, type, skip, take
 *   show     — get requirement details; required: hash
 *   deps     — dependency graph for a requirement; required: hash
 *   transfer — move requirement to another gate; required: hash, targetGateId; optional: reason
 *   search   — full-text search; required: query; optional: gateId, type, skip, take
 */
export const ReqActionInputSchema = z.object({
  action: z
    .enum(['list', 'show', 'deps', 'transfer', 'search', 'inherit', 'trace', 'update', 'db_sync', 'db_status', 'purge_orphans', 'reset_gate', 'regenerate'])
    .optional()
    .describe(
      'Action to perform. ' +
        'list=retrieve requirements (optional: gateId, type filter). ' +
        'show=get requirement details (needs: hash). ' +
        'deps=dependency graph (needs: hash). ' +
        'transfer=move to another gate (needs: hash, targetGateId). ' +
        'search=full-text search (needs: query). ' +
        'inherit=link existing requirement to a gate for cross-gate reuse (needs: hash, gateId). ' +
        'trace=full traceability chain — ancestors, children, all referencing gates (needs: hash). ' +
        'update=edit mutable fields on a requirement (needs: hash; optional: title, type, priority, acceptance). ' +
        'db_sync=reconcile proposals DB with disk (upsert new files, remove orphans). ' +
        'db_status=report proposal DB health (orphan count, status breakdown). ' +
        'purge_orphans=delete DB rows with no matching .md file (optional: gateId, solitary, dryRun). ' +
        'reset_gate=wipe and re-sync proposals for one gate from disk (needs: gateId). ' +
        'regenerate=delete the registry DB (and WAL/SHM) then re-initialise from disk, identical to MCP server startup.'
    ),

  // --- shared identifier ---
  hash: z.string().optional().describe('Requirement hash (show/deps/transfer)'),

  // --- list/search filters ---
  gateId: z.string().optional().describe('Gate hash (preferred) or gate ID e.g. "gate-01" — use hash from gates_action:list (list/search)'),
  type: z
    .enum(['functional', 'non_functional', 'constraint'])
    .optional()
    .describe('Filter by requirement type (list/search) or new type for update'),

  // --- search fields ---
  query: z.string().optional().describe('Search query string (search)'),

  // --- transfer fields ---
  targetGateId: z.string().optional().describe('Destination gate hash (preferred) or gate ID (transfer)'),
  reason: z.string().optional().describe('Reason for transfer (transfer)'),

  // --- update fields ---
  title: z.string().optional().describe('New title / description for the requirement (update)'),
  priority: z
    .enum(['must', 'should', 'could', 'wont'])
    .optional()
    .describe('New priority (update)'),
  acceptance: z.string().optional().describe('New acceptance criteria text (update)'),

  // --- db maintenance fields ---
  dryRun: z.boolean().optional().describe('purge_orphans: report without deleting (default false)'),
  solitary: z.boolean().optional().describe('purge_orphans: when true, only target proposals with no gate (solitary). Mutually exclusive with gateId.'),
}).superRefine((val, ctx) => {
  const hashRequired = ['show', 'deps', 'transfer', 'inherit', 'trace'] as const
  if (val.action && (hashRequired as readonly string[]).includes(val.action) && !val.hash) {
    ctx.addIssue({
      code: 'custom',
      path: ['hash'],
      message: `hash is required for action "${val.action}"`,
    })
  }
  if (val.action === 'transfer' && !val.targetGateId) {
    ctx.addIssue({
      code: 'custom',
      path: ['targetGateId'],
      message: 'targetGateId is required for action "transfer"',
    })
  }
  if (val.action === 'search' && !val.query) {
    ctx.addIssue({
      code: 'custom',
      path: ['query'],
      message: 'query is required for action "search"',
    })
  }
  if (val.action === 'update' && !val.hash) {
    ctx.addIssue({
      code: 'custom',
      path: ['hash'],
      message: 'hash is required for action "update"',
    })
  }
  if (val.action === 'reset_gate' && !val.gateId) {
    ctx.addIssue({
      code: 'custom',
      path: ['gateId'],
      message: 'gateId is required for action "reset_gate"',
    })
  }
})

export type ReqActionInput = z.infer<typeof ReqActionInputSchema>

// Output schema with discriminated union
export const ReqActionOutputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    result: ReqListOutputSchema,
  }),
  z.object({
    action: z.literal('show'),
    result: ReqShowOutputSchema,
  }),
  z.object({
    action: z.literal('deps'),
    result: ReqDepsWrapperSchema,
  }),
  z.object({
    action: z.literal('transfer'),
    result: ReqTransferOutputSchema,
  }),
  z.object({
    action: z.literal('search'),
    result: ReqSearchOutputSchema,
  }),
  z.object({
    action: z.literal('inherit'),
    result: ReqInheritOutputSchema,
  }),
  z.object({
    action: z.literal('trace'),
    result: ReqTraceOutputSchema,
  }),
  z.object({
    action: z.literal('update'),
    result: ReqUpdateOutputSchema,
  }),
  z.object({
    action: z.literal('db_sync'),
    result: DbSyncOutputSchema,
  }),
  z.object({
    action: z.literal('db_status'),
    result: DbStatusOutputSchema,
  }),
  z.object({
    action: z.literal('purge_orphans'),
    result: PurgeOrphansOutputSchema,
  }),
  z.object({
    action: z.literal('reset_gate'),
    result: ResetGateOutputSchema,
  }),
  z.object({
    action: z.literal('regenerate'),
    result: RegenerateOutputSchema,
  }),
])

export type ReqActionOutput = z.infer<typeof ReqActionOutputSchema>

// Helper function to get output schema for a specific action
export function getReqActionOutputSchema(action: string): z.ZodType {
  switch (action) {
    case 'list':
      return ReqListOutputSchema
    case 'show':
      return ReqShowOutputSchema
    case 'deps':
      return ReqDepsWrapperSchema
    case 'transfer':
      return ReqTransferOutputSchema
    case 'search':
      return ReqSearchOutputSchema
    case 'inherit':
      return ReqInheritOutputSchema
    case 'trace':
      return ReqTraceOutputSchema
    case 'update':
      return ReqUpdateOutputSchema
    case 'db_sync':
      return DbSyncOutputSchema
    case 'db_status':
      return DbStatusOutputSchema
    case 'purge_orphans':
      return PurgeOrphansOutputSchema
    case 'reset_gate':
      return ResetGateOutputSchema
    case 'regenerate':
      return RegenerateOutputSchema
    default:
      // z.unknown() has def.type='unknown'→ normalizeObjectSchema returns undefined → _zod TypeError.
      // Use passthrough object: accepts any shape and normalizes correctly.
      return z.looseObject({})
  }
}
