/**
 * Archive Tool Definitions & Handlers
 *
 * Defines MCP tool schemas and creates handlers using the handler factory pattern.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import {
  ArchiveActionInputSchema,
  ArchiveActionOutputSchema,
  getArchiveActionOutputSchema,
} from '../schemas/archive-schemas.js'

/**
 * Archive tool metadata for registration and documentation
 */
export const archiveToolDefinitions = [
  {
    name: 'archive_action',
    description: 'Unified archive actions: gate, proposal, batch',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['gate', 'proposal', 'batch'],
          description: 'The archive action to perform',
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

import { createEntityActionHandler } from './entity-action-handler.js'

export function archiveHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const archiveActionHandler = createEntityActionHandler(
    {
      entity: 'archive',
      actions: ['gate', 'proposal', 'batch'] as const,
      inputSchema: ArchiveActionInputSchema,
      outputSchema: ArchiveActionOutputSchema,
      actionOutputSchema: getArchiveActionOutputSchema,
      actionHandlers: {
        gate: async (payload, r) => r.invoke('archive_action', { action: 'gate', payload }),
        proposal: async (payload, r) => r.invoke('archive_action', { action: 'proposal', payload }),
        batch: async (payload, r) => r.invoke('archive_action', { action: 'batch', payload }),
      },
    },
    registry
  )

  return {
    archive_action: archiveActionHandler,
  }
}
