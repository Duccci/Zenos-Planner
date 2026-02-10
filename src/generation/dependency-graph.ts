/**
 * Dependency Graph Template Implementation
 *
 * Architecture-level dependency graph for visualizing requirement hierarchies.
 * Provides both data structure and visualization utilities for requirement dependencies.
 */

import type { Requirement } from './types.js'
import { DatabaseError } from '../utils/errors.js'

// Re-export Requirement type for test imports
export type { Requirement }

/**
 * Node in the dependency graph representing a requirement with metadata
 */
export interface DependencyNode {
  /** Requirement hash (unique identifier) */
  hash: string
  /** Requirement ID */
  id: string
  /** Human-readable title/name */
  title: string
  /** Requirement type */
  type: 'functional' | 'non_functional' | 'constraint'
  /** Priority level */
  priority: 'must' | 'should' | 'could' | 'wont'
  /** Gate ID if gate-specific requirement */
  gateId?: string
  /** Child requirement hashes (direct dependencies) */
  children: string[]
  /** Parent requirement hash (if any) */
  parent?: string
  /** Confidence score for parent-child relationship (0.0-1.0) */
  confidence?: number
  /** Depth in hierarchy (0 = root) */
  depth: number
}

/**
 * Edge representing dependency relationship between two requirements
 */
export interface DependencyEdge {
  /** Source requirement hash */
  from: string
  /** Target requirement hash */
  to: string
  /** Confidence score for this dependency (0.0-1.0) */
  confidence: number
  /** Relationship type */
  type: 'parent-child' | 'dependency' | 'transfer'
}

/**
 * Complete dependency graph structure
 */
export interface DependencyGraph {
  /** All nodes in the graph */
  nodes: Map<string, DependencyNode>
  /** All edges in the graph */
  edges: DependencyEdge[]
  /** Root nodes (no parents) */
  roots: string[]
  /** Detected cycles (if any) */
  cycles: string[][]
}

/**
 * Build dependency graph from a list of requirements
 * @param requirements - List of requirements to build graph from
 * @returns Complete dependency graph
 */
export function buildDependencyGraph(requirements: Requirement[]): DependencyGraph {
  const nodes = new Map<string, DependencyNode>()
  const edges: DependencyEdge[] = []
  const roots: string[] = []

  // Build nodes
  for (const req of requirements) {
    const node: DependencyNode = {
      hash: req.hash,
      id: req.id,
      title: req.description.split('\n')[0] ?? req.id, // First line as title
      type: req.type,
      priority: req.priority,
      gateId: req.gateId ?? undefined,
      children: [],
      parent: req.parentId ?? undefined,
      confidence: 1.0, // Default confidence
      depth: 0, // Calculated later
    }

    nodes.set(req.hash, node)

    // Track root nodes (no parent)
    if (!req.parentId) {
      roots.push(req.hash)
    }
  }

  // Build edges and parent-child relationships
  for (const req of requirements) {
    const node = nodes.get(req.hash)
    if (!node) continue

    if (req.parentId) {
      const parent = nodes.get(req.parentId)
      if (parent) {
        parent.children.push(req.hash)
        edges.push({
          from: req.parentId,
          to: req.hash,
          confidence: node.confidence ?? 1.0,
          type: 'parent-child',
        })
      }
    }
  }

  // Calculate depths via BFS
  const visited = new Set<string>()
  const queue: { hash: string; depth: number }[] = roots.map((hash) => ({ hash, depth: 0 }))

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current.hash)) continue

    visited.add(current.hash)
    const node = nodes.get(current.hash)
    if (!node) continue

    node.depth = current.depth

    for (const childHash of node.children) {
      if (!visited.has(childHash)) {
        queue.push({ hash: childHash, depth: current.depth + 1 })
      }
    }
  }

  // Detect cycles
  const cycles = detectCycles(nodes, edges)

  return { nodes, edges, roots, cycles }
}

/**
 * Detect cycles in dependency graph using DFS
 * @param nodes - Graph nodes
 * @param edges - Graph edges
 * @returns List of cycles (each cycle is a list of hashes)
 */
function detectCycles(nodes: Map<string, DependencyNode>, edges: DependencyEdge[]): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  // Build adjacency list
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from) ?? []
    neighbors.push(edge.to)
    adjacency.set(edge.from, neighbors)
  }

  // DFS for cycle detection
  function dfs(hash: string): void {
    visited.add(hash)
    recursionStack.add(hash)
    path.push(hash)

    const neighbors = adjacency.get(hash) ?? []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor)
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = path.indexOf(neighbor)
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart))
        }
      }
    }

    recursionStack.delete(hash)
    path.pop()
  }

  // Run DFS from all unvisited nodes
  for (const hash of nodes.keys()) {
    if (!visited.has(hash)) {
      dfs(hash)
    }
  }

  return cycles
}

/**
 * Get dependency subgraph for a specific requirement (includes all ancestors and descendants)
 * @param graph - Complete dependency graph
 * @param requirementHash - Hash of requirement to get subgraph for
 * @returns Subgraph containing only relevant nodes and edges
 */
