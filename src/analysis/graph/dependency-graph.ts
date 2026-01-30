/**
 * Dependency graph data structure
 * Directed graph representing module dependencies with analysis methods
 */

export class DependencyGraph {
  private adjacencyList: Map<string, Set<string>>;

  constructor() {
    this.adjacencyList = new Map();
  }

  /**
   * Add a directed edge from source to target (source depends on target)
   * @param source - Module that depends on target
   * @param target - Module being depended upon
   */
  addEdge(source: string, target: string): void {
    if (!this.adjacencyList.has(source)) {
      this.adjacencyList.set(source, new Set());
    }
    const sourceSet = this.adjacencyList.get(source);
    if (sourceSet) {
      sourceSet.add(target);
    }

    // Ensure target exists in the graph
    if (!this.adjacencyList.has(target)) {
      this.adjacencyList.set(target, new Set());
    }
  }

  /**
   * Get all nodes in the graph
   * @returns Array of all module paths
   */
  getNodes(): string[] {
    return Array.from(this.adjacencyList.keys());
  }

  /**
   * Get dependencies of a node
   * @param node - Module path
   * @returns Set of modules this node depends on
   */
  getDependencies(node: string): Set<string> {
    return this.adjacencyList.get(node) ?? new Set();
  }

  /**
   * Get dependents of a node (reverse dependencies)
   * @param node - Module path
   * @returns Set of modules that depend on this node
   */
  getDependents(node: string): Set<string> {
    const dependents = new Set<string>();
    for (const [source, targets] of this.adjacencyList) {
      if (targets.has(node)) {
        dependents.add(source);
      }
    }
    return dependents;
  }

  /**
   * Detect circular dependencies using DFS
   * @returns Array of circular dependency chains
   */
  findCircular(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found cycle
        const cycleStart = path.indexOf(node);
        cycles.push([...path.slice(cycleStart), node]);
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of this.getDependencies(node)) {
        dfs(neighbor, path);
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of this.getNodes()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Perform topological sort of the graph
   * @returns Array of nodes in topological order, or null if cycles exist
   */
  topologicalSort(): string[] | null {
    const cycles = this.findCircular();
    if (cycles.length > 0) {
      return null; // Cannot sort if cycles exist
    }

    const result: string[] = [];
    const visited = new Set<string>();
    const tempVisited = new Set<string>();

    const visit = (node: string): void => {
      if (tempVisited.has(node)) return; // Cycle detected (shouldn't happen)
      if (visited.has(node)) return;

      tempVisited.add(node);

      for (const neighbor of this.getDependencies(node)) {
        visit(neighbor);
      }

      tempVisited.delete(node);
      visited.add(node);
      result.push(node);
    };

    for (const node of this.getNodes()) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return result;
  }

  /**
   * Calculate transitive dependencies for a node
   * @param node - Module path
   * @returns Set of all transitive dependencies
   */
  getTransitiveDependencies(node: string): Set<string> {
    const visited = new Set<string>();
    const result = new Set<string>();

    const dfs = (current: string): void => {
      if (visited.has(current)) return;
      visited.add(current);

      for (const dep of this.getDependencies(current)) {
        result.add(dep);
        dfs(dep);
      }
    };

    dfs(node);
    result.delete(node); // Don't include self
    return result;
  }

  /**
   * Get the shortest path between two nodes
   * @param start - Starting module
   * @param end - Target module
   * @returns Array of nodes in path, or null if no path exists
   */
  getShortestPath(start: string, end: string): string[] | null {
    if (!this.adjacencyList.has(start) || !this.adjacencyList.has(end)) {
      return null;
    }

    const queue: { node: string; path: string[] }[] = [
      { node: start, path: [start] }
    ];
    const visited = new Set<string>([start]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue; // Should never happen since we check length > 0
      const { node, path } = current;

      if (node === end) {
        return path;
      }

      for (const neighbor of this.getDependencies(node)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ node: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return null;
  }

  /**
   * Get graph statistics
   * @returns Object with graph metrics
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    cycles: string[][];
    maxDepth: number;
  } {
    const nodeCount = this.adjacencyList.size;
    let edgeCount = 0;
    for (const edges of this.adjacencyList.values()) {
      edgeCount += edges.size;
    }

    const cycles = this.findCircular();

    // Calculate max depth (longest path)
    let maxDepth = 0;
    for (const node of this.getNodes()) {
      const depth = this.getMaxDepth(node);
      maxDepth = Math.max(maxDepth, depth);
    }

    return { nodeCount, edgeCount, cycles, maxDepth };
  }

  /**
   * Get maximum depth from a node (longest dependency chain)
   * @param node - Starting module
   * @returns Maximum depth
   */
  private getMaxDepth(node: string): number {
    const visited = new Set<string>();
    let maxDepth = 0;

    const dfs = (current: string, depth: number): void => {
      if (visited.has(current)) return;
      visited.add(current);
      maxDepth = Math.max(maxDepth, depth);

      for (const dep of this.getDependencies(current)) {
        dfs(dep, depth + 1);
      }
    };

    dfs(node, 0);
    return maxDepth;
  }
}