/**
 * Workflow Tool Definitions & Handlers
 *
 * Defines MCP tool schemas and creates handlers using the handler factory pattern.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { createSchemaValidatingHandler, parseJsonSafe } from './handler-factory.js'
import {
  ProposalGenerateInputSchema,
  ProposalUpdateProgressInputSchema,
  GateGenerateInputSchema,
  ProposalGenerateOutputSchema,
  ProposalUpdateProgressOutputSchema,
  GateGenerateOutputSchema,
} from '../schemas/workflow-schemas.js'

/**
 * Workflow tool metadata for registration and documentation
 */
export const workflowToolDefinitions = [
  {
    name: 'generateProposals',
    title: 'Generate Proposals',
    description: 'Generate proposal documents from a gate PRD',
    inputSchema: ProposalGenerateInputSchema,
  },
  {
    name: 'updateProposalProgress',
    title: 'Update Proposal Progress',
    description: 'Update progress for a proposal',
    inputSchema: ProposalUpdateProgressInputSchema,
  },
  {
    name: 'generateGates',
    title: 'Generate Gates',
    description: 'Generate or regenerate gates',
    inputSchema: GateGenerateInputSchema,
  },
]

import { generateProposals } from '../../core/proposal-generation.js'
import { updateProposalProgress } from '../../core/proposal-application.js'
import { generateGates } from '../../core/gate-generation.js'

/**
 * Extract mockResult from tool arguments if present (for testing)
 * Returns the mockResult value if present, or explicitly null if not found
 */
function extractMockResult(args: unknown): unknown {
  if (args && typeof args === 'object' && 'mockResult' in args && args.mockResult !== undefined) {
    return args.mockResult
  }
  return null
}

export function workflowHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  const generateHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'generateProposals', ProposalGenerateOutputSchema)
    : undefined
  const updateHandler = _registry
    ? createSchemaValidatingHandler(
        _registry,
        'updateProposalProgress',
        ProposalUpdateProgressOutputSchema
      )
    : undefined
  const generateGatesHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'generateGates', GateGenerateOutputSchema)
    : undefined

  return {
    async generateProposals(args: Record<string, unknown>) {
      try {
        const raw = extractMockResult(args)
        if (raw !== null) {
          const parsed = parseJsonSafe(raw)
          const ok = ProposalGenerateOutputSchema.safeParse(parsed)
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

        // Prefer handler-based invocation when registry is available (handler supports mockResult)
        if (generateHandler) return await generateHandler(args)

        const validated = ProposalGenerateInputSchema.parse(args)
        const result = await generateProposals(validated)
        const parsedOk = ProposalGenerateOutputSchema.safeParse(result)
        if (!parsedOk.success) throw new Error('Invalid output from generateProposals')
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

    async updateProposalProgress(args: Record<string, unknown>) {
      try {
        if (updateHandler) return await updateHandler(args)

        const validated = ProposalUpdateProgressInputSchema.parse(args)
        const result = await updateProposalProgress(validated)
        const ok = ProposalUpdateProgressOutputSchema.safeParse(result)
        if (!ok.success) throw new Error('Invalid output from updateProposalProgress')
        return {
          content: [{ type: 'text', text: JSON.stringify(ok.data, null, 2) }],
          structuredContent: ok.data,
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

    async generateGates(args: Record<string, unknown>) {
      try {
        const raw = extractMockResult(args)
        if (raw !== null) {
          const parsed = parseJsonSafe(raw)
          const ok = GateGenerateOutputSchema.safeParse(parsed)
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

        if (generateGatesHandler) return await generateGatesHandler(args)

        const validated = GateGenerateInputSchema.parse(args)
        const result = await generateGates(validated)
        const parsedOk = GateGenerateOutputSchema.safeParse(result)
        if (!parsedOk.success) throw new Error('Invalid output from generateGates')
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
