import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { RescopeEventStore, RescopeEvent } from '../../src/storage/rescope-event-store';

describe('RescopeEventStore', () => {
  let db: Database.Database;
  let eventStore: RescopeEventStore;

  beforeEach(() => {
    db = new Database(':memory:');

    // Initialize the database schema matching the RED test expectations
    db.exec(`
      CREATE TABLE IF NOT EXISTS rescope_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gate_id TEXT NOT NULL,
        snapshot_before TEXT NOT NULL,
        snapshot_after TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    eventStore = new RescopeEventStore(db);
  });

  describe('record()', () => {
    it('should insert a rescope event with all fields', () => {
      const gateId = 'gate-05';
      const snapshotBefore = JSON.stringify({ status: 'pending', objectives: ['obj1'] });
      const snapshotAfter = JSON.stringify({ status: 'pending', objectives: ['obj1', 'obj2'] });
      const actor = 'user@example.com';
      const createdAt = new Date().toISOString();

      eventStore.record({
        gate_id: gateId,
        snapshot_before: snapshotBefore,
        snapshot_after: snapshotAfter,
        actor,
        created_at: createdAt,
      });

      const events = db.prepare('SELECT * FROM rescope_events WHERE gate_id = ?')
        .all(gateId) as RescopeEvent[];

      expect(events).toHaveLength(1);
      expect(events[0].gate_id).toBe(gateId);
      expect(events[0].snapshot_before).toBe(snapshotBefore);
      expect(events[0].snapshot_after).toBe(snapshotAfter);
      expect(events[0].actor).toBe(actor);
      expect(events[0].created_at).toBe(createdAt);
    });

    it('should use prepared statements (no SQL injection vulnerability)', () => {
      const gateId = 'gate-injection-test';
      const maliciousJson = "'; DROP TABLE rescope_events; --";
      const actor = 'user@example.com';
      const createdAt = new Date().toISOString();

      eventStore.record({
        gate_id: gateId,
        snapshot_before: JSON.stringify({ test: maliciousJson }),
        snapshot_after: JSON.stringify({ result: 'safe' }),
        actor,
        created_at: createdAt,
      });

      // Table should still exist
      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='rescope_events'",
      ).get();
      expect(tableExists).toBeDefined();

      const events = db.prepare('SELECT * FROM rescope_events WHERE gate_id = ?')
        .all(gateId) as RescopeEvent[];
      expect(events).toHaveLength(1);
    });
  });

  describe('getHistory()', () => {
    it('should return all events for a gate', () => {
      const gateId = 'gate-hist-001';
      const time1 = new Date('2026-03-01T10:00:00Z').toISOString();
      const time2 = new Date('2026-03-01T11:00:00Z').toISOString();

      eventStore.record({
        gate_id: gateId,
        snapshot_before: JSON.stringify({ v: 1 }),
        snapshot_after: JSON.stringify({ v: 2 }),
        actor: 'user1@example.com',
        created_at: time1,
      });

      eventStore.record({
        gate_id: gateId,
        snapshot_before: JSON.stringify({ v: 2 }),
        snapshot_after: JSON.stringify({ v: 3 }),
        actor: 'user2@example.com',
        created_at: time2,
      });

      const history = eventStore.getHistory(gateId);

      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(2);
      expect(history[0].gate_id).toBe(gateId);
      expect(history[1].gate_id).toBe(gateId);
    });

    it('should return empty array for gate with no events', () => {
      const history = eventStore.getHistory('no-events-gate');

      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(0);
    });
  });

  describe('getLatest()', () => {
    it('should return the most recent snapshot pair for a gate', () => {
      const gateId = 'gate-latest';
      const time1 = new Date('2026-03-01T10:00:00Z').toISOString();
      const time2 = new Date('2026-03-01T11:00:00Z').toISOString();

      eventStore.record({
        gate_id: gateId,
        snapshot_before: JSON.stringify({ version: 1 }),
        snapshot_after: JSON.stringify({ version: 2 }),
        actor: 'user@example.com',
        created_at: time1,
      });

      eventStore.record({
        gate_id: gateId,
        snapshot_before: JSON.stringify({ version: 2 }),
        snapshot_after: JSON.stringify({ version: 3 }),
        actor: 'user@example.com',
        created_at: time2,
      });

      const latest = eventStore.getLatest(gateId);

      expect(latest).toBeDefined();
      expect(JSON.parse(latest!.snapshot_before)).toEqual({ version: 2 });
      expect(JSON.parse(latest!.snapshot_after)).toEqual({ version: 3 });
    });

    it('should return undefined for gate with no events', () => {
      const latest = eventStore.getLatest('no-events-gate');

      expect(latest).toBeUndefined();
    });

    it('should return the only event if one exists', () => {
      const gateId = 'gate-single';
      const now = new Date().toISOString();

      eventStore.record({
        gate_id: gateId,
        snapshot_before: JSON.stringify({ initial: true }),
        snapshot_after: JSON.stringify({ initial: true, changed: true }),
        actor: 'user@example.com',
        created_at: now,
      });

      const latest = eventStore.getLatest(gateId);

      expect(latest).toBeDefined();
      expect(JSON.parse(latest!.snapshot_before)).toEqual({ initial: true });
    });
  });

  describe('guardRescope()', () => {
    it('should return a warning when gate is in_progress and force is false', () => {
      const warning = eventStore.guardRescope('in_progress');

      expect(warning).not.toBeNull();
      expect(warning!.message).toBeTruthy();
    });

    it('should return null when gate is in_progress but force is true', () => {
      const warning = eventStore.guardRescope('in_progress', true);

      expect(warning).toBeNull();
    });
  });
});
