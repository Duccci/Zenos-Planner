# Proposal: Repository Management Commands

**Hash**: #7a175468
**Gate**: gate-06 - Multi-Repo & Subproject Detection
**Requirement**: #cb19655eee60ab38
**Status**: completed
**Role**: implementation
**Created**: 2026-03-01

---

## Summary

Implements the six CLI subcommands (`list`, `deps`, `detect`, `adjust`, `add`, `remove`) in `src/cli/commands/repos.ts`, replacing the current stubs with calls to storage and core modules. Also replaces the remaining `invokeCommand` stubs in `registerRepositoryOps` for `repos_list`, `repos_detect`, and `repos_adjust` with direct storage/core calls.

---

## Proposal Type

**GREEN**

- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%
- **Lines to Cover**: ~180 (CLI command implementations, schema-registry remaining ops)
- **Target Coverage**: 180 × 0.90 = 162 lines must be tested

---

## Context

### Why This Change

Gate 06 requires full `repos` CLI commands and MCP function-registry operations. The current CLI stubs log "Not yet implemented" and the schema-registry delegates to `invokeCommand`. This proposal wires the storage and boundary-detection modules into both the CLI and registry layers.

### Dependencies

| Hash | Type | Description |
| ---- | ---- | ----------- |
| #c5e27b7d | requires | RED test suite defines acceptance tests for CLI commands and registry ops |
| #1f01eca0 | requires | Repository storage CRUD must exist for list, add, remove operations |
| #0c081a5a | requires | Boundary detection module must exist for detect and adjust commands |
| #657cbc37 | requires | Cross-repo dependency queries must exist for deps command |

---

## Tasks

### Task 1: Implement repos CLI subcommands (list, add, remove)

> Replaced list/add/remove stubs in repos.ts with direct calls to listRepositories, saveRepository, deleteRepository. Hash derived via shortHash(name+path).

**Phase**: GREEN
**File(s)**: `src/cli/commands/repos.ts`
**Action**: modify

Replace the `list`, `add`, and `remove` stub handlers in the Commander subcommands. `list` calls `listRepositories(undefined, projectRoot)` and formats as table. `add` accepts `--name`, `--path`, `--type` options and calls `saveRepository({ name, path, type, hash }, projectRoot)` where `hash` is derived from the name+path. `remove` accepts `<id>` argument and calls `deleteRepository(id, projectRoot)`. Output formatted via Commander's `outputConfiguration`.

**Acceptance**:

- [x] `zeno repos list` outputs repository table from storage
- [x] `zeno repos add --name X --path Y --type service` creates a repository record
- [x] `zeno repos remove <id>` deletes the repository record
- [x] Error handling for missing/invalid arguments with Commander validation
- [x] All RED tests pass
- [x] Guardrails verified (no new tests)

---

### Task 2: Implement repos CLI subcommands (deps, detect, adjust)

**Phase**: GREEN
**File(s)**: `src/cli/commands/repos.ts`
**Action**: modify

Replace the `deps`, `detect`, and `adjust` stub handlers. `deps` calls `getRepoDependencyGraph(projectRoot)` and renders edges as table with optional circular-dependency warnings. `detect` calls `detectRepositoryBoundaries(projectRoot, { persist: false })` from `boundary-detection.ts` and displays the returned `recommendations` array. `adjust` accepts `--apply` flag; without it, displays recommendations (same as `detect`); with `--apply`, calls `detectRepositoryBoundaries(projectRoot, { persist: true })` to persist the boundaries.

**Acceptance**:

- [x] `zeno repos deps` outputs dependency graph with edges and circular warnings
- [x] `zeno repos detect` runs boundary detection and outputs recommendations
- [x] `zeno repos adjust --apply` applies boundary recommendations to storage
- [x] Graceful error handling when no repositories exist
- [x] All RED tests pass
- [x] Guardrails verified (no new tests)

---

### Task 3: Wire remaining schema-registry repository operations

**Phase**: GREEN
**File(s)**: `src/integration/schema-registry.ts`
**Action**: modify

Replace the `repos_list`, `repos_detect`, and `repos_adjust` handlers in `registerRepositoryOps` to call storage/core modules directly instead of `invokeCommand`. `repos_list` calls `listRepositories(typeFilter, projectRoot)`. `repos_detect` calls `detectRepositoryBoundaries(projectRoot, { persist: false })`. `repos_adjust` calls `detectRepositoryBoundaries(projectRoot, { persist: true })`. Map returns to match respective Zod output schemas.

**Acceptance**:

- [x] All four registry operations (list, deps, detect, adjust) use direct module calls
- [x] No remaining `invokeCommand` references in `registerRepositoryOps`
- [x] Return values pass Zod schema validation
- [x] All RED tests pass
- [x] Guardrails verified (no new tests)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/cli/commands/repos.ts` | GREEN | modify | Implement all 6 CLI subcommands replacing stubs |
| `src/integration/schema-registry.ts` | GREEN | modify | Replace remaining invokeCommand stubs with direct storage calls |

---

## Implementation Notes

Import `listRepositories`, `saveRepository`, `deleteRepository` from `../../storage/repository-storage.js`. Import `getRepoDependencyGraph`, `detectCircularDependencies` from `../../storage/repository-dependencies.js`. Import `detectRepositoryBoundaries` from `../../core/boundary-detection.js`. The Commander subcommand structure already exists with `.action()` handlers — only the handler bodies change. Follow the pattern established by other CLI commands (e.g., `gates.ts`).

---

## Rollback

**If rejected or failed**: Revert `repos.ts` handlers to stub implementations and `schema-registry.ts` to `invokeCommand` delegation.

---

**Document Version**: 1.0.1
**Last Updated**: 2026-03-05
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: zeno
**Reviewers**: zeno

### Change Log

| Version | Date       | Summary         | Author |
| ------- | ---------- | --------------- | ------ |
| 1.0.1   | 2026-03-05 | Fix function names: createRepository→saveRepository, detectBoundaries→detectRepositoryBoundaries, applyBoundaryRecommendations→detectRepositoryBoundaries w/ persist flag | zeno |
| 1.0.0   | 2026-03-01 | Initial version | zeno   |

## Completion Summary

**Tasks Completed**: 17/17
**Files Modified/Created**: 0

### Quality Metrics

- Coverage: 0%
- Security Issues: 0
- Lint Errors: 0
- Type Errors: 0
