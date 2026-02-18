import { z } from 'zod'
import {
  ReqListOutputSchema,
  RequirementDetailSchema,
  DependencyGraphSchema,
  ReqTransferOutputSchema,
  ReqSearchOutputSchema,
} from './requirement-schemas.js'

/**
 * Flat, self-documenting input schema for the req_action tool.
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
    .enum(['list', 'show', 'deps', 'transfer', 'search'])
    .optional()
    .describe(
      'Action to perform. ' +
        'list=retrieve requirements (optional: gateId, type filter). ' +
        'show=get requirement details (needs: hash). ' +
        'deps=dependency graph (needs: hash). ' +
        'transfer=move to another gate (needs: hash, targetGateId). ' +
        'search=full-text search (needs: query).'
    ),

  // --- shared identifier ---
  hash: z.string().optional().describe('Requirement hash (show/deps/transfer)'),

  // --- list/search filters ---
  gateId: z.string().optional().describe('Filter by gate ID e.g. "gate-01" (list/search)'),
  type: z
    .enum(['functional', 'non_functional', 'constraint'])
    .optional()
    .describe('Filter by requirement type (list/search)'),
  skip: z.number().int().min(0).optional().describe('Pagination offset (list/search, default 0)'),
  take: z.number().int().min(1).max(100).optional().describe('Page size (list/search, default 50)'),

  // --- search fields ---
  query: z.string().optional().describe('Search query string (search)'),

  // --- transfer fields ---
  targetGateId: z.string().optional().describe('Destination gate ID (transfer)'),
  reason: z.string().optional().describe('Reason for transfer (transfer)'),
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
    result: RequirementDetailSchema,
  }),
  z.object({
    action: z.literal('deps'),
    result: DependencyGraphSchema,
  }),
  z.object({
    action: z.literal('transfer'),
    result: ReqTransferOutputSchema,
  }),
  z.object({
    action: z.literal('search'),
    result: ReqSearchOutputSchema,
  }),
])

export type ReqActionOutput = z.infer<typeof ReqActionOutputSchema>

// Helper function to get output schema for a specific action
export function getReqActionOutputSchema(action: string): z.ZodType {
  switch (action) {
    case 'list':
      return ReqListOutputSchema
    case 'show':
      return RequirementDetailSchema
    case 'deps':
      return DependencyGraphSchema
    case 'transfer':
      return ReqTransferOutputSchema
    case 'search':
      return ReqSearchOutputSchema
    default:
      return z.unknown()
  }
}
