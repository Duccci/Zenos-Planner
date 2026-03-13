---
zeno:
  hash: 'e8f3c1d7'
  gate_id: 'gate-07'
  requirement_id: null
  status: validated
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

# Proposal: Surface `parallelSets` in `proposal list` and `proposal_action` MCP Response

**Hash**: #e8f3c1d7
**Gate**: gate-07 - Proposal Generation & Management
**Roles**: feature
**Status**: completed
**Approved By**: Duccci
**Implemented**: 2026-03-13T07:26:16.880Z
**Created**: 2026-03-11

---

## Summary

Updates the `ProposalListOutputSchema` Zod schema and the `proposal_action` MCP response handler to include a top-level `parallelSets: string[][]` array and a per-proposal `parallelSetIndex?: number` field. The `proposal_list` registry function is updated to query `parallel_set_index` from the DB and assemble the `parallelSets` structure before returning. The `proposal_action` list branch in `proposal-tools.ts` validates output against the updated schema.

---

## Context

### Why This Change

Gate 8 (Automated Validation) and Gate 9 (Human Approval) both depend on knowing which proposals can be reviewed/implemented concurrently. Currently `proposal list` returns only per-proposal metadata with no parallel set information. Surfacing `parallelSets` in the MCP response makes it a first-class part of the proposal lifecycle API — reviewers and automations can determine batching order without re-running the dependency calculation.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #a7d4f2e8 | requires | RED test suite defines the `ProposalListOutput` shape that this impl must satisfy |
| #b1c9e3f5 | requires | Parallel sets computation must persist `parallel_set_index` to DB before it can be queried here |

---

## Open Questions

N/A

---

## Tasks

### Task 1: Update `ProposalSummarySchema` and `ProposalListOutputSchema`

**File(s)**: `src/mcp/schemas/proposal-schemas.ts`
**Action**: modify

Add `parallelSetIndex: z.number().int().min(0).optional()` to `ProposalSummarySchema`. Add `parallelSets: z.array(z.array(z.string()))` as a required field on `ProposalListOutputSchema` (required because callers must always be able to read the sets; use `z.array(z.array(z.string()))` with no `.optional()` so the field is always present — gate-tied lists without computed sets return `[]`). Export the updated types `ProposalSummary` and `ProposalListOutput` remain auto-derived from the schemas via `z.infer`.

**Acceptance**:

- [x] `ProposalSummarySchema` has `parallelSetIndex: z.number().int().min(0).optional()`
- [x] `ProposalListOutputSchema` has `parallelSets: z.array(z.array(z.string()))` (required)
- [x] `ProposalListOutputSchema.parse({ proposals: [], parallelSets: [] })` succeeds
- [x] `ProposalListOutputSchema.parse({ proposals: [] })` throws `ZodError` (missing `parallelSets`)
- [x] `npm run build` compiles cleanly

---

### Task 2: Update `proposal_action` output schema for list action

**File(s)**: `src/mcp/schemas/proposal-action-schemas.ts`
**Action**: modify

Find the location in `proposal-action-schemas.ts` where the `list` action result is defined (it re-exports or references `ProposalListOutputSchema`). Confirm the reference is to the updated schema from Task 1 — no separate change should be needed if it uses a re-import, but verify the compile-time shape flows through. If there is a local `result:` override for the `list` action in the action output union, update it to include `parallelSets`.

**Acceptance**:

- [x] The `list` action result shape in `proposal-action-schemas.ts` reflects `parallelSets` field
- [x] `npm run build` compiles cleanly with no type errors related to list output

---

### Task 3: Update `proposal_list` registry implementation to return `parallelSets`

**File(s)**: `src/integration/proposals-registry.ts`
**Action**: modify

Locate the `proposal_list` function registration. After fetching proposal rows from the DB, group them by `parallel_set_index` to reconstruct `parallelSets: string[][]`. Proposals with `parallel_set_index IS NULL` should be placed in set index `0` as a safe fallback. Build the sets array by iterating an ordered set of distinct index values, collecting each set's proposal hashes in order. Also map each row's `parallel_set_index` value to the `parallelSetIndex` field on the returned proposal summary objects. Return `{ proposals: [...], parallelSets: [...] }`.

**Acceptance**:

- [x] `proposal_list` returns `{ proposals, parallelSets }` matching `ProposalListOutput` shape
- [x] Each proposal summary object includes `parallelSetIndex` when `parallel_set_index` is set in DB
- [x] Proposals with `parallel_set_index IS NULL` fall back to set `0` in the output
- [x] Empty gate (no proposals) returns `{ proposals: [], parallelSets: [] }`
- [x] Output validates against `ProposalListOutputSchema.parse(result)` without throwing

---

### Task 4: Validate `proposal_action` list output in handler

**File(s)**: `src/mcp/tools/proposal-tools.ts`
**Action**: modify

In the `proposalHandlers` function, the `list` action branch calls `r.invoke('proposal_list', payload)`. The result is then validated against `ProposalListOutputSchema` (check the existing `return ProposalListOutputSchema` at line 204). Verify this validation path now correctly handles the new `parallelSets` field. If `ProposalListOutputSchema` is used as the schema assertion, no code change is needed — just confirm via `npm run build` and tests.

**Acceptance**:

- [x] `proposal_action` list handler compiles cleanly with updated schema
- [x] Handler returns `parallelSets` as part of MCP structured content response
- [x] No runtime `ZodError` thrown when `proposal_list` returns a valid `{ proposals, parallelSets }` result

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/mcp/schemas/proposal-schemas.ts` | modify | Add `parallelSetIndex` to `ProposalSummarySchema`; add required `parallelSets` to `ProposalListOutputSchema` |
| `src/mcp/schemas/proposal-action-schemas.ts` | modify | Verify / update list action result shape for `parallelSets` |
| `src/integration/proposals-registry.ts` | modify | Reconstruct and return `parallelSets` from DB `parallel_set_index` column |
| `src/mcp/tools/proposal-tools.ts` | modify | Verify list handler passes through `parallelSets` in MCP response |

---

## Implementation Notes

The algorithm for `parallelSets` reconstruction in `proposals-registry.ts` should be O(n): group all proposals by `parallel_set_index` using a `Map<number, string[]>` keyed by index, then iterate the sorted entries via `[...map.entries()].sort((a,b) => a[0]-b[0]).map(([,hashes]) => hashes)` to produce the output array in index order.

When `parallelSets` is empty (gate has no proposals, or no proposals have been through generation), return `parallelSets: []` — never `undefined`. This keeps the schema required field contract.

---

## Rollback

**If rejected or failed**: Revert `ProposalSummarySchema` / `ProposalListOutputSchema` to remove `parallelSets`/`parallelSetIndex`. Revert `proposals-registry.ts` to return plain `{ proposals }`. No DB changes in this proposal.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-11
**Versioning**: SemVer
**Owner**: zeno

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-03-11 | Initial version | zeno |
