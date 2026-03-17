import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { RescopeEventStore, type RescopeEvent } from '../../src/storage/rescope-event-store.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rescope_events (
    id             INTEGER   PRIMARY KEY AUTOINCREMENT,
    gate_id        TEXT      NOT NULL,
    snapshot_before TEXT     NOT NULL,
    snapshot_after  TEXT     NOT NULL,
    actor          TEXT      NOT NULL,
    created_at     TEXT      NOT NULL
  );
`

function makeEvent(overrides: Partial<RescopeEvent> = {}): RescopeEvent {
  return {
    gate_id: 'gate-05',
    snapshot_before: JSON.stringify({ status: 'pending', objectives: ['obj-a'] }),
    snapshot_after: JSON.stringify({ status: 'pending', objectives: ['obj-a', 'obj-b'] }),
    actor: 'user@example.com',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('RescopeEventStore (integration)', () => {
  let db: Database.Database
  let store: RescopeEventStore

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(SCHEMA)
    store = new RescopeEventStore(db)
  })

  // ─── record() ──────────────────────────────────────────────────────────────

  describe('record()', () => {
    it('inserts a row with all fields correctly', () => {
      const event = makeEvent()

      store.record(event)

      const rows = db
        .prepare('SELECT * FROM rescope_events WHERE gate_id = ?')
        .all(event.gate_id) as RescopeEvent[]

      expect(rows).toHaveLength(1)
      expect(rows[0].gate_id).toBe('gate-05')
      expect(rows[0].snapshot_before).toBe(event.snapshot_before)
      expect(rows[0].snapshot_after).toBe(event.snapshot_after)
      expect(rows[0].actor).toBe('user@example.com')
    })

    it('preserves the event even when the caller throws after insertion', () => {
      const event = makeEvent({ gate_id: 'gate-persist' })

      expect(() => {
        store.record(event)
        throw new Error('simulated post-insert failure')
      }).toThrow('simulated post-insert failure')

      const rows = db
        .prepare('SELECT * FROM rescope_events WHERE gate_id = ?')
        .all('gate-persist') as RescopeEvent[]

      expect(rows).toHaveLength(1)
    })

    it('uses prepared statements — SQL injection does not break the table', () => {
      const malicious = "'; DROP TABLE rescope_events; --"
      store.record(makeEvent({ gate_id: 'safe-gate', snapshot_before: malicious }))

      const tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rescope_events'")
        .get()
      expect(tableExists).toBeDefined()

      const rows = db
        .prepare('SELECT * FROM rescope_events WHERE gate_id = ?')
        .all('safe-gate') as RescopeEvent[]
      expect(rows).toHaveLength(1)
    })
  })

  // ─── getHistory() ──────────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('returns events in ascending created_at order', () => {
      const gateId = 'gate-order'
      const t1 = '2026-01-01T00:00:00.000Z'
      const t2 = '2026-03-01T00:00:00.000Z'
      const t3 = '2026-06-01T00:00:00.000Z'

      // insert out-of-order
      store.record(makeEvent({ gate_id: gateId, created_at: t3 }))
      store.record(makeEvent({ gate_id: gateId, created_at: t1 }))
      store.record(makeEvent({ gate_id: gateId, created_at: t2 }))

      const history = store.getHistory(gateId)

      expect(history).toHaveLength(3)
      expect(history[0].created_at).toBe(t1)
      expect(history[1].created_at).toBe(t2)
      expect(history[2].created_at).toBe(t3)
    })

    it('returns empty array for unknown gate_id', () => {
      expect(store.getHistory('unknown-gate')).toEqual([])
    })
  })

  // ─── getLatest() ───────────────────────────────────────────────────────────

  describe('getLatest()', () => {
    it('returns undefined for an empty table', () => {
      expect(store.getLatest('gate-empty')).toBeUndefined()
    })

    it('returns the newest event for a gate', () => {
      const gateId = 'gate-newest'
      const early = '2026-01-01T00:00:00.000Z'
      const late = '2026-12-31T23:59:59.000Z'

      store.record(makeEvent({ gate_id: gateId, created_at: early }))
      store.record(makeEvent({ gate_id: gateId, created_at: late }))

      const latest = store.getLatest(gateId)

      expect(latest).toBeDefined()
      expect(latest!.created_at).toBe(late)
    })
  })

  // ─── guardRescope() ────────────────────────────────────────────────────────

  describe('guardRescope()', () => {
    it('returns a warning when gate is in_progress and force is false', () => {
      const warning = store.guardRescope('in_progress', false)

      expect(warning).not.toBeNull()
      expect(warning!.message).toMatch(/in_progress/)
    })

    it('returns null when gate is in_progress and force is true', () => {
      expect(store.guardRescope('in_progress', true)).toBeNull()
    })

    it('returns null when gate is not in_progress', () => {
      expect(store.guardRescope('pending')).toBeNull()
      expect(store.guardRescope('completed')).toBeNull()
    })
  })
})
