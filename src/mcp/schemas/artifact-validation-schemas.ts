import { z } from 'zod'

/**
 * Zod schemas for artifact_validate MCP tool
 */

// ============================================================================
// INPUT SCHEMA
// ============================================================================

export const ArtifactTypeEnum = z.enum(['gate', 'proposal', 'architecture'])
export type ArtifactType = z.infer<typeof ArtifactTypeEnum>

export const ValidationModeEnum = z.enum(['format', 'structure', 'all'])
export type ValidationMode = z.infer<typeof ValidationModeEnum>

export const OutputFormatEnum = z.enum(['text', 'json'])
export type OutputFormat = z.infer<typeof OutputFormatEnum>

export const ArtifactValidateInputSchema = z.object({
  /** Path to the artifact file on disk */
  artifactPath: z.string().min(1).optional(),
  /** Hash reference (e.g. "02e2ad5d6ecd6f46") identifying the artifact */
  artifactHash: z
    .string()
    .regex(/^[a-z0-9]{16}$/, 'Artifact hash must be 16 lowercase alphanumeric characters')
    .optional(),
  /** Type of artifact being validated */
  artifactType: ArtifactTypeEnum,
  /** Validation depth: format-only, structure checks, or all checks */
  validationMode: ValidationModeEnum.default('format').optional(),
  /** Response format */
  outputFormat: OutputFormatEnum.default('text').optional(),
})
export type ArtifactValidateInput = z.infer<typeof ArtifactValidateInputSchema>

// ============================================================================
// OUTPUT SCHEMA
// ============================================================================

export const ArtifactValidateOutputSchema = z.object({
  passed: z.boolean(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  details: z.unknown().optional(),
})
export type ArtifactValidateOutput = z.infer<typeof ArtifactValidateOutputSchema>

// ============================================================================
// ERROR SCHEMAS
// ============================================================================

export const ArtifactValidationErrorSchema = z.object({
  code: z.literal('VALIDATION_ERROR'),
  message: z.string(),
  context: z.object({
    artifactType: ArtifactTypeEnum,
    artifactPath: z.string().optional(),
    artifactHash: z.string().optional(),
    issues: z.array(z.string()),
  }),
})
export type ArtifactValidationError = z.infer<typeof ArtifactValidationErrorSchema>

export const ArtifactNotFoundErrorSchema = z.object({
  code: z.literal('ARTIFACT_NOT_FOUND'),
  message: z.string(),
  context: z.object({
    artifactType: ArtifactTypeEnum,
    artifactPath: z.string().optional(),
    artifactHash: z.string().optional(),
  }),
})
export type ArtifactNotFoundError = z.infer<typeof ArtifactNotFoundErrorSchema>
