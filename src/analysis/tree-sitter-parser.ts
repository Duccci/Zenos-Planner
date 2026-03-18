/**
 * Tree-sitter parser backend for non-JS/TS languages.
 * All requires are wrapped in try/catch so the module loads even when
 * tree-sitter optional dependencies are not installed.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { TreeSitterParseResult } from './types.js';

/** Map file extension → npm grammar package name */
const EXTENSION_TO_GRAMMAR: Record<string, string> = {
  '.py': 'tree-sitter-python',
  '.rs': 'tree-sitter-rust',
  '.go': 'tree-sitter-go',
  '.cpp': 'tree-sitter-cpp',
  '.c': 'tree-sitter-cpp',
  '.h': 'tree-sitter-cpp',
};

/** Map file extension → canonical language name */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
};

/** Iterative CST walker – counts every node in the tree */
function countNodes(root: unknown): number {
  let count = 0;
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as Record<string, unknown>;
    count++;
    const children = node['children'];
    if (Array.isArray(children)) {
      for (const child of children) {
        stack.push(child);
      }
    }
  }
  return count;
}

/**
 * Parse a file using the appropriate Tree-sitter grammar.
 *
 * Returns `success: false` when:
 * - The file extension is not supported
 * - The tree-sitter or grammar package is not installed
 * - The file cannot be read from disk
 */
export async function parseFileTreeSitter(
  filePath: string
): Promise<TreeSitterParseResult> {
  const ext = path.extname(filePath).toLowerCase();
  const grammarName = EXTENSION_TO_GRAMMAR[ext];
  const language = EXTENSION_TO_LANGUAGE[ext];

  if (!grammarName || !language) {
    return {
      filePath,
      language: '',
      nodeCount: 0,
      rootNode: null,
      success: false,
      error: `Unsupported extension: ${ext || '(none)'}`,
    };
  }

  // Load tree-sitter parser (optional dependency)
  let Parser: new () => {
    setLanguage(grammar: unknown): void;
    parse(source: string): { rootNode: unknown };
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Parser = require('tree-sitter') as typeof Parser;
  } catch {
    return {
      filePath,
      language,
      nodeCount: 0,
      rootNode: null,
      success: false,
      error: 'tree-sitter package not available',
    };
  }

  // Load language grammar (optional dependency)
  let grammar: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    grammar = require(grammarName) as unknown;
  } catch {
    return {
      filePath,
      language,
      nodeCount: 0,
      rootNode: null,
      success: false,
      error: `Grammar package not available: ${grammarName}`,
    };
  }

  // Read source file
  let source: string;
  try {
    source = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    return {
      filePath,
      language,
      nodeCount: 0,
      rootNode: null,
      success: false,
      error: `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Parse
  const parser = new Parser();
  parser.setLanguage(grammar);
  const tree = parser.parse(source);
  const rootNode = tree.rootNode;

  return {
    filePath,
    language,
    nodeCount: countNodes(rootNode),
    rootNode,
    success: true,
    source,
  };
}
