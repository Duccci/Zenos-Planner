# Proposal: Implement Code Analysis Foundation

**Hash**: #g02p01analysis  
**Gate**: gate-02 - Zeno Engine & Gate Generation  
**Requirement**: #p02codeanalysis  
**Status**: completed  
**Created**: 2026-01-29

---

## Summary

Implements the foundational AST parsing infrastructure using Babel for JavaScript/TypeScript code analysis. This proposal creates the code analyzer module that traverses codebase directory structures and extracts import/export dependencies from source files. These capabilities enable analysis of existing codebases during project initialization.

---

## Context

### Requirements Context

This proposal implements the Code Analysis Capabilities requirement (#p02codeanalysis) by establishing the parser foundation and basic code structure analysis. Subsequent proposals will build dependency graphs and metrics on top of this infrastructure.

### Why This Change

Gate 02 requires understanding existing codebases during `zeno init`. AST parsing with Babel provides accurate, robust code structure analysis that can extract dependencies reliably across different JavaScript/TypeScript configurations. This is the foundation for all downstream analysis.

### Dependencies

*No dependencies - first proposal in gate.*

---

## Tasks

### Task 1: Create Babel Parser Wrapper Module

**File(s)**: `src/analysis/parser.ts`  
**Action**: create

Create a wrapper around @babel/parser that safely parses JavaScript/TypeScript files, handles syntax errors gracefully, and normalizes parsing options. The wrapper should cache parse options per file type and provide clear error messages for unparseable code.

**Acceptance**:
- [x] Exports `parseFile(filePath: string): Promise<ParseResult>` function
- [x] Returns AST or error object without throwing
- [x] Handles both `.ts` and `.js` files with appropriate parser options
- [x] Normalizes file paths to absolute paths

---

### Task 2: Implement Code Analyzer Module

**File(s)**: `src/analysis/code-analyzer.ts`  
**Action**: create

Create the main code analyzer that orchestrates directory traversal, file filtering (skip node_modules, dist, build outputs), and AST parsing. The analyzer should accumulate parsed modules and provide methods to query module information.

**Acceptance**:
- [x] Exports `CodeAnalyzer` class with `analyzeCodebase(rootPath: string): Promise<AnalysisResult>` method
- [x] Recursively traverses directory structure, respecting .gitignore
- [x] Filters out common non-source directories (node_modules, dist, build, .next, etc.)
- [x] Stores parsed modules in memory with caching by file path

---

### Task 3: Extract Import/Export Information

**File(s)**: `src/analysis/dependency-extractor.ts`  
**Action**: create

Create a dependency extractor that uses @babel/traverse to walk AST and identify all import statements, export declarations, and re-exports. Build a module dependency map showing which modules depend on which others.

**Acceptance**:
- [x] Exports `extractDependencies(ast: File, filePath: string): Dependencies` function
- [x] Identifies ES6 imports, CommonJS requires, dynamic imports
- [x] Tracks both default and named imports
- [x] Handles circular dependencies without infinite loops

---

### Task 4: Create Analysis Interfaces and Types

**File(s)**: `src/analysis/types.ts`  
**Action**: create

Define TypeScript interfaces for analysis results: `ParseResult`, `Module`, `Dependencies`, `AnalysisResult`. These types should be clear, composable, and match Babel's AST structure where appropriate.

**Acceptance**:
- [x] Exports all necessary interfaces and type definitions
- [x] Types are properly documented with JSDoc comments
- [x] Compatible with downstream metrics and graph generation

---

### Task 5: Write Unit Tests for Code Analysis

**File(s)**: `tests/analysis/parser.test.ts`, `tests/analysis/code-analyzer.test.ts`, `tests/analysis/dependency-extractor.test.ts`  
**Action**: create

Write comprehensive tests covering parser error handling, code analyzer filtering, dependency extraction on various import patterns, and edge cases like circular dependencies.

**Acceptance**:
- [x] Parser tests: Valid files, syntax errors, TypeScript syntax, JSX
- [x] Analyzer tests: Directory filtering, .gitignore respect, caching
- [x] Extractor tests: ES6 imports, CommonJS, dynamic imports, circular refs
- [ ] Coverage meets 90% threshold for all analysis modules

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/analysis/parser.ts` | create | Babel parser wrapper with error handling |
| `src/analysis/code-analyzer.ts` | create | Main analyzer orchestrating directory traversal |
| `src/analysis/dependency-extractor.ts` | create | AST traversal for dependency extraction |
| `src/analysis/types.ts` | create | TypeScript interfaces for analysis results |
| `tests/analysis/parser.test.ts` | create | Parser unit tests |
| `tests/analysis/code-analyzer.test.ts` | create | Analyzer unit tests |
| `tests/analysis/dependency-extractor.test.ts` | create | Extractor unit tests |

---

## Implementation Notes

- Use @babel/parser's `parseExpression` mode for file-level parsing
- Handle TypeScript by setting `sourceType: 'module'` and enabling `typescript` plugin
- Cache parsed ASTs in the CodeAnalyzer to avoid re-parsing during analysis
- Skip symlinks to prevent infinite loops during directory traversal
- Gracefully handle files that can't be parsed (log warning, continue)
- Consider performance: goal is <100ms per file for medium-sized codebase

---

## Rollback

If rejected or failed: Delete created files in `src/analysis/` and `tests/analysis/`.
