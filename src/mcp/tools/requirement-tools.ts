export const requirementToolDefinitions = [
  {
    name: 'req_action',
    description: 'Unified requirement actions: list, show, deps, transfer',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'show', 'deps', 'transfer'],
          description: 'The requirement action to perform',
        },
        payload: {
          type: 'object',
          description: 'Action-specific payload',
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
      actions: ['list', 'show', 'deps', 'transfer'] as const,
      inputSchema: ReqActionInputSchema,
      outputSchema: ReqActionOutputSchema,
      actionOutputSchema: getReqActionOutputSchema,
      actionHandlers: {
        list: async (payload, r) =>
          r.invoke('req_action', { action: 'list', payload: payload ?? {} }),
        show: async (payload, r) => r.invoke('req_action', { action: 'show', payload }),
        deps: async (payload, r) => r.invoke('req_action', { action: 'deps', payload }),
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
      },
    },
    registry
  )

  return {
    req_action: reqActionHandler,
  }
}
