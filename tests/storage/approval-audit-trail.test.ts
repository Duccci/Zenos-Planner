import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { ApprovalAuditTrail, type ApprovalEvent } from '../../src/storage/approval-audit-trail.js'

describe('ApprovalAuditTrail', () => {
  let db: Database.Database
  let auditTrail: ApprovalAuditTrail

  beforeEach(() => {
    db = new Database(':memory:')

    // Initialize the database schema to match the actual schema.sql
    db.exec(`
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
      )
    `)

    auditTrail = new ApprovalAuditTrail(db)
  })

  describe('record()', () => {
    it('should insert an approval event with all required fields', () => {
      const event: ApprovalEvent = {
        proposal_hash: 'abc123def456',
        decision: 'approved',
        actor: 'alice@example.com',
        timestamp: new Date().toISOString(),
      }

      auditTrail.record(event)

      const rows = db
        .prepare('SELECT * FROM approval_events WHERE proposal_hash = ?')
        .all('abc123def456') as ApprovalEvent[]

      expect(rows).toHaveLength(1)
      expect(rows[0].proposal_hash).toBe('abc123def456')
      expect(rows[0].decision).toBe('approved')
      expect(rows[0].actor).toBe('alice@example.com')
    })

    it('should insert a rejection event with category', () => {
      const event: ApprovalEvent = {
        proposal_hash: 'xyz789',
        decision: 'rejected',
        actor: 'bob@example.com',
        reason: 'Quality thresholds not met',
        rejection_category: 'quality',
        timestamp: new Date().toISOString(),
      }

      auditTrail.record(event)

      const rows = db
        .prepare('SELECT * FROM approval_events WHERE proposal_hash = ?')
        .all('xyz789') as ApprovalEvent[]

      expect(rows).toHaveLength(1)
      expect(rows[0].decision).toBe('rejected')
      expect(rows[0].rejection_category).toBe('quality')
      expect(rows[0].reason).toBe('Quality thresholds not met')
    })

    it('should reject invalid rejection category', () => {
      const event: ApprovalEvent = {
        proposal_hash: 'invalid123',
        decision: 'rejected',
        actor: 'zeno',
        rejection_category: 'invalid_category' as unknown as string,
        timestamp: new Date().toISOString(),
      }

      expect(() => {
        auditTrail.record(event)
      }).toThrow()
    })

    it('should validate all five rejection categories', () => {
      const categories = ['quality', 'scope', 'design', 'incomplete']

      categories.forEach((cat) => {
        const event: ApprovalEvent = {
          proposal_hash: `prop-${cat}`,
          decision: 'rejected',
          actor: 'zeno',
          rejection_category: cat,
          timestamp: new Date().toISOString(),
        }

        auditTrail.record(event)

        const rows = db
          .prepare('SELECT * FROM approval_events WHERE rejection_category = ?')
          .all(cat) as ApprovalEvent[]

        expect(rows.length).toBeGreaterThan(0)
        expect(rows[rows.length - 1].rejection_category).toBe(cat)
      })
    })
  })

  describe('getHistory()', () => {
    it('should return an array of events for a proposal hash', () => {
      const proposalHash = 'history-test'
      const now = new Date()

      const event1: ApprovalEvent = {
        proposal_hash: proposalHash,
        decision: 'approved',
        actor: 'alice',
        timestamp: new Date(now.getTime()).toISOString(),
      }

      const event2: ApprovalEvent = {
        proposal_hash: proposalHash,
        decision: 'rejected',
        actor: 'bob',
        reason: 'Needs revision',
        timestamp: new Date(now.getTime() + 1000).toISOString(),
      }

      auditTrail.record(event1)
      auditTrail.record(event2)

      const history = auditTrail.getHistory(proposalHash)

      expect(history).toHaveLength(2)
      expect(history[0].decision).toBe('approved')
      expect(history[1].decision).toBe('rejected')
    })

    it('should return empty array for proposal with no events', () => {
      const history = auditTrail.getHistory('nonexistent-proposal')

      expect(history).toEqual([])
    })

    it('should return events in chronological order', () => {
      const proposalHash = 'chronological-test'
      const baseTime = new Date().getTime()

      const events = [
        { proposal_hash: proposalHash, decision: 'approved' as const, actor: 'alice', timestamp: new Date(baseTime).toISOString() },
        { proposal_hash: proposalHash, decision: 'rejected' as const, actor: 'bob', timestamp: new Date(baseTime + 2000).toISOString() },
        { proposal_hash: proposalHash, decision: 'approved' as const, actor: 'charlie', timestamp: new Date(baseTime + 1000).toISOString() },
      ]

      // Record out of order
      auditTrail.record(events[0])
      auditTrail.record(events[1])
      auditTrail.record(events[2])

      const history = auditTrail.getHistory(proposalHash)

      expect(history).toHaveLength(3)
      expect(history[0].actor).toBe('alice')
      expect(history[1].actor).toBe('charlie')
      expect(history[2].actor).toBe('bob')
    })
  })

  describe('getLatestDecision()', () => {
    it('should return the most recent event for a proposal', () => {
      const proposalHash = 'latest-test'
      const now = new Date()

      const event1: ApprovalEvent = {
        proposal_hash: proposalHash,
        decision: 'approved',
        actor: 'alice',
        timestamp: new Date(now.getTime()).toISOString(),
      }

      const event2: ApprovalEvent = {
        proposal_hash: proposalHash,
        decision: 'rejected',
        actor: 'bob',
        timestamp: new Date(now.getTime() + 1000).toISOString(),
      }

      auditTrail.record(event1)
      auditTrail.record(event2)

      const latest = auditTrail.getLatestDecision(proposalHash)

      expect(latest).toBeDefined()
      expect(latest?.decision).toBe('rejected')
      expect(latest?.actor).toBe('bob')
    })

    it('should return undefined for proposal with no events', () => {
      const latest = auditTrail.getLatestDecision('nonexistent-proposal')

      expect(latest).toBeUndefined()
    })

    it('should return the only event if one exists', () => {
      const proposalHash = 'single-event'

      const event: ApprovalEvent = {
        proposal_hash: proposalHash,
        decision: 'approved',
        actor: 'alice',
        timestamp: new Date().toISOString(),
      }

      auditTrail.record(event)

      const latest = auditTrail.getLatestDecision(proposalHash)

      expect(latest).toBeDefined()
      expect(latest?.decision).toBe('approved')
      expect(latest?.actor).toBe('alice')
    })
  })

  describe('rejection categories', () => {
    it('should accept quality category', () => {
      const event: ApprovalEvent = {
        proposal_hash: 'quality-test',
        decision: 'rejected',
        actor: 'zeno',
        rejection_category: 'quality',
        timestamp: new Date().toISOString(),
      }
      expect(() => auditTrail.record(event)).not.toThrow()
    })

    it('should accept scope category', () => {
      const event: ApprovalEvent = {
        proposal_hash: 'scope-test',
        decision: 'rejected',
        actor: 'zeno',
        rejection_category: 'scope',
        timestamp: new Date().toISOString(),
      }
      expect(() => auditTrail.record(event)).not.toThrow()
    })

    it('should accept design category', () => {
      const event: ApprovalEvent = {
        proposal_hash: 'design-test',
        decision: 'rejected',
        actor: 'zeno',
        rejection_category: 'design',
        timestamp: new Date().toISOString(),
      }
      expect(() => auditTrail.record(event)).not.toThrow()
    })

    it('should accept incomplete category', () => {
      const event: ApprovalEvent = {
        proposal_hash: 'incomplete-test',
        decision: 'rejected',
        actor: 'zeno',
        rejection_category: 'incomplete',
        timestamp: new Date().toISOString(),
      }
      expect(() => auditTrail.record(event)).not.toThrow()
    })

    it('should accept null category', () => {
      const event: ApprovalEvent = {
        proposal_hash: 'other-test',
        decision: 'rejected',
        actor: 'zeno',
        rejection_category: null,
        timestamp: new Date().toISOString(),
      }
      expect(() => auditTrail.record(event)).not.toThrow()
    })
  })
})
