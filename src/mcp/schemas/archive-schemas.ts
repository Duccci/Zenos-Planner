import { z } from 'zod'
import { GateIdSchema, TimestampSchema } from './common-schemas.js'

/**
 * Zod schemas for archive operations
 */

// ============================================================================
// ARCHIVE_GATE - Archive a completed gate
// ============================================================================

export const ArchiveGateInputSchema = z.object({
  gateId: GateIdSchema,
  completionNotes: z.string().optional(),
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
  summary: z.string(),
})
export type ArchiveGateOutput = z.infer<typeof ArchiveGateOutputSchema>

// ============================================================================
// ARCHIVE_BATCH - Archive multiple completed artifacts
// ============================================================================

export const ArchiveBatchInputSchema = z.object({
  artifacts: z.array(
    z.object({
      type: z.literal('gate'),
      gateId: GateIdSchema,
    })
  ),
  completionNotes: z.string().optional(),
})
export type ArchiveBatchInput = z.infer<typeof ArchiveBatchInputSchema>

export const ArchiveBatchOutputSchema = z.object({
  success: z.boolean(),
  archivedCount: z.number().int().min(0),
  results: z.array(ArchiveGateOutputSchema),
  summary: z.string(),
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
    issues: z.array(z.string()),
  }),
})
export type ArchiveValidationError = z.infer<typeof ArchiveValidationErrorSchema>

export const ArchiveNotReadyErrorSchema = z.object({
  code: z.literal('NOT_READY'),
  message: z.string(),
  context: z.object({
    artifactType: z.enum(['gate', 'proposal']),
    artifactId: z.string(),
    reason: z.string(),
    missingRequirements: z.array(z.string()).optional(),
  }),
})
export type ArchiveNotReadyError = z.infer<typeof ArchiveNotReadyErrorSchema>

// ============================================================================
// UNIFIED ARCHIVE ACTION SCHEMAS
// ============================================================================

export const ArchiveActionInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('gate'),
    payload: ArchiveGateInputSchema,
  }),
  z.object({
    action: z.literal('batch'),
    payload: ArchiveBatchInputSchema,
  }),
])

export type ArchiveActionInput = z.infer<typeof ArchiveActionInputSchema>

export const ArchiveActionOutputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('gate'),
    result: ArchiveGateOutputSchema,
    validation: z
      .object({
        warnings: z.array(z.string()),
        errors: z.array(z.string()),
      })
      .optional(),
  }),
  z.object({
    action: z.literal('batch'),
    result: ArchiveBatchOutputSchema,
    validation: z
      .object({
        warnings: z.array(z.string()),
        errors: z.array(z.string()),
      })
      .optional(),
  }),
])

export type ArchiveActionOutput = z.infer<typeof ArchiveActionOutputSchema>

// Helper function to get output schema for a specific action
export function getArchiveActionOutputSchema(action: ArchiveActionInput['action']): z.ZodType {
  switch (action) {
    case 'gate':
      return ArchiveGateOutputSchema
    case 'batch':
      return ArchiveBatchOutputSchema
  }
}
