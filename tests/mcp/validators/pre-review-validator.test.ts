import { describe, it, expect } from 'vitest'
import { validatePreReviewGeneratePhase } from '../../../src/mcp/validators/pre-review-validator.js'

const basePreReview = {
  phase: 'generate' as const,
  openQuestionsResolved: true,
  questionsFound: [] as string[],
  gateReviewed: true,
  requirementsVerified: true,
  vagueRequirements: [] as string[],
  assumptionsDocumented: [] as string[],
  blockersIdentified: [] as string[],
}

describe('validatePreReviewGeneratePhase', () => {
  // ── Missing preReview ──────────────────────────────────────────────────────

  it('returns error when preReview is undefined for gates_action', () => {
    const result = validatePreReviewGeneratePhase(undefined, 'gates_action')
    expect(result.allowed).toBe(false)
    expect(result.errors?.[0]).toMatch(/prereview is required/i)
    // gate-specific hint in error text
    expect(result.errors?.[0]).toContain('G5-G8')
    // gate-specific guidance hint in warnings
    expect(result.warnings?.[0]).toMatch(/requirements/i)
  })

  it('returns error when preReview is undefined for proposal_action', () => {
    const result = validatePreReviewGeneratePhase(undefined, 'proposal_action')
    expect(result.allowed).toBe(false)
    expect(result.errors?.[0]).toMatch(/prereview is required/i)
    // proposal-specific hint in error text
    expect(result.errors?.[0]).toMatch(/Gate PRD/i)
    // proposal-specific guidance hint in warnings
    expect(result.warnings?.[0]).toMatch(/Gate PRD/i)
  })

  // ── G5: openQuestionsResolved=false ────────────────────────────────────────

  it('returns error for gates_action when openQuestionsResolved=false with questions', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, openQuestionsResolved: false, questionsFound: ['What is the scope?'] },
      'gates_action'
    )
    expect(result.allowed).toBe(false)
    // For gates_action (isProposal=false), no "in Gate PRD" suffix
    expect(result.errors?.[0]).toMatch(/Unresolved open questions\. Resolve/i)
    expect(result.errors?.[0]).not.toContain('in Gate PRD')
    expect(result.errors?.[0]).toContain('What is the scope?')
  })

  it('returns error for proposal_action when openQuestionsResolved=false with questions', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, openQuestionsResolved: false, questionsFound: ['Unclear requirement?'] },
      'proposal_action'
    )
    expect(result.allowed).toBe(false)
    // For proposal_action (isProposal=true), includes "in Gate PRD"
    expect(result.errors?.[0]).toContain('in Gate PRD')
    expect(result.errors?.[0]).toContain('Unclear requirement?')
  })

  it('does NOT add error when openQuestionsResolved=false but questionsFound is empty', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, openQuestionsResolved: false, questionsFound: [] },
      'proposal_action'
    )
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  // ── G5: gateReviewed=false ─────────────────────────────────────────────────

  it('returns error for gates_action when gateReviewed=false', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, gateReviewed: false },
      'gates_action'
    )
    expect(result.allowed).toBe(false)
    expect(result.errors?.[0]).toContain('gateReviewed is false')
    expect(result.errors?.[0]).toContain('project requirements')
  })

  it('returns error for proposal_action when gateReviewed=false', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, gateReviewed: false },
      'proposal_action'
    )
    expect(result.allowed).toBe(false)
    expect(result.errors?.[0]).toContain('gateReviewed is false')
    // proposal variant says "Gate PRD"
    expect(result.errors?.[0]).toContain('Gate PRD')
    expect(result.errors?.[0]).not.toContain('project requirements')
  })

  // ── G6: requirementsVerified=false ────────────────────────────────────────

  it('returns error for gates_action when requirementsVerified=false with vague requirements', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, requirementsVerified: false, vagueRequirements: ['Perf goal unclear'] },
      'gates_action'
    )
    expect(result.allowed).toBe(false)
    // gates_action: just "Vague", not "Vague or incomplete"
    expect(result.errors?.[0]).toMatch(/^Vague requirements/i)
    expect(result.errors?.[0]).not.toContain('or incomplete')
    expect(result.errors?.[0]).toContain('Perf goal unclear')
  })

  it('returns error for proposal_action when requirementsVerified=false with vague requirements', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, requirementsVerified: false, vagueRequirements: ['Auth spec missing'] },
      'proposal_action'
    )
    expect(result.allowed).toBe(false)
    // proposal_action: "Vague or incomplete"
    expect(result.errors?.[0]).toMatch(/Vague or incomplete/i)
    expect(result.errors?.[0]).toContain('Auth spec missing')
  })

  it('does NOT add error when requirementsVerified=false but vagueRequirements is empty', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, requirementsVerified: false, vagueRequirements: [] },
      'proposal_action'
    )
    expect(result.allowed).toBe(true)
  })

  it('does NOT add error when requirementsVerified=false and vagueRequirements is undefined', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, requirementsVerified: false, vagueRequirements: undefined },
      'proposal_action'
    )
    expect(result.allowed).toBe(true)
  })

  // ── G8: blockersIdentified ────────────────────────────────────────────────

  it('returns warning for gates_action when blockersIdentified is non-empty', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, blockersIdentified: ['Dependency on gate-02'] },
      'gates_action'
    )
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
    expect(result.warnings?.[0]).toContain('Dependency blockers identified:')
    expect(result.warnings?.[0]).toContain('Dependency on gate-02')
    // No trailing "Resolve..." suffix for gates_action
    expect(result.warnings?.[0]).not.toContain('Resolve before generating proposals')
  })

  it('returns warning for proposal_action when blockersIdentified is non-empty', () => {
    const result = validatePreReviewGeneratePhase(
      { ...basePreReview, blockersIdentified: ['Gate-01 not complete'] },
      'proposal_action'
    )
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
    expect(result.warnings?.[0]).toContain('Gate dependency blockers:')
    expect(result.warnings?.[0]).toContain('Gate-01 not complete')
    // proposal_action includes the "Resolve before generating proposals." suffix
    expect(result.warnings?.[0]).toContain('Resolve before generating proposals.')
  })

  // ── All-clear ─────────────────────────────────────────────────────────────

  it('returns allowed:true with no errors/warnings when all preconditions pass', () => {
    const result = validatePreReviewGeneratePhase(basePreReview, 'gates_action')
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
    expect(result.warnings).toBeUndefined()
  })

  it('returns allowed:true with no errors/warnings for proposal_action when all ok', () => {
    const result = validatePreReviewGeneratePhase(basePreReview, 'proposal_action')
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
    expect(result.warnings).toBeUndefined()
  })

  // ── Multiple errors accumulate ────────────────────────────────────────────

  it('accumulates multiple errors when several preconditions fail', () => {
    const result = validatePreReviewGeneratePhase(
      {
        ...basePreReview,
        openQuestionsResolved: false,
        questionsFound: ['Q1', 'Q2'],
        gateReviewed: false,
        requirementsVerified: false,
        vagueRequirements: ['Vague R1'],
        blockersIdentified: ['Blocker 1'],
      },
      'proposal_action'
    )
    expect(result.allowed).toBe(false)
    expect((result.errors ?? []).length).toBeGreaterThanOrEqual(3)
    expect((result.warnings ?? []).length).toBeGreaterThanOrEqual(1)
  })
})
