/**
 * Artifact Validation Service
 *
 * Provides a unified interface for comprehensive artifact validation.
 * Delegates to the unified artifact validator for format and structure checks.
 *
 * *** IMPORTANT: Structure validation is MANDATORY ***
 * Structure validation cannot be disabled. ValidationMode parameters are
 * deprecated and ignored; all validations include both format and structure.
 *
 * Used by CLI and MCP handlers for comprehensive artifact validation.
 */
import { validateArtifactFile } from '../mcp/validators/artifact-validator.js'

export type ArtifactType = 'gate' | 'proposal' | 'architecture'

/**
 * DEPRECATED: ValidationMode is maintained for backward compatibility only.
 * Structure validation is now MANDATORY and cannot be disabled.
 *
 * @deprecated All validations now enforce structure validation
 */

export type ValidationMode = 'format' | 'structure' | 'all'

export interface ValidationInput {
  artifactPath?: string
  artifactHash?: string
  artifactType: ArtifactType
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  validationMode?: ValidationMode
  /** For proposals: gate ID if gate-tied */
  gateId?: string
  /** For proposals: all proposals in the same gate (for test-first pattern) */
  gateProposals?: { hash: string; role?: string; createdAt: string }[]
}

export interface ValidationResult {
  passed: boolean
  errors?: string[]
  warnings?: string[]
  details?: unknown
}

export class ArtifactValidationService {
  async validate(input: ValidationInput): Promise<ValidationResult> {
    if (!input.artifactPath) {
      return {
        passed: false,
        errors: ['artifactPath is required for validation'],
      }
    }

    // Delegate to unified artifact validator
    const result = await validateArtifactFile(
      input.artifactPath,
      input.artifactType,
      input.validationMode,
      {
        gateId: input.gateId,
        gateProposals: input.gateProposals,
      }
    )

    // Convert ValidationResult to ValidationInput format (allowed → passed)
    return {
      passed: result.allowed,
      errors: result.errors,
      warnings: result.warnings,
    }
  }
}
