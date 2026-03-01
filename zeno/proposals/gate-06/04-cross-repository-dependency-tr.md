# Proposal: Cross-Repository Dependency Tracking

**Hash**: #657cbc37  
**Gate**: gate-06 - Multi-Repo & Subproject Detection  
**Requirement**: #9c5150bf8e008175  
**Status**: pending  
**Created**: 2026-03-01

---

## Summary

Wires the repository dependency storage layer into the schema-registry function dispatch, replacing the current `invokeCommand` stubs with direct database calls for `repos_deps`. Implements the `repos_deps` registry operation so it queries `repo_dependencies` and returns the graph structure matching `RepositoryDependencyGraphSchema`, including circular dependency warnings.

---

## Proposal Type

**GREEN**

- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%
- **Lines to Cover**: ~80 (registry wiring, graph query orchestration, circular detection integration)
- **Target Coverage**: 80 × 0.90 = 72 lines must be tested

---

## Context

### Why This Change

Gate 06 requires cross-repository dependency tracking queries accessible via the MCP function registry. The `repos_deps` operation is currently a stub invoking CLI commands. This proposal replaces the stub with direct database queries and integrates circular dependency detection from the storage layer.

### Dependencies

| Hash | Type | Description |
| ---- | ---- | ----------- |
| #c5e27b7d | requires | RED test suite defines acceptance tests for dependency graph queries |
| #1f01eca0 | requires | Repository storage and dependency CRUD must exist before wiring |

---

## Tasks

### Task 1: Replace repos_deps registry stub with direct storage calls

**Phase**: GREEN  
**File(s)**: `src/integration/schema-registry.ts`  
**Action**: modify

Replace the `repos_deps` handler in `registerRepositoryOps` to call `getRepoDependencyGraph(projectRoot)` and `detectCircularDependencies(projectRoot)` directly from the `repository-dependencies` storage module instead of delegating to `invokeCommand`. Map the storage return into the `RepositoryDependencyGraphSchema` shape with `repositories`, `edges`, and `circularDependencies` fields.

**Acceptance**:

- [ ] `repos_deps` registry handler calls storage functions directly (no CLI passthrough)
- [ ] Return matches `RepositoryDependencyGraphSchema` Zod schema
- [ ] Circular dependencies included in response when detected
- [ ] Optional `repositoryId` filter scopes graph to a single repo's neighborhood
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/integration/schema-registry.ts` | GREEN | modify | Replace repos_deps invokeCommand with direct storage calls |

---

## Implementation Notes

Import `getRepoDependencyGraph`, `detectCircularDependencies` from `../../storage/repository-dependencies.js`. The existing `registerRepositoryOps` function structure handles input validation via Zod schemas already; only the handler body needs replacement.

---

## Rollback

**If rejected or failed**: Revert `registerRepositoryOps` repos_deps handler to previous `invokeCommand` stub.

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
