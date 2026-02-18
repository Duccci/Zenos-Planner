/**
 * Metrics Storage Service
 *
 * Persists lightweight aggregate metrics snapshots to SQLite at gate archive time.
 * Each snapshot is ~227 bytes of scalar columns — no per-module detail stored.
 * Per-module breakdowns can be recomputed from the git-tagged codebase on demand.
 */

import { getDatabase } from './database.js'
import { logger } from '../utils/logger.js'

/** Aggregate metrics snapshot captured at gate archive time */
export interface MetricsSnapshot {
  id?: number
  gateId: string
  fileCount: number
  totalLoc: number
  codeLines: number
  blankLines: number
  commentLines: number
  avgInstability: number
  highCouplingCount: number
  maxComplexity: number
  avgComplexity: number
  graphNodes: number
  graphEdges: number
  cycleCount: number
  maxDepth: number
  scanDurationMs: number
  createdAt?: string
}

/** Raw row shape from the database */
interface MetricsSnapshotRow {
  id: number
  gate_id: string
  file_count: number
  total_loc: number
  code_lines: number
  blank_lines: number
  comment_lines: number
  avg_instability: number
  high_coupling_count: number
  max_complexity: number
  avg_complexity: number
  graph_nodes: number
  graph_edges: number
  cycle_count: number
  max_depth: number
  scan_duration_ms: number
  created_at: string
}

const INSERT_SQL = `
  INSERT INTO metrics_snapshots (
    gate_id, file_count, total_loc, code_lines, blank_lines, comment_lines,
    avg_instability, high_coupling_count, max_complexity, avg_complexity,
    graph_nodes, graph_edges, cycle_count, max_depth, scan_duration_ms
  ) VALUES (
    @gateId, @fileCount, @totalLoc, @codeLines, @blankLines, @commentLines,
    @avgInstability, @highCouplingCount, @maxComplexity, @avgComplexity,
    @graphNodes, @graphEdges, @cycleCount, @maxDepth, @scanDurationMs
  )
`

/**
 * Map a database row to a MetricsSnapshot object.
 */
function rowToSnapshot(row: MetricsSnapshotRow): MetricsSnapshot {
  return {
    id: row.id,
    gateId: row.gate_id,
    fileCount: row.file_count,
    totalLoc: row.total_loc,
    codeLines: row.code_lines,
    blankLines: row.blank_lines,
    commentLines: row.comment_lines,
    avgInstability: row.avg_instability,
    highCouplingCount: row.high_coupling_count,
    maxComplexity: row.max_complexity,
    avgComplexity: row.avg_complexity,
    graphNodes: row.graph_nodes,
    graphEdges: row.graph_edges,
    cycleCount: row.cycle_count,
    maxDepth: row.max_depth,
    scanDurationMs: row.scan_duration_ms,
    createdAt: row.created_at,
  }
}

/**
 * Save a metrics snapshot for a gate.
 * @param snapshot - Aggregate metrics to persist
 * @param projectRoot - Project root for database resolution
 * @returns The inserted row ID
 */
export function saveMetricsSnapshot(snapshot: MetricsSnapshot, projectRoot?: string): number {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const stmt = db.prepare(INSERT_SQL)
  const result = stmt.run({
    gateId: snapshot.gateId,
    fileCount: snapshot.fileCount,
    totalLoc: snapshot.totalLoc,
    codeLines: snapshot.codeLines,
    blankLines: snapshot.blankLines,
    commentLines: snapshot.commentLines,
    avgInstability: snapshot.avgInstability,
    highCouplingCount: snapshot.highCouplingCount,
    maxComplexity: snapshot.maxComplexity,
    avgComplexity: snapshot.avgComplexity,
    graphNodes: snapshot.graphNodes,
    graphEdges: snapshot.graphEdges,
    cycleCount: snapshot.cycleCount,
    maxDepth: snapshot.maxDepth,
    scanDurationMs: snapshot.scanDurationMs,
  })
  logger.debug(
    `Saved metrics snapshot for gate ${snapshot.gateId} (id=${String(result.lastInsertRowid)})`
  )
  return Number(result.lastInsertRowid)
}

/**
 * Get the metrics snapshot for a specific gate.
 * @param gateId - Gate ID to look up
 * @param projectRoot - Project root for database resolution
 * @returns Snapshot or undefined if not found
 */
export function getMetricsForGate(
  gateId: string,
  projectRoot?: string
): MetricsSnapshot | undefined {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const row = db
    .prepare('SELECT * FROM metrics_snapshots WHERE gate_id = ? ORDER BY id DESC LIMIT 1')
    .get(gateId) as MetricsSnapshotRow | undefined
  return row ? rowToSnapshot(row) : undefined
}

/**
 * Get all metrics snapshots ordered by creation time.
 * Useful for trending across gates.
 * @param projectRoot - Project root for database resolution
 * @returns Array of snapshots ordered oldest-first
 */
export function getAllMetricsSnapshots(projectRoot?: string): MetricsSnapshot[] {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const rows = db
    .prepare('SELECT * FROM metrics_snapshots ORDER BY id ASC')
    .all() as MetricsSnapshotRow[]
  return rows.map(rowToSnapshot)
}

/**
 * Get metrics snapshots for the last N gates.
 * @param limit - Number of recent snapshots
 * @param projectRoot - Project root for database resolution
 * @returns Array of snapshots ordered newest-first
 */
export function getRecentMetricsSnapshots(limit = 5, projectRoot?: string): MetricsSnapshot[] {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const rows = db
    .prepare('SELECT * FROM metrics_snapshots ORDER BY id DESC LIMIT ?')
    .all(limit) as MetricsSnapshotRow[]
  return rows.map(rowToSnapshot)
}
