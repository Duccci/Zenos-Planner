export const requirementToolDefinitions = [
  {
    name: 'reg_action',
    description: `REQUIRED TOOL: Use reg_action whenever you need to work with requirements—this is the ONLY way to query the requirements database.

Actions: list (retrieve all requirements, optionally filter by gate), show (get requirement details by hash), deps (view requirement dependency graph), transfer (move requirement to different gate), search (full-text keyword search), inherit (link existing requirement to a gate for cross-gate reuse), trace (full traceability chain for a requirement), db_sync (reconcile proposals DB with disk), db_status (report proposal DB health), purge_orphans (delete DB rows with no matching .md file), reset_gate (wipe and re-sync proposals for one gate from disk).

Call this tool whenever: you need to see requirements, check a specific requirement's details, understand requirement relationships, or move requirements between gates.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list',
            'show',
            'deps',
            'transfer',
            'search',
            'inherit',
            'trace',
            'db_sync',
            'db_status',
            'purge_orphans',
            'reset_gate',
          ],
          description:
            'Action to perform. list=retrieve requirements (optional: gateId, type filter). show=get requirement details (needs: hash). deps=dependency graph (needs: hash). transfer=move to another gate (needs: hash, targetGateId). search=full-text search (needs: query). inherit=link existing requirement to a gate for cross-gate reuse (needs: hash, gateId). trace=full traceability chain (needs: hash). db_sync=reconcile proposals DB with disk. db_status=report proposal DB health. purge_orphans=delete DB rows with no matching .md file (optional: gateId, solitary, dryRun). reset_gate=wipe and re-sync proposals for one gate from disk (needs: gateId).',
        },
        hash: {
          type: 'string',
          description: 'Requirement hash (show/deps/transfer/inherit/trace)',
        },
        gateId: {
          type: 'string',
          description: 'Filter by gate ID e.g. "gate-01" (list/search/inherit/reset_gate)',
        },
        type: {
          type: 'string',
          enum: ['functional', 'non_functional', 'constraint'],
          description: 'Filter by requirement type (list/search)',
        },
        query: {
          type: 'string',
          description: 'Search query string (search)',
        },
        targetGateId: {
          type: 'string',
          description: 'Destination gate ID (transfer)',
        },
        reason: {
          type: 'string',
          description: 'Reason for transfer (transfer)',
        },
        dryRun: {
          type: 'boolean',
          description: 'purge_orphans: report without deleting (default false)',
        },
        solitary: {
          type: 'boolean',
          description:
            'purge_orphans: when true, only target proposals with no gate. Mutually exclusive with gateId.',
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
} from '../schemas/reg-action-schemas.js'
import { createEntityActionHandler } from './entity-action-handler.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export function requirementHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const reqActionHandler = createEntityActionHandler(
    {
      entity: 'requirement',
      actions: [
        'list',
        'show',
        'deps',
        'transfer',
        'search',
        'inherit',
        'trace',
        'db_sync',
        'db_status',
        'purge_orphans',
        'reset_gate',
      ] as const,
      inputSchema: ReqActionInputSchema,
      outputSchema: ReqActionOutputSchema,
      actionOutputSchema: getReqActionOutputSchema,
      actionHandlers: {
        list: async (payload, r) =>
          r.invoke('reg_action', { action: 'list', payload: payload ?? {} }),
        show: async (payload, r) => r.invoke('reg_action', { action: 'show', payload }),
        deps: async (payload, r) => r.invoke('reg_action', { action: 'deps', payload }),
        transfer: async (payload, r) => {
          if (!payload) throw new Error('Transfer payload required')
          const { targetGateId, ...rest } = payload as {
            targetGateId: string
            hash: string
            reason?: string
          }
          return r.invoke('reg_action', {
            action: 'transfer',
            payload: { ...rest, gateId: targetGateId },
          })
        },
        search: async (payload, r) => r.invoke('reg_action', { action: 'search', payload }),
        inherit: async (payload, r) => r.invoke('reg_action', { action: 'inherit', payload }),
        trace: async (payload, r) => r.invoke('reg_action', { action: 'trace', payload }),
        db_sync: async (payload, r) => r.invoke('reg_action', { action: 'db_sync', payload }),
        db_status: async (payload, r) =>
          r.invoke('reg_action', { action: 'db_status', payload }),
        purge_orphans: async (payload, r) =>
          r.invoke('reg_action', { action: 'purge_orphans', payload }),
        reset_gate: async (payload, r) =>
          r.invoke('reg_action', { action: 'reset_gate', payload }),
      },
    },
    registry
  )

  return {
    reg_action: reqActionHandler,
  }
}
