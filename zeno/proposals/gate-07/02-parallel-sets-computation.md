---
zeno:
  hash: 'b1c9e3f5'
  gate_id: 'gate-07'
  requirement_id: null
  status: pending
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

# Proposal: Parallel Sets Computation & `parallelSetIndex` Annotation

**Hash**: #b1c9e3f5
**Gate**: gate-07 - Proposal Generation & Management
**Status**: pending
**Created**: 2026-03-11

---

## Summary

Extends `calculateProposalDependencies()` in `src/core/proposal-writer.ts` to also compute parallel execution sets via Kahn's topological sort algorithm, returning `{ edges, parallelSets }` instead of a plain edges array. Updates the proposal generation flow to annotate each generated `ProposalMetadata` with its `parallelSetIndex`, adds the DB schema column, and wires `parallelSetIndex` into the `syncProposalsFromDisk` frontmatter-to-DB path so the value persists across restarts.

---

## Context

### Why This Change

`calculateProposalDependencies()` already produces the dependency graph edges (RED → impl → GREEN). The parallel execution sets — which proposals can run concurrently — are a direct product of a topological sort over those same edges. `topologicalFallback()` in `src/generation/task-distributor-integration.ts` already implements Kahn's algorithm but is only called by the optional AI-agent distributor path. Gate 07 requires this computation to be a first-class part of every proposal generation, not an optional agent invocation. Persisting `parallelSetIndex` allows `proposal list` and the MCP response (surfaces in Proposal 4) to serve ordering information without recomputing on every read.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #a7d4f2e8 | requires | RED test suite must exist so tests can be run against this implementation |

---

## Open Questions

N/A

---

## Tasks

### Task 1: Change `calculateProposalDependencies()` return type to `{ edges, parallelSets }`

**File(s)**: `src/core/proposal-writer.ts`
**Action**: modify

Change the return type of `calculateProposalDependencies()` from `{ from: string; to: string; type: string }[]` to `{ edges: { from: string; to: string; type: string }[]; parallelSets: string[][] }`. After all edges are built, compute `parallelSets` using inline Kahn's algorithm (copy the body of `topologicalFallback` from `src/generation/task-distributor-integration.ts` — do not import it; the module is an optional AI agent shuttle and pulling it in would create a dependency on `child_process` / ACP SDK). Build an `inDegree` map and adjacency map from the edges array, then iterate frontier → next until exhausted. Return `{ edges: dependencies, parallelSets }`.

**Acceptance**:

- [ ] Function signature changes from returning `Array` to returning `{ edges, parallelSets }`
- [ ] `parallelSets` is computed before the `return` statement using pure Kahn's algorithm
- [ ] No import of `topologicalFallback` or `task-distributor-integration` is added
- [ ] TypeScript compiles without errors (`npm run build`)

---

### Task 2: Update all callers of `calculateProposalDependencies()`

**File(s)**: `src/core/proposal-generation.ts`
**Action**: modify

`proposal-generation.ts` calls `calculateProposalDependencies(proposals)` and stores the result as `dependencies`. Destructure the new return value: `const { edges: dependencies, parallelSets } = calculateProposalDependencies(proposals)`. After the destructure, annotate each proposal: iterate `parallelSets.forEach((set, idx) => set.forEach(hash => { const p = proposals.find(…); if (p) p.parallelSetIndex = idx }))`. This relies on `ProposalMetadata` gaining the `parallelSetIndex` field in Task 3. Also update the call in `tests/core/proposal-generation.test.ts` mock: the mock's `mockReturnValue` should now return `{ edges: [...], parallelSets: [] }` to match the new shape.

**Acceptance**:

- [ ] `const { edges: dependencies, parallelSets }` destructure compiles cleanly
- [ ] `parallelSets.forEach` loop runs after destructure and sets `p.parallelSetIndex`
- [ ] `proposal-generation.test.ts` mock updated to return `{ edges, parallelSets }` shape
- [ ] No other callers of `calculateProposalDependencies` remain using the old plain-array return

---

### Task 3: Add `parallelSetIndex` to `ProposalMetadata`

**File(s)**: `src/core/proposal-writer.ts`
**Action**: modify

Add `parallelSetIndex?: number` as an optional field to the `ProposalMetadata` interface exported from this file. Ensure the `proposals.push(...)` calls in `generateRedTestSuiteProposal`, `generateImplementationProposals`, and `generateGreenVerificationProposal` do not need to supply it immediately (the field is populated post-generation by the annotation loop in `proposal-generation.ts`).

**Acceptance**:

- [ ] `ProposalMetadata` interface has `parallelSetIndex?: number`
- [ ] All three `proposals.push(...)` calls still compile cleanly (field is optional)
- [ ] Assigning `p.parallelSetIndex = idx` in Task 2 annotation loop compiles without `readonly` error

---

### Task 4: Add `parallel_set_index` column to the DB schema

**File(s)**: `src/storage/migrations/schema.sql`, `src/storage/migrations.ts`
**Action**: modify

