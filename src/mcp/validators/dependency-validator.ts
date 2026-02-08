/**
 * Dependency Validator
 *
 * Validates proposal/gate dependencies:
 * - Dependencies belong to same or earlier gates
 * - No circular dependencies
 * - All blocking dependencies are listed
 */

export interface DependencyNode {
  hash: string
  dependencies: string[]
  gateId?: string
  gateSequence?: number
}

export interface DependencyValidationContext {
  /** Current node (proposal or gate) */
  node: DependencyNode
  /** All nodes in the system */
  allNodes: Map<string, DependencyNode>
}

export interface ValidationResult {
  allowed: boolean
  errors?: string[]
  warnings?: string[]
}

/**
 * Detect circular dependencies using DFS.
 * Returns the circular path if found, null otherwise.
 */
function detectCircularDependency(
  nodeHash: string,
  allNodes: Map<string, DependencyNode>,
  visited = new Set<string>(),
  path: string[] = []
): string[] | null {
  if (path.includes(nodeHash)) {
    // Circular dependency found
    return [...path.slice(path.indexOf(nodeHash)), nodeHash]
  }

  if (visited.has(nodeHash)) {
    return null // Already checked this branch
  }

  visited.add(nodeHash)
  const node = allNodes.get(nodeHash)
  if (!node) return null

  for (const depHash of node.dependencies) {
    const circular = detectCircularDependency(depHash, allNodes, visited, [...path, nodeHash])
    if (circular) return circular
  }

  return null
}

/**
 * Validate dependency constraints for a proposal or gate.
 */
export function validateDependencies(context: DependencyValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { node, allNodes } = context

  // Rule 1: Check for circular dependencies
  const circularPath = detectCircularDependency(node.hash, allNodes)
  if (circularPath) {
    errors.push(
      `Circular dependency detected: ${circularPath.join(' → ')}. ` +
        `Dependencies must form a directed acyclic graph (DAG).`
    )
  }

  // Rule 2: Dependencies must belong to same or earlier gates
  if (node.gateSequence !== undefined) {
    for (const depHash of node.dependencies) {
      const depNode = allNodes.get(depHash)
      if (depNode?.gateSequence !== undefined) {
        if (depNode.gateSequence > node.gateSequence) {
          errors.push(
            `Dependency ${depHash} (gate ${depNode.gateId ?? '<unknown>'}, sequence ${String(depNode.gateSequence)}) ` +
              `is in a later gate than ${node.hash} (gate ${node.gateId ?? '<unknown>'}, sequence ${String(node.gateSequence)}). ` +
              `Dependencies must be in the same or earlier gates.`
          )
        }
      }
    }
  }

  // Rule 3: Check for missing dependencies (heuristic warnings)
  for (const depHash of node.dependencies) {
    if (!allNodes.has(depHash)) {
      warnings.push(
        `Dependency ${depHash} not found in system. ` +
          `Verify this hash exists or will be created.`
      )
    }
  }

  return {
    allowed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
