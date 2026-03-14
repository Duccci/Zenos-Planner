---
zeno:
  hash: 'a7d4f2e8'
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

# Proposal: RED — Gate 07 Test Suite

**Hash**: #a7d4f2e8
**Gate**: gate-07 - Proposal Generation & Management
**Roles**: testing
**Status**: completed
**Approved By**: Duccci
**Implemented**: 2026-03-14T03:35:19.288Z
**Created**: 2026-03-11

---

## Summary

Writes the complete failing test suite for all gate-07 deliverables before any implementation begins. Tests cover: `calculateProposalDependencies()` returning `{ edges, parallelSets }` with correct topological grouping; `parallelSetIndex` presence on `ProposalMetadata`; `ProposalRole` type constraints and per-field validation; and `ProposalListOutput` including `parallelSets` and per-summary `parallelSetIndex`. All tests are expected to fail (RED) until the three implementation proposals complete.

---

## Context

### Why This Change

Gate 7 extends the proposal generation pipeline with parallel execution awareness (`parallelSets`, `parallelSetIndex`) and a consolidated role taxonomy (`ProposalRole`). Writing tests first defines precise acceptance criteria and prevents implementation drift. No gate-level test proposal existed before this gate started.

### Dependencies

*No dependencies.*

---

## Open Questions

N/A

---

## Tasks

### Task 1: Tests for `calculateProposalDependencies()` parallel sets output

**File(s)**: `tests/core/proposal-writer.test.ts`
**Action**: modify

Extend the existing `calculateProposalDependencies` describe block. Add test cases that assert the function now returns an object with `edges` and `parallelSets` keys (not a plain array). Verify `parallelSets` for the standard RED → impl → GREEN layout: `parallelSets[0]` = `['red-hash']`, `parallelSets[1]` = impl hashes (order-independent), `parallelSets[2]` = `['green-hash']`. Add a test for an empty proposal list returns `{ edges: [], parallelSets: [] }`, and one for a single proposal returns `{ edges: [], parallelSets: [['only']] }`. Add a test for the RED → GREEN direct case (no impls) returns two sets. Update the import to include the new return-type shape.

**Acceptance**:

- [x] All new assertions fail with `TypeError` or shape-mismatch before implementation (RED)
- [x] Existing `calculateProposalDependencies` tests updated to destructure `.edges` from the return
- [x] Test for `parallelSets[1]` uses `expect.arrayContaining` for order-independence
- [x] Test for cycle-free multi-impl: all impls grouped in the same set (parallelSets[1])

---

### Task 2: Tests for `parallelSetIndex` on `ProposalMetadata`

**File(s)**: `tests/core/proposal-writer.test.ts`
**Action**: modify

Add a describe block `ProposalMetadata shape` that imports the `ProposalMetadata` interface and asserts via TypeScript assignability tests (compile-time) that `parallelSetIndex?: number` is an accepted field. Add a runtime test that constructs a minimal `ProposalMetadata` object without `parallelSetIndex` and confirms it satisfies the type (optional field check). Import the type only — do not call the generator yet.

**Acceptance**:

- [x] TypeScript `satisfies ProposalMetadata` check compiles when `parallelSetIndex` is omitted
- [x] TypeScript `satisfies ProposalMetadata` check compiles when `parallelSetIndex: 0` is included
- [x] TypeScript compile error when `parallelSetIndex: 'bad'` is assigned (negative type test via `@ts-expect-error`)

---

### Task 3: Tests for `ProposalRole` type constraints

**File(s)**: `tests/core/types.test.ts`
**Action**: create

Create a new test file. Import `ProposalRole` from `src/core/types.ts`. Write tests that confirm the union type contains exactly the five values: `'testing'`, `'feature'`, `'cleanup'`, `'documentation'`, `'solitary'`. Use a typed array `const roles: ProposalRole[] = [...]` and verify `includes` calls. Add negative-type tests with `@ts-expect-error` for values outside the union (e.g. `'RED'`, `'GREEN'`, `'implementation'`). Add a test that `ProposalMetadata` (from `src/core/proposal-writer.ts`) accepts `roles: ProposalRole[]`.

**Acceptance**:

