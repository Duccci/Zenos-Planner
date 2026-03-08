# Proposal: Repository Declaration & Storage

**Hash**: #1f01eca0
**Gate**: gate-06 - Multi-Repo & Subproject Detection
**Requirement**: #4bc74e36854c4221
**Status**: completed
**Approved By**: Duccci
**Implemented**: 2026-03-08T08:35:49.861Z
**Role**: implementation
**Created**: 2026-03-01
**Files Affected**: `src/storage/migrations/schema.sql`, `src/storage/repository-storage.ts`, `src/storage/repository-dependencies.ts`

---

## Summary

Adds the `repo_dependencies` table to the canonical `schema.sql`, implements the `repository-storage.ts` CRUD module following the `metrics-storage.ts` functional pattern, and defines the `Repository` and `RepositoryRow` interfaces. Enables hashable repository entities to be declared, queried, updated, and deleted in SQLite with path validation and metadata serialization.

## Context

### Why This Change

Gate 06 requires persistent repository storage in SQLite. The `repositories` table already exists in the canonical `schema.sql` but lacks a CRUD service layer. The `repo_dependencies` table does not exist and requires a new `CREATE TABLE IF NOT EXISTS` block added directly to `schema.sql` (numbered migration files are no longer used). This proposal provides the storage foundation all other gate-06 proposals depend on.

### Prerequisites

- Zeno's planner project initialized with existing SQLite database and migration system
- RED test suite (#c5e27b7d) completed with acceptance tests for CRUD operations
- Existing `metrics-storage.ts` module available as pattern reference
- TypeScript compiler and database utilities configured

### Dependencies

| Hash | Type | Description |
| ---- | ---- | ----------- |
| #c5e27b7d | requires | RED test suite defines acceptance tests for all storage CRUD operations |

---

## Tasks

### Task Summary

| # | Description | Phase | Files | Acceptance Criteria Count |
| - | ----------- | ----- | ----- | ----------------------- |
| 1 | Add repo_dependencies table to schema.sql | GREEN | `src/storage/migrations/schema.sql` | 5 |
| 2 | Implement repository storage CRUD module | GREEN | `src/storage/repository-storage.ts` | 6 |
| 3 | Implement repository dependency CRUD functions | GREEN | `src/storage/repository-dependencies.ts` | 4 |

### Detailed Task Descriptions

#### Task 1: Add repo_dependencies table to schema.sql

**Phase**: GREEN
**File(s)**: `src/storage/migrations/schema.sql`
**Action**: modify

Add a `CREATE TABLE IF NOT EXISTS repo_dependencies` block to the canonical `schema.sql` with columns: `id` (TEXT PRIMARY KEY), `source_repo_hash` (TEXT NOT NULL FK → repositories.hash), `target_repo_hash` (TEXT NOT NULL FK → repositories.hash), `dependency_type` (TEXT NOT NULL CHECK IN 'imports','extends','references'), `metadata` (TEXT), `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP). Add `CREATE INDEX IF NOT EXISTS` statements for source_repo_hash, target_repo_hash, and a unique constraint on (source_repo_hash, target_repo_hash, dependency_type). All statements must use `IF NOT EXISTS` to stay idempotent.

**Acceptance Criteria**:

- [x] `repo_dependencies` table added to `schema.sql` with all columns
- [x] Foreign key constraints reference `repositories.hash`
- [x] Unique constraint prevents duplicate dependency edges
- [x] Schema applies cleanly on both fresh and existing databases (idempotent)
- [x] All RED tests pass

---

#### Task 2: Implement repository storage CRUD module

**Phase**: GREEN
**File(s)**: `src/storage/repository-storage.ts`
**Action**: create

Create the repository storage module following the `metrics-storage.ts` functional pattern. Define `Repository` interface (camelCase domain model) and `RepositoryRow` interface (snake_case DB row). Implement `rowToRepository` mapper, SQL constants for all operations, and exported functions: `saveRepository(repo, projectRoot?)`, `getRepositoryByHash(hash, projectRoot?)`, `listRepositories(typeFilter?, projectRoot?)`, `updateRepository(hash, updates, projectRoot?)`, `deleteRepository(hash, projectRoot?)`. Include path validation that rejects `..` sequences and resolves to absolute paths. Use parameterized SQL statements.

**Acceptance Criteria**:

- [x] All CRUD functions implemented: save, get-by-hash, list, list-with-filter, update, delete
- [x] `RepositoryRow` → `Repository` mapper handles metadata JSON parse/stringify
- [x] Path validation rejects `..` sequences with descriptive error
- [x] All SQL uses parameterized statements (no string interpolation)
- [x] All RED tests pass
- [x] Guardrails verified (no new tests)

---

#### Task 3: Implement repository dependency CRUD functions

**Phase**: GREEN
**File(s)**: `src/storage/repository-dependencies.ts`
**Action**: create

Create dependency storage module with functions: `addRepoDependency(sourceHash, targetHash, type, metadata?, projectRoot?)`, `getRepoDependencies(repoHash, projectRoot?)`, `removeRepoDependency(sourceHash, targetHash, type, projectRoot?)`, `getRepoDependencyGraph(projectRoot?)` returning full graph structure, and `detectCircularDependencies(projectRoot?)` using iterative DFS. Follow the same functional pattern as `repository-storage.ts`.

**Acceptance Criteria**:

- [x] All dependency CRUD functions implemented: add, get, remove, graph, detect-circular
- [x] Circular dependency detection uses iterative DFS (no recursion stack overflow)
- [x] Graph query returns nodes and edges matching `RepositoryDependencyGraphSchema`
- [x] All RED tests pass
- [x] Guardrails verified (no new tests)

---

## Files Affected

- `src/storage/migrations/schema.sql` (modify)
- `src/storage/repository-storage.ts` (create)
- `src/storage/repository-dependencies.ts` (create)

### Detailed Breakdown

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/storage/migrations/schema.sql` | GREEN | modify | Add repo_dependencies table with FK constraints and indexes |
| `src/storage/repository-storage.ts` | GREEN | create | Repository CRUD module with save, get, list, update, delete, path validation |
| `src/storage/repository-dependencies.ts` | GREEN | create | Dependency CRUD with add, get, remove, graph queries, circular detection |

---

## Implementation Notes

Follow the `metrics-storage.ts` pattern: no classes, export pure functions, accept optional `projectRoot`. Use `getDatabase(projectRoot)` for DB access. Repository hashes are generated via `generateHash` from `src/utils/hash.ts`. Path validation should use `path.resolve()` and check for `..` segments after normalization.

---

## Rollback

Remove the `repo_dependencies` table block (table definition and its indexes) from `src/storage/migrations/schema.sql`. Delete `src/storage/repository-storage.ts` and `src/storage/repository-dependencies.ts`. No further rollback is required as only new files are created and the schema change is additive.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-01
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: zeno
**Reviewers**: zeno

### Change Log

| Version | Date       | Summary         | Author |
| ------- | ---------- | --------------- | ------ |
| 1.0.0   | 2026-03-01 | Initial version | zeno   |
