# Proposal: Multi-Language Support via Tree-sitter (O-05)

**Hash**: #b5553461  
**Gate**: Solitary  
**Status**: pending  
**Created**: 2026-03-01

---

## Summary

Introduces Tree-sitter as an optional second parser backend in the code-analysis pipeline. The Babel parser continues to own TypeScript/JavaScript; Tree-sitter handles Python, Rust, Go, and C++ by producing normalized LOC, dependency, and complexity metrics through a shared analyzer interface. The feature is opt-in (controlled by an AnalysisOptions flag) and carries no breaking changes to existing consumers.

---

## Proposal Type

**RED** | **GREEN** | **Test Refinement**

- **RED**: Test-first phase defining acceptance criteria. Focuses on coverage target (from `config.qualityThresholds.codeCoverage`). No implementation code.
- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.
- **Test Refinement**: Final proposal refining coverage gaps and validating all tests pass.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: [Inherited from config, e.g., 90%]
- **Lines to Cover**: [Estimated count of lines in affected modules]
- **Target Coverage**: (lines × threshold) ÷ 100 = [number] lines must be tested

---

## Context

### Why This Change

O-05 (RO-matrix): "Replacing Babel AST with Tree-sitter would support Python, Rust, Go, C++ analysis at near-zero incremental cost, removing the TypeScript/JavaScript-only open question and opening Zeno to the broader developer market." Status: pursuing; target 2026-06-30. Current analysis stack: src/analysis/parser.ts (Babel-only), CodeAnalyzer.getFilesToAnalyze filters on DEFAULT_EXTENSIONS (.ts/.tsx/.js/.jsx). The proposal adds a parallel Tree-sitter path without touching the Babel path.

### Dependencies

List only valid hash references. It is acceptable to have no dependencies if this proposal is self-contained or first in a gate.

**Hash Usage Rules**:

