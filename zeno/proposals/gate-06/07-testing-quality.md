# Proposal: Testing & Quality

**Hash**: #cd07d597
**Gate**: gate-06 - Multi-Repo & Subproject Detection
**Requirement**: #4bc74e36854c4221
**Status**: pending
**Created**: 2026-03-01

---

## Summary

Wires integration tests that validate the full stack: MCP handler → function registry → storage module → SQLite, for all four repository actions. Validates schema conformance end-to-end and ensures the existing `repository-handlers.integration.test.ts` covers real database operations instead of only mocked registry calls.

---

## Proposal Type

**GREEN**

- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%
- **Lines to Cover**: ~60 (integration glue, schema validation wiring)
- **Target Coverage**: 60 × 0.90 = 54 lines must be tested

---

## Context

### Why This Change

Gate 06 requires integration testing that validates the full request path from MCP tool invocation through function registry dispatch to SQLite storage. The existing integration test file (`tests/mcp/tools/repository-handlers.integration.test.ts`) uses mocked registry calls; this proposal enhances it to use real database operations, ensuring schema conformance end-to-end.

### Dependencies

| Hash | Type | Description |
| ---- | ---- | ----------- |
| #c5e27b7d | requires | RED test suite defines the integration test structure |
| #1f01eca0 | requires | Repository storage must be implemented for real DB integration tests |
| #657cbc37 | requires | Dependency graph queries must be implemented for deps integration test |
| #7a175468 | requires | Schema-registry ops must be wired for registry-through-storage integration |
| #7fa5df86 | requires | MCP handler must dispatch through registry for full-stack test |

---

## Tasks

### Task 1: Enhance integration test to use real database operations

**Phase**: GREEN
**File(s)**: `tests/mcp/tools/repository-handlers.integration.test.ts`
**Action**: modify

Replace the mocked `FunctionRegistry` in the existing integration test with a real registry backed by a temporary SQLite database. Register the actual `registerRepositoryOps` functions. Each test should exercise the full path: invoke registry function → storage module → SQLite → return. Use `beforeEach`/`afterEach` to create and destroy a temporary database per test. Validate return values against the Zod output schemas.

**Acceptance**:

- [ ] Integration tests use real SQLite database (temporary, per-test lifecycle)
- [ ] All 4 repository operations tested end-to-end (list, deps, detect, adjust)
- [ ] Return values validated against Zod output schemas
- [ ] No mocked storage layer — real database operations
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

### Task 2: Validate database schema conformance

**Phase**: GREEN
**File(s)**: `src/storage/database.ts`
**Action**: modify

Extend `validateSchema()` to verify the `repo_dependencies` table exists alongside the existing `repositories` table check. This ensures the schema has been applied before any repository dependency operations are attempted.

**Acceptance**:

- [ ] `validateSchema()` checks for `repo_dependencies` table existence
- [ ] Error thrown with descriptive message if table missing
- [ ] Existing `repositories` table check preserved
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `tests/mcp/tools/repository-handlers.integration.test.ts` | GREEN | modify | Replace mocked registry with real DB integration |
| `src/storage/database.ts` | GREEN | modify | Add repo_dependencies table to schema validation |

---

## Implementation Notes

Use `tmp` directory for temporary databases (pattern: `path.join(os.tmpdir(), 'zeno-test-' + randomId)`). Import `getDatabase` with temporary project root to get isolated database. Apply the canonical schema programmatically before each test suite. The existing test structure has 5 tests that can be enhanced in-place.

---

## Rollback

**If rejected or failed**: Revert integration test to mocked registry pattern and remove `repo_dependencies` check from `validateSchema()`.

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
