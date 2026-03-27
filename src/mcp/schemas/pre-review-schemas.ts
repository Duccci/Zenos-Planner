/**
 * Pre-Review Schemas
 *
 * Unified schema for agent-reported pre-work review evidence.
 * Required on `proposal_action: start`, `proposal_action: generate`,
 * and `gates_action: generate` to enforce that the agent has performed
 * the mandatory pre-checks documented in SKILL.md before invoking these actions.
 *
 * The `phase` discriminator selects apply-specific vs generate-specific fields.
 * G1↔G5, G3↔G7, and G4↔G8 share the same underlying checks across phases —
 * collapsing them into one schema removes duplication.
 *
 * Reference: guardrails G1–G9 (structured preconditions from 2026-02-24-02 proposal)
 */

import { z } from 'zod'

/**
 * Unified pre-review evidence schema.
 *
 * **phase: 'apply'** fields (proposal_action: start):
 *   - openQuestionsResolved  — agent confirms open questions have been resolved (G1)
 *   - questionsFound         — list of questions found; must be empty if openQuestionsResolved=true (G1)
 *   - filesVerified          — agent confirms all Files Affected exist or are marked new (G2)
 *   - assumptionsDocumented  — list of implicit assumptions the agent identified (G3); empty array = none found
 *   - blockersIdentified     — list of incomplete dependency blockers (G4); empty array = no blockers
 *   (gateReviewed and requirementsVerified/vagueRequirements are not applicable in apply phase)
 *
 * **phase: 'generate'** fields (proposal_action: generate, gates_action: generate):
 *   - openQuestionsResolved  — agent confirms open questions have been resolved (G5)
 *   - questionsFound         — list of questions found (G5)
 *   - gateReviewed           — agent confirms the full Gate PRD has been read (G5)
 *   - requirementsVerified   — agent confirms all requirements are complete and unambiguous (G6)
 *   - vagueRequirements      — list of vague requirements identified (G6); empty array = none found
 *   - assumptionsDocumented  — list of implicit assumptions identified (G7); empty array = none found
 *   - blockersIdentified     — list of incomplete gate dependency blockers (G8); empty array = no blockers
 *   (filesVerified is not applicable in generate phase)
 */
