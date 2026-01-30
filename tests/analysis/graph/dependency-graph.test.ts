/**
 * Tests for dependency graph data structure
 */

import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../../../src/analysis/graph/dependency-graph.js';

describe('DependencyGraph', () => {
  it('starts empty', () => {
    const graph = new DependencyGraph();

    expect(graph.getNodes()).toEqual([]);
  });

  it('adds edges correctly', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('a.ts', 'c.ts');
    graph.addEdge('b.ts', 'd.ts');

    expect(graph.getNodes()).toHaveLength(4);
    expect(graph.getDependencies('a.ts')).toEqual(new Set(['b.ts', 'c.ts']));
    expect(graph.getDependencies('b.ts')).toEqual(new Set(['d.ts']));
    expect(graph.getDependencies('c.ts')).toEqual(new Set());
    expect(graph.getDependencies('d.ts')).toEqual(new Set());
  });

  it('gets dependents correctly', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('c.ts', 'b.ts');
    graph.addEdge('b.ts', 'd.ts');

    expect(graph.getDependents('b.ts')).toEqual(new Set(['a.ts', 'c.ts']));
    expect(graph.getDependents('d.ts')).toEqual(new Set(['b.ts']));
    expect(graph.getDependents('a.ts')).toEqual(new Set());
  });

  it('detects simple cycles', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('b.ts', 'c.ts');
    graph.addEdge('c.ts', 'a.ts');

    const cycles = graph.findCircular();

    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts']);
  });

  it('detects multiple cycles', () => {
    const graph = new DependencyGraph();

    // Cycle 1: a -> b -> c -> a
    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('b.ts', 'c.ts');
    graph.addEdge('c.ts', 'a.ts');

    // Cycle 2: x -> y -> x
    graph.addEdge('x.ts', 'y.ts');
    graph.addEdge('y.ts', 'x.ts');

    const cycles = graph.findCircular();

    expect(cycles).toHaveLength(2);
    expect(cycles).toContainEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts']);
    expect(cycles).toContainEqual(['x.ts', 'y.ts', 'x.ts']);
  });

  it('handles self-cycles', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'a.ts');

    const cycles = graph.findCircular();

    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual(['a.ts', 'a.ts']);
  });

  it('returns empty cycles for acyclic graph', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('b.ts', 'c.ts');
    graph.addEdge('d.ts', 'c.ts');

    const cycles = graph.findCircular();

    expect(cycles).toEqual([]);
  });

  it('performs topological sort on acyclic graph', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('a.ts', 'c.ts');
    graph.addEdge('b.ts', 'd.ts');
    graph.addEdge('c.ts', 'd.ts');

    const sorted = graph.topologicalSort();

    expect(sorted).not.toBeNull();
    // d should come before b and c, b and c before a
    const dIndex = sorted!.indexOf('d.ts');
    const bIndex = sorted!.indexOf('b.ts');
    const cIndex = sorted!.indexOf('c.ts');
    const aIndex = sorted!.indexOf('a.ts');

    expect(dIndex).toBeLessThan(bIndex);
    expect(dIndex).toBeLessThan(cIndex);
    expect(bIndex).toBeLessThan(aIndex);
    expect(cIndex).toBeLessThan(aIndex);
  });

  it('returns null for topological sort on cyclic graph', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('b.ts', 'a.ts');

    const sorted = graph.topologicalSort();

    expect(sorted).toBeNull();
  });

  it('calculates transitive dependencies', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('b.ts', 'c.ts');
    graph.addEdge('b.ts', 'd.ts');
    graph.addEdge('c.ts', 'e.ts');

    const transitive = graph.getTransitiveDependencies('a.ts');

    expect(transitive).toEqual(new Set(['b.ts', 'c.ts', 'd.ts', 'e.ts']));
  });

  it('calculates transitive dependencies with no self-reference', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'a.ts');

    const transitive = graph.getTransitiveDependencies('a.ts');

    expect(transitive).toEqual(new Set());
  });

  it('finds shortest path', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('a.ts', 'c.ts');
    graph.addEdge('b.ts', 'd.ts');
    graph.addEdge('c.ts', 'd.ts');
    graph.addEdge('d.ts', 'e.ts');

    const path = graph.getShortestPath('a.ts', 'e.ts');

    expect(path).toEqual(['a.ts', 'b.ts', 'd.ts', 'e.ts']);
  });

  it('returns null for non-existent path', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('c.ts', 'd.ts');

    const path = graph.getShortestPath('a.ts', 'd.ts');

    expect(path).toBeNull();
  });

  it('calculates graph statistics', () => {
    const graph = new DependencyGraph();

    graph.addEdge('a.ts', 'b.ts');
    graph.addEdge('a.ts', 'c.ts');
    graph.addEdge('b.ts', 'd.ts');
    graph.addEdge('c.ts', 'd.ts');
    graph.addEdge('d.ts', 'a.ts'); // creates cycle

    const stats = graph.getStats();

    expect(stats.nodeCount).toBe(4);
    expect(stats.edgeCount).toBe(5);
    expect(stats.cycles).toHaveLength(1);
    expect(stats.maxDepth).toBeGreaterThan(0);
  });
});