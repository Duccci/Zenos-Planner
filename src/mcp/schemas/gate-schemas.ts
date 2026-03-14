import { z } from 'zod'
import {
  GateIdSchema,
  GateStatusEnum,
  GateTypeEnum,
  ProposalStatusEnum,
  RequirementStatusEnum,
  TimestampSchema,
} from './common-schemas.js'

/**
 * Zod schemas for gate management operations
 */

// ============================================================================
// GATE_LIST - List all gates with optional filtering
// ============================================================================

export const GatesListInputSchema = z.object({
  status: GateStatusEnum.optional(),
})
export type GatesListInput = z.infer<typeof GatesListInputSchema>

export const GateSummarySchema = z.object({
  id: GateIdSchema,
  name: z.string(),
  description: z.string().optional(),
  sequence: z.number().int().min(1),
  status: GateStatusEnum,
  type: GateTypeEnum,
  lastUpdated: TimestampSchema,
  proposalCount: z.number().int().min(0),
  completedProposalCount: z.number().int().min(0),
  requirementCount: z.number().int().min(0),
  testedRequirementCount: z.number().int().min(0),
})
export type GateSummary = z.infer<typeof GateSummarySchema>

export const GatesListOutputSchema = z.object({
  gates: z.array(GateSummarySchema),
})
export type GatesListOutput = z.infer<typeof GatesListOutputSchema>

// ============================================================================
// GATES_SHOW - Show detailed gate information
// ============================================================================

export const GatesShowInputSchema = z.object({
  gateId: GateIdSchema
})
export type GatesShowInput = z.infer<typeof GatesShowInputSchema>

export const GateDetailSchema = z.object({
  id: GateIdSchema,
  name: z.string(),
  description: z.string().optional(),
  sequence: z.number().int().min(1),
  status: GateStatusEnum,
  type: GateTypeEnum,
  objectives: z.array(
    z.object({
      title: z.string(),
      completed: z.boolean(),
    })
  ),
  requirements: z.array(
    z.object({
      hash: z.string(),
      title: z.string(),
      status: RequirementStatusEnum,
      priority: z.enum(['low', 'medium', 'high']).optional(),
    })
  ),
  proposals: z.array(
    z.object({
      hash: z.string(),
      title: z.string(),
      status: ProposalStatusEnum,
      tasksCompleted: z.number().int().min(0),
      totalTasks: z.number().int().min(0),
    })
  ),
  lastUpdated: TimestampSchema,
})
export type GateDetail = z.infer<typeof GateDetailSchema>

// ============================================================================
// GATES_START - Start a gate (transition from validated to in_progress)
// ============================================================================

/**
 * Agent-submitted evidence that the qualitative gate review has been performed.
 * Required on gates_action:start — blocks the transition until the LLM has
 * evaluated and documented its findings for each check.
 */
export const GateQualitativeReviewSchema = z.object({
  /** Gate objectives are still current, achievable, and unambiguous */
  objectivesConfirmed: z.boolean(),
  /** Every requirement maps to a concrete, testable deliverable */
  requirementsMapped: z.boolean(),
  /** Proposal count is appropriate for gate scope (not monolithic, not micro-fragmented) */
  proposalCountAppropriate: z.boolean(),
  /** RED proposals precede GREEN proposals (test-first ordering is correct) */
  testFirstOrderingVerified: z.boolean(),
  /** Gate dependency declarations reflect the real execution order */
  dependenciesConfirmed: z.boolean(),
  /** Gate objectives are achievable within a single gate (no splitting needed) */
  scopeAchievable: z.boolean(),
  /** Items flagged during review; empty array if nothing was flagged */
  flaggedItems: z.array(z.string()),
})
export type GateQualitativeReview = z.infer<typeof GateQualitativeReviewSchema>

export const GatesStartInputSchema = z.object({
  gateId: GateIdSchema,
  qualitativeReview: GateQualitativeReviewSchema,
  notes: z.string().optional(),
})
export type GatesStartInput = z.infer<typeof GatesStartInputSchema>

export const GatesStartOutputSchema = z.object({
  gateId: GateIdSchema,
  previousStatus: GateStatusEnum,
  newStatus: z.literal('in_progress'),
  startedAt: TimestampSchema,
  /** Warnings surfaced from qualitativeReview findings (false booleans + flaggedItems) */
  reviewWarnings: z.array(z.string()).optional(),
})
export type GatesStartOutput = z.infer<typeof GatesStartOutputSchema>

// ============================================================================
// GATES_COMPLETE - Complete a gate (transition to completed)
// ============================================================================

export const GatesCompleteInputSchema = z.object({
  gateId: GateIdSchema,
  completionNotes: z.string().optional(),
  approvalDate: TimestampSchema.optional(),
})
export type GatesCompleteInput = z.infer<typeof GatesCompleteInputSchema>

export const GatesCompleteGitInstructionsSchema = z.object({
  commitMessage: z.string(),
  tagName: z.string().optional(),
  tagMessage: z.string().optional(),
  commands: z.array(z.string()),
})

export const GatesCompleteOutputSchema = z.object({
  gateId: GateIdSchema,
  previousStatus: GateStatusEnum,
  newStatus: z.literal('completed'),
  completedAt: TimestampSchema,
  summary: z.object({
    proposalsCompleted: z.number().int(),
    requirementsTested: z.number().int(),
    qualityMetrics: z.object({
      testCoverage: z.number().min(0).max(100),
      typeErrors: z.number().int().min(0),
      lintErrors: z.number().int().min(0),
      securityIssues: z.number().int().min(0),
    }).optional(),
  }),
  gitInstructions: GatesCompleteGitInstructionsSchema.optional(),
})
export type GatesCompleteOutput = z.infer<typeof GatesCompleteOutputSchema>

