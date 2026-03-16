/**
 * Context Action Tool Schemas
 *
 * Zod schemas for the context_action tool that provides compact working context
 * for gates, proposals, requirements, and repositories by querying the registry
 * database. Replaces show_entity — resolves any entity by hash OR by name/id.
 * Designed to replace loading full PRD / architecture documents during execution.
 */

import { z } from 'zod'

// ── Input ────────────────────────────────────────────────────────────────────

export const ContextActionInputSchema = z.object({
  action: z.enum(['gate', 'proposal', 'requirement', 'repository']).optional().describe(
    'Action to perform. gate=gate context (needs: hash preferred, or gateId). proposal=proposal context (needs: hash). requirement=requirement details (needs: hash). repository=repository details (needs: hash or name).'
  ),
  gateId: z.string().min(1).optional().describe('Gate ID (e.g. "gate-01") — use hash instead where possible (prefer the hash field for gate action)'),
  hash: z.string().min(1).optional().describe('Entity hash — used for proposal, requirement, repository, or gate (when gateId is unknown)'),
  name: z.string().min(1).optional().describe('Entity name — for repository lookup by name'),
  operationMode: z.enum(['planning', 'execution']).optional().describe(
    'Declare the current operation phase. planning=gate/proposal generation workflows (may include planning artifact paths). execution=proposal implementation (DB-only context, no PRD loading). Omit during execution to keep context minimal.'
  ),
}).superRefine((data, ctx) => {
  if (data.action === 'gate' && !data.gateId && !data.hash) {
    ctx.addIssue({
      code: 'custom',
      path: ['gateId'],
      message: 'gate action requires gateId or hash',
    })
  }
  if (data.action === 'proposal' && !data.hash) {
    ctx.addIssue({
      code: 'custom',
      path: ['hash'],
      message: 'hash is required for proposal action',
    })
  }
  if (data.action === 'requirement' && !data.hash) {
    ctx.addIssue({
      code: 'custom',
      path: ['hash'],
      message: 'hash is required for requirement action',
    })
  }
  if (data.action === 'repository' && !data.hash && !data.name) {
    ctx.addIssue({
      code: 'custom',
      path: ['hash'],
      message: 'repository action requires hash or name',
    })
  }
})

export type ContextActionInput = z.infer<typeof ContextActionInputSchema>

// ── Per-action Output Schemas ─────────────────────────────────────────────────

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

// ── Requirement Output ────────────────────────────────────────────────────────

export const RequirementContextOutputSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.string(),
  priority: z.string(),
  level: z.string(),
  status: z.string().optional(),
  hash: z.string(),
  gateId: z.string().nullable(),
  acceptanceCriteria: z.string().nullable(),
  createdAt: z.string(),
})

export type RequirementContextOutput = z.infer<typeof RequirementContextOutputSchema>

// ── Repository Output ─────────────────────────────────────────────────────────

export const RepositoryContextOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  type: z.string(),
  hash: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
})

export type RepositoryContextOutput = z.infer<typeof RepositoryContextOutputSchema>

// ── Unified Output ────────────────────────────────────────────────────────────

export const ContextActionOutputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('gate'), result: GateContextOutputSchema }),
  z.object({ action: z.literal('proposal'), result: ProposalContextOutputSchema }),
  z.object({ action: z.literal('requirement'), result: RequirementContextOutputSchema }),
  z.object({ action: z.literal('repository'), result: RepositoryContextOutputSchema }),
])

export type ContextActionOutput = z.infer<typeof ContextActionOutputSchema>
