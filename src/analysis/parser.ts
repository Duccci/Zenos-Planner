/**
 * Babel parser wrapper for safe, configurable JavaScript/TypeScript parsing
 */

import * as parser from '@babel/parser';
import { promises as fs } from 'fs';
import path from 'path';
import type { ParseResult } from './types.js';
import type { File as BabelFile } from '@babel/types';

/**
 * Cache for parser options by file extension
 */
const parserOptionsCache = new Map<string, parser.ParserOptions>();

/**
 * Get parser options based on file extension
 */
function getParserOptions(filePath: string): parser.ParserOptions {
  const ext = path.extname(filePath);

  if (parserOptionsCache.has(ext)) {
    const cached = parserOptionsCache.get(ext);
    if (cached !== undefined) {
      return cached;
    }
  }

  // Determine parser options based on file extension
  const options: parser.ParserOptions =
    ext === '.ts' || ext === '.tsx'
      ? {
          sourceType: 'module',
          plugins: [
            'typescript',
            'jsx',
            ['pipelineOperator', { proposal: 'minimal' }],
            'decorators',
            'classProperties',
            'classPrivateProperties',
          ],
        }
      : {
          sourceType: 'module',
          plugins: [
            'jsx',
            ['pipelineOperator', { proposal: 'minimal' }],
            'decorators',
            'classProperties',
            'classPrivateProperties',
          ],
        };

  parserOptionsCache.set(ext, options);
  return options;
}

/**
 * Parse a single file and return AST or error
 * @param filePath - Absolute file path to parse
 * @returns ParseResult with AST or error information
 */
export async function parseFile(filePath: string): Promise<ParseResult> {
  const absolutePath = path.resolve(filePath);

  try {
    // Read file content
    const content = await fs.readFile(absolutePath, 'utf-8');

    // Get appropriate parser options for this file type
    const options = getParserOptions(absolutePath);

    // Parse the file
    const ast = parser.parse(content, options) as BabelFile;

    return {
      filePath: absolutePath,
      ast,
      success: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      filePath: absolutePath,
      ast: null,
      error: errorMessage,
      success: false,
    };
  }
}

/**
 * Check if a file is parseable (without actually parsing it)
 * @param filePath - File path to check
 * @returns true if file has a supported extension
 */
export function isParseable(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
}
