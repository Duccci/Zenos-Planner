/**
 * Context Action Tool Schemas
 *
 * Zod schemas for the context_action tool that provides compact working context
 * for gates and proposals by querying the registry database.
 * Designed to replace loading full PRD / architecture documents during execution.
 */

import { z } from 'zod'

// ── Input ────────────────────────────────────────────────────────────────────

export const ContextActionInputSchema = z.object({
  action: z.enum(['gate', 'proposal']).optional().describe(
    'Action to perform. gate=get working context for a gate (needs: gateId). proposal=get working context for a proposal (needs: hash).'
  ),
  gateId: z.string().min(1).optional().describe('Gate ID (e.g. "gate-01") — required for gate action'),
  hash: z.string().min(1).optional().describe('Proposal hash — required for proposal action'),
  operationMode: z.enum(['planning', 'execution']).optional().describe(
    'Declare the current operation phase. planning=gate/proposal generation workflows (may include planning artifact paths). execution=proposal implementation (DB-only context, no PRD loading). Omit during execution to keep context minimal.'
  ),
}).superRefine((data, ctx) => {
  if (data.action === 'gate' && !data.gateId) {
    ctx.addIssue({
      code: 'custom',
      path: ['gateId'],
      message: 'gateId is required for gate action',
    })
  }
  if (data.action === 'proposal' && !data.hash) {
    ctx.addIssue({
      code: 'custom',
      path: ['hash'],
      message: 'hash is required for proposal action',
    })
  }
})

export type ContextActionInput = z.infer<typeof ContextActionInputSchema>

// ── Per-action Output Schemas ────────────────────────────────────────────────

export const GateContextOutputSchema = z.object({
  gate: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    description: z.string().nullable(),
    sequence: z.number(),
    dependsOn: z.array(z.string()),
  }),
  proposals: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    hash: z.string(),
  })),
  requirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    type: z.string(),
    priority: z.string(),
    hash: z.string(),
  })),
  _planningContext: z.object({
    prdPath: z.string(),
    structurePath: z.string(),
  }).optional().describe('Present only when operationMode=planning. Paths to heavyweight planning artifacts — load only during gate/proposal generation workflows.'),
})

export type GateContextOutput = z.infer<typeof GateContextOutputSchema>

export const ProposalContextOutputSchema = z.object({
  proposal: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    hash: z.string(),
    gateId: z.string().nullable(),
    createdAt: z.string(),
    startedAt: z.string().nullable(),
  }),
  gate: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
  }).nullable(),
  requirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    type: z.string(),
    priority: z.string(),
    hash: z.string(),
  })),
  dependencies: z.array(z.object({
    targetHash: z.string(),
    type: z.string(),
    description: z.string().nullable(),
  })),
  _planningContext: z.object({
    prdPath: z.string(),
    structurePath: z.string(),
  }).optional().describe('Present only when operationMode=planning. Paths to heavyweight planning artifacts — load only during gate/proposal generation workflows.'),
})

export type ProposalContextOutput = z.infer<typeof ProposalContextOutputSchema>

// ── Unified Output ───────────────────────────────────────────────────────────

export const ContextActionOutputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('gate'), result: GateContextOutputSchema }),
  z.object({ action: z.literal('proposal'), result: ProposalContextOutputSchema }),
])

export type ContextActionOutput = z.infer<typeof ContextActionOutputSchema>
