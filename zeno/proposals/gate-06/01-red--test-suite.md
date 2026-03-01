# Proposal: RED Test Suite — Multi-Repo & Subproject Detection

**Hash**: #c5e27b7d  
**Gate**: gate-06 - Multi-Repo & Subproject Detection  
**Requirement**: #4bc74e36854c4221  
**Status**: pending  
**Created**: 2026-03-01

---

## Summary

Defines the complete RED test suite for all Gate 06 deliverables: repository CRUD storage, cross-repository dependency tracking with circular detection, hybrid LLM-driven boundary detection workflow, repository management CLI/MCP commands, and file-level conflict detection for concurrent proposals. All tests are written to fail before implementation, establishing acceptance criteria for the GREEN phase proposals.

---

## Proposal Type

**RED**

- **RED**: Test-first phase defining acceptance criteria. Focuses on coverage target (from `config.qualityThresholds.codeCoverage`). No implementation code.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%
- **Lines to Cover**: ~700 (repository-storage, conflict-detector, boundary-detection, schema-registry repo ops, CLI commands)
- **Target Coverage**: 700 × 0.90 = 630 lines must be tested

---

## Context

### Why This Change

Gate 06 introduces multi-repo detection and repository management. RED tests must be written first to define acceptance criteria for all gate deliverables: repository storage CRUD, cross-repo dependency tracking, hybrid boundary detection, CLI/MCP commands, and conflict detection.

### Dependencies

*No dependencies.*

---

## Tasks

### Task 1: Write unit tests for repository storage CRUD operations

**Phase**: RED  
**File(s)**: `tests/storage/repository-storage.test.ts`  
**Action**: create

Write tests for the repository storage module following `metrics-storage.ts` patterns. Test `saveRepository`, `getRepositoryByHash`, `listRepositories`, `updateRepository`, `deleteRepository`. Use an in-memory SQLite database with the existing `getDatabase` helper. Include tests for type filtering (`main`, `service`, `library`, `tool`), hash uniqueness constraints, metadata JSON serialization/deserialization, and path validation rejecting `..` sequences.

**Acceptance**:

- [ ] Tests cover all CRUD functions: save, get-by-hash, list, list-with-type-filter, update, delete
- [ ] Tests assert hash uniqueness violation throws a meaningful error
- [ ] Tests verify path traversal (`..`) is rejected with a validation error
- [ ] Tests verify metadata round-trips correctly through JSON serialization
- [ ] All tests fail before implementation (RED)

---

### Task 2: Write unit tests for repo_dependencies table and cross-repo dependency tracking

**Phase**: RED  
**File(s)**: `tests/storage/repository-dependencies.test.ts`  
**Action**: create

Write tests for cross-repo dependency CRUD: `addRepoDependency`, `getRepoDependencies`, `removeRepoDependency`, `getRepoDependencyGraph`, `detectCircularDependencies`. Tests should validate edge insertion/deletion, graph traversal for transitive dependencies, and circular dependency detection (A→B→C→A). Use an in-memory SQLite database seeded with 3-4 repository fixtures.

**Acceptance**:

- [ ] Tests cover dependency CRUD: add, get, remove, graph
- [ ] Tests verify circular dependency detection with cycles of length 2 and 3
- [ ] Tests verify transitive dependency resolution
- [ ] Tests verify foreign key constraint enforcement (dependency on non-existent repo fails)
- [ ] Tests verify `PRAGMA foreign_keys = ON` is set in test DB setup so FK constraints actually fire
- [ ] All tests fail before implementation (RED)

---

### Task 3: Write unit tests for hybrid boundary detection workflow

**Phase**: RED  
**File(s)**: `tests/core/boundary-detection.test.ts`  
**Action**: create

Write tests for the boundary detection service that orchestrates CodeAnalyzer output serialization for the `architect-reviewer` subagent. Because `architect-reviewer` is a Markdown subagent file with no mockable JavaScript interface, tests focus on the two testable boundaries: (1) the serialization layer that transforms `AnalysisResult` into the structured JSON payload passed to the subagent, and (2) the response-parsing layer that extracts boundary recommendations from a fixture LLM response string. Mock `CodeAnalyzer.analyzeCodebase()` to return a fixture `AnalysisResult` from `createAnalysisResult()`. Provide a fixture boundary recommendation string (representing typical LLM output) to the response parser. Test that structured metrics (coupling scores, dependency counts, LOC, file counts) are serialized correctly to a stable JSON schema. Test that recommendations are returned without being auto-persisted.