export function getRequirementSubgraph(
  graph: DependencyGraph,
  requirementHash: string
): DependencyGraph {
  const node = graph.nodes.get(requirementHash)
  if (!node) {
    throw new DatabaseError('Requirement not found in graph', 'GRAPH_NODE_NOT_FOUND', {
      hash: requirementHash,
    })
  }

  const relevantHashes = new Set<string>([requirementHash])

  // Traverse ancestors
  let current = node
  while (current.parent) {
    relevantHashes.add(current.parent)
    const parentNode = graph.nodes.get(current.parent)
    if (!parentNode) break
    current = parentNode
  }

  // Traverse descendants (BFS)
  const queue = [requirementHash]
  while (queue.length > 0) {
    const hash = queue.shift()
    if (!hash) continue

    const currentNode = graph.nodes.get(hash)
    if (!currentNode) continue

    for (const childHash of currentNode.children) {
      if (!relevantHashes.has(childHash)) {
        relevantHashes.add(childHash)
        queue.push(childHash)
      }
    }
  }

  // Filter nodes and edges
  const subgraphNodes = new Map<string, DependencyNode>()
  for (const hash of relevantHashes) {
    const n = graph.nodes.get(hash)
    if (n) {
      subgraphNodes.set(hash, { ...n })
    }
  }

  const subgraphEdges = graph.edges.filter(
    (edge) => relevantHashes.has(edge.from) && relevantHashes.has(edge.to)
  )

  const subgraphRoots = Array.from(relevantHashes).filter((hash) => {
    const n = subgraphNodes.get(hash)
    return n && !n.parent
  })

  const subgraphCycles = graph.cycles.filter((cycle) =>
    cycle.every((hash) => relevantHashes.has(hash))
  )

  return {
    nodes: subgraphNodes,
    edges: subgraphEdges,
    roots: subgraphRoots,
    cycles: subgraphCycles,
  }
}

/**
 * Convert dependency graph to ASCII tree visualization
 * @param graph - Dependency graph
 * @param maxDepth - Maximum depth to display (default: unlimited)
 * @returns ASCII tree string
 */
export function graphToAsciiTree(graph: DependencyGraph, maxDepth?: number): string {
  const lines: string[] = []

  function traverse(hash: string, prefix: string, isLast: boolean, currentDepth: number): void {
    if (maxDepth !== undefined && currentDepth > maxDepth) return

    const node = graph.nodes.get(hash)
    if (!node) return

    const connector = isLast ? '└── ' : '├── '
    const confidenceStr =
      node.confidence !== undefined && node.confidence < 1.0
        ? ` (${(node.confidence * 100).toFixed(0)}%)`
        : ''

    lines.push(`${prefix}${connector}[${node.hash}] ${node.title}${confidenceStr}`)

    const newPrefix = prefix + (isLast ? '    ' : '│   ')
    const children = node.children

    for (let i = 0; i < children.length; i++) {
      const childHash = children[i]
      if (childHash) {
        traverse(childHash, newPrefix, i === children.length - 1, currentDepth + 1)
      }
    }
  }

  // Start from roots
  for (let i = 0; i < graph.roots.length; i++) {
    const rootHash = graph.roots[i]
    if (rootHash) {
      traverse(rootHash, '', i === graph.roots.length - 1, 0)
    }
  }

  return lines.join('\n')
}

/**
 * Convert dependency graph to Mermaid diagram
 * @param graph - Dependency graph
 * @returns Mermaid diagram string
 */
export function graphToMermaid(graph: DependencyGraph): string {
  const lines: string[] = ['graph TD']

  // Add nodes
  for (const [hash, node] of graph.nodes) {
    const label = `${node.title.replace(/"/g, "'")} (${node.priority})`
    lines.push(`  ${hash}["${label}"]`)
  }

  // Add edges
  for (const edge of graph.edges) {
    const confidenceLabel = edge.confidence < 1.0 ? `|${(edge.confidence * 100).toFixed(0)}%|` : ''
    lines.push(`  ${edge.from} -->${confidenceLabel} ${edge.to}`)
  }

  return lines.join('\n')
}

/**
 * Validate dependency graph for common issues
 * @param graph - Dependency graph
 * @returns Validation errors (empty array if valid)
 */
export function validateDependencyGraph(graph: DependencyGraph): string[] {
  const errors: string[] = []

  // Check for cycles
  if (graph.cycles.length > 0) {
    for (const cycle of graph.cycles) {
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')} -> ${String(cycle[0])}`)
    }
  }

  // Check for orphaned nodes (nodes with parent reference but parent doesn't exist)
  for (const [hash, node] of graph.nodes) {
    if (node.parent && !graph.nodes.has(node.parent)) {
      errors.push(`Orphaned node ${hash}: parent ${node.parent} not found in graph`)
    }
  }

  // Check for invalid confidence scores
  for (const [hash, node] of graph.nodes) {
    if (node.confidence !== undefined && (node.confidence < 0.0 || node.confidence > 1.0)) {
      errors.push(
        `Invalid confidence score for ${hash}: ${String(node.confidence)} (must be 0.0-1.0)`
      )
    }
  }

  return errors
}
