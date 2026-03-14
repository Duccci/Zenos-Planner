---
zeno:
  hash: 'f5a2b3e6'
  gate_id: 'gate-07'
  requirement_id: null
  status: completed
  reason: null
  created_at: '2026-03-11'
---
<!-- Status lifecycle:
  - pending: Proposal generated, awaiting implementation
  - in_progress: Proposal currently being implemented
  - completed: Implementation done, all tests passing
  - rejected: Proposal will not be implemented (covers both review rejection and deliberate cancellation); user-provided reason required
  - deferred: Proposal postponed to a later gate; user-provided reason required

  Non-implementation terminal statuses (rejected, deferred) require a reason.
  Set `reason` in the frontmatter above with a clear explanation before changing to either status.
-->

# Proposal: GREEN — Test Verification & Gate 07 Quality Pass

**Hash**: #f5a2b3e6
**Gate**: gate-07 - Proposal Generation & Management
**Status**: completed
**Approved By**: Duccci
**Implemented**: 2026-03-14T03:35:09.061Z
**Roles**: testing
**Created**: 2026-03-11

---

## Summary

Wires all gate-07 implementation work to the RED test suite and verifies every test passes. Covers: `calculateProposalDependencies()` shape change, `parallelSetIndex` annotation and DB persistence, `ProposalRole` type and field propagation, and `ProposalListOutput` schema update with `parallelSets`. Also closes any coverage gaps identified during implementation (missing branch coverage, error paths in the new migration patch). Ensures `npm run build` and all affected test suites pass at ≥ 90% coverage threshold.

---

## Context

### Why This Change

The three implementation proposals (parallel sets computation, `ProposalRole` taxonomy, MCP surface) each target distinct modules. GREEN ties them together: confirms no regressions, checks that the full proposal generation → annotation → DB persist → MCP list pipeline works end-to-end, and ensures the migration patch handles both fresh and existing databases correctly.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #b1c9e3f5 | requires | Parallel sets computation must be implemented before pipeline integration tests can pass |
| #c6d0a2b4 | requires | `ProposalRole` type must exist for type-level tests to compile |
| #e8f3c1d7 | requires | MCP schema updates must be merged before list output tests can pass |

---

## Open Questions

N/A

---

## Tasks

### Task 1: Verify and fix `calculateProposalDependencies()` RED tests

**File(s)**: `tests/core/proposal-writer.test.ts`
**Action**: modify

Run the updated `calculateProposalDependencies` tests. Each test now destructures `.edges` and `.parallelSets` from the return value. Confirm all six existing tests (plus the new `parallelSets` assertions from the RED proposal) pass. If the `proposalSet` helper from RED Task 6 needs adjustment after implementation, update it. Do not add new test cases — only make existing RED tests green.

**Acceptance**:

- [x] All `calculateProposalDependencies` tests pass
- [x] `parallelSets[0] === ['red-hash']` test passes for standard layout
- [x] `parallelSets[1]` contains all impl hashes (order-independent) test passes
- [x] Single-proposal test returns `parallelSets: [['only']]`
- [x] Empty-proposals test returns `parallelSets: []`

---

### Task 2: Verify and fix `ProposalRole` type tests

**File(s)**: `tests/core/types.test.ts`
**Action**: modify

Run `tests/core/types.test.ts`. Confirm the five valid `ProposalRole` values are accepted and the `@ts-expect-error` negative tests are correctly placed. If the import path for `ProposalRole` from `src/core/types.ts` did not land at the expected path, fix the import. Do not add new test cases.

**Acceptance**:

- [x] All `ProposalRole` tests pass
- [x] No TypeScript errors or `@ts-expect-error` mismatches
- [x] `describe('ProposalRole', ...)` block reports all tests green

---

### Task 3: Verify and fix `ProposalListOutput` schema tests

**File(s)**: `tests/mcp/proposal-schemas.test.ts`
**Action**: modify

Run the proposal-schemas tests. Confirm `ProposalListOutputSchema.parse({ proposals: [], parallelSets: [] })` passes. Confirm `ProposalListOutputSchema.parse({ proposals: [] })` throws. Confirm `parallelSetIndex: 0` is accepted on a proposal summary. If the schema file was not yet created as part of RED, confirm it exists and was created by the RED proposal.