In `schema.sql`, add `parallel_set_index INTEGER` to the `CREATE TABLE IF NOT EXISTS proposals (...)` statement. In `migrations.ts`, add a `patchProposalsParallelSetIndex(db)` function (modelled after `patchProposalStatusConstraint`) that runs `db.exec("ALTER TABLE proposals ADD COLUMN parallel_set_index INTEGER")` inside a try/catch (SQLite returns an error if the column already exists; swallow `duplicate column` errors). Call `patchProposalsParallelSetIndex(db)` at the top of `runMigrations()` after the existing patch call.

**Acceptance**:

- [ ] `schema.sql` includes `parallel_set_index INTEGER` in the proposals table definition
- [ ] `patchProposalsParallelSetIndex` is defined and called in `runMigrations`
- [ ] Running the migration on an existing DB without the column succeeds (column added)
- [ ] Running the migration a second time does not throw (duplicate-column error swallowed)

---

### Task 5: Persist `parallelSetIndex` via `syncProposalsFromDisk`

**File(s)**: `src/storage/proposal-sync.ts`
**Action**: modify

Extend `ParsedProposalMetadata` interface with `parallelSetIndex: number | null`. In `parseProposalMetadata`, read `parallel_set_index` from the frontmatter YAML object (`fm.parallel_set_index`) if present and it is a number; otherwise `null`. In the `upsert` prepared statement add `parallel_set_index` to the columns list and add the value to the `.run(...)` call. In the `ON CONFLICT(hash) DO UPDATE SET` clause, leave `parallel_set_index` out (DB is authoritative for lifecycle fields; file is written once by the generator and then not re-written by human edits).

**Acceptance**:

- [ ] `ParsedProposalMetadata` has `parallelSetIndex: number | null`
- [ ] `parseProposalMetadata` extracts `parallel_set_index` from frontmatter YAML
- [ ] UPSERT `INSERT` includes `parallel_set_index` column with the parsed value
- [ ] `ON CONFLICT DO UPDATE` does NOT overwrite `parallel_set_index` for existing rows
- [ ] `npm run build` compiles cleanly

---

### Task 6: Write `parallel_set_index` to generated proposal frontmatter

**File(s)**: `src/core/proposal-writer.ts`
**Action**: modify

In `generateRedTestSuiteProposal`, `generateImplementationProposals`, and `generateGreenVerificationProposal`, update the YAML frontmatter block written to disk to include `parallel_set_index: null`. The value will be back-filled in memory by the annotation loop in `proposal-generation.ts`, but the on-disk frontmatter only needs the placeholder so that `syncProposalsFromDisk` has the key present. After the annotation loop in `proposal-generation.ts` runs and sets `parallelSetIndex` on each `ProposalMetadata`, update each `.md` file on disk by replacing the `parallel_set_index: null` line with the actual index value before calling `syncProposalsFromDisk`.

**Acceptance**:

- [ ] Generated `.md` frontmatter contains `parallel_set_index:` key after generation
- [ ] After annotation, the frontmatter is updated to the correct integer index
- [ ] `syncProposalsFromDisk` subsequently reads the correct integer and stores it in DB
- [ ] No `.md` files are left with `parallel_set_index: null` after a successful generation

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/core/proposal-writer.ts` | modify | Change return type of `calculateProposalDependencies()`; add `parallelSetIndex?` to `ProposalMetadata`; write `parallel_set_index` to frontmatter |
| `src/core/proposal-generation.ts` | modify | Destructure `{ edges, parallelSets }`; run annotation loop after deps calculation |
| `src/storage/migrations/schema.sql` | modify | Add `parallel_set_index INTEGER` column to proposals table |
| `src/storage/migrations.ts` | modify | Add `patchProposalsParallelSetIndex()` and call in `runMigrations()` |
| `src/storage/proposal-sync.ts` | modify | Extend `ParsedProposalMetadata`; parse + persist `parallel_set_index` |
| `tests/core/proposal-generation.test.ts` | modify | Update mock return value to `{ edges, parallelSets }` shape |

---

## Implementation Notes

The topological sort duplicated into `calculateProposalDependencies()` is intentional — `task-distributor-integration.ts` is an optional AI shuttle with a `child_process` dependency and should not become a hard import for core generation logic. The ~20-line Kahn's algorithm copy is justified by the isolation requirement stated in the gate PRD.

For Task 6, the frontmatter update should re-read the written `.md` file content, find the `parallel_set_index: null` line, replace it with `parallel_set_index: <idx>`, and write the file back. Use the existing `writeFile` utility. Keep it minimal — do not introduce a full YAML serialiser.

---

## Rollback

**If rejected or failed**: Revert `calculateProposalDependencies()` to return a plain array. Remove `parallelSetIndex` from `ProposalMetadata`. Revert `schema.sql` and remove `patchProposalsParallelSetIndex`. Revert `syncProposalsFromDisk` changes. Revert `proposal-generation.ts` destructure.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-11
**Versioning**: SemVer
**Owner**: zeno

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-03-11 | Initial version | zeno |
