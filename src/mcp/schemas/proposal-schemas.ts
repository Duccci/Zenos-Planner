import { z } from 'zod'
import {
  ProposalHashSchema,
  ProposalStatusEnum,
  GateIdSchema,
  TimestampSchema,
  OptionalTimestampSchema,
  PaginationMetadataSchema,
} from './common-schemas.js'

/**
 * Zod schemas for proposal management operations
 */

// ============================================================================
// PROPOSAL_LIST - List proposals with optional filtering
// ============================================================================

export const ProposalListInputSchema = z.object({
  gateId: GateIdSchema.optional(),
  status: ProposalStatusEnum.optional(),
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(50),
})
export type ProposalListInput = z.infer<typeof ProposalListInputSchema>

export const ProposalSummarySchema = z.object({
  hash: ProposalHashSchema,
  title: z.string(),
  description: z.string().optional(),
  status: ProposalStatusEnum,
  gateId: GateIdSchema,
  tasksCompleted: z.number().int().min(0),
  totalTasks: z.number().int().min(0),
  created: TimestampSchema,
  updated: OptionalTimestampSchema,
  completedAt: OptionalTimestampSchema,
})
export type ProposalSummary = z.infer<typeof ProposalSummarySchema>

export const ProposalListOutputSchema = z.object({
  proposals: z.array(ProposalSummarySchema),
  pagination: PaginationMetadataSchema,
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
  gateId: GateIdSchema,
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
  created: TimestampSchema,
  updated: OptionalTimestampSchema,
  completedAt: OptionalTimestampSchema,
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

export const ProposalValidateOutputSchema = z.object({
  hash: ProposalHashSchema,
  passed: z.boolean(),
  issues: z.array(ValidationIssueSchema),
  metrics: z
    .object({
      testCoverage: z.number().min(0).max(100).optional(),
      typeErrors: z.number().int().min(0).optional(),
      lintErrors: z.number().int().min(0).optional(),
      securityIssues: z.number().int().min(0).optional(),
    })
    .optional(),
  summary: z.string().optional(),
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

export const ProposalStartInputSchema = z.object({
  hash: ProposalHashSchema,
  startedBy: z.string().optional(),
})
export type ProposalStartInput = z.infer<typeof ProposalStartInputSchema>

export const ProposalStartOutputSchema = z.object({
  hash: ProposalHashSchema,
  previousStatus: ProposalStatusEnum,
  newStatus: z.literal('in_progress'),
  startedAt: TimestampSchema,
})
export type ProposalStartOutput = z.infer<typeof ProposalStartOutputSchema>

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
