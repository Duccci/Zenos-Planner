/**
 * Shared types for all Zeno validators.
 *
 * Centralizes the ValidationResult interface so every validator
 * returns a structurally identical result without re-declaring the type.
 */

/* c8 ignore start */
export interface ValidationResult {
  /** Whether validation passed (no blocking errors) */
  allowed: boolean
  /** Blocking errors that prevent proceeding */
  errors?: string[]
  /** Non-blocking warnings for informational purposes */
  warnings?: string[]
  /**
   * Implementation quality score 0–100.
   * Present when section-implementation validation ran.
   * 100 = fully implemented; 0 = empty / all placeholders unchanged.
   */
  score?: number
  /**
   * Agent-directed review items that require LLM judgment.
   *
   * These are targeted questions the calling agent MUST evaluate and affirm
   * using its own understanding of the content.  Heuristics and parsers cannot
   * answer them — they exist specifically to catch issues that mechanical
   * checks miss (intent misalignment, implicit omissions, logical gaps).
   *
   * The validate workflow is not complete until every item here has been
   * reviewed by the agent.  A mechanical `passed: true` result does NOT
   * exempt the agent from performing this review.
   */
  agentReview?: string[]
} /* c8 ignore end */
