/**
 * Proposal Action Schemas
 *
 * Flat, self-documenting input schema for the proposal_action tool.
 * All fields are optional top-level properties so LLMs can call this tool
 * with any subset of args and the handler decides what is required per action.
 * An empty call ({}) passes validation and the handler returns usage guidance.
 */

import { z } from 'zod'
import { PreReviewSchema, ScopeExpansionSchema } from './pre-review-schemas.js'
import { ProposalStatusEnum } from './common-schemas.js'
import {
  ProposalListOutputSchema,
  ProposalDetailSchema,
  ProposalValidateOutputSchema,
  ProposalApproveOutputSchema,
  ProposalRejectOutputSchema,
  ProposalStartOutputSchema,
  ProposalCancelOutputSchema,
  ProposalDeferOutputSchema,
  ProposalQualitativeReviewSchema,
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
 *   list      — list proposals; optional: gateId, status
 *   show      — get proposal details; required: hash
 *   generate  — create or generate proposals. Explicit-fields path (title + tasks → creates directly; optional: gateId, solitary, filesAffected, context, dependencies).
 *               Gate-tied AI path (gateId + preReview → decomposes gate PRD). Solitary path (solitary=true → standalone proposal).
 *               preReview required for AI decomposition and start (enforced by handler)
 *   validate  — run quality checks on a proposal; required: hash; optional: strict
 *   approve   — approve and merge a proposal; required: hash; optional: approverNotes, approvedBy
 *   reject    — reject with reason; required: hash, rejectionReason; optional: rejectedBy
 *   start     — create isolated worktree; required: hash, preReview; optional: startedBy
 *              preReview required for start (enforced by handler)
 *   progress  — update task status; required: hash, currentTask; optional: completed, notes, scopeExpansion
 *              currentTask required for every progress call (enforced by handler)
 *   cancel    — cancel a proposal (divergent/dropped); required: hash; optional: rejectionReason as reason
 *   defer     — move proposal to backlog (deferred to later); required: hash; optional: notes as reason
 *
 * preReview: required for `start` and `generate` actions; see PreReviewSchema for fields.
 * currentTask: required for `progress` action; 1-based index of the task currently being applied.
 * scopeExpansion: optional for `progress` action; document files added outside filesAffected.
 */
export const ProposalActionInputSchema = z.object({
  action: z
    .enum([
      'list',
      'show',
      'generate',
      'validate',
      'approve',
      'reject',
      'start',
      'progress',
      'cancel',
      'defer',
    ])
    .optional()
    .describe(
      'Action to perform. ' +
        'list=show proposals (filter by gateId/status). ' +
        'show=get proposal details (needs: hash). ' +
        'generate=create or generate proposals. ' +
        'Explicit-fields path (needs: title, tasks; optional: gateId, filesAffected): creates the proposal directly. ' +
        'Context-driven path (needs: gateId for gate-tied, or solitary=true; required: preReview with phase=generate): AI generates proposals from gate PRD. ' +
        'validate=run quality checks (needs: hash). ' +
        'approve=merge proposal (needs: hash; optional: writeback=true to patch status into .md file). ' +
        'reject=reject with feedback (needs: hash, rejectionReason). ' +
        'start=create worktree for implementation (needs: hash, preReview with phase=apply, qualitativeReview with all six booleans + flaggedItems). ' +
        'progress=update task status (needs: hash, currentTask; optional: completed, notes, scopeExpansion). ' +
        'cancel=mark proposal as cancelled/dropped (needs: hash, confirmed: true; optional: rejectionReason as reason). ' +
        'defer=move proposal to backlog for later implementation (needs: hash, confirmed: true; optional: notes as reason). ' +
        'IMPORTANT: cancel and defer are destructive and require confirmed: true — omitting it returns a confirmation prompt instead of executing.'
    ),

  // --- list filters ---
  status: ProposalStatusEnum
    .optional()
    .describe('Filter proposals by status (list action)'),

  // --- shared identifier ---
  hash: z
    .string()
    .optional()
    .describe('Proposal hash (show/validate/approve/reject/start/progress)'),
  gateId: z.string().optional().describe('Gate hash from gates_action:list — never pass plaintext IDs like "gate-01" (list filter, create, generate)'),

  // --- create fields ---
  title: z.string().optional().describe('Proposal title (create)'),
  summary: z.string().optional().describe('Short 2-3 sentence summary (create)'),
  solitary: z.boolean().optional().describe('True if not tied to a gate (create)'),
  tasks: z
    .array(
      z.object({
        description: z.string().describe('Task description'),
        acceptanceCriteria: z.array(z.string()).optional().describe('Testable acceptance criteria'),
        phase: z.enum(['RED', 'GREEN']).optional().describe('Task phase (RED/GREEN)'),
        files: z.array(z.string()).optional().describe('File paths this task touches'),
        action: z.enum(['create', 'modify', 'delete', 'refactor']).optional().describe('Change action for files (create/modify/delete/refactor)'),
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
  writeback: z
    .boolean()
    .optional()
    .describe(
      'approve: when true, patches **Status**: completed back into the proposal .md file. ' +
        'Default false. The .md file is the user\'s source of truth — only pass writeback: true ' +
        'when the user explicitly asks for DB↔file reconciliation after an approval.'
    ),

  // --- reject fields ---
  rejectionReason: z.string().optional().describe('Required reason for rejection (reject)'),
  rejectedBy: z.string().optional().describe('Rejector identifier (reject)'),

  // --- destructive action guard ---
  confirmed: z
    .boolean()
    .optional()
    .describe(
      'Must be true to execute destructive actions (cancel, defer). ' +
        'If absent or false, the action returns a confirmation prompt with the required details ' +
        'instead of executing. Always present this prompt to the user and wait for explicit approval ' +
        'before re-calling with confirmed: true.'
    ),

  // --- start fields ---
  startedBy: z.string().optional().describe('Implementer identifier (start)'),

  // --- qualitativeReview field (start) ---
  /**
   * Agent-submitted qualitative review evidence. Required for the `start` action alongside preReview.
   * Evaluate every item in the validate checklist with your own judgment first,
   * then submit findings here. The handler returns a structured error if absent.
   */
  qualitativeReview: ProposalQualitativeReviewSchema.optional().describe(
    "Required for 'start' action. Evaluate the qualitative checklist from proposal_action:validate, " +
      'then submit: { taskDescriptionsSpecific, acceptanceCriteriaMeasurable, filesAffectedVerified, ' +
      'noUnresolvedMarkers, scopeFocused, rollbackSpecific, flaggedItems }.'
  ),

  // --- progress fields ---
  taskIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Zero-based task index to update (progress)'),
  completed: z.boolean().optional().describe('Whether the task is completed (progress)'),
  notes: z.string().optional().describe('Implementation notes for the task (progress)'),

  // --- preReview fields (start + generate) ---
  /**
   * Pre-work review evidence. Required for `start` and `generate` actions.
   * The handler returns a structured error if absent for those actions.
   * Phase must match action: 'apply' for start, 'generate' for generate.
   */
  preReview: PreReviewSchema.optional().describe(
    "Pre-work review evidence (required for 'start' and 'generate' actions). " +
      "phase='apply' for start; phase='generate' for generate. " +
      'See PreReviewSchema for all required fields.'
  ),

  // --- currentTask field (progress) ---
  /**
   * 1-based index of the task currently being applied.
   * Required on every `progress` call. Enables out-of-bounds detection
   * to catch context rot where the agent loses track of its position.
   */
  currentTask: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('1-based index of the task currently being applied (required for progress action)'),

  // --- scopeExpansion field (progress) ---
  /**
   * G9: Structured scope expansion documentation.
   * Required when `progress` modifies files outside filesAffected.
   * Provides a structured alternative to the narrative "document and ask human" guidance.
   */
  scopeExpansion: ScopeExpansionSchema.optional().describe(
    "(progress) Required when modifying files outside the proposal's declared filesAffected. " +
      'List the new files and justify the scope change.'
  ),
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
 * Union of proposal generate outputs — covers both AI-decomposition (ProposalGenerateOutputSchema)
 * and explicit-fields creation (ProposalCreateOutputSchema) paths.
 */
export const ProposalGenerateOrCreateOutputSchema = z.union([ProposalGenerateOutputSchema, ProposalCreateOutputSchema])

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
    action: z.literal('generate'),
    result: ProposalGenerateOrCreateOutputSchema,
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
  z.object({
    action: z.literal('cancel'),
    result: ProposalCancelOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
  z.object({
    action: z.literal('defer'),
    result: ProposalDeferOutputSchema,
    validation: ValidationResultSchema.optional(),
  }),
])

export type ProposalActionOutput = z.infer<typeof ProposalActionOutputSchema>
