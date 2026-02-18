/**
 * Cyclomatic complexity calculator
 * Measures decision points in code to assess complexity
 */

import type { NodePath } from '@babel/traverse'
import type {
  FunctionDeclaration,
  FunctionExpression,
  ArrowFunctionExpression,
  ClassMethod,
  SwitchCase,
  LogicalExpression,
} from '@babel/types'

// Babel traverse typing is complex, use lazy loading
type TraverseFn = (
  ast: object,
  visitors: Record<string, unknown>,
  scope?: unknown,
  path?: unknown
) => void
let traverse: TraverseFn | null = null

function getTraverse(): TraverseFn {
  if (!traverse) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const traverseModule = require('@babel/traverse') as { default?: TraverseFn } | TraverseFn
    traverse =
      typeof traverseModule === 'function'
        ? traverseModule
        : (traverseModule as { default: TraverseFn }).default
  }
  return traverse
}

import type { File as BabelFile } from '@babel/types'
import type { ComplexityMetrics, ModuleComplexity, FunctionComplexity } from '../types.js'

/**
 * Calculate cyclomatic complexity for a single file
 * @param ast - Babel AST of the file
 * @param filePath - File path for context
 * @returns Complexity metrics for the file
 */
export function calculateComplexity(ast: BabelFile, filePath: string): ComplexityMetrics {
  const moduleComplexity = calculateModuleComplexity(ast, filePath)
  const allComplexities = moduleComplexity.functions.map((func) => func.complexity)
  const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 0
  const averageComplexity =
    allComplexities.length > 0
      ? allComplexities.reduce((a, b) => a + b, 0) / allComplexities.length
      : 0

  return {
    modules: new Map([[filePath, moduleComplexity]]),
    maxComplexity,
    averageComplexity,
  }
}

function calculateModuleComplexity(ast: BabelFile, filePath: string): ModuleComplexity {
  const functions: FunctionComplexity[] = []

  getTraverse()(ast, {
    FunctionDeclaration(nodePath: NodePath<FunctionDeclaration>) {
      const complexity = calculateFunctionComplexity(nodePath)
      const { start, end } = nodePath.node.loc ?? { start: { line: 0 }, end: { line: 0 } }
      functions.push({
        name: nodePath.node.id?.name ?? '<anonymous>',
        complexity,
        startLine: start.line,
        endLine: end.line,
      })
    },

    FunctionExpression(nodePath: NodePath<FunctionExpression>) {
      const complexity = calculateFunctionComplexity(nodePath)
      const { start, end } = nodePath.node.loc ?? { start: { line: 0 }, end: { line: 0 } }
      functions.push({
        name: '<anonymous>',
        complexity,
        startLine: start.line,
        endLine: end.line,
      })
    },

    ArrowFunctionExpression(nodePath: NodePath<ArrowFunctionExpression>) {
      const complexity = calculateFunctionComplexity(nodePath)
      const { start, end } = nodePath.node.loc ?? { start: { line: 0 }, end: { line: 0 } }
      functions.push({
        name: '<arrow>',
        complexity,
        startLine: start.line,
        endLine: end.line,
      })
    },

    // Also handle class methods
    ClassMethod(nodePath: NodePath<ClassMethod>) {
      const complexity = calculateFunctionComplexity(nodePath)
      const { start, end } = nodePath.node.loc ?? { start: { line: 0 }, end: { line: 0 } }
      const keyNode = nodePath.node.key
      const keyName =
        keyNode.type === 'Identifier'
          ? keyNode.name
          : keyNode.type === 'StringLiteral'
            ? keyNode.value
            : 'name' in keyNode && typeof keyNode.name === 'string'
              ? keyNode.name
              : '<method>'
      functions.push({
        name: keyName,
        complexity,
        startLine: start.line,
        endLine: end.line,
      })
    },
  })

  const complexities = functions.map((f) => f.complexity)
  const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0
  const averageComplexity =
    complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0

  return {
    filePath,
    functions,
    maxComplexity,
    averageComplexity,
  }
}

/**
 * Calculate complexity for a single function
 * @param functionPath - Babel traverse path for the function
 * @returns Cyclomatic complexity score
 */
function calculateFunctionComplexity(
  functionPath: NodePath<
    FunctionDeclaration | FunctionExpression | ArrowFunctionExpression | ClassMethod
  >
): number {
  let complexity = 1 // Base complexity
  const traverseFn = getTraverse()

  traverseFn(
    functionPath.node,
    {
      // Control flow statements
      IfStatement() {
        complexity++
      },

      ConditionalExpression() {
        // ternary ?:
        complexity++
      },

      SwitchCase(nodePath: NodePath<SwitchCase>) {
        // Only count cases, not default
        if (!nodePath.node.test) return // default case
        complexity++
      },

      // Loops
      ForStatement() {
        complexity++
      },

      ForInStatement() {
        complexity++
      },

      ForOfStatement() {
        complexity++
      },

      WhileStatement() {
        complexity++
      },

      DoWhileStatement() {
        complexity++
      },

      // Exception handling
      CatchClause() {
        complexity++
      },

      // Logical operators in conditions (simplified)
      LogicalExpression(nodePath: NodePath<LogicalExpression>) {
        // Only count && and || in conditional contexts
        if (isInCondition(nodePath)) {
          complexity++
        }
      },
    },
    functionPath.scope,
    functionPath
  )

  return complexity
}

/**
 * Check if a logical expression is in a conditional context
 * @param nodePath - Babel traverse path
 * @returns True if in if/switch/while condition
 */
function isInCondition(nodePath: NodePath<LogicalExpression>): boolean {
  let current: NodePath | null = nodePath.parentPath
  while (current) {
    const node = current.node as unknown as Record<string, unknown>
    const type = current.node.type
    if (type === 'IfStatement' && node['test'] === nodePath.node) return true
    if (type === 'WhileStatement' && node['test'] === nodePath.node) return true
    if (type === 'DoWhileStatement' && node['test'] === nodePath.node) return true
    if (type === 'ConditionalExpression' && node['test'] === nodePath.node) return true
    if (type === 'SwitchStatement' && node['discriminant'] === nodePath.node) return true
    if (type === 'ForStatement' && node['test'] === nodePath.node) return true

    // Stop at function boundaries
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(type)) {
      break
    }

    current = current.parentPath
  }
  return false
}

/**
 * Calculate complexity metrics for multiple modules
 * @param modules - Map of file paths to ASTs
 * @returns Overall complexity metrics
 */
export function calculateComplexityMetrics(modules: Map<string, BabelFile>): ComplexityMetrics {
  const moduleComplexities = new Map<string, ModuleComplexity>()
  const allComplexities: number[] = []

  for (const [filePath, ast] of modules) {
    const moduleComplexity = calculateModuleComplexity(ast, filePath)
    moduleComplexities.set(filePath, moduleComplexity)
    allComplexities.push(...moduleComplexity.functions.map((f) => f.complexity))
  }

  const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 0
  const averageComplexity =
    allComplexities.length > 0
      ? allComplexities.reduce((a, b) => a + b, 0) / allComplexities.length
      : 0

  return {
    modules: moduleComplexities,
    maxComplexity,
    averageComplexity,
  }
}
