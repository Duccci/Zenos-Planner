/**
 * Pre-Review Validator — Generate Phase (G5–G8)
 *
 * Shared validation for the `preReview` object required on both
 * `gates_action: generate` and `proposal_action: generate`.
 *
 * Eliminates duplication between gate-tools.ts and proposal-tools.ts by
 * centralising the G5–G8 precondition checks in one place. The only
 * variation between the two call-sites is the error-message context text,
 * controlled via the `entityLabel` parameter.
 *
 * Apply-phase validation (G1–G4, `proposal_action: start`) is intentionally
 * separate — see `apply-phase-validator.ts`.
 */

import type { PreReview } from '../schemas/pre-review-schemas.js'
import type { ValidationResult } from './types.js'

// Re-export so callers can import both from a single location.
export type { PreReview }

/**
 * Validate a generate-phase `preReview` object against SKILL.md guardrails G5–G8.
 *
 * Called by:
 *  - `gates_action: generate`    → entityLabel = 'gates_action'
 *  - `proposal_action: generate` → entityLabel = 'proposal_action'
 *
 * @param pre         The preReview value extracted from the action payload (may be undefined).
 * @param entityLabel Used in error messages to identify which action triggered the check.
 * @param gateId      Optional gate ID; when provided for proposal_action, error message includes gateId-scoped reg_action hint.
 */
export function validatePreReviewGeneratePhase(
  pre: PreReview | undefined,
  entityLabel: 'gates_action' | 'proposal_action',
  gateId?: string
): ValidationResult {
  const isProposal = entityLabel === 'proposal_action'

  if (!pre) {
    const regActionHint = isProposal
      ? gateId
        ? `Read the Gate PRD for ${gateId}, then call reg_action { action: 'list', gateId: '${gateId}' } to see requirements prescribed for this gate, then re-call proposal_action:generate with preReview populated.`
        : `Read the Gate PRD, then call reg_action { action: 'list' } to see all project requirements, then re-call proposal_action:generate with preReview populated.`
      : `Call reg_action { action: 'list' } to see all project-level requirements, then re-call gates_action:generate with preReview populated.`

    const missingHint = isProposal
      ? 'Read the full Gate PRD and all requirements before generating (SKILL.md G5-G8).'
      : 'Read the full project PRD and requirements before generating gates (SKILL.md G5-G8).'

    return {
      allowed: false,
      errors: [
        `preReview is required for ${entityLabel}: generate. ` +
          'Provide preReview with phase="generate" and: ' +
          'openQuestionsResolved (bool), questionsFound (string[]), ' +
          'gateReviewed (bool), requirementsVerified (bool), vagueRequirements (string[]), ' +
          `assumptionsDocumented (string[]), blockersIdentified (string[]). ${missingHint}`,
      ],
      warnings: [regActionHint],
    }
  }

  const errors: string[] = []
  const warnings: string[] = []

  // G5: unresolved open questions
  if (!pre.openQuestionsResolved && pre.questionsFound.length > 0) {
    errors.push(
      `Unresolved open questions${isProposal ? ' in Gate PRD' : ''}. Resolve before generating: ` +
        pre.questionsFound.map((q) => `"${q}"`).join('; ')
    )
  }

  // G5: gate PRD / project requirements not reviewed
  if (pre.gateReviewed === false) {
    errors.push(
      isProposal
        ? 'gateReviewed is false. Read the full Gate PRD before generating proposals.'
        : 'gateReviewed is false. Read the full project requirements before generating gates.'
    )
  }

  // G6: vague or incomplete requirements
  if (
    pre.requirementsVerified === false &&
    pre.vagueRequirements &&
    pre.vagueRequirements.length > 0
  ) {
    errors.push(
      `${isProposal ? 'Vague or incomplete' : 'Vague'} requirements found. Clarify before generating: ` +
        pre.vagueRequirements.map((r) => `"${r}"`).join('; ')
    )
  }

  // G8: blockers — warning only, documenting is encouraged
  if (pre.blockersIdentified.length > 0) {
    const prefix = isProposal ? 'Gate dependency blockers: ' : 'Dependency blockers identified: '
    const suffix = isProposal ? '. Resolve before generating proposals.' : ''
    warnings.push(prefix + pre.blockersIdentified.map((b) => `"${b}"`).join('; ') + suffix)
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
