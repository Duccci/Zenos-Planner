import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { parseFileTreeSitter } from '../../src/analysis/tree-sitter-parser.js';
import {
  extractTreeSitterMetrics,
  countBranchNodes,
  BRANCH_TYPES,
} from '../../src/analysis/tree-sitter-metrics.js';
import type { TreeSitterParseResult } from '../../src/analysis/types.js';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');

let pyResult: TreeSitterParseResult;
let rsResult: TreeSitterParseResult;
let goResult: TreeSitterParseResult;
let cppResult: TreeSitterParseResult;

beforeAll(async () => {
  [pyResult, rsResult, goResult, cppResult] = await Promise.all([
    parseFileTreeSitter(path.join(FIXTURES, 'sample.py')),
    parseFileTreeSitter(path.join(FIXTURES, 'sample.rs')),
    parseFileTreeSitter(path.join(FIXTURES, 'sample.go')),
    parseFileTreeSitter(path.join(FIXTURES, 'sample.cpp')),
  ]);
});

describe('extractTreeSitterMetrics', () => {
  it('returns non-zero totalLines for Python fixture', () => {
    const m = extractTreeSitterMetrics(pyResult);
    expect(m.totalLines).toBeGreaterThan(20);
  });

  it('satisfies totalLines = codeLines + blankLines + commentLines (Python)', () => {
    const m = extractTreeSitterMetrics(pyResult);
    expect(m.codeLines + m.blankLines + m.commentLines).toBe(m.totalLines);
  });

  it('satisfies totalLines = codeLines + blankLines + commentLines (Rust)', () => {
    const m = extractTreeSitterMetrics(rsResult);
    expect(m.codeLines + m.blankLines + m.commentLines).toBe(m.totalLines);
  });

  it('detects comment lines in Rust fixture', () => {
    const m = extractTreeSitterMetrics(rsResult);
    expect(m.commentLines).toBeGreaterThan(0);
  });

  it('detects comment lines in C++ fixture', () => {
    const m = extractTreeSitterMetrics(cppResult);
    expect(m.commentLines).toBeGreaterThan(0);
  });

  it('returns accurate LOC for Go fixture', () => {
    const m = extractTreeSitterMetrics(goResult);
    expect(m.totalLines).toBeGreaterThan(20);
    expect(m.codeLines).toBeGreaterThan(0);
  });

  it('returns all-zero metrics for a failed parse result', () => {
    const failed: TreeSitterParseResult = {
      filePath: '/fake.py',
      language: 'python',
      nodeCount: 0,
      rootNode: null,
      success: false,
      error: 'synthetic failure',
    };
    const m = extractTreeSitterMetrics(failed);
    expect(m.totalLines).toBe(0);
    expect(m.codeLines).toBe(0);
    expect(m.blankLines).toBe(0);
    expect(m.commentLines).toBe(0);
  });
});

describe('countBranchNodes', () => {
  it('returns > 0 for Python fixture', () => {
    expect(countBranchNodes(pyResult)).toBeGreaterThan(0);
  });

  it('returns > 0 for Rust fixture', () => {
    expect(countBranchNodes(rsResult)).toBeGreaterThan(0);
  });

  it('returns > 0 for Go fixture', () => {
    expect(countBranchNodes(goResult)).toBeGreaterThan(0);
  });

  it('returns > 0 for C++ fixture', () => {
    expect(countBranchNodes(cppResult)).toBeGreaterThan(0);
  });

  it('returns 0 for a failed parse result', () => {
    const failed: TreeSitterParseResult = {
      filePath: '/fake.rs',
      language: 'rust',
      nodeCount: 0,
      rootNode: null,
      success: false,
    };
    expect(countBranchNodes(failed)).toBe(0);
  });

  it('exports BRANCH_TYPES for all supported languages', () => {
    for (const lang of ['python', 'rust', 'go', 'cpp', 'c']) {
      expect(BRANCH_TYPES[lang]).toBeDefined();
      expect(BRANCH_TYPES[lang]!.length).toBeGreaterThan(0);
    }
  });
});
