/**
 * Cyclomatic complexity calculator
 * Measures decision points in code to assess complexity
 */

/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-assignment */

// Babel traverse typing is complex, use lazy loading
let traverse: any = null;

function getTraverse(): any {
  if (!traverse) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const traverseModule = require('@babel/traverse');
    traverse = traverseModule.default ?? traverseModule;
  }
  return traverse;
}

import type { File as BabelFile } from '@babel/types';
import type { ComplexityMetrics, ModuleComplexity, FunctionComplexity } from '../types.js';

/**
 * Calculate cyclomatic complexity for a single file
 * @param ast - Babel AST of the file
 * @param filePath - File path for context
 * @returns Complexity metrics for the file
 */
export function calculateComplexity(
  ast: BabelFile,
  filePath: string
): ComplexityMetrics {
  const moduleComplexity = calculateModuleComplexity(ast, filePath);
  const allComplexities = moduleComplexity.functions.map((func) => func.complexity);
  const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 0;
  const averageComplexity = allComplexities.length > 0
    ? allComplexities.reduce((a, b) => a + b, 0) / allComplexities.length
    : 0;

  return {
    modules: new Map([[filePath, moduleComplexity]]),
    maxComplexity,
    averageComplexity,
  };
}

function calculateModuleComplexity(
  ast: BabelFile,
  filePath: string
): ModuleComplexity {
  const functions: FunctionComplexity[] = [];

  getTraverse()(ast as any, {
    FunctionDeclaration(nodePath: any) {
      const complexity = calculateFunctionComplexity(nodePath);
      const { start, end } = nodePath.node.loc ?? { start: { line: 0 }, end: { line: 0 } };
      functions.push({
        name: nodePath.node.id?.name ?? '<anonymous>',
        complexity,
        startLine: start.line,
        endLine: end.line,
      });
    },

    FunctionExpression(nodePath: any) {
      const complexity = calculateFunctionComplexity(nodePath);
      const { start, end } = nodePath.node.loc ?? { start: { line: 0 }, end: { line: 0 } };
      functions.push({
        name: '<anonymous>',
        complexity,
        startLine: start.line,
        endLine: end.line,
      });
    },

    ArrowFunctionExpression(nodePath: any) {
      const complexity = calculateFunctionComplexity(nodePath);
      const { start, end } = nodePath.node.loc ?? { start: { line: 0 }, end: { line: 0 } };
      functions.push({
        name: '<arrow>',
        complexity,
        startLine: start.line,
        endLine: end.line,
      });
    },

    // Also handle class methods
    ClassMethod(nodePath: any) {
      const complexity = calculateFunctionComplexity(nodePath);
      const { start, end } = nodePath.node.loc ?? { start: { line: 0 }, end: { line: 0 } };
      functions.push({
        name: nodePath.node.key?.name ?? '<method>',
        complexity,
        startLine: start.line,
        endLine: end.line,
      });
    },
  });

  const complexities = functions.map(f => f.complexity);
  const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0;
  const averageComplexity = complexities.length > 0
    ? complexities.reduce((a, b) => a + b, 0) / complexities.length
    : 0;

  return {
    filePath,
    functions,
    maxComplexity,
    averageComplexity,
  };
}

/**
 * Calculate complexity for a single function
 * @param functionPath - Babel traverse path for the function
 * @returns Cyclomatic complexity score
 */
function calculateFunctionComplexity(functionPath: any): number {
  let complexity = 1; // Base complexity

  traverse(functionPath.node, {
    // Control flow statements
    IfStatement() {
      complexity++;
    },

    ConditionalExpression() { // ternary ?:
      complexity++;
    },

    SwitchCase(nodePath: any) {
      // Only count cases, not default
      if (!nodePath.node.test) return; // default case
      complexity++;
    },

    // Loops
    ForStatement() {
      complexity++;
    },

    ForInStatement() {
      complexity++;
    },

    ForOfStatement() {
      complexity++;
    },

    WhileStatement() {
      complexity++;
    },

    DoWhileStatement() {
      complexity++;
    },

    // Exception handling
    CatchClause() {
      complexity++;
    },

    // Logical operators in conditions (simplified)
    LogicalExpression(nodePath: any) {
      // Only count && and || in conditional contexts
      if (isInCondition(nodePath)) {
        complexity++;
      }
    },
  }, functionPath.scope, functionPath);

  return complexity;
}

/**
 * Check if a logical expression is in a conditional context
 * @param nodePath - Babel traverse path
 * @returns True if in if/switch/while condition
 */
function isInCondition(nodePath: any): boolean {
  let current = nodePath.parentPath;
  while (current) {
    const type = current.node.type;
    if (type === 'IfStatement' && current.node.test === nodePath.node) return true;
    if (type === 'WhileStatement' && current.node.test === nodePath.node) return true;
    if (type === 'DoWhileStatement' && current.node.test === nodePath.node) return true;
    if (type === 'ConditionalExpression' && current.node.test === nodePath.node) return true;
    if (type === 'SwitchStatement' && current.node.discriminant === nodePath.node) return true;
    if (type === 'ForStatement' && current.node.test === nodePath.node) return true;

    // Stop at function boundaries
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(type)) {
      break;
    }

    current = current.parentPath;
  }
  return false;
}

/**
 * Calculate complexity metrics for multiple modules
 * @param modules - Map of file paths to ASTs
 * @returns Overall complexity metrics
 */
export function calculateComplexityMetrics(
  modules: Map<string, BabelFile>
): ComplexityMetrics {
  const moduleComplexities = new Map<string, ModuleComplexity>();
  const allComplexities: number[] = [];

  for (const [filePath, ast] of modules) {
    const moduleComplexity = calculateModuleComplexity(ast, filePath);
    moduleComplexities.set(filePath, moduleComplexity);
    allComplexities.push(...moduleComplexity.functions.map(f => f.complexity));
  }

  const maxComplexity = allComplexities.length > 0 ? Math.max(...allComplexities) : 0;
  const averageComplexity = allComplexities.length > 0
    ? allComplexities.reduce((a, b) => a + b, 0) / allComplexities.length
    : 0;

  return {
    modules: moduleComplexities,
    maxComplexity,
    averageComplexity,
  };
}