/**
 * Doctor command types
 *
 * Shared types for the `zeno doctor` diagnostic command.
 */

/** Status of a single diagnostic check */
export type DoctorCheckStatus = 'ok' | 'warn' | 'fail'

/** Result of a single diagnostic check */
export interface DoctorCheckResult {
  /** Stable identifier for this check (snake_case) */
  id: string
  /** Human-readable label for table display */
  label: string
  /** Outcome of the check */
  status: DoctorCheckStatus
  /** Short description of the current state */
  detail: string
  /** Remediation instructions when status is warn or fail; null on ok */
  fix: string | null
}

/** Aggregated report returned by the runner */
export interface DoctorReport {
  passed: number
  warned: number
  failed: number
  checks: DoctorCheckResult[]
}