- Proposal hashes (#xxxxx) should only appear in: the proposal's own header, the associated gate's proposal table, and dependency tables
- Do not reference proposal hashes in body text, task descriptions, or other sections
- Use descriptive names instead of hashes for readability in all other contexts
- **Performance**: This restriction prevents excessive file searches and context window bloat when LLMs need to find proposal references

| Hash    | Type     | Description                        |
| ------- | -------- | ---------------------------------- |
| #[hash] | requires | [What this proposal depends on]    |
| #[hash] | blocks   | [What this unblocks when complete] |

**Rules**:

- Omit rows for dependency types that do not apply
- Never use placeholder values like "None" or "N/A" as hash references
- If no dependencies exist, replace the entire Dependencies section (header through table) with: `*No dependencies.*`
- The Description column must be self-contained — the apply agent reads only this table, not the dependency files

---

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

**RED Phase Tasks** (test-first, defining acceptance criteria):
- Write tests covering happy path and error cases
- Tests should fail before implementation (RED)
- Use fixtures and mocks to isolate units
- No implementation code in RED phase

**GREEN Phase Tasks** (implementation following tests):
- Implement only functions/methods covered by RED tests
- Make RED tests pass (GREEN)
- Do not add new tests beyond what RED defined
- Verify all RED tests pass before marking complete

**GREEN Phase Guardrails** (verification rules):
- [ ] All changes implement only code specified in RED phase tests
- [ ] No new test files created beyond those in RED phase
- [ ] No new test cases added to existing test files
- [ ] All RED tests pass with implementation
- [ ] Coverage meets or exceeds target threshold

**File Scoping Rules**:

- Every `File(s)` entry MUST be an explicit file path (e.g., `src/core/archive-logic.ts`)
- NEVER use directory globs or wildcards (e.g., ~~`src/mcp/tools/*.ts`~~)
- NEVER use directory-only references (e.g., ~~`src/mcp/tools/`~~)
- If a refactoring touches many files, list each one explicitly — this is the cost signal that justifies splitting the proposal
- Each task should touch 1-3 files maximum; if more are needed, split into additional tasks

**Test Scoping Rules**:

- **Gate-tied proposals**: RED phase creates test proposals as early proposals in the gate; GREEN phase implementation proposals omit new test files; final proposal refines coverage
- **Solitary proposals**: MUST include test tasks inline. Solitary proposals are self-contained and combine RED and GREEN.

### Task 1: Install and validate Tree-sitter Node.js bindings

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Install and validate Tree-sitter Node.js bindings

**Acceptance**:
- [ ] tree-sitter and tree-sitter-<lang> grammar packages added as optional dependencies
- [ ] A minimal spike script (tests/analysis/tree-sitter-spike.ts) successfully parses one .py, one .rs, one .go, and one .cpp fixture and prints node counts without error
- [ ] npm run build succeeds; no TypeScript errors introduced

---

### Task 2: Define the language-agnostic parser interface and Tree-sitter backend

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Define the language-agnostic parser interface and Tree-sitter backend

**Acceptance**:
- [ ] LanguageBackend union type added to types.ts: 'babel' | 'tree-sitter'
- [ ] TreeSitterParseResult interface defined with fields: filePath, language, nodeCount, rootNode, success, error
- [ ] parseFileTreeSitter(filePath) exported from tree-sitter-parser.ts, detects language from extension, delegates to the correct grammar, returns TreeSitterParseResult
- [ ] Failing unit tests written for parseFileTreeSitter covering .py / .rs / .go / .cpp success paths and an unknown-extension error path

---

### Task 3: Implement normalized metrics extraction from Tree-sitter ASTs

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Implement normalized metrics extraction from Tree-sitter ASTs

**Acceptance**:
- [ ] extractTreeSitterMetrics(result: TreeSitterParseResult): LineMetrics function exported
- [ ] LOC counted by walking the Tree-sitter CST: totalLines, codeLines, commentLines, blankLines
- [ ] Function/method definition nodes counted per language grammar for complexity estimation (cyclomatic approximation via branch node count)
- [ ] extractTreeSitterMetrics passes all failing tests from the RED phase

---

### Task 4: Integrate Tree-sitter backend into CodeAnalyzer

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Integrate Tree-sitter backend into CodeAnalyzer

**Acceptance**:
- [ ] AnalysisOptions gains optional enableTreeSitter?: boolean and treeSitterExtensions?: string[] fields (defaults: false, ['.py', '.rs', '.go', '.cpp', '.c', '.h'])
- [ ] getFilesToAnalyze includes treeSitterExtensions when enableTreeSitter is true
- [ ] analyzeCodebase calls parseFileTreeSitter for files matching treeSitterExtensions; Babel path unchanged for all other extensions
- [ ] Module interface updated: ast field typed as BabelFile | TreeSitterParseResult | null so callers can discriminate
- [ ] Existing tests still pass; two new integration tests verify a mixed JS+Python workspace returns metrics for both file types

---

### Task 5: Write comprehensive tests and update documentation

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Write comprehensive tests and update documentation

**Acceptance**:
- [ ] Fixture files added: tests/fixtures/sample.py, sample.rs, sample.go, sample.cpp (20-30 LOC each)
- [ ] Tests cover: parse success, parse error recovery, LOC extraction accuracy (±2 lines), complexity node count >0 for files with functions/methods
- [ ] Test coverage for src/analysis/tree-sitter-parser.ts and tree-sitter-metrics.ts ≥90%
- [ ] README updated with a 'Multi-language analysis' section showing how to pass enableTreeSitter: true to CodeAnalyzer

---

## Files Affected

**Rules**:

- Every entry MUST be a fully-qualified file path — no directories, no globs, no wildcards
- This table is the authoritative scope boundary; the scope validator rejects modifications to unlisted files
- Each file path must match exactly one file in the repository
- RED phase entries: test files only
- GREEN phase entries: implementation files (no new test files)
- Test Refinement entries: refinement and validation of test files only

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/analysis/parser.ts` | - | modify | Implementation file |
| `src/analysis/types.ts` | - | modify | Implementation file |
| `src/analysis/tree-sitter-parser.ts` | - | modify | Implementation file |
| `src/analysis/tree-sitter-metrics.ts` | - | modify | Implementation file |
| `src/analysis/code-analyzer.ts` | - | modify | Implementation file |
| `tests/analysis/tree-sitter-parser.test.ts` | - | modify | Implementation file |
| `package.json` | - | modify | Implementation file |

---

## Implementation Notes

[Optional: Technical approach, edge cases to handle, patterns to use. Keep brief - this is guidance, not specification. Omit if straightforward.]

---

## Rollback

**If rejected or failed**: [Brief description of how to revert changes, or "No rollback needed - isolated change"]

---

**Document Version**: [MAJOR.MINOR.PATCH]  
**Last Updated**: [YYYY-MM-DD]  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Owner**: [git.user.name]  
**Reviewers**: [git.user.name]

### Change Log

| Version | Date         | Summary         | Author          |
| ------- | ------------ | --------------- | --------------- |
| 1.0.0   | [YYYY-MM-DD] | Initial version | [git.user.name] |
