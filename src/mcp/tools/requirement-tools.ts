export const requirementToolDefinitions = [
  {
    name: 'req_action',
    description: `REQUIRED TOOL: Use req_action whenever you need to work with requirements—this is the ONLY way to query the requirements database.

Actions: list (retrieve all requirements, optionally filter by gate), show (get requirement details by hash), deps (view requirement dependency graph), transfer (move requirement to different gate), search (full-text search across description and acceptance criteria).

Call this tool whenever: you need to see requirements, check a specific requirement's details, understand requirement relationships, move requirements between gates, or find requirements matching a keyword.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'show', 'deps', 'transfer', 'search'],
          description:
            'Action to perform: "list" (retrieve requirements), "show" (details for hash), "deps" (dependency graph), "transfer" (move to gate), "search" (keyword search)',
        },
        payload: {
          type: 'object',
          description:
            'Action-specific parameters. For list: {gateId?, type?, skip?, take?}. For show/deps: {hash}. For transfer: {hash, targetGateId}. For search: {query, gateId?, type?, skip?, take?}',
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
      actions: ['list', 'show', 'deps', 'transfer', 'search'] as const,
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
      },
    },
    registry
  )

  return {
    req_action: reqActionHandler,
  }
}
