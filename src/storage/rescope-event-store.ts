import Database from 'better-sqlite3';

/**
 * RescopeEvent represents a single rescope operation recorded in the database.
 */
export interface RescopeEvent {
  id?: number;
  gate_id: string;
  snapshot_before: string;
  snapshot_after: string;
  actor: string;
  created_at: string;
}

/**
 * RescopeWarning indicates a warning when rescoping an in-progress gate without force.
 */
export interface RescopeWarning {
  message: string;
}

/**
 * RescopeEventStore manages the rescope_events table and provides durable
 * rescope history for auditing and recovery.
 */
export class RescopeEventStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Records a single rescope event in the rescope_events table.
   * Uses prepared statements to prevent SQL injection.
   */
  record(event: RescopeEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO rescope_events (
        gate_id, snapshot_before, snapshot_after, actor, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.gate_id,
      event.snapshot_before,
      event.snapshot_after,
      event.actor,
      event.created_at,
    );
  }

  /**
   * Retrieves all rescope events for a specific gate, ordered by creation time.
   */
  getHistory(gateId: string): RescopeEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM rescope_events WHERE gate_id = ? ORDER BY created_at ASC
    `);

    return stmt.all(gateId) as RescopeEvent[];
  }

  /**
   * Retrieves the most recent rescope event for a specific gate, or undefined if none exist.
   */
  getLatest(gateId: string): RescopeEvent | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM rescope_events WHERE gate_id = ? ORDER BY created_at DESC LIMIT 1
    `);

    return stmt.get(gateId) as RescopeEvent | undefined;
  }

  /**
   * Returns a RescopeWarning if the gate is in_progress and force is not set.
   * Returns null when safe to proceed.
   */
  guardRescope(gateStatus: string, force = false): RescopeWarning | null {
    if (gateStatus === 'in_progress' && !force) {
      return { message: 'Gate is in_progress. Use force: true to override.' };
    }
    return null;
  }
}

