/**
 * Tests for lines of code counter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { countLines, countLOCMetrics } from '../../../src/analysis/metrics/loc.js';
import path from 'path';
import os from 'os';

describe('countLines', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loc-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('counts lines in a simple file', async () => {
    const content = `line 1
line 2
line 3`;

    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, content);

    const result = await countLines(filePath);

    expect(result.totalLines).toBe(3);
    expect(result.codeLines).toBe(3);
    expect(result.blankLines).toBe(0);
    expect(result.commentLines).toBe(0);
  });

  it('counts blank lines', async () => {
    const content = `line 1

line 3

line 5`;

    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, content);

    const result = await countLines(filePath);

    expect(result.totalLines).toBe(5);
    expect(result.codeLines).toBe(3);
    expect(result.blankLines).toBe(2);
    expect(result.commentLines).toBe(0);
  });

  it('counts comment lines', async () => {
    const content = `// comment 1
code line
// comment 2
more code
/* block comment */
/*
multi
line
comment
*/
final code`;

    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, content);

    const result = await countLines(filePath);

    expect(result.totalLines).toBe(11);
    expect(result.codeLines).toBe(7);
    expect(result.blankLines).toBe(0);
    expect(result.commentLines).toBe(4);
  });

  it('handles CRLF line endings', async () => {
    const content = 'line 1\r\nline 2\r\nline 3';

    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, content);

    const result = await countLines(filePath);

    expect(result.totalLines).toBe(3);
    expect(result.codeLines).toBe(3);
  });

  it('handles mixed whitespace', async () => {
    const content = `   
\t\t
// comment
   code   
\t
`;

    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, content);

    const result = await countLines(filePath);

    expect(result.totalLines).toBe(6);
    expect(result.codeLines).toBe(1);
    expect(result.blankLines).toBe(4);
    expect(result.commentLines).toBe(1);
  });
});

describe('countLOCMetrics', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loc-metrics-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('calculates metrics for multiple files', async () => {
    const file1 = path.join(tempDir, 'file1.ts');
    await fs.writeFile(file1, `code1
code2`);

    const file2 = path.join(tempDir, 'file2.ts');
    await fs.writeFile(file2, `// comment
code
`);

    const result = await countLOCMetrics([file1, file2]);

    expect(result.files.size).toBe(2);
    expect(result.totalLines).toBe(5);
    expect(result.totalCodeLines).toBe(3);
    expect(result.totalBlankLines).toBe(1);
    expect(result.totalCommentLines).toBe(1);
  });

  it('handles empty file list', async () => {
    const result = await countLOCMetrics([]);

    expect(result.files.size).toBe(0);
    expect(result.totalLines).toBe(0);
    expect(result.totalCodeLines).toBe(0);
    expect(result.totalBlankLines).toBe(0);
    expect(result.totalCommentLines).toBe(0);
  });
});