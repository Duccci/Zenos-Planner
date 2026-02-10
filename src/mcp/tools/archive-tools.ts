/**
 * Archive Tool Definitions & Handlers
 *
 * Defines MCP tool schemas and creates handlers using the handler factory pattern.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { createSchemaValidatingHandler } from './handler-factory.js'
import {
  ArchiveGateInputSchema,
  ArchiveProposalInputSchema,
  ArchiveBatchInputSchema,
  ArchiveGateOutputSchema,
  ArchiveProposalOutputSchema,
  ArchiveBatchOutputSchema,
} from '../schemas/archive-schemas.js'

/**
 * Archive tool metadata for registration and documentation
 */
export const archiveToolDefinitions = [
  {
    name: 'archive_gate',
    title: 'Archive Gate',
    description: 'Archive a completed gate with consolidation and git tagging',
    inputSchema: ArchiveGateInputSchema,
  },
  {
    name: 'archive_proposal',
    title: 'Archive Proposal',
    description: 'Archive a completed proposal and update dependent artifacts',
    inputSchema: ArchiveProposalInputSchema,
  },
  {
    name: 'archive_batch',
    title: 'Archive Batch',
    description: 'Archive multiple completed gates and proposals in batch',
    inputSchema: ArchiveBatchInputSchema,
  },
]

import { archiveGate, archiveProposal, archiveBatch } from '../../core/archive-logic.js'

export function archiveHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const gateHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'archive_gate', ArchiveGateOutputSchema)
    : undefined
  const proposalHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'archive_proposal', ArchiveProposalOutputSchema)
    : undefined
  const batchHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'archive_batch', ArchiveBatchOutputSchema)
    : undefined

  return {
    async archive_gate(args: Record<string, unknown>) {
      // Allow tests to provide mockResult
      const raw = (args as unknown as { mockResult?: unknown }).mockResult ?? null
      try {
        if (raw !== null) {
          const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
          const ok = ArchiveGateOutputSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
          return {
            content: [{ type: 'text', text: JSON.stringify(raw, null, 2) }],
            structuredContent: { output: raw },
          }
        }

        if (gateHandler) return await gateHandler(args)

        const validated = ArchiveGateInputSchema.parse(args)
        const result = await archiveGate(validated.gateId, validated.completionNotes)
        const parsedOk = ArchiveGateOutputSchema.safeParse(result)
        if (!parsedOk.success) throw new Error('Invalid output from archiveGate')
        return {
          content: [{ type: 'text', text: JSON.stringify(parsedOk.data, null, 2) }],
          structuredContent: parsedOk.data,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { error: String(error instanceof Error ? error.message : error) },
                null,
                2
              ),
            },
          ],
          isError: true,
        }
      }
    },

    async archive_proposal(args: Record<string, unknown>) {
      const raw = (args as unknown as { mockResult?: unknown }).mockResult ?? null
      try {
        if (raw !== null) {
          const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
          const ok = ArchiveProposalOutputSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
          return {
            content: [{ type: 'text', text: JSON.stringify(raw, null, 2) }],
            structuredContent: { output: raw },
          }
        }

        if (proposalHandler) return await proposalHandler(args)

        const validated = ArchiveProposalInputSchema.parse(args)
        const result = await archiveProposal(validated.hash, validated.completionNotes)
        const parsedOk = ArchiveProposalOutputSchema.safeParse(result)
        if (!parsedOk.success) throw new Error('Invalid output from archiveProposal')
        return {
          content: [{ type: 'text', text: JSON.stringify(parsedOk.data, null, 2) }],
          structuredContent: parsedOk.data,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { error: String(error instanceof Error ? error.message : error) },
                null,
                2
              ),
            },
          ],
          isError: true,
        }
      }
    },

    async archive_batch(args: Record<string, unknown>) {
      const raw = (args as unknown as { mockResult?: unknown }).mockResult ?? null
      try {
        if (raw !== null) {
          const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
          const ok = ArchiveBatchOutputSchema.safeParse(parsed)
          if (ok.success)
            return {
              content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
              structuredContent: ok.data,
            }
          return {
            content: [{ type: 'text', text: JSON.stringify(raw, null, 2) }],
            structuredContent: { output: raw },
          }
        }

        if (batchHandler) return await batchHandler(args)

        const validated = ArchiveBatchInputSchema.parse(args)
        const artifacts = validated.artifacts.map((a) => {
          if (a.type === 'gate') {
            return { type: 'gate' as const, gateId: a.gateId }
          } else {
            return { type: 'proposal' as const, hash: a.hash }
          }
        })
        const result = await archiveBatch(artifacts, validated.completionNotes)
        const parsedOk = ArchiveBatchOutputSchema.safeParse(result)
        if (!parsedOk.success) throw new Error('Invalid output from archiveBatch')
        return {
          content: [{ type: 'text', text: JSON.stringify(parsedOk.data, null, 2) }],
          structuredContent: parsedOk.data,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { error: String(error instanceof Error ? error.message : error) },
                null,
                2
              ),
            },
          ],
          isError: true,
        }
      }
    },
  }
}
