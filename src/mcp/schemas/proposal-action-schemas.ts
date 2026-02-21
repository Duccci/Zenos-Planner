/**
 * Proposal Action Schemas
 *
 * Flat, self-documenting input schema for the proposal_action tool.
 * All fields are optional top-level properties so LLMs can call this tool
 * with any subset of args and the handler decides what is required per action.
 * An empty call ({}) passes validation and the handler returns usage guidance.
 */

import { z } from 'zod'
import {
  ProposalListOutputSchema,
  ProposalDetailSchema,
  ProposalValidateOutputSchema,
  ProposalApproveOutputSchema,
  ProposalRejectOutputSchema,
  ProposalStartOutputSchema,
} from './proposal-schemas.js'
import { ProposalCreateOutputSchema } from './proposal-create-schemas.js'
import {
  ProposalGenerateOutputSchema,
  ProposalUpdateProgressOutputSchema,
} from './workflow-schemas.js'

/**
 * Flat input schema for the proposal_action tool.
 *
 * action required for all calls:
 *   list      — list proposals; optional: gateId, status, skip, take
 *   show      — get proposal details; required: hash
 *   create    — new proposal; required: title, summary, tasks; optional: gateId, solitary, filesAffected, context, dependencies
 *   generate  — generate proposals (gate or solitary); required: gateId (for gate-tied) or solitary=true (for solitary); optional: title, summary, tasks, templateName, outputDir, filesAffected
 *   validate  — run quality checks on a proposal; required: hash; optional: strict
 *   approve   — approve and merge a proposal; required: hash; optional: approverNotes, approvedBy
 *   reject    — reject with reason; required: hash, rejectionReason; optional: rejectedBy
 *   start     — create isolated worktree; required: hash; optional: startedBy
 *   progress  — update task completion; required: hash, taskIndex, completed; optional: notes
 */
export const ProposalActionInputSchema = z.object({
  action: z
    .enum([
      'list',
      'show',
      'create',
      'generate',
      'validate',
      'approve',
      'reject',
      'start',
      'progress',
    ])
    .optional()
    .describe(
      'Action to perform. ' +
        'list=show proposals (filter by gateId/status). ' +
        'show=get proposal details (needs: hash). ' +
        'create=new proposal (needs: title, summary, tasks; optional: gateId, filesAffected). ' +
        'generate=generate proposals from gate PRD (gate-tied) or create solitary proposal (needs: gateId for gate-tied, solitary=true for solitary). ' +
        'validate=run quality checks (needs: hash). ' +
        'approve=merge proposal (needs: hash). ' +
        'reject=reject with feedback (needs: hash, rejectionReason). ' +
        'start=create worktree for implementation (needs: hash). ' +
        'progress=update task status (needs: hash, taskIndex, completed).'
    ),

  // --- list filters ---
  status: z
    .enum(['pending', 'in_progress', 'completed', 'archived', 'rejected'])
    .optional()
    .describe('Filter proposals by status (list action)'),
  skip: z.number().int().min(0).optional().describe('Pagination offset (list action, default 0)'),
  take: z.number().int().min(1).max(100).optional().describe('Page size (list action, default 50)'),

  // --- shared identifier ---
  hash: z
    .string()
    .optional()
    .describe('Proposal hash (show/validate/approve/reject/start/progress)'),
  gateId: z.string().optional().describe('Gate ID e.g. "gate-01" (list filter, create, generate)'),

  // --- create fields ---
  title: z.string().optional().describe('Proposal title (create)'),
  summary: z.string().optional().describe('Short 2-3 sentence summary (create)'),
  solitary: z.boolean().optional().describe('True if not tied to a gate (create)'),
  tasks: z
    .array(
      z.object({
        description: z.string().describe('Task description'),
        acceptanceCriteria: z.array(z.string()).optional().describe('Testable acceptance criteria'),
      })
    )
    .optional()
    .describe('Implementation tasks with acceptance criteria (create)'),
  filesAffected: z
    .array(z.string())
    .optional()
    .describe('File paths this proposal will change (create)'),
  context: z.string().optional().describe('Additional context or rationale (create)'),
  dependencies: z.array(z.string()).optional().describe('Proposal hashes this depends on (create)'),

  // --- generate fields ---
  templateName: z
    .string()
    .optional()
    .describe('Template name for generation (generate, default: proposal-template)'),
  outputDir: z.string().optional().describe('Output directory override (generate)'),

  // --- validate fields ---

  // --- approve fields ---
  approverNotes: z.string().optional().describe('Optional notes from approver (approve)'),
  approvedBy: z.string().optional().describe('Approver identifier (approve)'),

  // --- reject fields ---
  rejectionReason: z.string().optional().describe('Required reason for rejection (reject)'),
  rejectedBy: z.string().optional().describe('Rejector identifier (reject)'),

  // --- start fields ---
  startedBy: z.string().optional().describe('Implementer identifier (start)'),

  // --- progress fields ---
  taskIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Zero-based task index to update (progress)'),
  completed: z.boolean().optional().describe('Whether the task is completed (progress)'),
  notes: z.string().optional().describe('Implementation notes for the task (progress)'),
})

export type ProposalActionInput = z.infer<typeof ProposalActionInputSchema>

/**
 * Validation result schema for guardrail enforcement
 */
const ValidationResultSchema = z.object({
  allowed: z.boolean(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
})

/**
 * Discriminated union for proposal action outputs
 * Maps each action to its corresponding output schema
 */
export const ProposalActionOutputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    result: ProposalListOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('show'),
    result: ProposalDetailSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('create'),
    result: ProposalCreateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('generate'),
    result: ProposalGenerateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('validate'),
    result: ProposalValidateOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('approve'),
    result: ProposalApproveOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('reject'),
    result: ProposalRejectOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('start'),
    result: ProposalStartOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('progress'),
    result: ProposalUpdateProgressOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
])

export type ProposalActionOutput = z.infer<typeof ProposalActionOutputSchema>
