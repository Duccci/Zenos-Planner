# Proposal: Repository Management Commands

**Hash**: #7a175468  
**Gate**: gate-06 - Multi-Repo & Subproject Detection  
**Requirement**: #cb19655eee60ab38  
**Status**: pending  
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

**Phase**: GREEN  
**File(s)**: `src/cli/commands/repos.ts`  
**Action**: modify

Replace the `list`, `add`, and `remove` stub handlers in the Commander subcommands. `list` calls `listRepositories(projectRoot)` and formats as table. `add` accepts `--name`, `--path`, `--type` options and calls `createRepository(projectRoot, data)`. `remove` accepts `<id>` argument and calls `deleteRepository(projectRoot, id)`. Output formatted via Commander's `outputConfiguration`.

**Acceptance**:

- [ ] `zeno repos list` outputs repository table from storage
- [ ] `zeno repos add --name X --path Y --type service` creates a repository record
- [ ] `zeno repos remove <id>` deletes the repository record
- [ ] Error handling for missing/invalid arguments with Commander validation
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

### Task 2: Implement repos CLI subcommands (deps, detect, adjust)

**Phase**: GREEN  
**File(s)**: `src/cli/commands/repos.ts`  
**Action**: modify

Replace the `deps`, `detect`, and `adjust` stub handlers. `deps` calls `getRepoDependencyGraph(projectRoot)` and renders edges as table with optional circular-dependency warnings. `detect` calls `detectBoundaries(projectRoot)` from boundary-detection module and displays recommendations. `adjust` accepts `--apply` flag to apply recommended boundaries by calling `applyBoundaryRecommendations(projectRoot, recommendations)`.

**Acceptance**:

- [ ] `zeno repos deps` outputs dependency graph with edges and circular warnings
- [ ] `zeno repos detect` runs boundary detection and outputs recommendations
- [ ] `zeno repos adjust --apply` applies boundary recommendations to storage
- [ ] Graceful error handling when no repositories exist
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

### Task 3: Wire remaining schema-registry repository operations

**Phase**: GREEN  
**File(s)**: `src/integration/schema-registry.ts`  
**Action**: modify

Replace the `repos_list`, `repos_detect`, and `repos_adjust` handlers in `registerRepositoryOps` to call storage/core modules directly instead of `invokeCommand`. `repos_list` calls `listRepositories`. `repos_detect` calls `detectBoundaries`. `repos_adjust` calls `applyBoundaryRecommendations`. Map returns to match respective Zod output schemas.

**Acceptance**:

- [ ] All four registry operations (list, deps, detect, adjust) use direct module calls
- [ ] No remaining `invokeCommand` references in `registerRepositoryOps`
- [ ] Return values pass Zod schema validation
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/cli/commands/repos.ts` | GREEN | modify | Implement all 6 CLI subcommands replacing stubs |
| `src/integration/schema-registry.ts` | GREEN | modify | Replace remaining invokeCommand stubs with direct storage calls |

---

## Implementation Notes

Import storage functions from `../../storage/repository-storage.js` and `../../storage/repository-dependencies.js`. Import boundary detection from `../../core/boundary-detection.js`. The Commander subcommand structure already exists with `.action()` handlers — only the handler bodies change. Follow the pattern established by other CLI commands (e.g., `gates.ts`).

---

## Rollback

**If rejected or failed**: Revert `repos.ts` handlers to stub implementations and `schema-registry.ts` to `invokeCommand` delegation.

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
