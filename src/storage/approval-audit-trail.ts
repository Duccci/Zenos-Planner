/**
 * Approval Audit Trail Storage
 *
 * Records and retrieves approval/rejection events for proposals.
 * Provides durable audit history accessible via proposal_action:show.
 */

import type Database from 'better-sqlite3'

/**
 * Represents a single approval or rejection event.
 * Maps directly to approval_events table columns.
 */
export interface ApprovalEvent {
  id?: number
  proposal_hash: string
  decision: 'approved' | 'rejected'
  actor: string
  reason?: string | null
  rejection_category?: string | null
  timestamp: string
}

/**
 * ApprovalAuditTrail — Record and retrieve approval/rejection decisions
 *
 * Provides three main methods:
 * - record(event): INSERT into approval_events
 * - getHistory(proposalHash): SELECT all events for a proposal (ascending timestamp)
 * - getLatestDecision(proposalHash): SELECT most recent event for a proposal
 *
 * Uses prepared statements for all queries to prevent SQL injection.
 */
export class ApprovalAuditTrail {
  private recordStmt: Database.Statement
  private getHistoryStmt: Database.Statement
  private getLatestDecisionStmt: Database.Statement

  constructor(db: Database.Database) {
    // Prepare statements for reuse (better performance and safety)
    this.recordStmt = db.prepare(
      `INSERT INTO approval_events
       (proposal_hash, decision, actor, reason, rejection_category, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    )

    this.getHistoryStmt = db.prepare(
      `SELECT id, proposal_hash, decision, actor, reason, rejection_category, timestamp
       FROM approval_events
       WHERE proposal_hash = ?
       ORDER BY timestamp ASC`
    )

    this.getLatestDecisionStmt = db.prepare(
      `SELECT id, proposal_hash, decision, actor, reason, rejection_category, timestamp
       FROM approval_events
       WHERE proposal_hash = ?
       ORDER BY timestamp DESC
       LIMIT 1`
    )
  }

  /**
   * Record an approval or rejection event.
   * Validates rejection_category if provided.
   * @param event The approval event to record
   * @throws Error if rejection_category is invalid
   */
  record(event: ApprovalEvent): void {
    // Validate rejection_category if provided and not null
    const validCategories = ['quality', 'scope', 'design', 'incomplete']
    if (event.rejection_category !== null && event.rejection_category !== undefined) {
      if (!validCategories.includes(event.rejection_category)) {
        throw new Error(
          `Invalid rejection_category: "${event.rejection_category}". Valid values are: ${validCategories.join(', ')}`
        )
      }
    }

    this.recordStmt.run(
      event.proposal_hash,
      event.decision,
      event.actor,
      event.reason ?? null,
      event.rejection_category ?? null,
      event.timestamp
    )
  }

  /**
   * Retrieve all approval events for a proposal in chronological order.
   * @param proposalHash The proposal hash to query
   * @returns Array of approval events (empty if none exist)
   */
  getHistory(proposalHash: string): ApprovalEvent[] {
    const rows = this.getHistoryStmt.all(proposalHash) as ApprovalEvent[]
    return rows
  }

  /**
   * Retrieve the most recent approval event for a proposal.
   * @param proposalHash The proposal hash to query
   * @returns The latest event, or undefined if no events exist
   */
  getLatestDecision(proposalHash: string): ApprovalEvent | undefined {
    const row = this.getLatestDecisionStmt.get(proposalHash) as ApprovalEvent | undefined
    return row
  }
}
