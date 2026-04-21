import { z } from 'zod'
import {
  ProposalHashSchema,
  ProposalStatusEnum,
  TimestampSchema,
} from './common-schemas.js'
import { PreReviewSummarySchema } from './pre-review-schemas.js'

/**
 * Zod schemas for proposal management operations
 */

// ============================================================================
// PROPOSAL_LIST - List proposals with optional filtering
// ============================================================================

export const ProposalListInputSchema = z.object({
  gateId: z.string().optional(), // permissive: accepts 'solitary' and 'gate-NN'
  status: ProposalStatusEnum.optional(),
})
export type ProposalListInput = z.infer<typeof ProposalListInputSchema>

export const ProposalSummarySchema = z.object({
  hash: ProposalHashSchema,
  title: z.string(),
  description: z.string().optional(),
  status: ProposalStatusEnum,
  gateId: z.string(),   // permissive: DB gate_id may not always match gate-NN regex
  tasksCompleted: z.number().int().min(0),
  totalTasks: z.number().int().min(0),
  parallelSetIndex: z.number().int().min(0).optional(),
  lastUpdated: TimestampSchema,
})
export type ProposalSummary = z.infer<typeof ProposalSummarySchema>

export const ProposalListOutputSchema = z.object({
  proposals: z.array(ProposalSummarySchema),
  parallelSets: z.array(z.array(z.string())),
})
export type ProposalListOutput = z.infer<typeof ProposalListOutputSchema>

// ============================================================================
// PROPOSAL_SHOW - Show detailed proposal information
// ============================================================================

export const ProposalShowInputSchema = z.object({
  hash: ProposalHashSchema,
})
export type ProposalShowInput = z.infer<typeof ProposalShowInputSchema>

export const ProposalTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  completed: z.boolean(),
  acceptance: z
    .array(
      z.object({
        criteria: z.string(),
        met: z.boolean(),
      })
    )
    .optional(),
})
export type ProposalTask = z.infer<typeof ProposalTaskSchema>

export const ProposalDetailSchema = z.object({
  hash: ProposalHashSchema,
  title: z.string(),
  description: z.string(),
  status: ProposalStatusEnum,
  gateId: z.string(), // permissive: accepts 'solitary' as well as 'gate-NN'
  solitary: z.boolean().optional(),
  summary: z.string().optional(),
  context: z.string().optional(),
  tasks: z.array(ProposalTaskSchema),
  dependencies: z
    .array(
      z.object({
        hash: ProposalHashSchema,
        type: z.enum(['blocks', 'depends_on', 'related_to']),
        title: z.string().optional(),
      })
    )
    .optional(),
  files: z
    .array(
      z.object({
        path: z.string(),
        action: z.enum(['create', 'modify']),
        description: z.string().optional(),
      })
    )
    .optional(),
  lastUpdated: TimestampSchema,
})
export type ProposalDetail = z.infer<typeof ProposalDetailSchema>

// ============================================================================
// PROPOSAL_VALIDATE - Validate proposal implementation
// ============================================================================

export const ProposalValidateInputSchema = z.object({
  hash: ProposalHashSchema,
})
export type ProposalValidateInput = z.infer<typeof ProposalValidateInputSchema>

export const ValidationIssueSchema = z.object({
  level: z.enum(['error', 'warning', 'info']),
  category: z.string(),
  message: z.string(),
  suggestion: z.string().optional(),
  file: z.string().optional(),
})
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>

const NextRequiredStepSchema = z.object({
  blocking: z.boolean(),
  action: z.string(),
  description: z.string(),
  agentInstruction: z.string().optional(),
  checklist: z.array(z.string()).optional(),
})

