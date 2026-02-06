import { z } from 'zod'
import {
  GateIdSchema,
  TimestampSchema
} from './common-schemas.js'

/**
 * Zod schemas for archive operations
 */

// ============================================================================
// ARCHIVE_GATE - Archive a completed gate
// ============================================================================

export const ArchiveGateInputSchema = z.object({
  gateId: GateIdSchema,
  completionNotes: z.string().optional()
})
export type ArchiveGateInput = z.infer<typeof ArchiveGateInputSchema>

export const ArchiveGateOutputSchema = z.object({
  success: z.boolean(),
  gateId: GateIdSchema,
  gateName: z.string(),
  status: z.literal('completed'),
  archivedAt: TimestampSchema,
  location: z.string(),
  gitTag: z.string(),
  consolidatedProposals: z.number().int().min(0),
  fulfilledRequirements: z.number().int().min(0),
  nextGateId: z.string().optional(),
  summary: z.string()
})
export type ArchiveGateOutput = z.infer<typeof ArchiveGateOutputSchema>

// ============================================================================
// ARCHIVE_PROPOSAL - Archive a completed proposal
// ============================================================================

export const ArchiveProposalInputSchema = z.object({
  hash: z.string().regex(/^[a-z0-9]{8}$/, 'Must be 8-character hash'),
  completionNotes: z.string().optional()
})
export type ArchiveProposalInput = z.infer<typeof ArchiveProposalInputSchema>

export const ArchiveProposalOutputSchema = z.object({
  success: z.boolean(),
  hash: z.string(),
  title: z.string(),
  type: z.enum(['gate-tied', 'solitary']),
  gateId: GateIdSchema.optional(),
  archivedAt: TimestampSchema,
  location: z.string(),
  updatedRequirements: z.array(z.object({
    hash: z.string(),
    name: z.string(),
    status: z.string()
  })),
  unblockedProposals: z.array(z.string()),
  gateStatus: z.string(),
  summary: z.string()
})
export type ArchiveProposalOutput = z.infer<typeof ArchiveProposalOutputSchema>

// ============================================================================
// ARCHIVE_BATCH - Archive multiple completed artifacts
// ============================================================================

export const ArchiveBatchInputSchema = z.object({
  artifacts: z.array(z.union([
    z.object({
      type: z.literal('gate'),
      gateId: GateIdSchema
    }),
    z.object({
      type: z.literal('proposal'),
      hash: z.string().regex(/^[a-z0-9]{8}$/)
    })
  ])),
  completionNotes: z.string().optional()
})
export type ArchiveBatchInput = z.infer<typeof ArchiveBatchInputSchema>

export const ArchiveBatchOutputSchema = z.object({
  success: z.boolean(),
  archivedCount: z.number().int().min(0),
  results: z.array(z.union([
    ArchiveGateOutputSchema,
    ArchiveProposalOutputSchema
  ])),
  summary: z.string()
})
export type ArchiveBatchOutput = z.infer<typeof ArchiveBatchOutputSchema>

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export const ArchiveValidationErrorSchema = z.object({
  code: z.literal('VALIDATION_FAILED'),
  message: z.string(),
  context: z.object({
    artifactType: z.enum(['gate', 'proposal']),
    artifactId: z.string(),
    issues: z.array(z.string())
  })
})
export type ArchiveValidationError = z.infer<typeof ArchiveValidationErrorSchema>

export const ArchiveNotReadyErrorSchema = z.object({
  code: z.literal('NOT_READY'),
  message: z.string(),
  context: z.object({
    artifactType: z.enum(['gate', 'proposal']),
    artifactId: z.string(),
    reason: z.string(),
    missingRequirements: z.array(z.string()).optional()
  })
})
export type ArchiveNotReadyError = z.infer<typeof ArchiveNotReadyErrorSchema>