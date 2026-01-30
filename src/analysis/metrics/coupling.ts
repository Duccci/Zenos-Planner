/**
 * Coupling metrics calculator
 * Measures afferent (incoming) and efferent (outgoing) dependencies between modules
 */

import path from 'path';
import type { CouplingMetrics, ModuleCoupling, Module } from '../types.js';
import { DependencyGraph } from '../graph/dependency-graph.js';

const HIGH_COUPLING_THRESHOLD = 0.7;

/**
 * Resolve relative import path to potential module paths
 * @param importPath - Import path from code
 * @param fromFilePath - File path containing the import
 * @returns List of possible resolved paths
 */
export function resolveImportPath(importPath: string, fromFilePath: string): string[] {
  // If it's a node_modules package, don't resolve
  if (!importPath.startsWith('.')) {
    return [importPath]; // Return as-is for package names
  }

  const fromDir = path.dirname(fromFilePath);
  const basePath = path.resolve(fromDir, importPath);

  // Generate possible paths (with and without extensions)
  const possibilities = [
    path.normalize(basePath).replace(/\\/g, '/'),
    path.normalize(`${basePath}.ts`).replace(/\\/g, '/'),
    path.normalize(`${basePath}.tsx`).replace(/\\/g, '/'),
    path.normalize(`${basePath}.js`).replace(/\\/g, '/'),
    path.normalize(`${basePath}.jsx`).replace(/\\/g, '/'),
    path.normalize(`${basePath}/index.ts`).replace(/\\/g, '/'),
    path.normalize(`${basePath}/index.tsx`).replace(/\\/g, '/'),
    path.normalize(`${basePath}/index.js`).replace(/\\/g, '/'),
    path.normalize(`${basePath}/index.jsx`).replace(/\\/g, '/'),
  ];

  return possibilities;
}

/**
 * Calculate coupling metrics for modules
 * @param modules - Map of file path to module information
 * @returns Coupling metrics
 */
export function calculateCoupling(
  modules: Map<string, Module>
): CouplingMetrics {
  const graph = new DependencyGraph();

  for (const [module, moduleInfo] of modules) {
    for (const dep of moduleInfo.dependencies.imports) {
      const resolvedPaths = resolveImportPath(dep.source, module);

      // Check if any resolved path matches a module in our codebase
      for (const resolvedPath of resolvedPaths) {
        if (modules.has(resolvedPath)) {
          graph.addEdge(module, resolvedPath);
          break; // Found a match, no need to check other possibilities
        }
      }
    }
  }

  const moduleCouplings = new Map<string, ModuleCoupling>();
  const highCoupling: ModuleCoupling[] = [];
  let totalInstability = 0;

  for (const node of modules.keys()) {
    const efferent = graph.getDependencies(node).size;
    const afferent = graph.getDependents(node).size;
    const instability = efferent + afferent > 0 ? efferent / (efferent + afferent) : 0;

    const moduleCoupling = {
      filePath: node,
      afferent,
      efferent,
      instability,
    };

    moduleCouplings.set(node, moduleCoupling);

    if (instability >= HIGH_COUPLING_THRESHOLD && efferent + afferent > 0) {
      highCoupling.push(moduleCoupling);
    }

    totalInstability += instability;
  }

  return {
    modules: moduleCouplings,
    averageInstability: modules.size > 0 ? totalInstability / modules.size : 0,
    highCoupling,
  };
}