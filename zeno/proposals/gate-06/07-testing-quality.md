# Proposal: Testing & Quality

**Hash**: #cd07d597
**Gate**: gate-06 - Multi-Repo & Subproject Detection
**Requirement**: #4bc74e36854c4221
**Role**: implementation
**Status**: pending
**Created**: 2026-03-01

---

## Summary

Wires integration tests that validate the full stack: MCP handler → function registry → storage module → SQLite, for all four repository actions. Validates schema conformance end-to-end and ensures the existing `repository-handlers.integration.test.ts` covers real database operations instead of only mocked registry calls.

---

## Single-Phase Requirement

All tasks in this proposal are GREEN phase only. No new test files may be added; test coverage is defined exclusively by the sibling RED test-suite proposal (`#c5e27b7d`).

---

## Open Questions

- [x] No open questions — implementation scope is well-defined by RED test suite (`#c5e27b7d`).

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

### Task 1: Validate database schema conformance

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
| `src/storage/database.ts` | GREEN | modify | Add repo_dependencies table to schema validation |

---

## Implementation Notes

Extend `validateSchema()` in `src/storage/database.ts` to assert the `repo_dependencies` table exists alongside the current `repositories` table check. Throw a descriptive error if the table is absent so callers fail fast before executing dependency queries.

---

## Rollback

**If rejected or failed**: Revert `validateSchema()` changes in `src/storage/database.ts` and remove `repo_dependencies` check.

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
