/**
 * Canonical State Transition Maps
 *
 * Single source of truth for valid status transitions across gate and proposal
 * workflows. Both CLI and MCP tools import from here to ensure consistency and
 * prevent the transition-map drift that previously existed between the two layers.
 */

// ─── Gate transitions ─────────────────────────────────────────────────────────

/** All valid gate statuses */
export type GateStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'backlog'

/**
 * Full gate state transition map.
 *
 * pending    → in_progress
 * in_progress → completed | rejected | cancelled | backlog
 * rejected   → in_progress  (resume rejected gates directly as in_progress)
 * backlog    → in_progress
 * completed  → (terminal)
 * cancelled  → (terminal)
 */
export const GATE_TRANSITIONS: Partial<Record<GateStatus, GateStatus[]>> = {
  pending: ['in_progress'],
  in_progress: ['completed', 'rejected', 'cancelled', 'backlog'],
  rejected: ['in_progress'],
  completed: [],
  cancelled: [],
  backlog: ['in_progress'],
}

// ─── Proposal transitions ─────────────────────────────────────────────────────

/** All valid proposal statuses */
export type ProposalStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'backlog'
  | 'archived'

/**
 * Full proposal state transition map.
 *
 * pending    → in_progress | cancelled | backlog
 * in_progress → completed | rejected | cancelled | backlog
 * rejected   → pending    (proposals reset to pending for rework, unlike gates)
 * backlog    → pending
 * completed  → (terminal)
 * cancelled  → (terminal)
 * archived   → (terminal)
 */
export const PROPOSAL_TRANSITIONS: Partial<Record<ProposalStatus, ProposalStatus[]>> = {
  pending: ['in_progress', 'cancelled', 'backlog'],
  in_progress: ['completed', 'rejected', 'cancelled', 'backlog'],
  rejected: ['pending'],
  completed: [],
  cancelled: [],
  backlog: ['pending'],
  archived: [],
}

// ─── Shared helper ─────────────────────────────────────────────────────────────

/**
 * Validate that a status transition is permitted.
 *
 * @param transitionMap - The entity's full transition map
 * @param current       - Current status of the entity
 * @param target        - Desired target status
 * @returns `{ valid: true }` when permitted; `{ valid: false, error }` otherwise
 */
export function validateTransition<TStatus extends string>(
  transitionMap: Partial<Record<TStatus, TStatus[]>>,
  current: TStatus,
  target: TStatus
): { valid: boolean; error?: string } {
  const validTargets = transitionMap[current] ?? []
  if ((validTargets as string[]).includes(target)) {
    return { valid: true }
  }
  const validTargetsMsg = validTargets.length > 0 ? (validTargets as string[]).join(', ') : 'none'
  return {
    valid: false,
    error: `Cannot transition from ${current} to ${target}. Valid transitions from ${current}: ${validTargetsMsg}`,
  }
}
