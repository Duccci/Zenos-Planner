import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseFileTreeSitter } from '../../src/analysis/tree-sitter-parser.js';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');

describe('parseFileTreeSitter', () => {
  it('parses a Python file successfully', async () => {
    const result = await parseFileTreeSitter(path.join(FIXTURES, 'sample.py'));
    expect(result.success).toBe(true);
    expect(result.language).toBe('python');
    expect(result.nodeCount).toBeGreaterThan(0);
    expect(result.rootNode).not.toBeNull();
    expect(result.error).toBeUndefined();
  });

  it('parses a Rust file successfully', async () => {
    const result = await parseFileTreeSitter(path.join(FIXTURES, 'sample.rs'));
    expect(result.success).toBe(true);
    expect(result.language).toBe('rust');
    expect(result.nodeCount).toBeGreaterThan(0);
  });

  it('parses a Go file successfully', async () => {
    const result = await parseFileTreeSitter(path.join(FIXTURES, 'sample.go'));
    expect(result.success).toBe(true);
    expect(result.language).toBe('go');
    expect(result.nodeCount).toBeGreaterThan(0);
  });

  it('parses a C++ file successfully', async () => {
    const result = await parseFileTreeSitter(path.join(FIXTURES, 'sample.cpp'));
    expect(result.success).toBe(true);
    expect(result.language).toBe('cpp');
    expect(result.nodeCount).toBeGreaterThan(0);
  });

  it('stores source text on successful parse', async () => {
    const result = await parseFileTreeSitter(path.join(FIXTURES, 'sample.py'));
    expect(result.source).toBeDefined();
    expect(result.source!.length).toBeGreaterThan(0);
    expect(result.source).toContain('fibonacci');
  });

  it('returns success:false for an unsupported extension', async () => {
    const result = await parseFileTreeSitter(path.join(FIXTURES, 'sample.py') + '.xyz');
    // Rename trick — just pass a path with unsupported ext directly
    const r2 = await parseFileTreeSitter('/tmp/test.xyz');
    expect(r2.success).toBe(false);
    expect(r2.error).toMatch(/Unsupported extension/);
    // Suppress unused variable lint
    void result;
  });

  it('returns success:false for a file with no extension', async () => {
    const result = await parseFileTreeSitter('/tmp/Makefile');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unsupported extension/);
  });

  it('returns success:false for a nonexistent .py file', async () => {
    const result = await parseFileTreeSitter('/nonexistent/path/does-not-exist.py');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot read file/);
  });
});
