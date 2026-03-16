export const requirementToolDefinitions = [
  {
    name: 'reg_action',
    description: `Registry DB: list, show, deps, transfer, search, inherit, trace, update, db_sync, db_status, purge_orphans, reset_gate. Use gate hash (from gates_action:list) for gateId/targetGateId. Use for querying requirements, managing dependencies, and DB maintenance.`,
    inputSchema: ReqActionInputSchema,
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
        'update',
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
        update: async (payload, r) => r.invoke('reg_action', { action: 'update', payload }),
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
