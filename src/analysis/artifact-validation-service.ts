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

export interface ValidationInput {
  artifactPath?: string
  artifactHash?: string
  artifactType: ArtifactType
  /** For proposals: gate ID if gate-tied */
  gateId?: string
  /** For proposals: all proposals in the same gate (for test-first pattern) */
  gateProposals?: { hash: string; role?: string; createdAt: string }[]
}

export interface ValidationResult {
  passed: boolean
  errors?: string[]
  warnings?: string[]
  /**
   * Implementation quality score 0–100.
   * Present when section-implementation validation ran.
   */
  score?: number
  details?: unknown
  /**
   * Agent-directed review items that require LLM judgment.
   * Present when qualitative checks produced review prompts.
   * The calling agent must evaluate every item — mechanical validation
   * does not substitute for this review.
   */
  agentReview?: string[]
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
      {
        gateId: input.gateId,
        gateProposals: input.gateProposals,
      }
    )

    // Convert ValidationResult to ValidationInput format (allowed → passed)
    const resultWithExtras = result as typeof result & { sectionScores?: unknown }
    return {
      passed: result.allowed,
      errors: result.errors,
      warnings: result.warnings,
      ...(result.score !== undefined ? { score: result.score } : {}),
      ...(resultWithExtras.sectionScores !== undefined
        ? { details: { sectionScores: resultWithExtras.sectionScores } }
        : {}),
      ...(result.agentReview !== undefined ? { agentReview: result.agentReview } : {}),
    }
  }
}
