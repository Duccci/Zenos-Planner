/**
 * Manual spike: validates tree-sitter parsing works end-to-end
 * on all fixture files. Run with: npx tsx tests/analysis/tree-sitter-spike.ts
 */
import path from 'path';
import { parseFileTreeSitter } from '../../src/analysis/tree-sitter-parser.js';
import { extractTreeSitterMetrics, countBranchNodes } from '../../src/analysis/tree-sitter-metrics.js';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');

const fixtures = [
  { file: 'sample.py', language: 'python' },
  { file: 'sample.rs', language: 'rust' },
  { file: 'sample.go', language: 'go' },
  { file: 'sample.cpp', language: 'cpp' },
];

for (const { file, language } of fixtures) {
  const filePath = path.join(FIXTURES, file);
  const result = await parseFileTreeSitter(filePath);

  if (!result.success) {
    throw new Error(`[FAIL] ${file}: ${result.error ?? 'unknown error'}`);
  }

  const metrics = extractTreeSitterMetrics(result);
  const branches = countBranchNodes(result);

  console.log(`\n=== ${file} (${language}) ===`);
  console.log(`  Nodes     : ${result.nodeCount}`);
  console.log(`  Total LOC : ${metrics.totalLines}`);
  console.log(`  Code      : ${metrics.codeLines}`);
  console.log(`  Blank     : ${metrics.blankLines}`);
  console.log(`  Comments  : ${metrics.commentLines}`);
  console.log(`  Branches  : ${branches}`);
}

console.log('\nSpike complete — all fixtures parsed successfully.');
