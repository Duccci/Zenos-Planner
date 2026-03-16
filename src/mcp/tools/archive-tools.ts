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
    description: `Archive completed work: gate, batch. Use gate hash (from gates_action:list) for gateId. Use to finalize and archive completed gates or proposals.`,
    inputSchema: ArchiveActionInputSchema,
  },
]

import { createEntityActionHandler } from './entity-action-handler.js'
import { withGuidance } from './handler-factory.js'
import {
  ARCHIVAL_GUARDRAILS,
  ARCHIVAL_WORKFLOW,
  toNarrativeRules,
  toCompactWorkflow,
} from '../content/index.js'

export function archiveHandlers(
  registry: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const archiveActionHandler = createEntityActionHandler(
    {
      entity: 'archive',
      actions: ['gate', 'batch'] as const,
      inputSchema: ArchiveActionInputSchema,
      outputSchema: ArchiveActionOutputSchema,
      actionOutputSchema: getArchiveActionOutputSchema,
      actionHandlers: {
        gate: async (payload, r) =>
          withGuidance(
            await r.invoke('archive_action', { action: 'gate', payload }),
            toNarrativeRules(ARCHIVAL_GUARDRAILS),
            toCompactWorkflow(ARCHIVAL_WORKFLOW)
          ),
        batch: async (payload, r) =>
          withGuidance(
            await r.invoke('archive_action', { action: 'batch', payload }),
            toNarrativeRules(ARCHIVAL_GUARDRAILS),
            toCompactWorkflow(ARCHIVAL_WORKFLOW)
          ),
      },
    },
    registry
  )

  return {
    archive_action: archiveActionHandler,
  }
}
