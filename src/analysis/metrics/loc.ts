/**
 * Lines of Code (LOC) counter
 * Counts total lines, code lines, blank lines, and comment lines
 */

import { promises as fs } from 'fs';
import type { LineMetrics, LOCMetrics } from '../types.js';

/**
 * Count lines of code metrics for a single file
 * @param filePath - Absolute path to the file
 * @returns LOC metrics for the file
 */
export async function countLines(filePath: string): Promise<LineMetrics> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Normalize line endings to \n
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n');

  let codeLines = 0;
  let blankLines = 0;
  let commentLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      blankLines++;
    } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || (trimmed.startsWith('*') && !trimmed.startsWith('*/'))) {
      commentLines++;
    } else {
      codeLines++;
    }
  }

  return {
    filePath,
    totalLines: lines.length,
    codeLines,
    blankLines,
    commentLines,
  };
}

/**
 * Count LOC metrics for multiple files
 * @param filePaths - Array of absolute file paths
 * @returns Overall LOC metrics
 */
export async function countLOCMetrics(filePaths: string[]): Promise<LOCMetrics> {
  const files = new Map<string, LineMetrics>();

  let totalLines = 0;
  let totalCodeLines = 0;
  let totalBlankLines = 0;
  let totalCommentLines = 0;

  for (const filePath of filePaths) {
    const metrics = await countLines(filePath);
    files.set(filePath, metrics);

    totalLines += metrics.totalLines;
    totalCodeLines += metrics.codeLines;
    totalBlankLines += metrics.blankLines;
    totalCommentLines += metrics.commentLines;
  }

  return {
    files,
    totalLines,
    totalCodeLines,
    totalBlankLines,
    totalCommentLines,
  };
}