**Acceptance**:

- [x] All four schema assertions from RED Task 4 pass
- [x] No `ZodError` thrown for valid shapes
- [x] `ZodError` thrown for missing `parallelSets` (required field test)

---

### Task 4: Verify and fix `ProposalData` roles tests

**File(s)**: `tests/generation/proposal-template.test.ts`
**Action**: modify

Run the proposal-template tests. Confirm `ProposalData` accepts `roles?: ProposalRole[]` and that `renderProposalTemplate` replaces `{{ROLES}}` correctly. If the template test file needs the import path for `ProposalRole` adjusted (e.g. was imported from `proposal-template.ts` rather than `src/core/types.ts`), update only the import.

**Acceptance**:

- [x] `roles: ['testing', 'feature']` renders as `'testing, feature'` in template output
- [x] Missing `roles` renders without error and produces an empty string for `{{ROLES}}`
- [x] All existing `proposal-template` tests continue to pass

---

### Task 5: Integration test — proposal generation pipeline end-to-end

**File(s)**: `tests/core/proposal-generation.test.ts`
**Action**: modify

Update the mock for `calculateProposalDependencies` to return `{ edges: [...], parallelSets: [['red-hash'], ['impl-hash'], ['green-hash']] }`. Extend the existing integration test that calls `generateProposals` to assert: (a) no error thrown, (b) generated proposals have `parallelSetIndex` populated, (c) `syncProposalsFromDisk` is called after annotation. If the `parallelSetIndex` annotation loop in `proposal-generation.ts` is not yet covered by the mock, add a spy to confirm the annotation loop runs.

**Acceptance**:

- [x] Mock returns `{ edges, parallelSets }` shape
- [x] Integration test asserts `parallelSetIndex` is set on at least one proposal
- [x] No regression in existing `proposal-generation` tests

---

### Task 6: Coverage gap analysis — migration patch error path

**File(s)**: `tests/storage/migrations.test.ts`
**Action**: modify

Locate the existing migrations test file. Add a test that calls `patchProposalsParallelSetIndex` (if exported, or test indirectly via `runMigrations`) against a DB that already has the `parallel_set_index` column, and confirms no error is thrown (duplicate-column error is swallowed). Add a test that a fresh DB after `runMigrations` contains the `parallel_set_index` column in the `proposals` table (`PRAGMA table_info(proposals)` assertion).

**Acceptance**:

- [x] `patchProposalsParallelSetIndex` on existing column does not throw
- [x] Fresh DB from `runMigrations` has `parallel_set_index` column in `proposals` table
- [x] Existing migrations tests continue to pass

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `tests/core/proposal-writer.test.ts` | modify | Fix any failing RED tests for `calculateProposalDependencies` + `parallelSets` |
| `tests/core/types.test.ts` | modify | Confirm `ProposalRole` imports resolve; fix import paths if needed |
| `tests/mcp/proposal-schemas.test.ts` | modify | Confirm all four `ProposalListOutput` schema assertions pass |
| `tests/generation/proposal-template.test.ts` | modify | Confirm `roles` render test passes; fix import paths if needed |
| `tests/core/proposal-generation.test.ts` | modify | Update mock shape and add `parallelSetIndex` annotation assertion |
| `tests/storage/migrations.test.ts` | modify | Add `patchProposalsParallelSetIndex` idempotency and column-presence tests |

---

## Implementation Notes

GREEN phase tasks are verification-only: do not add implementation code. If a test fails because of a genuine bug in the implementation proposals, the fix belongs in the prior proposal, not here. GREEN tasks are limited to: fixing import paths that landed at different locations than RED assumed, updating fixtures to match actual generated file shapes (e.g., if hash values or file naming differed), and adding targeted coverage-gap tests for newly discovered uncovered branches.

The 90% coverage threshold must be met for all files touched across P02, P03, and P04 before this proposal is marked complete.

---

## Rollback

**If rejected or failed**: No production code is changed in this proposal. Revert only test file modifications. All source changes belong to P02, P03, P04.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-11
**Versioning**: SemVer
**Owner**: zeno

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-03-11 | Initial version | zeno |
