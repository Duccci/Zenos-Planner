/**
 * Repository Dependencies Storage
 *
 * CRUD module for the `repo_dependencies` table.
 * Follows the same functional pattern as repository-storage.ts.
 *
 * Key operations:
 *   addRepoDependency    — insert a directed edge
 *   getRepoDependencies  — edges leaving a given node
 *   removeRepoDependency — delete a specific edge
 *   getRepoDependencyGraph — full graph (nodes + edges)
 *   detectCircularDependencies — iterative DFS cycle detection
 */

import { getDatabase } from './database.js'
import { shortHash } from '../utils/hash.js'
import { logger } from '../utils/logger.js'
import { listRepositories } from './repository-storage.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoDependencyEdge {
  fromRepoHash: string
  targetRepoHash: string
  depType: string
  metadata?: Record<string, unknown>
}

export interface RepoDependencyGraph {
  repositories: { hash: string; name: string }[]
  edges: { from: string; to: string; depType: string }[]
}

interface RepoDependencyRow {
  id: string
  source_repo_hash: string
  target_repo_hash: string
  dependency_type: string
  metadata: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEdge(row: RepoDependencyRow): RepoDependencyEdge {
  return {
    fromRepoHash: row.source_repo_hash,
    targetRepoHash: row.target_repo_hash,
    depType: row.dependency_type,
    ...(row.metadata
      ? { metadata: JSON.parse(row.metadata) as Record<string, unknown> }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// SQL constants
// ---------------------------------------------------------------------------

const INSERT_DEP_SQL = `
  INSERT INTO repo_dependencies (id, source_repo_hash, target_repo_hash, dependency_type, metadata)
  VALUES (@id, @sourceHash, @targetHash, @depType, @metadata)
`

const SELECT_DEPS_SQL = `SELECT * FROM repo_dependencies WHERE source_repo_hash = ?`
const DELETE_DEP_SQL = `
  DELETE FROM repo_dependencies
  WHERE source_repo_hash = ? AND target_repo_hash = ? AND dependency_type = ?
`
const SELECT_ALL_DEPS_SQL = `SELECT * FROM repo_dependencies`

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Add a directed dependency edge between two repositories.
 * The ID is derived from source + target + type so duplicate insertions
 * hit the UNIQUE constraint cleanly.
 * @throws if source or target hash does not exist (FK constraint, requires PRAGMA foreign_keys = ON)
 */
export function addRepoDependency(
  fromHash: string,
  toHash: string,
  depType: string,
  metadata?: Record<string, unknown>,
  projectRoot?: string
): void {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const id = shortHash(`${fromHash}:${toHash}:${depType}`)
  db.prepare(INSERT_DEP_SQL).run({
    id,
    sourceHash: fromHash,
    targetHash: toHash,
    depType,
    metadata: metadata ? JSON.stringify(metadata) : null,
  })
  logger.debug(`Added repo dependency ${fromHash} → ${toHash} (${depType})`)
}

/** Return all outgoing dependency edges for a repository. */
export function getRepoDependencies(
  repoHash: string,
  projectRoot?: string
): RepoDependencyEdge[] {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const rows = db.prepare(SELECT_DEPS_SQL).all(repoHash) as RepoDependencyRow[]
  return rows.map(rowToEdge)
}

/** Remove a specific dependency edge. No-op if the edge does not exist. */
export function removeRepoDependency(
  fromHash: string,
  toHash: string,
  depType: string,
  projectRoot?: string
): void {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  db.prepare(DELETE_DEP_SQL).run(fromHash, toHash, depType)
}

/**
 * Return the full dependency graph: all repository nodes that appear in at
 * least one edge, and all edges with from/to/depType.
 */
export function getRepoDependencyGraph(
  projectRoot?: string
): RepoDependencyGraph {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const allEdges = (db.prepare(SELECT_ALL_DEPS_SQL).all() as RepoDependencyRow[]).map(rowToEdge)

  // Find which repository hashes appear in edges
  const hashesInGraph = new Set<string>()
  for (const e of allEdges) {
    hashesInGraph.add(e.fromRepoHash)
    hashesInGraph.add(e.targetRepoHash)
  }

  const repos = listRepositories(undefined, projectRoot)
  const repoNodes = repos
    .filter((r) => hashesInGraph.has(r.hash))
    .map((r) => ({ hash: r.hash, name: r.name }))

  return {
    repositories: repoNodes,
    edges: allEdges.map((e) => ({ from: e.fromRepoHash, to: e.targetRepoHash, depType: e.depType })),
  }
}

/**
 * Detect circular dependency cycles using iterative DFS (no recursion to avoid
 * stack overflow on large graphs).
 *
 * Algorithm:
 *   - Color nodes white (unvisited) → gray (on current path) → black (done).
 *   - Maintain an explicit path stack mirroring the DFS recursion stack.
 *   - A back edge (gray neighbor) signals a cycle; the cycle is path[cycleStart…].
 *   - Duplicate cycles (same member set) are suppressed via a canonical key.
 *
 * @returns Array of cycles; each cycle is an array of repository hash strings.
 */
export function detectCircularDependencies(
  projectRoot?: string
): string[][] {
  const db = projectRoot ? getDatabase(projectRoot) : getDatabase()
  const allEdges = (db.prepare(SELECT_ALL_DEPS_SQL).all() as RepoDependencyRow[]).map(rowToEdge)

  // Build adjacency list
  const adj = new Map<string, string[]>()
  for (const e of allEdges) {
    if (!adj.has(e.fromRepoHash)) adj.set(e.fromRepoHash, [])
    if (!adj.has(e.targetRepoHash)) adj.set(e.targetRepoHash, [])
    adj.get(e.fromRepoHash)?.push(e.targetRepoHash)
  }

  const color = new Map<string, 'white' | 'gray' | 'black'>()
  for (const n of adj.keys()) color.set(n, 'white')

  const cycles: string[][] = []
  const seenCycleKeys = new Set<string>()

  interface Frame { node: string; neighborIdx: number }

  for (const startNode of adj.keys()) {
    if (color.get(startNode) !== 'white') continue

    // Begin iterative DFS from startNode
    const stack: Frame[] = [{ node: startNode, neighborIdx: 0 }]
    const path: string[] = [startNode]
    color.set(startNode, 'gray')

    while (stack.length > 0) {
      const top = stack[stack.length - 1]
      if (!top) break
      const neighbors = adj.get(top.node) ?? []

      if (top.neighborIdx < neighbors.length) {
        const neighbor = neighbors[top.neighborIdx++]
        if (neighbor === undefined) continue
        const neighborColor = color.get(neighbor) ?? 'white'

        if (neighborColor === 'gray') {
          // Back edge — extract cycle
          const cycleStart = path.indexOf(neighbor)
          if (cycleStart >= 0) {
            const cycle = path.slice(cycleStart)
            const key = [...cycle].sort().join('\0')
            if (!seenCycleKeys.has(key)) {
              seenCycleKeys.add(key)
              cycles.push(cycle)
            }
          }
        } else if (neighborColor === 'white') {
          color.set(neighbor, 'gray')
          path.push(neighbor)
          stack.push({ node: neighbor, neighborIdx: 0 })
        }
        // black neighbor → already fully explored, skip
      } else {
        // All neighbors processed — backtrack
        color.set(top.node, 'black')
        stack.pop()
        path.pop()
      }
    }
  }

  return cycles
}
