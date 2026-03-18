/**
 * Metrics extraction from Tree-sitter parse results.
 * Provides LOC breakdown (code / blank / comment) and cyclomatic-complexity
 * branch-node counts for supported languages.
 */

import type { TreeSitterParseResult, LineMetrics } from './types.js';

/** Comment node-type identifiers per language */
const COMMENT_TYPES: Record<string, string[]> = {
  python: ['comment'],
  rust: ['line_comment', 'block_comment'],
  go: ['comment'],
  cpp: ['comment'],
  c: ['comment'],
};

/** Branch node-type identifiers per language (exported for tests) */
export const BRANCH_TYPES: Record<string, string[]> = {
  python: [
    'if_statement',
    'elif_clause',
    'for_statement',
    'while_statement',
    'except_clause',
    'with_statement',
    'conditional_expression',
    'boolean_operator',
  ],
  rust: [
    'if_expression',
    'if_let_expression',
    'for_expression',
    'while_expression',
    'while_let_expression',
    'match_arm',
  ],
  go: ['if_statement', 'for_statement', 'type_case_clause', 'expression_case', 'communication_case'],
  cpp: [
    'if_statement',
    'for_statement',
    'for_range_loop',
    'while_statement',
    'do_statement',
    'case_statement',
    'conditional_expression',
  ],
  c: [
    'if_statement',
    'for_statement',
    'for_range_loop',
    'while_statement',
    'do_statement',
    'case_statement',
    'conditional_expression',
  ],
};

/** Safe cast: treat unknown rootNode as a node record */
function asNode(n: unknown): Record<string, unknown> {
  return n as Record<string, unknown>;
}

/**
 * Iterative CST walker — collects all node type strings in the tree.
 * Each entry is `{ type, startRow, endRow }`.
 */
function collectNodeTypes(
  root: unknown
): { type: string; startRow: number; endRow: number }[] {
  const results: { type: string; startRow: number; endRow: number }[] = [];
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = asNode(stack.pop());
    const type = node['type'] as string | undefined;
    const startPosition = asNode(node['startPosition'] ?? {});
    const endPosition = asNode(node['endPosition'] ?? {});
    if (type !== undefined) {
      results.push({
        type,
        startRow: (startPosition['row'] as number | undefined) ?? 0,
        endRow: (endPosition['row'] as number | undefined) ?? 0,
      });
    }
    const children = node['children'];
    if (Array.isArray(children)) {
      for (const child of children) {
        stack.push(child);
      }
    }
  }
  return results;
}

/**
 * Extract LOC metrics from a successful Tree-sitter parse result.
 * Falls back to zero counts if the result is not successful.
 */
export function extractTreeSitterMetrics(result: TreeSitterParseResult): LineMetrics {
  if (!result.success || result.rootNode === null || result.source === undefined) {
    return { filePath: result.filePath, totalLines: 0, codeLines: 0, blankLines: 0, commentLines: 0 };
  }

  const lines = result.source.split('\n');
  // Trim trailing empty string produced when file ends with \n
  const lastLine = lines[lines.length - 1];
  const effectiveLines = lastLine === '' ? lines.slice(0, -1) : lines;
  const totalLines = effectiveLines.length;

  // Collect comment row ranges from CST
  const commentTypes = new Set(COMMENT_TYPES[result.language] ?? []);
  const commentRows = new Set<number>();
  if (commentTypes.size > 0) {
    const nodes = collectNodeTypes(result.rootNode);
    for (const node of nodes) {
      if (commentTypes.has(node.type)) {
        for (let r = node.startRow; r <= node.endRow; r++) {
          commentRows.add(r);
        }
      }
    }
  }

  let blankLines = 0;
  let commentLines = 0;
  let codeLines = 0;

  for (let i = 0; i < totalLines; i++) {
    const trimmed = (effectiveLines[i] ?? '').trim();
    if (trimmed.length === 0) {
      blankLines++;
    } else if (commentRows.has(i)) {
      commentLines++;
    } else {
      codeLines++;
    }
  }

  return { filePath: result.filePath, totalLines, codeLines, blankLines, commentLines };
}

/**
 * Count branch/decision nodes in the CST for a cyclomatic-complexity
 * approximation. Returns 0 for failed parse results.
 */
export function countBranchNodes(result: TreeSitterParseResult): number {
  if (!result.success || result.rootNode === null) return 0;

  const branchTypes = new Set(BRANCH_TYPES[result.language] ?? []);
  if (branchTypes.size === 0) return 0;

  let count = 0;
  const nodes = collectNodeTypes(result.rootNode);
  for (const node of nodes) {
    if (branchTypes.has(node.type)) count++;
  }
  return count;
}
