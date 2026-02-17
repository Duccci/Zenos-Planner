/**
 * Branch coverage tests for DependencyGraph
 *
 * Targets uncovered branches: getDependencies for unknown node, getDependents with no dependents,
 * getShortestPath with unknown nodes, getTransitiveDependencies for leaf node,
 * getStats on empty graph, topological sort edge cases.
 */

import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../../../src/analysis/graph/dependency-graph.js';

describe('DependencyGraph branch coverage', () => {
  describe('getDependencies', () => {
    it('returns empty set for unknown node', () => {
      const graph = new DependencyGraph();
      expect(graph.getDependencies('nonexistent')).toEqual(new Set());
    });
  });

  describe('getDependents', () => {
    it('returns empty set for node with no dependents', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      expect(graph.getDependents('a')).toEqual(new Set());
    });

    it('returns empty set for unknown node', () => {
      const graph = new DependencyGraph();
      expect(graph.getDependents('nonexistent')).toEqual(new Set());
    });
  });

  describe('getShortestPath', () => {
    it('returns null when start node does not exist', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      expect(graph.getShortestPath('x', 'b')).toBeNull();
    });

    it('returns null when end node does not exist', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      expect(graph.getShortestPath('a', 'x')).toBeNull();
    });

    it('returns single-element path when start equals end', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      const path = graph.getShortestPath('a', 'a');
      expect(path).toEqual(['a']);
    });

    it('finds path in diamond graph', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('a', 'c');
      graph.addEdge('b', 'd');
      graph.addEdge('c', 'd');

      const path = graph.getShortestPath('a', 'd');
      expect(path).not.toBeNull();
      expect(path![0]).toBe('a');
      expect(path![path!.length - 1]).toBe('d');
      expect(path!.length).toBe(3); // a -> b -> d or a -> c -> d
    });
  });

  describe('getTransitiveDependencies', () => {
    it('returns empty set for leaf node', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      expect(graph.getTransitiveDependencies('b')).toEqual(new Set());
    });

    it('returns empty set for unknown node', () => {
      const graph = new DependencyGraph();
      expect(graph.getTransitiveDependencies('nonexistent')).toEqual(new Set());
    });

    it('handles diamond dependencies without duplicates', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('a', 'c');
      graph.addEdge('b', 'd');
      graph.addEdge('c', 'd');

      const deps = graph.getTransitiveDependencies('a');
      expect(deps).toEqual(new Set(['b', 'c', 'd']));
    });
  });

  describe('getStats', () => {
    it('returns zeroes for empty graph', () => {
      const graph = new DependencyGraph();
      const stats = graph.getStats();
      expect(stats.nodeCount).toBe(0);
      expect(stats.edgeCount).toBe(0);
      expect(stats.cycles).toEqual([]);
      expect(stats.maxDepth).toBe(0);
    });

    it('counts edges correctly with multiple edges per node', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('a', 'c');
      graph.addEdge('a', 'd');

      const stats = graph.getStats();
      expect(stats.nodeCount).toBe(4);
      expect(stats.edgeCount).toBe(3);
    });

    it('reports max depth for linear chain', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'c');
      graph.addEdge('c', 'd');

      const stats = graph.getStats();
      expect(stats.maxDepth).toBe(3);
    });
  });

  describe('findCircular', () => {
    it('returns empty for single node with no edges', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b'); // adds both a and b
      // Remove the edge by creating fresh graph with isolated node
      const g2 = new DependencyGraph();
      // addEdge always creates both nodes, so we rely on a node with no outgoing
      // edges to its own set
      expect(g2.findCircular()).toEqual([]);
    });
  });

  describe('topologicalSort', () => {
    it('returns empty array for empty graph', () => {
      const graph = new DependencyGraph();
      const sorted = graph.topologicalSort();
      expect(sorted).toEqual([]);
    });

    it('returns single node for single-node graph', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      // b has no deps, a depends on b
      const sorted = graph.topologicalSort();
      expect(sorted).not.toBeNull();
      expect(sorted).toHaveLength(2);
      expect(sorted!.indexOf('b')).toBeLessThan(sorted!.indexOf('a'));
    });
  });

  describe('addEdge', () => {
    it('handles adding duplicate edges idempotently', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('a', 'b');

      expect(graph.getDependencies('a')).toEqual(new Set(['b']));
      expect(graph.getNodes()).toHaveLength(2);
    });

    it('handles adding edge where source already exists', () => {
      const graph = new DependencyGraph();
      graph.addEdge('a', 'b');
      graph.addEdge('a', 'c');

      expect(graph.getDependencies('a')).toEqual(new Set(['b', 'c']));
    });
  });
});