**Acceptance**:

- [ ] Tests verify CodeAnalyzer output is serialized to a stable JSON schema (no raw AST)
- [ ] Tests verify serialized output includes coupling, LOC, dependency graph, file counts
- [ ] Tests verify the response parser correctly extracts boundary recommendations from a fixture LLM response string
- [ ] Tests verify recommendations are returned as advisory (not persisted)
- [ ] Tests verify error handling when CodeAnalyzer fails or returns empty results
- [ ] All tests fail before implementation (RED)

---

### Task 4: Write unit tests for ConflictDetector

**Phase**: RED  
**File(s)**: `tests/core/conflict-detector.test.ts`  
**Action**: create

Write tests for the `ConflictDetector` module that detects overlapping file sets between concurrent proposals across repositories. Test `detectConflicts(proposalHash)` with fixtures of 3 proposals where 2 share files. Test no-conflict case. Test cross-repo conflict detection. Test that the result includes conflicting file paths and proposal references.

**Acceptance**:

- [ ] Tests verify conflict detection between proposals with overlapping files
- [ ] Tests verify no false positives when proposals touch different files
- [ ] Tests verify conflict report includes file paths and proposal hashes
- [ ] Tests verify cross-repository conflict detection works correctly
- [ ] All tests fail before implementation (RED)

---

### Task 5: Write integration tests for CLI repos commands and MCP repos_action handler

**Phase**: RED  
**File(s)**: `tests/cli/commands/repos.test.ts`, `tests/mcp/tools/repository-handlers.integration.test.ts`  
**Action**: create / modify

Write integration tests for all six `zeno repos` CLI subcommands (`list`, `deps`, `detect`, `adjust`, `add`, `remove`) using the existing CLI test patterns. Write handler tests for the MCP `repos_action` tool covering `list`, `detect`, `deps`, `adjust` actions with mocked storage and registry. Extend the existing `repository-handlers.integration.test.ts` to cover `add` and `remove` actions.

**Acceptance**:

- [ ] CLI tests cover all 6 subcommands: list, deps, detect, adjust, add, remove
- [ ] CLI tests verify output format and exit codes
- [ ] CLI tests cover `detect --reanalyzeCrossRepo true` and `detect --reanalyzeCrossRepo false` as distinct scenarios with different output
- [ ] MCP handler tests cover all actions with mocked FunctionRegistry
- [ ] MCP handler tests verify structured output matches Zod schemas, including schemas for `add` and `remove` responses
- [ ] All tests fail before implementation (RED)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `tests/storage/repository-storage.test.ts` | RED | create | Unit tests for repository CRUD operations |
| `tests/storage/repository-dependencies.test.ts` | RED | create | Unit tests for repo_dependencies table and graph queries |
| `tests/core/boundary-detection.test.ts` | RED | create | Unit tests for hybrid boundary detection workflow |
| `tests/core/conflict-detector.test.ts` | RED | create | Unit tests for proposal file-level conflict detection |
| `tests/cli/commands/repos.test.ts` | RED | create | Integration tests for all 6 CLI repos subcommands |
| `tests/fixtures/analysis.ts` | RED | create | `createAnalysisResult()` fixture factory for boundary detection tests |
| `tests/mcp/tools/repository-handlers.integration.test.ts` | RED | modify | Extend MCP handler tests with add/remove actions and schema validation |

---

## Implementation Notes

Follow existing test patterns from `tests/storage/` and `tests/mcp/tools/`. Use `beforeEach`/`afterEach` with in-memory SQLite for storage tests; always set `PRAGMA foreign_keys = ON` in the `beforeEach` setup. Mock `FunctionRegistry` for MCP handler tests. Use `createAnalysisResult()` from `tests/fixtures/analysis.ts` (created in Task 3 file list) for boundary detection tests. All tests must import from the planned module paths (which do not exist yet) so they fail at compile time, confirming RED phase.

---

## Rollback

**If rejected or failed**: Delete all created test files. No production code is modified.

---

**Document Version**: 1.1.0  
**Last Updated**: 2026-03-01  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Owner**: zeno  
**Reviewers**: zeno

### Change Log

| Version | Date       | Summary         | Author |
| ------- | ---------- | --------------- | ------ |
| 1.1.0   | 2026-03-01 | Review: see log | zeno   |
| 1.0.0   | 2026-03-01 | Initial version | zeno   |
