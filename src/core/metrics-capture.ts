/**
 * Metrics Capture
 *
 * Runs a full codebase scan and persists a lightweight aggregate snapshot
 * to the metrics_snapshots table. Invoked during gate archive.
 *
 * Design constraints:
 * - Only scalar aggregates are stored (~227 bytes per row)
 * - Per-module detail is NOT persisted; recompute from the git tag if needed
 * - Scan failure is non-fatal: archive proceeds even if metrics capture fails
 */

import { findProjectRoot } from '../utils/config.js'
import { saveMetricsSnapshot } from '../storage/metrics-storage.js'
import type { MetricsSnapshot } from '../storage/metrics-storage.js'
import { logger } from '../utils/logger.js'

/**
 * Run a full codebase scan and persist the aggregate metrics snapshot for a gate.
 *
 * @param gateId - Gate being archived
 * @param projectRoot - Optional project root override
 * @returns The persisted snapshot, or undefined if the scan failed
 */
export async function captureMetricsSnapshot(
  gateId: string,
  projectRoot?: string
): Promise<MetricsSnapshot | undefined> {
  const root = projectRoot ?? findProjectRoot(process.cwd()) ?? process.cwd()

  try {
    const startTime = Date.now()

    // Dynamic import to avoid circular deps and keep the module lazy
    const { CodeAnalyzer } = await import('../analysis/code-analyzer.js')
    const analyzer = new CodeAnalyzer()
    const result = await analyzer.analyzeCodebase(root)

    const metrics = result.metrics
    if (!metrics) {
      logger.warn(`No metrics returned from analyzer for ${root}; skipping metrics snapshot.`)
      return undefined
    }

    const graph = analyzer.getGraph()
    const graphStats = graph.getStats()

    const snapshot: MetricsSnapshot = {
      gateId,
      fileCount: result.fileCount,
      totalLoc: result.totalLOC,
      codeLines: metrics.loc.totalCodeLines,
      blankLines: metrics.loc.totalBlankLines,
      commentLines: metrics.loc.totalCommentLines,
      avgInstability: metrics.coupling.averageInstability,
      highCouplingCount: metrics.coupling.highCoupling.length,
      maxComplexity: metrics.complexity.maxComplexity,
      avgComplexity: metrics.complexity.averageComplexity,
      graphNodes: graphStats.nodeCount,
      graphEdges: graphStats.edgeCount,
      cycleCount: graphStats.cycles.length,
      maxDepth: graphStats.maxDepth,
      scanDurationMs: Date.now() - startTime,
    }

    const rowId = saveMetricsSnapshot(snapshot, root)
    logger.info(
      `Metrics snapshot captured for gate ${gateId}: ${String(result.fileCount)} files, ` +
        `${String(result.totalLOC)} LOC, complexity avg=${snapshot.avgComplexity.toFixed(2)} ` +
        `(row ${String(rowId)})`
    )

    return { ...snapshot, id: rowId }
  } catch (error) {
    // Non-fatal: log and return undefined so archive can proceed
    logger.warn(
      `Metrics capture failed for gate ${gateId}: ${error instanceof Error ? error.message : String(error)}`
    )
    return undefined
  }
}
