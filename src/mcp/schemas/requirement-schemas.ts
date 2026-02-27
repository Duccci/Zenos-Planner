import { z } from 'zod'
import {
  RequirementHashSchema,
  RequirementTypeEnum,
  GateIdSchema,
  TimestampSchema,
  OptionalTimestampSchema,
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
})
export type ReqListInput = z.infer<typeof ReqListInputSchema>

export const RequirementSummarySchema = z.object({
  hash: RequirementHashSchema,
  title: z.string(),
  description: z.string().optional(),
  type: RequirementTypeEnum,
  gateId: GateIdSchema,
  priority: z.enum(['must', 'should', 'could', 'wont']).optional(),
  created: TimestampSchema,
  updated: OptionalTimestampSchema,
  testedAt: OptionalTimestampSchema,
})
export type RequirementSummary = z.infer<typeof RequirementSummarySchema>

export const ReqListOutputSchema = z.object({
  requirements: z.array(RequirementSummarySchema),
})
export type ReqListOutput = z.infer<typeof ReqListOutputSchema>

// ============================================================================
// REQ_SHOW - Show detailed requirement information
// ============================================================================

export const ReqShowInputSchema = z.object({
  hash: RequirementHashSchema,
})
export type ReqShowInput = z.infer<typeof ReqShowInputSchema>

export const RequirementDetailSchema = z.object({
  hash: RequirementHashSchema,
  title: z.string(),
  description: z.string(),
  type: RequirementTypeEnum,
  gateId: GateIdSchema,
  priority: z.enum(['must', 'should', 'could', 'wont']).optional(),
  acceptance: z
    .array(
      z.object({
        criteria: z.string(),
        completed: z.boolean(),
      })
    )
    .optional(),
  parentRequirement: z
    .object({
      hash: RequirementHashSchema,
      title: z.string(),
    })
    .optional(),
  childRequirements: z
    .array(
      z.object({
        hash: RequirementHashSchema,
        title: z.string(),
      })
    )
    .optional(),
  relatedProposals: z
    .array(
      z.object({
        hash: z.string(),
        title: z.string(),
      })
    )
    .optional(),
  created: TimestampSchema,
  updated: OptionalTimestampSchema,
  testedAt: OptionalTimestampSchema,
})
export type RequirementDetail = z.infer<typeof RequirementDetailSchema>

// ============================================================================
// REQ_DEPS - Show requirement dependencies
// ============================================================================

export const ReqDepsInputSchema = z.object({
  hash: RequirementHashSchema,
})
export type ReqDepsInput = z.infer<typeof ReqDepsInputSchema>

export const DependencyNodeSchema = z.object({
  hash: RequirementHashSchema,
  title: z.string(),
  type: RequirementTypeEnum,
  gateId: GateIdSchema,
})
export type DependencyNode = z.infer<typeof DependencyNodeSchema>

export const DependencyEdgeSchema = z.object({
  from: RequirementHashSchema,
  to: RequirementHashSchema,
  type: z.enum(['blocks', 'depends_on', 'related_to']),
})
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>

export const DependencyGraphSchema = z.object({
  root: RequirementHashSchema,
  nodes: z.array(DependencyNodeSchema),
  edges: z.array(DependencyEdgeSchema),
  blocking: z.array(RequirementHashSchema).optional(),
  blockedBy: z.array(RequirementHashSchema).optional(),
})
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>

// ============================================================================
// REQ_SHOW output — wrapped envelope returned by req_action show
// Uses permissive string types for DB-sourced IDs to avoid strict regex failures
// on real data. Only INPUT schemas need strict validation.
// ============================================================================

export const ReqShowOutputSchema = z.object({
  requirement: z.object({
    hash: z.string(),
    title: z.string(),
    description: z.string().optional(),
    type: z.string(),
    gateId: z.string(),
    priority: z.string().optional(),
    acceptance: z.array(z.object({ criteria: z.string(), completed: z.boolean() })).optional(),
    parentRequirement: z.object({ hash: z.string(), title: z.string() }).optional(),
    childRequirements: z.array(z.object({ hash: z.string(), title: z.string() })).optional(),
    relatedProposals: z.array(z.object({ hash: z.string(), title: z.string() })).optional(),
    created: z.string(),
    updated: z.string().nullable().optional(),
    testedAt: z.string().nullable().optional(),
  }).nullable(),
  children: z.array(z.any()).optional(),
  ancestors: z.array(z.any()).optional(),
})
export type ReqShowOutput = z.infer<typeof ReqShowOutputSchema>

// REQ_DEPS output — wrapped envelope returned by req_action deps
export const ReqDepsWrapperSchema = z.object({
  graph: z.object({
    root: z.string(),
    nodes: z.array(z.object({
      hash: z.string(),
      title: z.string(),
      type: z.string(),
      gateId: z.string(),
    })),
    edges: z.array(z.object({
      from: z.string(),
      to: z.string(),
      type: z.string(),
    })),
    blocking: z.array(z.string()).optional(),
    blockedBy: z.array(z.string()).optional(),
  }).nullable(),
})
export type ReqDepsWrapper = z.infer<typeof ReqDepsWrapperSchema>

// ============================================================================
// REQ_TRANSFER - Transfer requirement to different gate
// ============================================================================

export const ReqTransferInputSchema = z.object({
  hash: RequirementHashSchema,
  targetGateId: GateIdSchema,
  reason: z.string().optional(),
})
export type ReqTransferInput = z.infer<typeof ReqTransferInputSchema>

export const ReqTransferOutputSchema = z.object({
  hash: RequirementHashSchema,
  previousGateId: GateIdSchema,
  newGateId: GateIdSchema,
  transferredAt: TimestampSchema,
  affectedProposals: z.array(z.string()).optional(),
})
export type ReqTransferOutput = z.infer<typeof ReqTransferOutputSchema>

// ============================================================================
// REQ_SEARCH - Full-text search across description and acceptance criteria
// ============================================================================

export const ReqSearchInputSchema = z.object({
  query: z.string().min(1),
  gateId: GateIdSchema.optional(),
  type: RequirementTypeEnum.optional(),
})
export type ReqSearchInput = z.infer<typeof ReqSearchInputSchema>

export const ReqSearchOutputSchema = z.object({
  requirements: z.array(RequirementSummarySchema),
  total: z.number().int().min(0),
})
export type ReqSearchOutput = z.infer<typeof ReqSearchOutputSchema>

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export const RequirementNotFoundErrorSchema = z.object({
  code: z.literal('NOT_FOUND'),
  message: z.string(),
  context: z.object({
    resourceType: z.literal('requirement'),
    resourceId: RequirementHashSchema,
  }),
})
export type RequirementNotFoundError = z.infer<typeof RequirementNotFoundErrorSchema>

export const DependencyBlockedErrorSchema = z.object({
  code: z.literal('DEPENDENCY_BLOCKED'),
  message: z.string(),
  context: z.object({
    requirementHash: RequirementHashSchema,
    blockedBy: z.array(RequirementHashSchema),
    suggestion: z.string().optional(),
  }),
})
export type DependencyBlockedError = z.infer<typeof DependencyBlockedErrorSchema>