- [x] File is created and all imports fail (RED — types don't exist yet)
- [x] Five valid `ProposalRole` values accepted without compile error
- [x] `@ts-expect-error` annotations silence the expected TS errors for invalid values
- [x] Test file follows existing naming convention (`describe('ProposalRole', ...)`)

---

### Task 4: Tests for `ProposalListOutput` shape with `parallelSets`

**File(s)**: `tests/mcp/proposal-schemas.test.ts`
**Action**: modify

Locate the existing test file for proposal schemas. Add assertions that `ProposalListOutputSchema` (imported from `src/mcp/schemas/proposal-schemas.ts`) parses an object containing `parallelSets: string[][]` without error. Add a test for missing `parallelSets` fails parse (confirming the field is required). Add a test that each item in `proposals` array within `ProposalListOutput` has an optional `parallelSetIndex: number` field. Confirm the Zod schema rejects `parallelSetIndex: 'bad'`.

**Acceptance**:

- [x] Assertions fail before schema is updated (RED — `parallelSets` key not present yet)
- [x] `ProposalListOutputSchema.parse({ proposals: [], parallelSets: [] })` passes (post-impl)
- [x] Missing `parallelSets` key throws `ZodError` (required field)
- [x] `parallelSetIndex: 0` on a proposal summary is accepted; `parallelSetIndex: 'bad'` rejected

---

### Task 5: Tests for `roles` field on `ProposalData`

**File(s)**: `tests/generation/proposal-template.test.ts`
**Action**: modify

Locate the existing proposal-template test file (or create if absent). Add assertions that `ProposalData` (from `src/generation/proposal-template.ts`) accepts `roles?: ProposalRole[]`. Verify that `renderProposalTemplate` correctly replaces a `{{ROLES}}` placeholder in a template string with a comma-joined string of roles when `data.roles` is provided, and omits the placeholder (or uses a default) when `roles` is absent. Use a minimal template string fixture, not the real template file.

**Acceptance**:

- [x] TypeScript assignability test for `roles: ['testing', 'feature']` on `ProposalData` passes
- [x] `renderProposalTemplate` test fails with "replace is not a function" or placeholder mismatch (RED)
- [x] Test for missing `roles` renders without throwing

---

### Task 6: Set up shared test fixtures

**File(s)**: `tests/core/proposal-writer.test.ts`
**Action**: modify

Add a `proposalSet` factory helper inside the existing test file that constructs arrays of `ProposalMetadata`-shaped objects (or minimal `{ hash, phase?, filename? }` shapes) for the RED/impl/GREEN layout. Use this helper to DRY the new `parallelSets` test cases added in Task 1. No separate fixtures file needed — inline helper is sufficient.

**Acceptance**:

- [x] Helper is co-located in the test file, not exported
- [x] All Task 1 `parallelSets` tests use the helper
- [x] No duplication of hash literals across tests that use the helper

---

### Task 7: Consolidate role behaviour tests into `tests/core/types.test.ts`

**File(s)**: `tests/mcp/validators/test-first-validator.test.ts`, `tests/core/types.test.ts`
**Action**: modify / modify

The `describe('missing or invalid role', ...)` block (3 tests) in `test-first-validator.test.ts` tests role-specific validation behaviour and belongs alongside the `ProposalRole` type tests in `tests/core/types.test.ts`. Move those 3 tests into a new `describe('ProposalRole — validation behaviour', ...)` block at the bottom of `tests/core/types.test.ts`. Remove the block from `test-first-validator.test.ts`. Add any imports needed by the moved tests (`validateTestFirstPattern`, `TestFirstValidationContext`) to `tests/core/types.test.ts`.

The three tests to move are:

1. `'should warn on missing role for gate-tied proposal'`
2. `'should allow missing role for solitary proposal'`
3. `'should warn on unknown role'`

Do **not** move the tests in `tests/mcp/tools/proposal-coverage-filePath.test.ts`, `tests/mcp/tools/gate-coverage-filePath.test.ts`, or `tests/mcp/validators/artifact-validator.test.ts` — those use `role` only as fixture data and are not testing `ProposalRole` constraints.

**Acceptance**:

- [x] All 3 tests removed from the `describe('missing or invalid role', ...)` block in `test-first-validator.test.ts`
- [x] `describe('missing or invalid role', ...)` parent block removed from that file if it becomes empty
- [x] All 3 tests present under `describe('ProposalRole — validation behaviour', ...)` in `tests/core/types.test.ts`
- [x] `tests/core/types.test.ts` imports `validateTestFirstPattern` and `TestFirstValidationContext` from their source modules
- [x] No test regressions: same assertions, same pass/fail behaviour

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `tests/core/proposal-writer.test.ts` | modify | Extend `calculateProposalDependencies` tests + `ProposalMetadata` shape tests + fixture helper |
| `tests/core/types.test.ts` | create | New test file for `ProposalRole` type constraints + moved role validation behaviour tests |
| `tests/mcp/proposal-schemas.test.ts` | create | New test file for `parallelSets` + `parallelSetIndex` assertions on `ProposalListOutputSchema` |
| `tests/generation/proposal-template.test.ts` | modify | Add `roles` field tests on `ProposalData` |
| `tests/mcp/validators/test-first-validator.test.ts` | modify | Remove `describe('missing or invalid role', ...)` block (moved to `types.test.ts`) |

---

## Implementation Notes

All tasks are pure test-writing; no source files are modified. Tests in Tasks 1 and 4 will fail at import or runtime because the expected shapes don't exist yet. Tasks 2, 3, and 5 fail at compile time via `@ts-expect-error` inversion or type-only assertions once the types are absent.

`tests/mcp/proposal-schemas.test.ts` does not yet exist — create it (write a `describe` wrapper + the four assertions from Task 4).

---

## Rollback

**If rejected or failed**: Delete `tests/core/types.test.ts` (newly created). Revert changes to the four modified test files (`proposal-writer.test.ts`, `proposal-template.test.ts`, `test-first-validator.test.ts`, and `proposal-schemas.test.ts` if created). No source code was touched.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-11
**Versioning**: SemVer
**Owner**: zeno

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-03-11 | Initial version | zeno |
| 1.1.0 | 2026-03-11 | Add Task 7: consolidate role validation behaviour tests from test-first-validator.test.ts into types.test.ts; update Files Affected table | user |
