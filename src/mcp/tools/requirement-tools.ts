export const requirementToolDefinitions = [
  {
    name: 'req_action',
    description: `REQUIRED TOOL: Use req_action whenever you need to work with requirements or maintain the proposals database.

Actions: list (retrieve all requirements, optionally filter by gate), show (get requirement details by hash), deps (view requirement dependency graph), transfer (move requirement to different gate), search (full-text search across description and acceptance criteria).

DB maintenance actions (call when proposals appear stale or after manual file edits / git operations):
  db_status — report proposals DB health: orphan count, per-status breakdown, disk vs DB row counts.
  db_sync   — full reconciliation: upsert new .md files, remove orphaned DB rows in one operation.
  purge_orphans — delete DB rows with no matching .md file. Optional: { gateId } to scope to one gate; { dryRun: true } to preview without deleting.
  reset_gate — wipe all proposal rows for one gate then re-sync from disk. Required: { gateId }.

Call db_status first to diagnose, then db_sync or purge_orphans to fix.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'show', 'deps', 'transfer', 'search', 'db_status', 'db_sync', 'purge_orphans', 'reset_gate'],
          description:
            'Action to perform: "list" (requirements), "show" (details for hash), "deps" (dependency graph), "transfer" (move to gate), "search" (keyword search), "db_status" (proposals DB health), "db_sync" (reconcile DB with disk), "purge_orphans" (remove stale rows), "reset_gate" (wipe+resync one gate)',
        },
        payload: {
          type: 'object',
          description:
            'Action-specific parameters. list: {gateId?, type?, skip?, take?}. show/deps: {hash}. transfer: {hash, targetGateId}. search: {query, gateId?, type?, skip?, take?}. purge_orphans: {gateId?, solitary?, dryRun?} — gateId and solitary are mutually exclusive. reset_gate: {gateId}.',
        },
      },
      required: ['action'],
    },
  },
]

import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  ReqActionInputSchema,
  ReqActionOutputSchema,
  getReqActionOutputSchema,
} from '../schemas/req-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export function requirementHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const reqActionHandler = createEntityActionHandler(
    {
      entity: 'requirement',
      actions: ['list', 'show', 'deps', 'transfer', 'search', 'db_sync', 'db_status', 'purge_orphans', 'reset_gate'] as const,
      inputSchema: ReqActionInputSchema,
      outputSchema: ReqActionOutputSchema,
      actionOutputSchema: getReqActionOutputSchema,
      actionHandlers: {
        list: async (payload, r) =>
          r.invoke('req_action', { action: 'list', payload: payload ?? {} }),
        show: async (payload, r) => r.invoke('req_action', { action: 'show', payload }),
        deps: async (payload, r) => r.invoke('req_action', { action: 'deps', payload }),
        search: async (payload, r) => r.invoke('req_action', { action: 'search', payload }),
        transfer: async (payload, r) => {
          if (!payload) throw new Error('Transfer payload required')
          const { targetGateId, ...rest } = payload as {
            targetGateId: string
            hash: string
            reason?: string
          }
          return r.invoke('req_action', {
            action: 'transfer',
            payload: { ...rest, gateId: targetGateId },
          })
        },
        // DB maintenance actions — delegate directly to the registry handler
        db_status: async (payload, r) =>
          r.invoke('req_action', { action: 'db_status', payload: payload ?? {} }),
        db_sync: async (payload, r) =>
          r.invoke('req_action', { action: 'db_sync', payload: payload ?? {} }),
        purge_orphans: async (payload, r) =>
          r.invoke('req_action', { action: 'purge_orphans', payload: payload ?? {} }),
        reset_gate: async (payload, r) => {
          if (!payload) throw new Error('reset_gate requires a gateId')
          return r.invoke('req_action', { action: 'reset_gate', payload })
        },
      },
    },
    registry
  )

  return {
    req_action: reqActionHandler,
  }
}