export const ProposalValidateOutputSchema = z.object({
  hash: ProposalHashSchema,
  passedQuantitative: z.boolean(),
  previousStatus: ProposalStatusEnum.optional(),
  newStatus: z.literal('validated').optional(),
  issues: z.array(ValidationIssueSchema),
  nextRequiredStep: NextRequiredStepSchema.optional(),
  failedChecks: z.record(z.string(), z.boolean()).optional(),
  checks: z.object({
    phases: z.boolean(),
    scope: z.boolean(),
    testFileScope: z.boolean(),
    dependencies: z.boolean(),
    artifactStructure: z.boolean(),
    quality: z.boolean(),
    testFirstPattern: z.boolean(),
    gateLevelTestFirst: z.boolean().optional(),
    redTestCoverage: z.boolean().optional(),
    requirementsCoverage: z.boolean().optional(),
    requirementRelevance: z.boolean().optional(),
  }).optional(),
  metrics: z
    .object({
      testCoverage: z.number().min(0).max(100).optional(),
      typeErrors: z.number().int().min(0).optional(),
      lintErrors: z.number().int().min(0).optional(),
      securityIssues: z.number().int().min(0).optional(),
    })
    .optional(),
  summary: z.string().optional(),
  /**
   * Agent-directed review items that the calling LLM MUST evaluate with its
   * own judgment before considering the validation complete.
   * Includes the qualitative scope-creep gate comparison when a gate PRD is
   * available, plus intent alignment and completeness checks.
   */
  agentReview: z.array(z.string()).optional(),
})
export type ProposalValidateOutput = z.infer<typeof ProposalValidateOutputSchema>

// ============================================================================
// PROPOSAL_APPROVE - Approve a proposal
// ============================================================================

export const ProposalApproveInputSchema = z.object({
  hash: ProposalHashSchema,
  approverNotes: z.string().optional(),
  approvedBy: z.string().optional(),
})
export type ProposalApproveInput = z.infer<typeof ProposalApproveInputSchema>

export const ProposalApproveOutputSchema = z.object({
  hash: ProposalHashSchema,
  previousStatus: ProposalStatusEnum,
  newStatus: z.literal('completed'),
  approvedAt: TimestampSchema,
  nextSteps: z.string().optional(),
  wroteBack: z.boolean().optional().describe('True when the proposal .md file status was synchronized successfully'),
})
export type ProposalApproveOutput = z.infer<typeof ProposalApproveOutputSchema>

// ============================================================================
// PROPOSAL_REJECT - Reject a proposal
// ============================================================================

export const ProposalRejectInputSchema = z.object({
  hash: ProposalHashSchema,
  rejectionReason: z.string(),
  rejectedBy: z.string().optional(),
})
export type ProposalRejectInput = z.infer<typeof ProposalRejectInputSchema>

export const ProposalRejectOutputSchema = z.object({
  hash: ProposalHashSchema,
  previousStatus: ProposalStatusEnum,
  newStatus: z.literal('rejected'),
  rejectedAt: TimestampSchema,
  reason: z.string(),
  nextSteps: z.string().optional(),
})
export type ProposalRejectOutput = z.infer<typeof ProposalRejectOutputSchema>

// ============================================================================
// PROPOSAL_START - Start proposal implementation
// ============================================================================

/**
 * Agent-submitted evidence that the qualitative proposal review has been performed.
 * Required on proposal_action:start alongside preReview — blocks the transition
 * until the LLM has evaluated and documented its findings for each content check.
 */
export const ProposalQualitativeReviewSchema = z.object({
  /** Task descriptions name a concrete file, function, or code construct */
  taskDescriptionsSpecific: z.boolean(),
  /** Every acceptance criterion is testable and measurable */
  acceptanceCriteriaMeasurable: z.boolean(),
  /** filesAffected paths verified against actual codebase naming conventions */
  filesAffectedVerified: z.boolean(),
  /** No unresolved markers: TODO, TBD, unclear, "?", or assumptions stated as fact */
  noUnresolvedMarkers: z.boolean(),
  /** Proposal focuses on one cohesive concern, not bundled unrelated changes */
  scopeFocused: z.boolean(),
  /** Rollback section describes specific, reversible steps (not just "revert the changes") */
  rollbackSpecific: z.boolean(),
  /**
   * For feature/implementation proposals: implementation performs real I/O operations
   * stated in acceptance criteria, not just in-memory stubs that satisfy mocked tests.
   * Optional — only required for proposals with role 'feature'.
   */
  implementationFidelityVerified: z.boolean().optional(),
  /** Items flagged during review; empty array if nothing was flagged */
  flaggedItems: z.array(z.string()),
})
export type ProposalQualitativeReview = z.infer<typeof ProposalQualitativeReviewSchema>

