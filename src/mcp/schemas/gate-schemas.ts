import { z } from 'zod'
import {
  GateIdSchema,
  GateStatusEnum,
  TimestampSchema,
  OptionalTimestampSchema,
  PaginationMetadataSchema
} from './common-schemas.js'

/**
 * Zod schemas for gate management operations
 */

// ============================================================================
// GATE_LIST - List all gates with optional filtering
// ============================================================================

export const GatesListInputSchema = z.object({
  status: GateStatusEnum.optional(),
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(50)
})
export type GatesListInput = z.infer<typeof GatesListInputSchema>

export const GateSummarySchema = z.object({
  id: GateIdSchema,
  name: z.string(),
  description: z.string(),
  sequence: z.number().int().min(1),
  status: GateStatusEnum,
  type: z.enum(['feature', 'infrastructure', 'migration']),
  created: TimestampSchema,
  started: OptionalTimestampSchema,
  completed: OptionalTimestampSchema,
  proposalCount: z.number().int().min(0),
  completedProposalCount: z.number().int().min(0),
  requirementCount: z.number().int().min(0),
  testedRequirementCount: z.number().int().min(0),
})
export type GateSummary = z.infer<typeof GateSummarySchema>

export const GatesListOutputSchema = z.object({
  gates: z.array(GateSummarySchema),
  pagination: PaginationMetadataSchema
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
  description: z.string(),
  sequence: z.number().int().min(1),
  status: GateStatusEnum,
  type: z.enum(['feature', 'infrastructure', 'migration']),
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
      status: z.enum(['pending', 'in_progress', 'tested', 'archived']),
      priority: z.enum(['low', 'medium', 'high']).optional(),
    })
  ),
  proposals: z.array(
    z.object({
      hash: z.string(),
      title: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'archived', 'rejected']),
      tasksCompleted: z.number().int().min(0),
      totalTasks: z.number().int().min(0),
    })
  ),
  created: TimestampSchema,
  started: OptionalTimestampSchema,
  completed: OptionalTimestampSchema,
})
export type GateDetail = z.infer<typeof GateDetailSchema>

// ============================================================================
// GATES_START - Start a gate (transition from pending to in_progress)
// ============================================================================

export const GatesStartInputSchema = z.object({
  gateId: GateIdSchema,
  notes: z.string().optional(),
})
export type GatesStartInput = z.infer<typeof GatesStartInputSchema>

export const GatesStartOutputSchema = z.object({
  gateId: GateIdSchema,
  previousStatus: GateStatusEnum,
  newStatus: z.literal('in_progress'),
  startedAt: TimestampSchema,
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
})
export type GatesCompleteOutput = z.infer<typeof GatesCompleteOutputSchema>

// ============================================================================
// GATES_REGENERATE - Regenerate gate sequence or check for updates
// ============================================================================

export const GatesRegenerateInputSchema = z.object({
  fromGateId: GateIdSchema.optional(),
  mode: z.enum(['full', 'partial', 'check']).default('check')
})
export type GatesRegenerateInput = z.infer<typeof GatesRegenerateInputSchema>

export const GatesRegenerateOutputSchema = z.object({
  mode: z.enum(['full', 'partial', 'check']),
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
