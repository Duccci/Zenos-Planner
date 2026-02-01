import { z } from 'zod'
import {
  RequirementHashSchema,
  RequirementTypeEnum,
  GateIdSchema,
  TimestampSchema,
  OptionalTimestampSchema,
  PaginationMetadataSchema
} from './common-schemas.js'

/**
 * Zod schemas for requirement management operations
 */

// ============================================================================
// REQ_LIST - List requirements with optional filtering
// ============================================================================

export const ReqListInputSchema = z.object({
  gateId: GateIdSchema.optional(),
  type: RequirementTypeEnum.optional(),
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(50)
})
export type ReqListInput = z.infer<typeof ReqListInputSchema>

export const RequirementSummarySchema = z.object({
  hash: RequirementHashSchema,
  title: z.string(),
  description: z.string().optional(),
  type: RequirementTypeEnum,
  gateId: GateIdSchema,
  priority: z.enum(['low', 'medium', 'high']).optional(),
  created: TimestampSchema,
  updated: OptionalTimestampSchema,
  testedAt: OptionalTimestampSchema
})
export type RequirementSummary = z.infer<typeof RequirementSummarySchema>

export const ReqListOutputSchema = z.object({
  requirements: z.array(RequirementSummarySchema),
  pagination: PaginationMetadataSchema
})
export type ReqListOutput = z.infer<typeof ReqListOutputSchema>

// ============================================================================
// REQ_SHOW - Show detailed requirement information
// ============================================================================

export const ReqShowInputSchema = z.object({
  hash: RequirementHashSchema
})
export type ReqShowInput = z.infer<typeof ReqShowInputSchema>

export const RequirementDetailSchema = z.object({
  hash: RequirementHashSchema,
  title: z.string(),
  description: z.string(),
  type: RequirementTypeEnum,
  gateId: GateIdSchema,
  priority: z.enum(['low', 'medium', 'high']).optional(),
  acceptance: z.array(z.object({
    criteria: z.string(),
    completed: z.boolean()
  })).optional(),
  parentRequirement: z.object({
    hash: RequirementHashSchema,
    title: z.string()
  }).optional(),
  childRequirements: z.array(z.object({
    hash: RequirementHashSchema,
    title: z.string()
  })).optional(),
  relatedProposals: z.array(z.object({
    hash: z.string(),
    title: z.string()
  })).optional(),
  created: TimestampSchema,
  updated: OptionalTimestampSchema,
  testedAt: OptionalTimestampSchema
})
export type RequirementDetail = z.infer<typeof RequirementDetailSchema>

// ============================================================================
// REQ_DEPS - Show requirement dependencies
// ============================================================================

export const ReqDepsInputSchema = z.object({
  hash: RequirementHashSchema
})
export type ReqDepsInput = z.infer<typeof ReqDepsInputSchema>

export const DependencyNodeSchema = z.object({
  hash: RequirementHashSchema,
  title: z.string(),
  type: RequirementTypeEnum,
  gateId: GateIdSchema
})
export type DependencyNode = z.infer<typeof DependencyNodeSchema>

export const DependencyEdgeSchema = z.object({
  from: RequirementHashSchema,
  to: RequirementHashSchema,
  type: z.enum(['blocks', 'depends_on', 'related_to'])
})
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>

export const DependencyGraphSchema = z.object({
  root: RequirementHashSchema,
  nodes: z.array(DependencyNodeSchema),
  edges: z.array(DependencyEdgeSchema),
  blocking: z.array(RequirementHashSchema).optional(),
  blockedBy: z.array(RequirementHashSchema).optional()
})
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>

// ============================================================================
// REQ_TRANSFER - Transfer requirement to different gate
// ============================================================================

export const ReqTransferInputSchema = z.object({
  hash: RequirementHashSchema,
  targetGateId: GateIdSchema,
  reason: z.string().optional()
})
export type ReqTransferInput = z.infer<typeof ReqTransferInputSchema>

export const ReqTransferOutputSchema = z.object({
  hash: RequirementHashSchema,
  previousGateId: GateIdSchema,
  newGateId: GateIdSchema,
  transferredAt: TimestampSchema,
  affectedProposals: z.array(z.string()).optional()
})
export type ReqTransferOutput = z.infer<typeof ReqTransferOutputSchema>

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export const RequirementNotFoundErrorSchema = z.object({
  code: z.literal('NOT_FOUND'),
  message: z.string(),
  context: z.object({
    resourceType: z.literal('requirement'),
    resourceId: RequirementHashSchema
  })
})
export type RequirementNotFoundError = z.infer<typeof RequirementNotFoundErrorSchema>



export const DependencyBlockedErrorSchema = z.object({
  code: z.literal('DEPENDENCY_BLOCKED'),
  message: z.string(),
  context: z.object({
    requirementHash: RequirementHashSchema,
    blockedBy: z.array(RequirementHashSchema),
    suggestion: z.string().optional()
  })
})
export type DependencyBlockedError = z.infer<typeof DependencyBlockedErrorSchema>
