/**
 * Requirement Relevance Validator
 *
 * Validates that the requirement linked to a proposal is actually relevant to
 * the work the proposal describes.  Two checks are performed:
 *
 *   1. Gate alignment  – the requirement must belong to the same gate as the
 *      proposal (or be a project-level requirement with no gate association).
 *      A requirement from a different gate cannot be the basis for work in
 *      this gate; link it to something in the correct scope.
 *
 *   2. Agent review item – the validator always surfaces a targeted question
 *      that the calling LLM must evaluate using its own judgment:
 *      "Does the requirement's description match what this proposal actually
 *       implements?"  Mechanical keyword matching is intentionally omitted —
 *      the LLM is in a far better position to assess semantic alignment than
 *      any heuristic this validator could apply.
 */

import type { ValidationResult } from './types.js'
export type { ValidationResult }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkedRequirement {
  /** Content-addressable hash (full or partial) */
  hash: string
  /** Primary key in the requirements table (human-readable id) */
  id: string
  /** Gate the requirement belongs to, or null for project-level requirements */
  gate_id: string | null
  /** Full requirement description text */
  description: string
}

export interface RequirementRelevanceContext {
  /** Hash of the proposal being validated */
  proposalHash: string
  /**
   * Gate the proposal belongs to.
   * undefined for solitary proposals.
   */
  proposalGateId: string | undefined
  /** true when the proposal is not tied to any gate */
  isSolitary: boolean
  /** The resolved requirement row that has been linked to this proposal */
  requirement: LinkedRequirement
  /**
   * Optional proposal narrative used to generate a richer agentReview prompt.
   * Falls back to a generic prompt when absent.
   */
  proposalSummary?: string
  /**
   * Task titles / descriptions extracted from the proposal.
   * Helps the LLM evaluator understand the breadth of work covered.
   */
  proposalTaskDescriptions?: string[]
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate that the requirement linked to a proposal is relevant to its work.
 *
 * Never throws — returns `allowed: false` with errors on hard violations,
 * or `allowed: true` with an agentReview item when only qualitative judgment
 * is needed.
 */
export function validateRequirementRelevance(
  ctx: RequirementRelevanceContext
): ValidationResult {
  const errors: string[] = []
  const agentReview: string[] = []

  const { requirement, proposalGateId, isSolitary } = ctx

  // ── Check 1: Gate alignment ──────────────────────────────────────────────
  // A project-level requirement (gate_id = null) is valid for any proposal.
  // A gate-scoped requirement must belong to the same gate as the proposal.
  if (
    !isSolitary &&
    proposalGateId !== undefined &&
    requirement.gate_id !== null &&
    requirement.gate_id !== proposalGateId
  ) {
    errors.push(
      `Requirement "${requirement.id}" (#${requirement.hash.slice(0, 8)}) belongs to ` +
        `gate "${requirement.gate_id}" but this proposal is in gate "${proposalGateId}". ` +
        `Link a requirement that belongs to the same gate, or use a project-level ` +
        `requirement (one not associated with any gate) for cross-cutting concerns.`
    )
  }

  // ── Check 2: Agent review — semantic relevance ───────────────────────────
  // The LLM must confirm that the requirement's intent actually maps to what
  // the proposal implements.  We surface a targeted question rather than
  // attempting fragile keyword matching.
  const reqLabel = requirement.id || requirement.hash.slice(0, 12)
  const descSnippet = requirement.description.length > 140
    ? `${requirement.description.slice(0, 140).replace(/\n/g, ' ').trimEnd()}…`
    : requirement.description.replace(/\n/g, ' ')

  const taskContext =
    ctx.proposalTaskDescriptions && ctx.proposalTaskDescriptions.length > 0
      ? ` The proposal covers tasks: ${ctx.proposalTaskDescriptions.slice(0, 3).map((t) => `"${t.slice(0, 60)}"`).join(', ')}.`
      : ctx.proposalSummary
        ? ` The proposal summary is: "${ctx.proposalSummary.slice(0, 120).replace(/\n/g, ' ')}".`
        : ''

  agentReview.push(
    `Confirm that requirement "${reqLabel}" (#${requirement.hash.slice(0, 8)}) is semantically ` +
      `relevant to this proposal's implementation scope.` +
      ` Requirement: "${descSnippet}".` +
      taskContext +
      ` If the proposal's work does not directly implement or contribute to fulfilling this` +
      ` requirement, update the **Requirement** header in the proposal file to reference the` +
      ` correct requirement hash before approving.`
  )

  return {
    allowed: errors.length === 0,
    ...(errors.length > 0 ? { errors } : {}),
    agentReview,
  }
}
