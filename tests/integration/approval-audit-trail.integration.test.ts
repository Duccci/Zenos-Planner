import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { ApprovalAuditTrail, type ApprovalEvent } from '../../src/storage/approval-audit-trail.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS approval_events (
    id                    INTEGER   PRIMARY KEY AUTOINCREMENT,
    proposal_hash         TEXT      NOT NULL,
    decision              TEXT      NOT NULL
      CHECK (decision IN ('approved', 'rejected')),
    actor                 TEXT      NOT NULL DEFAULT 'zeno',
    reason                TEXT,
    rejection_category    TEXT
      CHECK (rejection_category IN ('quality', 'scope', 'design', 'incomplete', NULL)),
    timestamp             TEXT      NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_approval_events_proposal_hash
    ON approval_events(proposal_hash);
  CREATE INDEX IF NOT EXISTS idx_approval_events_decision_ts
    ON approval_events(decision, timestamp);
`

function makeEvent(overrides: Partial<ApprovalEvent> = {}): ApprovalEvent {
  return {
    proposal_hash: 'test-hash-001',
    decision: 'approved',
    actor: 'alice@example.com',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('ApprovalAuditTrail (integration)', () => {
  let db: Database.Database
  let trail: ApprovalAuditTrail

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(SCHEMA)
    trail = new ApprovalAuditTrail(db)
  })

  // ─── record() ──────────────────────────────────────────────────────────────

  describe('record()', () => {
    it('inserts a row correctly with all required fields', () => {
      const event = makeEvent()

      trail.record(event)

      const rows = db
        .prepare('SELECT * FROM approval_events WHERE proposal_hash = ?')
        .all(event.proposal_hash) as ApprovalEvent[]

      expect(rows).toHaveLength(1)
      expect(rows[0].proposal_hash).toBe(event.proposal_hash)
      expect(rows[0].decision).toBe('approved')
      expect(rows[0].actor).toBe('alice@example.com')
    })

    it('inserts a rejection with reason and rejection_category', () => {
      const event = makeEvent({
        proposal_hash: 'rej-hash',
        decision: 'rejected',
        reason: 'Tests not passing',
        rejection_category: 'quality',
      })

      trail.record(event)

      const rows = db
        .prepare('SELECT * FROM approval_events WHERE proposal_hash = ?')
        .all('rej-hash') as ApprovalEvent[]

      expect(rows[0].rejection_category).toBe('quality')
      expect(rows[0].reason).toBe('Tests not passing')
    })

    it('rejects invalid rejection_category', () => {
      const event = makeEvent({ rejection_category: 'bogus' as any })

      expect(() => trail.record(event)).toThrow(/Invalid rejection_category/)
    })

    it('allows null rejection_category', () => {
      const event = makeEvent({ rejection_category: null })

      expect(() => trail.record(event)).not.toThrow()
    })
  })

  // ─── getHistory() ──────────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('returns all rows for a proposal in ascending timestamp order', () => {
      const hash = 'multi-hash'
      const t1 = '2026-01-01T00:00:00.000Z'
      const t2 = '2026-01-02T00:00:00.000Z'
      const t3 = '2026-01-03T00:00:00.000Z'

      trail.record(makeEvent({ proposal_hash: hash, timestamp: t3 }))
      trail.record(makeEvent({ proposal_hash: hash, timestamp: t1 }))
      trail.record(makeEvent({ proposal_hash: hash, timestamp: t2 }))

      const history = trail.getHistory(hash)

      expect(history).toHaveLength(3)
      expect(history[0].timestamp).toBe(t1)
      expect(history[1].timestamp).toBe(t2)
      expect(history[2].timestamp).toBe(t3)
    })

    it('returns empty array for unknown proposal hash', () => {
      expect(trail.getHistory('unknown-hash')).toEqual([])
    })

    it('returns only events for the queried proposal', () => {
      trail.record(makeEvent({ proposal_hash: 'p1' }))
      trail.record(makeEvent({ proposal_hash: 'p2' }))

      expect(trail.getHistory('p1')).toHaveLength(1)
      expect(trail.getHistory('p2')).toHaveLength(1)
    })
  })

  // ─── getLatestDecision() ───────────────────────────────────────────────────

  describe('getLatestDecision()', () => {
    it('returns undefined for unknown proposal hash', () => {
      expect(trail.getLatestDecision('no-such-hash')).toBeUndefined()
    })

    it('returns the most recent event when multiple exist', () => {
      const hash = 'latest-hash'
      const old = '2026-01-01T00:00:00.000Z'
      const recent = '2026-06-01T00:00:00.000Z'

      trail.record(makeEvent({ proposal_hash: hash, decision: 'rejected', timestamp: old }))
      trail.record(makeEvent({ proposal_hash: hash, decision: 'approved', timestamp: recent }))

      const latest = trail.getLatestDecision(hash)

      expect(latest).toBeDefined()
      expect(latest!.decision).toBe('approved')
      expect(latest!.timestamp).toBe(recent)
    })
  })
})