export const ProposalStartInputSchema = z.object({
  hash: ProposalHashSchema,
  qualitativeReview: ProposalQualitativeReviewSchema,
  startedBy: z.string().optional(),
})
export type ProposalStartInput = z.infer<typeof ProposalStartInputSchema>

export const ProposalStartOutputSchema = z.object({
  hash: ProposalHashSchema,
  previousStatus: ProposalStatusEnum,
  newStatus: z.literal('in_progress'),
  startedAt: TimestampSchema,
  /** Pre-review audit trail: echoes back agent-reported pre-review values for user verification */
  preReviewSummary: PreReviewSummarySchema.optional(),
  /** Warnings surfaced from qualitativeReview findings (false booleans + flaggedItems) */
  reviewWarnings: z.array(z.string()).optional(),
})
export type ProposalStartOutput = z.infer<typeof ProposalStartOutputSchema>

// ============================================================================
// PROPOSAL_CANCEL - Cancel a proposal (divergent/dropped)
// ============================================================================

export const ProposalCancelOutputSchema = z.object({
  hash: ProposalHashSchema,
  previousStatus: ProposalStatusEnum,
  newStatus: z.literal('cancelled'),
  cancelledAt: TimestampSchema,
  reason: z.string().optional(),
})
export type ProposalCancelOutput = z.infer<typeof ProposalCancelOutputSchema>

// ============================================================================
// PROPOSAL_DEFER - Defer a proposal to backlog (off main path, revisit later)
// ============================================================================

export const ProposalDeferOutputSchema = z.object({
  hash: ProposalHashSchema,
  previousStatus: ProposalStatusEnum,
  newStatus: z.literal('backlog'),
  deferredAt: TimestampSchema,
  reason: z.string().optional(),
})
export type ProposalDeferOutput = z.infer<typeof ProposalDeferOutputSchema>

// ============================================================================
// PROPOSAL_DELETE - Permanently remove a proposal (DB row + disk file)
// ============================================================================

export const ProposalDeleteOutputSchema = z.object({
  hash: ProposalHashSchema,
  title: z.string(),
  gateId: z.string().nullable(),
  previousStatus: ProposalStatusEnum,
  fileRemoved: z.boolean().describe('True when the disk file was successfully deleted'),
  filePath: z.string().nullable().describe('Path of the deleted file, or null if not found'),
  deletedAt: TimestampSchema,
  reason: z.string().optional(),
})
export type ProposalDeleteOutput = z.infer<typeof ProposalDeleteOutputSchema>

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export const ProposalNotFoundErrorSchema = z.object({
  code: z.literal('NOT_FOUND'),
  message: z.string(),
  context: z.object({
    resourceType: z.literal('proposal'),
    resourceId: ProposalHashSchema,
  }),
})
export type ProposalNotFoundError = z.infer<typeof ProposalNotFoundErrorSchema>

export const InvalidProposalStatusTransitionErrorSchema = z.object({
  code: z.literal('INVALID_STATUS_TRANSITION'),
  message: z.string(),
  context: z.object({
    currentStatus: ProposalStatusEnum,
    requestedStatus: ProposalStatusEnum,
    validTransitions: z.array(ProposalStatusEnum),
  }),
})
export type InvalidProposalStatusTransitionError = z.infer<
  typeof InvalidProposalStatusTransitionErrorSchema
>

export const ValidationFailedErrorSchema = z.object({
  code: z.literal('VALIDATION_ERROR'),
  message: z.string(),
  context: z.object({
    proposalHash: ProposalHashSchema,
    issues: z.array(ValidationIssueSchema),
    suggestion: z.string().optional(),
  }),
})
export type ValidationFailedError = z.infer<typeof ValidationFailedErrorSchema>