// ============================================================================
// GATES_VALIDATE - Dry-run quality + structural checks without completing
// ============================================================================

const GateNextRequiredStepSchema = z.object({
  blocking: z.boolean(),
  action: z.string(),
  description: z.string(),
  agentInstruction: z.string().optional(),
  checklist: z.array(z.string()).optional(),
})

export const GatesValidateOutputSchema = z.object({
  gateId: GateIdSchema,
  passed: z.boolean(),
  previousStatus: GateStatusEnum.optional(),
  newStatus: z.literal('validated').optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  /**
   * Present only when checks fail — contains only the checks that did NOT pass.
   * Omitted when all checks pass to avoid all-true noise.
   */
  failedChecks: z.record(z.string(), z.boolean()).optional(),
  /**
   * Full check results. Present only inline during transitional states;
   * omitted from the handler response when all checks pass (replaced by nextRequiredStep)
   * or when checks fail (replaced by failedChecks).
   */
  checks: z.object({
    /** No duplicate gate IDs and dependencies form an acyclic graph */
    dependencies: z.boolean(),
    /** All declared dependency gates are in completed status */
    dependencyGatesCompleted: z.boolean(),
    /** Artifact has required sections, valid Status, actionable objectives, no stale markers */
    artifactStructure: z.boolean(),
    /** Gate has at least one requirement linked in the database */
    requirementsCoverage: z.boolean(),
    /** Proposals exist and satisfy the test-first ordering rule */
    testFirstStructure: z.boolean(),
    /** Quality thresholds (coverage, lint, security) are met */
    quality: z.boolean(),
  }).optional(),
  /**
   * The mandatory next action after validation.
   * - passed=true  → qualitative-review (checklist items require agent judgment)
   * - passed=false → fix-structural-errors (fix every error in errors[] first)
   */
  nextRequiredStep: GateNextRequiredStepSchema.optional(),
})
export type GatesValidateOutput = z.infer<typeof GatesValidateOutputSchema>

// ============================================================================
// GATES_REGENERATE - Regenerate gate sequence or check for updates
// ============================================================================

export const GatesRegenerateInputSchema = z.object({
  /** Single-gate replan: clear and re-render this specific gate's MD from template. */
  gateId: GateIdSchema.optional(),
  /** Multi-gate baseline: regenerate gates after this completed gate (auto-detected if omitted). */
  fromGateId: GateIdSchema.optional(),
  /** Rescope signal: the project PRD end-state has changed. */
  prdChanged: z.boolean().optional().default(false),
  /** Return the plan without writing any files. */
  dryRun: z.boolean().optional().default(false),
  mode: z.enum(['single', 'full', 'partial', 'check']).default('check')
})
export type GatesRegenerateInput = z.infer<typeof GatesRegenerateInputSchema>

export const GatesRegenerateOutputSchema = z.object({
  mode: z.enum(['single', 'full', 'partial', 'check']),
  status: z.enum(['no_changes', 'changes_suggested', 'regenerated']),
  changes: z.object({
    gatesAffected: z.array(GateIdSchema),
    proposalsGenerated: z.number().int().min(0),
    requirementsAttributed: z.number().int().min(0),
    summary: z.string().optional()
  }).optional()
})
export type GatesRegenerateOutput = z.infer<typeof GatesRegenerateOutputSchema>

// ============================================================================
// ============================================================================
// CONFIRMATION REQUIRED - Returned when a destructive action needs explicit user permission
// ============================================================================

export const GatesConfirmationRequiredSchema = z.object({
  requiresConfirmation: z.literal(true),
  action: z.enum(['cancel', 'defer']),
  gateId: GateIdSchema.optional(),
  message: z.string(),
})
export type GatesConfirmationRequired = z.infer<typeof GatesConfirmationRequiredSchema>

// ============================================================================
// GATES_CANCEL - Cancel a gate (divergent/dropped from roadmap)
// ============================================================================

export const GatesCancelSuccessSchema = z.object({
  gateId: GateIdSchema,
  previousStatus: GateStatusEnum,
  newStatus: z.literal('cancelled'),
  cancelledAt: TimestampSchema,
  reason: z.string().optional(),
})
export const GatesCancelOutputSchema = z.union([GatesCancelSuccessSchema, GatesConfirmationRequiredSchema])
export type GatesCancelOutput = z.infer<typeof GatesCancelOutputSchema>

// ============================================================================
// GATES_DEFER - Defer a gate to backlog (off main path, revisit later)
// ============================================================================

export const GatesDeferSuccessSchema = z.object({
  gateId: GateIdSchema,
  previousStatus: GateStatusEnum,
  newStatus: z.literal('backlog'),
  deferredAt: TimestampSchema,
  reason: z.string().optional(),
})
export const GatesDeferOutputSchema = z.union([GatesDeferSuccessSchema, GatesConfirmationRequiredSchema])
export type GatesDeferOutput = z.infer<typeof GatesDeferOutputSchema>

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export const GateNotFoundErrorSchema = z.object({
  code: z.literal('NOT_FOUND'),
  message: z.string(),
  context: z.object({
    resourceType: z.literal('gate'),
    resourceId: GateIdSchema
  })
})
export type GateNotFoundError = z.infer<typeof GateNotFoundErrorSchema>

export const InvalidGateStatusTransitionErrorSchema = z.object({
  code: z.literal('INVALID_STATUS_TRANSITION'),
  message: z.string(),
  context: z.object({
    currentStatus: GateStatusEnum,
    requestedStatus: GateStatusEnum,
    validTransitions: z.array(GateStatusEnum)
  })
})
export type InvalidGateStatusTransitionError = z.infer<typeof InvalidGateStatusTransitionErrorSchema>