export const PreReviewSchema = z
  .object({
    /**
     * Workflow phase this review was performed for.
     * 'apply' = proposal start (SKILL.md Pre-Apply guardrails G1–G4)
     * 'generate' = gate/proposal generation (SKILL.md Pre-Gen guardrails G5–G8)
     */
    phase: z.enum(['apply', 'generate']).describe("Workflow phase: 'apply' for start, 'generate' for generation actions"),

    /**
     * G1 / G5: True if agent reviewed the proposal/PRD and all open questions
     * have been resolved or explicitly handled (stubbed, deferred with documented rationale).
     *
     * In generate phase: set true even when questionsFound is non-empty — those entries
     * document the resolved/handled questions for traceability and to prevent hallucinations.
     * In apply phase: questionsFound must be empty when this is true.
     */
    openQuestionsResolved: z
      .boolean()
      .describe(
        'True if all open questions have been resolved or explicitly handled. ' +
        'In generate phase, questionsFound may still list resolved items for traceability.'
      ),

    /**
     * G1 / G5: Open questions, unclear requirements, or contradictory statements found.
     *
     * In generate phase: document ALL questions found — including resolved ones — for
     * traceability and to surface context that prevents hallucinations. Non-empty is
     * allowed (and encouraged) when openQuestionsResolved=true.
     * In apply phase: must be empty when openQuestionsResolved=true.
     */
    questionsFound: z
      .array(z.string())
      .describe(
        'Questions found during review. In generate phase, document resolved questions for traceability. ' +
        'In apply phase, must be empty when openQuestionsResolved=true.'
      ),

    /**
     * G2 (apply phase only): True if all entries in Files Affected were verified
     * to exist (or explicitly marked as new files).
     * Required when phase === 'apply'; ignored for 'generate'.
     */
    filesVerified: z
      .boolean()
      .optional()
      .describe("(apply phase) True if all Files Affected entries were verified to exist or are new files"),

    /**
     * G5 / generate phase only: True if the agent read the full Gate PRD before generating.
     * Required when phase === 'generate'; ignored for 'apply'.
     */
    gateReviewed: z
      .boolean()
      .optional()
      .describe("(generate phase) True if the full Gate PRD has been read"),

    /**
     * G6 (generate phase only): True if all requirements are complete and unambiguous.
     * Required when phase === 'generate'; ignored for 'apply'.
     */
    requirementsVerified: z
      .boolean()
      .optional()
      .describe("(generate phase) True if all requirements are complete and unambiguous"),

    /**
     * G6 (generate phase only): Vague or incomplete requirements identified.
     *
     * Must be empty when requirementsVerified=true. If vague requirements remain,
     * set requirementsVerified=false and list them here.
     */
    vagueRequirements: z
      .array(z.string())
      .optional()
      .describe(
        '(generate phase) Vague requirements found; must be empty when requirementsVerified=true.'
      ),

    /**
     * G3 / G7: Implicit assumptions the agent identified in the proposal/PRD.
     * Empty array means no assumptions found.
     */
    assumptionsDocumented: z
      .array(z.string())
      .describe('Implicit assumptions identified; empty array if none found'),

    /**
     * G4 / G8: Incomplete dependency blockers found in the Dependencies table.
     * Non-blocking — returns a warning, not an error. Empty array = no blockers.
     */
    blockersIdentified: z
      .array(z.string())
      .describe('Incomplete blockers from Dependencies table; empty array if none found'),
  })
  .superRefine((data, ctx) => {
    // G1 (apply phase only): openQuestionsResolved=true requires questionsFound to be empty.
    // In generate phase, questionsFound may document resolved questions for traceability.
    if (data.phase === 'apply' && data.openQuestionsResolved && data.questionsFound.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['questionsFound'],
        message:
          'questionsFound must be empty when openQuestionsResolved is true in apply phase. ' +
          'Resolve all open questions before starting implementation.',
      })
    }

    if (data.phase === 'apply') {
      // G2: filesVerified required in apply phase
      if (data.filesVerified !== true && data.filesVerified !== false) {
        ctx.addIssue({
          code: 'custom',
          path: ['filesVerified'],
          message: 'filesVerified is required in apply phase. Verify all Files Affected entries exist.',
        })
      }
    }

    if (data.phase === 'generate') {
      // G5: gateReviewed required in generate phase
      if (data.gateReviewed !== true && data.gateReviewed !== false) {
        ctx.addIssue({
          code: 'custom',
          path: ['gateReviewed'],
          message: 'gateReviewed is required in generate phase. Read the full Gate PRD before generating.',
        })
      }

      // G6: requirementsVerified required in generate phase
      if (data.requirementsVerified !== true && data.requirementsVerified !== false) {
        ctx.addIssue({
          code: 'custom',
          path: ['requirementsVerified'],
          message: 'requirementsVerified is required in generate phase.',
        })
      }

      // G6: requirementsVerified=true requires vagueRequirements to be empty.
      // If requirements are truly verified as complete, there should be no vague ones.
      if (data.requirementsVerified === true && data.vagueRequirements && data.vagueRequirements.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['vagueRequirements'],
          message:
            'vagueRequirements must be empty when requirementsVerified is true. ' +
            'Set requirementsVerified=false if vague requirements remain.',
        })
      }
    }
  })

export type PreReview = z.infer<typeof PreReviewSchema>

/**
 * Scope expansion documentation schema.
 *
 * G9: When a task requires additional files beyond the proposal's declared
 * Files Affected, the agent must provide structured justification rather
 * than silently modifying out-of-scope files.
 *
 * Required in `proposal_action: progress` when files outside filesAffected are modified.
 */
export const ScopeExpansionSchema = z.object({
  /**
   * Explicit file paths that need to be added to scope.
   * Must be explicit paths — no wildcards or directory references.
   */
  filesAdded: z.array(z.string()).describe('Explicit file paths being added to scope'),

  /**
   * Human-readable justification explaining why scope expansion is needed.
   */
  justification: z.string().min(1).describe('Reason why these files need to be added to scope'),
})

export type ScopeExpansion = z.infer<typeof ScopeExpansionSchema>

/**
 * Echo of pre-review values surfaced in successful tool responses.
 *
 * The handler echoes back agent-reported values so the user can verify
 * the agent actually performed the checks (mitigates the "agent can lie" risk).
 * See Notes section of proposal 2026-02-24-02.
 */
export const PreReviewSummarySchema = z.object({
  phase: z.enum(['apply', 'generate']),
  openQuestionsResolved: z.boolean(),
  questionsFound: z.array(z.string()),
  filesVerified: z.boolean().optional(),
  gateReviewed: z.boolean().optional(),
  requirementsVerified: z.boolean().optional(),
  vagueRequirements: z.array(z.string()).optional(),
  assumptionsDocumented: z.array(z.string()),
  blockersIdentified: z.array(z.string()),
})

export type PreReviewSummary = z.infer<typeof PreReviewSummarySchema>
