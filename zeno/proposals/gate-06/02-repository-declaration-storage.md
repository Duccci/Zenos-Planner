# Proposal: Repository Declaration & Storage

**Hash**: #1f01eca0  
**Gate**: gate-06 - Multi-Repo & Subproject Detection  
**Requirement**: #4bc74e36854c4221  
**Status**: pending  
**Created**: 2026-03-01

---

## Summary

Creates the `repo_dependencies` migration (006), implements the `repository-storage.ts` CRUD module following the `metrics-storage.ts` functional pattern, and defines the `Repository` and `RepositoryRow` interfaces. Enables hashable repository entities to be declared, queried, updated, and deleted in SQLite with path validation and metadata serialization.

---

## Proposal Type

**GREEN**

- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%
- **Lines to Cover**: ~150 (migration SQL, storage CRUD functions, row mapper, path validation)
- **Target Coverage**: 150 × 0.90 = 135 lines must be tested

---

## Context

### Why This Change

Gate 06 requires persistent repository storage in SQLite. The `repositories` table exists from migration 001 but lacks a CRUD service layer. The `repo_dependencies` table does not exist and requires a new migration. This proposal provides the storage foundation all other gate-06 proposals depend on.

### Dependencies

| Hash | Type | Description |
| ---- | ---- | ----------- |
| #c5e27b7d | requires | RED test suite defines acceptance tests for all storage CRUD operations |

---

## Tasks

### Task 1: Create migration 006 for repo_dependencies table

**Phase**: GREEN  
**File(s)**: `src/storage/migrations/006_repo_dependencies.sql`  
**Action**: create

Create SQL migration adding the `repo_dependencies` table with columns: `id` (TEXT PRIMARY KEY), `source_repo_hash` (TEXT NOT NULL FK → repositories.hash), `target_repo_hash` (TEXT NOT NULL FK → repositories.hash), `dependency_type` (TEXT NOT NULL CHECK IN 'imports','extends','references'), `metadata` (TEXT), `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP). Add indexes on source_repo_hash, target_repo_hash, and a unique constraint on (source_repo_hash, target_repo_hash, dependency_type).

**Acceptance**:

- [ ] Migration file creates `repo_dependencies` table with all columns
- [ ] Foreign key constraints reference `repositories.hash`
- [ ] Unique constraint prevents duplicate dependency edges
- [ ] Migration runs cleanly on existing databases
- [ ] All RED tests pass

---

### Task 2: Implement repository storage CRUD module

**Phase**: GREEN  
**File(s)**: `src/storage/repository-storage.ts`  
**Action**: create

Create the repository storage module following the `metrics-storage.ts` functional pattern. Define `Repository` interface (camelCase domain model) and `RepositoryRow` interface (snake_case DB row). Implement `rowToRepository` mapper, SQL constants for all operations, and exported functions: `saveRepository(repo, projectRoot?)`, `getRepositoryByHash(hash, projectRoot?)`, `listRepositories(typeFilter?, projectRoot?)`, `updateRepository(hash, updates, projectRoot?)`, `deleteRepository(hash, projectRoot?)`. Include path validation that rejects `..` sequences and resolves to absolute paths. Use parameterized SQL statements.

**Acceptance**:

- [ ] All CRUD functions implemented: save, get-by-hash, list, list-with-filter, update, delete
- [ ] `RepositoryRow` → `Repository` mapper handles metadata JSON parse/stringify
- [ ] Path validation rejects `..` sequences with descriptive error
- [ ] All SQL uses parameterized statements (no string interpolation)
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

### Task 3: Implement repository dependency CRUD functions

**Phase**: GREEN  
**File(s)**: `src/storage/repository-dependencies.ts`  
**Action**: create

Create dependency storage module with functions: `addRepoDependency(sourceHash, targetHash, type, metadata?, projectRoot?)`, `getRepoDependencies(repoHash, projectRoot?)`, `removeRepoDependency(sourceHash, targetHash, type, projectRoot?)`, `getRepoDependencyGraph(projectRoot?)` returning full graph structure, and `detectCircularDependencies(projectRoot?)` using iterative DFS. Follow the same functional pattern as `repository-storage.ts`.

**Acceptance**:

- [ ] All dependency CRUD functions implemented: add, get, remove, graph, detect-circular
- [ ] Circular dependency detection uses iterative DFS (no recursion stack overflow)
- [ ] Graph query returns nodes and edges matching `RepositoryDependencyGraphSchema`
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/storage/migrations/006_repo_dependencies.sql` | GREEN | create | SQL migration for repo_dependencies table |
| `src/storage/repository-storage.ts` | GREEN | create | Repository CRUD module with path validation |
| `src/storage/repository-dependencies.ts` | GREEN | create | Dependency CRUD with graph queries and circular detection |

---

## Implementation Notes

Follow the `metrics-storage.ts` pattern: no classes, export pure functions, accept optional `projectRoot`. Use `getDatabase(projectRoot)` for DB access. Repository hashes are generated via `generateHash` from `src/utils/hash.ts`. Path validation should use `path.resolve()` and check for `..` segments after normalization.

---

## Rollback

**If rejected or failed**: Delete created files and migration. No existing code modified.

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
