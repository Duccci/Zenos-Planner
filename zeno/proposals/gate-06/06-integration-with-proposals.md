# Proposal: Integration with Proposals

**Hash**: #7fa5df86
**Gate**: gate-06 - Multi-Repo & Subproject Detection
**Requirement**: #9c5150bf8e008175
**Role**: implementation
**Status**: pending
**Created**: 2026-03-01

---

## Summary

Creates a conflict detector module (`src/core/conflict-detector.ts`) that detects file-level overlaps between concurrent proposals targeting the same repository. Integrates the MCP `repos_action` handler in `src/mcp/tools/repository-tools.ts` to dispatch all four actions (list, deps, detect, adjust) through the function registry, making multi-repo features available via MCP.

---

## Proposal Type

**GREEN**

- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%
- **Lines to Cover**: ~120 (conflict detector, MCP handler dispatch)
- **Target Coverage**: 120 × 0.90 = 108 lines must be tested

---

## Context

### Why This Change

Gate 06 requires that multi-repo features integrate with the existing proposal workflow. Concurrent proposals may modify the same files across repositories; a conflict detector ensures the orchestrator can serialize overlapping work. The MCP handler must dispatch through the registry so LLM clients can invoke repos operations.

### Dependencies

| Hash | Type | Description |
| ---- | ---- | ----------- |
| #c5e27b7d | requires | RED test suite defines acceptance tests for conflict detection and MCP dispatch |
| #1f01eca0 | requires | Repository storage needed for listing repos in conflict scope |
| #657cbc37 | requires | Dependency graph needed for cross-repo conflict analysis |

---

## Tasks

### Task 1: Create conflict detector module

**Phase**: GREEN
**File(s)**: `src/core/conflict-detector.ts`
**Action**: create

Create a functional module exporting `detectFileConflicts(projectRoot: string, proposalHashes: string[]): ConflictReport`. The function reads proposals' Files Affected tables (from proposal markdown), groups by file path, and reports overlaps where two or more proposals touch the same file. Returns `ConflictReport` interface with `conflicts` array containing `filePath`, `proposalHashes`, and `severity` (warning if same phase, error if different phases). Follow the functional pattern from `metrics-storage.ts` (no classes).

**Acceptance**:

- [ ] `detectFileConflicts` returns empty array when proposals have no file overlap
- [ ] `detectFileConflicts` returns conflict entries when proposals share file paths
- [ ] Severity is `error` when proposals are in different phases (RED vs GREEN)
- [ ] Severity is `warning` when proposals share phase
- [ ] `ConflictReport` interface exported from module
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

### Task 2: Wire MCP repos_action handler to function registry

**Phase**: GREEN
**File(s)**: `src/mcp/tools/repository-tools.ts`
**Action**: modify

Replace the stub handler in `createRepositoryToolHandler` to dispatch actions (`list`, `deps`, `detect`, `adjust`) through the `FunctionRegistry.invoke()` pattern, matching the existing `createEntityActionHandler` used by other tool handlers. Validate input via the existing `RepositoryActionInputSchema` and return structured content matching respective output schemas.

**Acceptance**:

- [ ] All 4 actions dispatch through `FunctionRegistry.invoke()`
- [ ] Invalid action names return structured error
- [ ] Response matches Zod output schema per action
- [ ] Handler integrates with MCP server tool registration
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/core/conflict-detector.ts` | GREEN | create | File-level conflict detection between concurrent proposals |
| `src/mcp/tools/repository-tools.ts` | GREEN | modify | Wire repos_action handler to dispatch through function registry |

---

## Implementation Notes

The conflict detector reads proposal markdown files from `zeno/proposals/gate-XX/` and parses the Files Affected table. Use the existing `proposal-parser.ts` for markdown parsing if a suitable function exists, otherwise parse the table with a simple regex. The MCP handler should follow `createGatesToolHandler` as the reference pattern for dispatching actions.

---

## Rollback

**If rejected or failed**: Delete `src/core/conflict-detector.ts` and revert `repository-tools.ts` to its prior stub handler.

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
