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
} /* c8 ignore end */
