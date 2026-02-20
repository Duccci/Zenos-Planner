/**
 * Tests for dependency graph data structure
 */

import { describe, it, expect } from 'vitest'
import { DependencyGraph } from '../../../src/analysis/graph/dependency-graph.js'

describe('DependencyGraph', () => {
  it('starts empty', () => {
    const graph = new DependencyGraph()

    expect(graph.getNodes()).toEqual([])
  })

  it('adds edges correctly', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('a.ts', 'c.ts')
    graph.addEdge('b.ts', 'd.ts')

    expect(graph.getNodes()).toHaveLength(4)
    expect(graph.getDependencies('a.ts')).toEqual(new Set(['b.ts', 'c.ts']))
    expect(graph.getDependencies('b.ts')).toEqual(new Set(['d.ts']))
    expect(graph.getDependencies('c.ts')).toEqual(new Set())
    expect(graph.getDependencies('d.ts')).toEqual(new Set())
  })

  it('gets dependents correctly', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('c.ts', 'b.ts')
    graph.addEdge('b.ts', 'd.ts')

    expect(graph.getDependents('b.ts')).toEqual(new Set(['a.ts', 'c.ts']))
    expect(graph.getDependents('d.ts')).toEqual(new Set(['b.ts']))
    expect(graph.getDependents('a.ts')).toEqual(new Set())
  })

  it('detects simple cycles', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('b.ts', 'c.ts')
    graph.addEdge('c.ts', 'a.ts')

    const cycles = graph.findCircular()

    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts'])
  })

  it('detects multiple cycles', () => {
    const graph = new DependencyGraph()

    // Cycle 1: a -> b -> c -> a
    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('b.ts', 'c.ts')
    graph.addEdge('c.ts', 'a.ts')

    // Cycle 2: x -> y -> x
    graph.addEdge('x.ts', 'y.ts')
    graph.addEdge('y.ts', 'x.ts')

    const cycles = graph.findCircular()

    expect(cycles).toHaveLength(2)
    expect(cycles).toContainEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts'])
    expect(cycles).toContainEqual(['x.ts', 'y.ts', 'x.ts'])
  })

  it('handles self-cycles', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'a.ts')

    const cycles = graph.findCircular()

    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toEqual(['a.ts', 'a.ts'])
  })

  it('returns empty cycles for acyclic graph', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('b.ts', 'c.ts')
    graph.addEdge('d.ts', 'c.ts')

    const cycles = graph.findCircular()

    expect(cycles).toEqual([])
  })

  it('performs topological sort on acyclic graph', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('a.ts', 'c.ts')
    graph.addEdge('b.ts', 'd.ts')
    graph.addEdge('c.ts', 'd.ts')

    const sorted = graph.topologicalSort()

    expect(sorted).not.toBeNull()
    // d should come before b and c, b and c before a
    const dIndex = sorted!.indexOf('d.ts')
    const bIndex = sorted!.indexOf('b.ts')
    const cIndex = sorted!.indexOf('c.ts')
    const aIndex = sorted!.indexOf('a.ts')

    expect(dIndex).toBeLessThan(bIndex)
    expect(dIndex).toBeLessThan(cIndex)
    expect(bIndex).toBeLessThan(aIndex)
    expect(cIndex).toBeLessThan(aIndex)
  })

  it('returns null for topological sort on cyclic graph', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('b.ts', 'a.ts')

    const sorted = graph.topologicalSort()

    expect(sorted).toBeNull()
  })

  it('calculates transitive dependencies', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('b.ts', 'c.ts')
    graph.addEdge('b.ts', 'd.ts')
    graph.addEdge('c.ts', 'e.ts')

    const transitive = graph.getTransitiveDependencies('a.ts')

    expect(transitive).toEqual(new Set(['b.ts', 'c.ts', 'd.ts', 'e.ts']))
  })

  it('calculates transitive dependencies with no self-reference', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'a.ts')

    const transitive = graph.getTransitiveDependencies('a.ts')

    expect(transitive).toEqual(new Set())
  })

  it('finds shortest path', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('a.ts', 'c.ts')
    graph.addEdge('b.ts', 'd.ts')
    graph.addEdge('c.ts', 'd.ts')
    graph.addEdge('d.ts', 'e.ts')

    const path = graph.getShortestPath('a.ts', 'e.ts')

    expect(path).toEqual(['a.ts', 'b.ts', 'd.ts', 'e.ts'])
  })

  it('returns null for non-existent path', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('c.ts', 'd.ts')

    const path = graph.getShortestPath('a.ts', 'd.ts')

    expect(path).toBeNull()
  })

  it('calculates graph statistics', () => {
    const graph = new DependencyGraph()

    graph.addEdge('a.ts', 'b.ts')
    graph.addEdge('a.ts', 'c.ts')
    graph.addEdge('b.ts', 'd.ts')
    graph.addEdge('c.ts', 'd.ts')
    graph.addEdge('d.ts', 'a.ts') // creates cycle

    const stats = graph.getStats()

    expect(stats.nodeCount).toBe(4)
    expect(stats.edgeCount).toBe(5)
    expect(stats.cycles).toHaveLength(1)
    expect(stats.maxDepth).toBeGreaterThan(0)
  })

  // --- Edge cases (branch coverage) ---

  describe('edge cases', () => {
    it('returns empty set for unknown node dependencies', () => {
      const graph = new DependencyGraph()
      expect(graph.getDependencies('nonexistent')).toEqual(new Set())
    })

    it('returns empty set for node with no dependents', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      expect(graph.getDependents('a')).toEqual(new Set())
    })

    it('returns empty set for unknown node dependents', () => {
      const graph = new DependencyGraph()
      expect(graph.getDependents('nonexistent')).toEqual(new Set())
    })

    it('returns null when start node does not exist for shortest path', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      expect(graph.getShortestPath('x', 'b')).toBeNull()
    })

    it('returns null when end node does not exist for shortest path', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      expect(graph.getShortestPath('a', 'x')).toBeNull()
    })

    it('returns single-element path when start equals end', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      expect(graph.getShortestPath('a', 'a')).toEqual(['a'])
    })

    it('returns empty set for leaf node transitive deps', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      expect(graph.getTransitiveDependencies('b')).toEqual(new Set())
    })

    it('returns empty set for unknown node transitive deps', () => {
      const graph = new DependencyGraph()
      expect(graph.getTransitiveDependencies('nonexistent')).toEqual(new Set())
    })

    it('handles diamond dependencies without duplicates', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('a', 'c')
      graph.addEdge('b', 'd')
      graph.addEdge('c', 'd')
      expect(graph.getTransitiveDependencies('a')).toEqual(new Set(['b', 'c', 'd']))
    })

    it('returns zeroes for empty graph stats', () => {
      const graph = new DependencyGraph()
      const stats = graph.getStats()
      expect(stats.nodeCount).toBe(0)
      expect(stats.edgeCount).toBe(0)
      expect(stats.cycles).toEqual([])
      expect(stats.maxDepth).toBe(0)
    })

    it('handles adding duplicate edges idempotently', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('a', 'b')
      expect(graph.getDependencies('a')).toEqual(new Set(['b']))
      expect(graph.getNodes()).toHaveLength(2)
    })

    it('returns empty topological sort for empty graph', () => {
      const graph = new DependencyGraph()
      expect(graph.topologicalSort()).toEqual([])
    })
  })

  // --- Complex scenarios (branch improvements) ---

  describe('complex scenarios', () => {
    it('detects cycle in graph with both cyclic and acyclic parts', () => {
      const graph = new DependencyGraph()
      graph.addEdge('x', 'y')
      graph.addEdge('y', 'z')
      graph.addEdge('a', 'b')
      graph.addEdge('b', 'c')
      graph.addEdge('c', 'a')

      const cycles = graph.findCircular()
      expect(cycles).toHaveLength(1)
      expect(cycles[0]).toContain('a')
      expect(cycles[0]).toContain('b')
      expect(cycles[0]).toContain('c')
    })

    it('detects nested cycle within a longer path', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('b', 'c')
      graph.addEdge('c', 'b')

      const cycles = graph.findCircular()
      expect(cycles.length).toBeGreaterThanOrEqual(1)
      const hasBCCycle = cycles.some((cycle) => cycle.includes('b') && cycle.includes('c'))
      expect(hasBCCycle).toBe(true)
    })

    it('sorts disconnected acyclic components', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('c', 'd')

      const sorted = graph.topologicalSort()
      expect(sorted).not.toBeNull()
      expect(sorted).toHaveLength(4)
      expect(sorted!.indexOf('b')).toBeLessThan(sorted!.indexOf('a'))
      expect(sorted!.indexOf('d')).toBeLessThan(sorted!.indexOf('c'))
    })

    it('returns null when one disconnected component has a cycle', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('c', 'd')
      graph.addEdge('d', 'c')
      expect(graph.topologicalSort()).toBeNull()
    })

    it('handles cyclic graph in transitive deps without infinite loop', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('b', 'c')
      graph.addEdge('c', 'a')

      const deps = graph.getTransitiveDependencies('a')
      expect(deps).toContain('b')
      expect(deps).toContain('c')
      expect(deps).not.toContain('a')
    })

    it('calculates maxDepth for wide shallow graph', () => {
      const graph = new DependencyGraph()
      graph.addEdge('root', 'a')
      graph.addEdge('root', 'b')
      graph.addEdge('root', 'c')
      graph.addEdge('root', 'd')

      const stats = graph.getStats()
      expect(stats.maxDepth).toBe(1)
      expect(stats.nodeCount).toBe(5)
    })

    it('calculates maxDepth for deep narrow graph', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('b', 'c')
      graph.addEdge('c', 'd')
      graph.addEdge('d', 'e')
      graph.addEdge('e', 'f')

      expect(graph.getStats().maxDepth).toBe(5)
    })

    it('finds shortest path when multiple paths exist', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('b', 'd')
      graph.addEdge('a', 'c')
      graph.addEdge('c', 'e')
      graph.addEdge('e', 'd')

      const path = graph.getShortestPath('a', 'd')
      expect(path).not.toBeNull()
      expect(path!.length).toBeLessThanOrEqual(3)
    })

    it('returns null for reverse direction in directed graph', () => {
      const graph = new DependencyGraph()
      graph.addEdge('a', 'b')
      graph.addEdge('b', 'c')
      expect(graph.getShortestPath('c', 'a')).toBeNull()
    })
  })
})
