/**
 * Additional branch coverage for DependencyGraph
 *
 * Targets: complex cycle detection, getMaxDepth via getStats on wide/deep graphs,
 * topological sort with disconnected components, transitive deps with cycles.
 */

import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../../../src/analysis/graph/dependency-graph.js';

describe('DependencyGraph branch improvements', () => {
  describe('findCircular - complex scenarios', () => {
    it('detects cycle in graph with both cyclic and acyclic parts', () => {
      const graph = new DependencyGraph();
      // Acyclic chain
      graph.addEdge('x', 'y');
      graph.addEdge('y', 'z');
      // Separate cycle
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'c');
      graph.addEdge('c', 'a');

      const cycles = graph.findCircular();
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('a');
      expect(cycles[0]).toContain('b');
      expect(cycles[0]).toContain('c');
    });

    it('detects nested cycle (cycle within a longer path)', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'c');
      graph.addEdge('c', 'b'); // cycle between b and c only

      const cycles = graph.findCircular();
      expect(cycles.length).toBeGreaterThanOrEqual(1);
      // At least one cycle should involve b and c
      const hasBCCycle = cycles.some(
        (cycle) => cycle.includes('b') && cycle.includes('c')
      );
      expect(hasBCCycle).toBe(true);
    });
  });

  describe('topologicalSort - disconnected components', () => {
    it('sorts disconnected acyclic components', () => {
      const graph = new DependencyGraph();
      // Component 1
      graph.addEdge('a', 'b');
      // Component 2
      graph.addEdge('c', 'd');

      const sorted = graph.topologicalSort();
      expect(sorted).not.toBeNull();
      expect(sorted).toHaveLength(4);
      expect(sorted!.indexOf('b')).toBeLessThan(sorted!.indexOf('a'));
      expect(sorted!.indexOf('d')).toBeLessThan(sorted!.indexOf('c'));
    });

    it('returns null when one disconnected component has a cycle', () => {
      const graph = new DependencyGraph();
      // Acyclic component
      graph.addEdge('a', 'b');
      // Cyclic component
      graph.addEdge('c', 'd');
      graph.addEdge('d', 'c');

      expect(graph.topologicalSort()).toBeNull();
    });
  });

  describe('getTransitiveDependencies - with cycles', () => {
    it('handles cyclic graph without infinite loop', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'c');
      graph.addEdge('c', 'a');

      // Should terminate and return dependencies (excluding self)
      const deps = graph.getTransitiveDependencies('a');
      expect(deps).toContain('b');
      expect(deps).toContain('c');
      expect(deps).not.toContain('a');
    });
  });

  describe('getStats - maxDepth calculations', () => {
    it('calculates maxDepth for wide shallow graph', () => {
      const graph = new DependencyGraph();
      graph.addEdge('root', 'a');
      graph.addEdge('root', 'b');
      graph.addEdge('root', 'c');
      graph.addEdge('root', 'd');

      const stats = graph.getStats();
      expect(stats.maxDepth).toBe(1);
      expect(stats.nodeCount).toBe(5);
      expect(stats.edgeCount).toBe(4);
    });

    it('calculates maxDepth for deep narrow graph', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'c');
      graph.addEdge('c', 'd');
      graph.addEdge('d', 'e');
      graph.addEdge('e', 'f');

      const stats = graph.getStats();
      expect(stats.maxDepth).toBe(5);
    });

    it('handles graph with multiple roots', () => {
      const graph = new DependencyGraph();
      graph.addEdge('r1', 'shared');
      graph.addEdge('r2', 'shared');
      graph.addEdge('shared', 'leaf');

      const stats = graph.getStats();
      expect(stats.maxDepth).toBe(2);
      expect(stats.nodeCount).toBe(4);
    });
  });

  describe('getShortestPath - complex scenarios', () => {
    it('finds shortest path when multiple paths exist', () => {
      const graph = new DependencyGraph();
      // Short path: a -> d (via direct)
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'd');
      // Long path: a -> b -> c -> d
      graph.addEdge('a', 'c');
      graph.addEdge('c', 'e');
      graph.addEdge('e', 'd');

      const path = graph.getShortestPath('a', 'd');
      expect(path).not.toBeNull();
      // BFS should find a -> b -> d (length 3) before a -> c -> e -> d (length 4)
      expect(path!.length).toBeLessThanOrEqual(3);
    });

    it('returns null for reverse direction in directed graph', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'c');

      // Path exists a->b->c but not c->a
      expect(graph.getShortestPath('c', 'a')).toBeNull();
    });
  });

  describe('getDependents - complex graph', () => {
    it('finds all dependents across multiple paths', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'shared');
      graph.addEdge('b', 'shared');
      graph.addEdge('c', 'shared');

      const dependents = graph.getDependents('shared');
      expect(dependents).toEqual(new Set(['a', 'b', 'c']));
    });
  });
});
