# Proposal: Multi-Language Support via Tree-sitter (O-05)

**Hash**: #b5553461
**Gate**: Solitary
**Status**: pending
**Created**: 2026-03-01
**Roles**: feature

---

## Summary

Introduces Tree-sitter as an optional second parser backend in the code-analysis pipeline. The Babel parser continues to own TypeScript/JavaScript; Tree-sitter handles Python, Rust, Go, and C++ by producing normalized LOC, dependency, and complexity metrics through a shared analyzer interface. The feature is opt-in (controlled by an AnalysisOptions flag) and carries no breaking changes to existing consumers.

---

## Context

### Why This Change

O-05 (RO-matrix): "Replacing Babel AST with Tree-sitter would support Python, Rust, Go, C++ analysis at near-zero incremental cost, removing the TypeScript/JavaScript-only open question and opening Zeno to the broader developer market." Status: pursuing; target 2026-06-30. Current analysis stack: src/analysis/parser.ts (Babel-only), CodeAnalyzer.getFilesToAnalyze filters on DEFAULT_EXTENSIONS (.ts/.tsx/.js/.jsx). The proposal adds a parallel Tree-sitter path without touching the Babel path.

### Dependencies

*No dependencies.*

---

## Tasks

### Task 1: Install and validate Tree-sitter Node.js bindings

**Phase**: GREEN
**File(s)**: `package.json`
**Action**: modify

Install and validate Tree-sitter Node.js bindings

**Acceptance**:

- [ ] tree-sitter and tree-sitter-<lang> grammar packages added as optional dependencies
- [ ] A minimal spike script (tests/analysis/tree-sitter-spike.ts) successfully parses one .py, one .rs, one .go, and one .cpp fixture and prints node counts without error
- [ ] npm run build succeeds; no TypeScript errors introduced

---

### Task 2: Define the language-agnostic parser interface and Tree-sitter backend

**Phase**: GREEN
**File(s)**: `src/analysis/types.ts`, `src/analysis/tree-sitter-parser.ts`
**Action**: create/modify

Define the language-agnostic parser interface and Tree-sitter backend

**Acceptance**:

- [ ] LanguageBackend union type added to types.ts: 'babel' | 'tree-sitter'
- [ ] TreeSitterParseResult interface defined with fields: filePath, language, nodeCount, rootNode, success, error
- [ ] parseFileTreeSitter(filePath) exported from tree-sitter-parser.ts, detects language from extension, delegates to the correct grammar, returns TreeSitterParseResult
- [ ] Failing unit tests written for parseFileTreeSitter covering .py / .rs / .go / .cpp success paths and an unknown-extension error path

---

### Task 3: Implement normalized metrics extraction from Tree-sitter ASTs

**Phase**: GREEN
**File(s)**: `src/analysis/tree-sitter-metrics.ts`
**Action**: create

Implement normalized metrics extraction from Tree-sitter ASTs

**Acceptance**:

- [ ] extractTreeSitterMetrics(result: TreeSitterParseResult): LineMetrics function exported
- [ ] LOC counted by walking the Tree-sitter CST: totalLines, codeLines, commentLines, blankLines
- [ ] Function/method definition nodes counted per language grammar for complexity estimation (cyclomatic approximation via branch node count)
- [ ] extractTreeSitterMetrics passes all failing tests from the RED phase

---

### Task 4: Integrate Tree-sitter backend into CodeAnalyzer

**Phase**: GREEN
**File(s)**: `src/analysis/code-analyzer.ts`, `src/analysis/types.ts`
**Action**: modify

Integrate Tree-sitter backend into CodeAnalyzer

**Acceptance**:

- [ ] AnalysisOptions gains optional `enableTreeSitter?: boolean` and `treeSitterExtensions?: string[]` fields (defaults: `false`, `['.py', '.rs', '.go', '.cpp', '.c', '.h']`)
- [ ] getFilesToAnalyze includes treeSitterExtensions when enableTreeSitter is true
- [ ] analyzeCodebase calls parseFileTreeSitter for files matching treeSitterExtensions; Babel path unchanged for all other extensions
- [ ] Module interface updated: ast field typed as BabelFile | TreeSitterParseResult | null so callers can discriminate
- [ ] Existing tests still pass; two new integration tests verify a mixed JS+Python workspace returns metrics for both file types

---

### Task 5: Write comprehensive tests and update documentation

**Phase**: GREEN
**File(s)**: `README.md`
**Action**: modify

Write comprehensive tests and update documentation

**Acceptance**:

- [ ] Fixture files added: tests/fixtures/sample.py, sample.rs, sample.go, sample.cpp (20-30 LOC each)
- [ ] Tests cover: parse success, parse error recovery, LOC extraction accuracy (±2 lines), complexity node count >0 for files with functions/methods
- [ ] Test coverage for src/analysis/tree-sitter-parser.ts and tree-sitter-metrics.ts ≥90%
- [ ] README updated with a 'Multi-language analysis' section showing how to pass enableTreeSitter: true to CodeAnalyzer

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `package.json` | GREEN | modify | Add tree-sitter and language grammar packages as optional dependencies |
| `src/analysis/types.ts` | GREEN | modify | Add LanguageBackend type, TreeSitterParseResult interface; update AnalysisOptions and Module interface |
| `src/analysis/tree-sitter-parser.ts` | GREEN | create | Implement parseFileTreeSitter with language detection and grammar dispatch |
| `src/analysis/tree-sitter-metrics.ts` | GREEN | create | Implement extractTreeSitterMetrics for LOC and complexity metrics |
| `src/analysis/code-analyzer.ts` | GREEN | modify | Integrate Tree-sitter path into getFilesToAnalyze and analyzeCodebase |
| `README.md` | GREEN | modify | Add Multi-language analysis section documenting enableTreeSitter usage |

---

## Implementation Notes

Tree-sitter grammars are loaded via `require('tree-sitter-<lang>')` at runtime — guard each `require` with a `try/catch` and return `success: false` if a grammar is not installed, rather than throwing. The Babel path must remain untouched; this change is purely additive. Use `path.extname(filePath).toLowerCase()` for extension matching to avoid case-sensitivity issues.

---

## Rollback

**If rejected or failed**: Remove `src/analysis/tree-sitter-parser.ts` and `src/analysis/tree-sitter-metrics.ts`. Revert `src/analysis/types.ts` and `src/analysis/code-analyzer.ts` to their pre-proposal state. Remove tree-sitter packages from `package.json`. No database migrations; no breaking changes to existing consumers.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-01
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: Duccci
**Reviewers**: Duccci

### Change Log

| Version | Date       | Summary         | Author |
| ------- | ---------- | --------------- | ------ |
| 1.0.0   | 2026-03-01 | Initial version | Duccci |
