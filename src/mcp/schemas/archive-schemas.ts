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
// ARCHIVE_PROPOSAL - Archive a completed proposal
// ============================================================================

export const ArchiveProposalInputSchema = z.object({
  proposalHash: z.string(),
  completionNotes: z.string().optional(),
})
export type ArchiveProposalInput = z.infer<typeof ArchiveProposalInputSchema>

export const ArchiveProposalOutputSchema = z.object({
  success: z.boolean(),
  proposalHash: z.string(),
  proposalTitle: z.string(),
  proposalType: z.enum(['gate-tied', 'solitary']),
  gateId: z.string().optional(),
  status: z.literal('completed'),
  archivedAt: TimestampSchema,
  location: z.string(),
  summary: z.string(),
})
export type ArchiveProposalOutput = z.infer<typeof ArchiveProposalOutputSchema>

// ============================================================================
// ARCHIVE_BATCH - Archive multiple completed artifacts
// ============================================================================

export const ArchiveBatchInputSchema = z.object({
  artifacts: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('gate'),
        gateId: GateIdSchema,
      }),
      z.object({
        type: z.literal('proposal'),
        proposalHash: z.string(),
      }),
    ])
  ),
  completionNotes: z.string().optional(),
})
export type ArchiveBatchInput = z.infer<typeof ArchiveBatchInputSchema>

export const ArchiveBatchOutputSchema = z.object({
  success: z.boolean(),
  archivedCount: z.number().int().min(0),
  results: z.array(
    z.discriminatedUnion('success', [
      z.object({
        success: z.literal(true),
        artifactType: z.enum(['gate', 'proposal']),
        artifactId: z.string(),
        output: z.union([ArchiveGateOutputSchema, ArchiveProposalOutputSchema]),
      }),
      z.object({
        success: z.literal(false),
        artifactType: z.enum(['gate', 'proposal']),
        artifactId: z.string(),
        error: z.string(),
      }),
    ])
  ),
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

/**
 * Flat, self-documenting input schema for the archive_action tool.
 *
 * action required for all calls:
 *   gate   — archive a completed gate; required: gateId; optional: completionNotes
 *   batch  — archive multiple completed gates/proposals; required: artifacts
 */
export const ArchiveActionInputSchema = z.object({
  action: z
    .enum(['gate', 'batch'])
    .optional()
    .describe(
      'Action to perform. ' +
        'gate=archive a completed gate (needs: gateId; optional: completionNotes). ' +
        'batch=archive multiple artifacts (gates/proposals) at once (needs: artifacts array of {type, gateId|proposalHash}).'
    ),

  // --- gate fields ---
  gateId: z.string().optional().describe('Gate ID to archive e.g. "gate-01" (gate action)'),

  // --- proposal fields ---
  proposalHash: z
    .string()
    .optional()
    .describe('Proposal hash to archive (proposal action, if added in future)'),

  completionNotes: z.string().optional().describe('Summary notes for the archive (gate/batch)'),

  // --- batch fields ---
  artifacts: z
    .array(
      z.union([
        z.object({
          type: z.literal('gate').describe('Archive a gate'),
          gateId: z.string().describe('Gate ID to archive'),
        }),
        z.object({
          type: z.literal('proposal').describe('Archive a proposal'),
          proposalHash: z.string().describe('Proposal hash to archive'),
        }),
      ])
    )
    .optional()
    .describe('Array of artifacts to archive (batch action): {type: "gate"|"proposal", gateId|proposalHash}'),
})

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
export function getArchiveActionOutputSchema(action: string): z.ZodType {
  switch (action) {
    case 'gate':
      return ArchiveGateOutputSchema
    case 'batch':
      return ArchiveBatchOutputSchema
    default:
      return z.unknown()
  }
}
