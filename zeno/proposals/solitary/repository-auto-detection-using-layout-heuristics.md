# Proposal: Repository Auto-Detection Using zenoDir Layout Heuristics

**Hash**: #{{HASH}}
**Gate**: Solitary
**Status**: pending
**Created**: 2026-04-24

<!-- LLM AGENT — MANDATORY PRE-EXECUTION STEP
Do NOT read tasks and begin implementing. You MUST call the MCP tool first:

  proposal_action:start { "hash": "#{{HASH}}" }

This registers the proposal as in_progress and returns the worktree path.
All file edits and commits must happen inside that worktree — not in the main workspace.
Skipping this step bypasses worktree isolation and breaks the approve/merge workflow.
-->

---

## Summary

Wire a working implementation of `detectRepositoryBoundaries()` so the `repositories` table is actually populated from `zeno repos detect --apply` and the `repos_adjust` / `repos_detect` MCP actions. The current code path runs `CodeAnalyzer`, builds a serializable payload, and hands it to `ArchitectReviewerBoundaryAnalyzer.analyze()` which returns `[]` and never persists. Reuse the deterministic project-layout probes already proven in `src/utils/config.ts` — `isSubmoduleLayout`, `isDirGitSubmodule`, plus `.git`/`.gitmodules` parsing — to seed an initial repository topology (root project, mounted planning submodule, declared submodules, and detected service/library directories) before any LLM-driven recommendation is layered on top. Persist results via `saveRepository` so `zeno repos list` and downstream multi-repo features (cross-repo deps, conflict detection) operate on real data instead of an empty table.

---

## Proposal Type

**RED** | **GREEN** | **Test Refinement**

- **RED**: Test-first phase defining acceptance criteria. Focuses on coverage target (from `config.qualityThresholds.codeCoverage`). No implementation code.
- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.
- **Test Refinement**: Final proposal refining coverage gaps and validating all tests pass.

---

## Context

### Why This Change

**The gap.** The `repositories` SQLite table is fully scaffolded (schema, CRUD in `src/storage/repository-storage.ts`, MCP tools `repos_list`/`repos_add`/`repos_detect`/`repos_adjust`, CLI `zeno repos`) but has zero population paths in normal use:

- `detectRepositoryBoundaries(rootPath, { persist })` in `src/core/boundary-detection.ts` always returns `{ recommendations: [], persisted: false }` because it delegates to `ArchitectReviewerBoundaryAnalyzer.analyze()` which is a stub that resolves with `[]` (LLM invocation deferred).
- The `persist: true` option is accepted but ignored — no call to `saveRepository` is ever made from the detection path.
- `zeno repos detect --apply` and the `repos_adjust` MCP action therefore appear to succeed but populate nothing.
- The only working write path today is manual `zeno repos add` / `repos_add`, which requires a human to enumerate every repo by hand.

**The reuse opportunity.** `src/utils/config.ts` already implements layered, deterministic layout detection that the rest of the codebase trusts:

- `isDirGitSubmodule(dir)` — checks for `.git` being a *file* (the submodule gitfile) rather than a directory
- `isSubmoduleLayout(projectRoot)` — true when `<root>/zeno/` is a mounted submodule
- `getZenoDir` / `getZenoGitDir` — three-way layout discrimination (submodule, standard, standalone)

The same heuristics generalize naturally to repository-boundary discovery: parse `.gitmodules`, walk for nested `.git` files/dirs, and apply the existing `isDirGitSubmodule` probe to each candidate. This produces a deterministic, no-LLM seed topology that the database can be populated from immediately, with the existing `ArchitectReviewerBoundaryAnalyzer` retained as an optional advisory layer for splitting monolith directories.

### Dependencies

List only valid hash references. It is acceptable to have no dependencies if this proposal is self-contained or first in a gate.

**Hash Usage Rules**:

- Proposal hashes (#xxxxx) should only appear in: the proposal's own header, the associated gate's proposal table, and dependency tables
- Do not reference proposal hashes in body text, task descriptions, or other sections
- Use descriptive names instead of hashes for readability in all other contexts

*No dependencies.*

---

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

**RED Phase Tasks** (test-first, defining acceptance criteria):

- Write tests covering happy path and error cases
- Tests should fail before implementation (RED)
- Use fixtures and mocks to isolate units
- No implementation code in RED phase

**GREEN Phase Tasks** (implementation following tests):

- Implement only functions/methods covered by RED tests
- Make RED tests pass (GREEN)
- Do not add new tests beyond what RED defined
- Verify all RED tests pass before marking complete

**GREEN Phase Guardrails** (verification rules):

- [ ] All changes implement only code specified in RED phase tests
- [ ] No new test files created beyond those in RED phase
- [ ] No new test cases added to existing test files
- [ ] All RED tests pass with implementation
- [ ] Coverage meets or exceeds target threshold

<!-- LLM Instructions — File Scoping Rules (not rendered in output):
- Every File(s) entry MUST be an explicit file path
- NEVER use directory globs or wildcards
- Each task should touch 1-3 files maximum

Test Scoping Rules:
- Solitary proposals MUST include test tasks inline (combine RED and GREEN).
-->

### Task 1: Write failing tests for layout-based repository detector

**Phase**: RED
**File(s)**: `tests/core/repository-layout-detector.test.ts`
**Action**: create

Write failing tests for the layout-based repository detector that mirrors `getZenoDir`'s heuristic style.

**Acceptance**:

- [ ] Test fixture: standalone project (single `.git/` directory, no `zeno/` subfolder) yields exactly one repo of type `main` with `path = '.'` and name derived from the root directory basename
- [ ] Test fixture: standard layout (`<root>/.git/` directory, `<root>/zeno/` regular directory) yields one `main` repo only — `zeno/` is not classified as a separate repo
- [ ] Test fixture: submodule planning layout (`<root>/.git/` directory, `<root>/zeno/.git` is a *file*) yields two repos: `main` (`path = '.'`) and `planning` (`path = 'zeno'`, type = `tool`)
- [ ] Test fixture: monorepo with `.gitmodules` declaring `services/auth` and `services/billing` as submodules yields three repos: `main`, plus `auth` and `billing` typed as `service`
- [ ] Test fixture: nested git checkout at `packages/sdk/.git` (not in `.gitmodules`) yields a repo entry typed `library` with `path = 'packages/sdk'` and rationale containing the substring `nested .git directory`
- [ ] Test verifies all detector results carry `hash = shortHash(name + path)` matching the value `repos_add` would generate
- [ ] Test verifies the detector does not descend into `node_modules`, `.local`, `coverage`, `dist`, or any path matched by `.gitignore` at the project root
- [ ] All tests fail before implementation

---

### Task 2: Write failing tests for `detectRepositoryBoundaries` persistence

**Phase**: RED
**File(s)**: `tests/core/boundary-detection.test.ts`
**Action**: modify

Extend existing boundary-detection tests with persistence-path coverage.

**Acceptance**:

- [ ] Test verifies `detectRepositoryBoundaries(root, { persist: false })` returns recommendations from the layout detector AND does not call `saveRepository`
- [ ] Test verifies `detectRepositoryBoundaries(root, { persist: true })` calls `saveRepository` once per detected repo with the correct `{ hash, name, type, path }` payload
- [ ] Test verifies `persisted: true` is returned in the result when `persist: true` and at least one repo was written
- [ ] Test verifies idempotency: invoking with `persist: true` twice on the same root does not throw (existing rows are skipped via `INSERT OR IGNORE` semantics or pre-flight `getRepositoryByHash` check) and the row count remains stable
- [ ] Test verifies the optional `BoundaryAnalyzer` is still invoked AFTER layout seeding, and any LLM recommendations are merged but never override deterministic layout-detected entries (deterministic wins on hash collision)
- [ ] All tests fail before implementation

---

### Task 3: Implement `detectRepositoryLayout` — deterministic layout-based detector

**Phase**: GREEN
**File(s)**: `src/core/repository-layout-detector.ts`

**Action**: create

Implement a pure function that returns `BoundaryRecommendation[]` derived from filesystem layout probes only — no LLM, no `CodeAnalyzer`.

**Acceptance**:

- [ ] Exports `detectRepositoryLayout(projectRoot: string): BoundaryRecommendation[]`
- [ ] Reuses `isDirGitSubmodule` from `src/utils/config.ts` (export it if not already exported) rather than reimplementing the `.git`-as-file check
- [ ] Always emits a `main` repo entry for `projectRoot` when `<root>/.git` exists (file or directory)
- [ ] When `isSubmoduleLayout(projectRoot)` is true, emits an additional `tool`-typed repo entry for `<root>/zeno` named `planning` with rationale `'zeno mounted as git submodule'`
- [ ] Parses `<root>/.gitmodules` (if present) and emits one repo per declared submodule, classifying type by path heuristics: `services/*` → `service`, `packages/*` or `libs/*` → `library`, `apps/*` → `app`, fallback → `library`
- [ ] Walks one level deep under `services/`, `packages/`, `libs/`, `apps/` and emits any directory containing a `.git` file/dir not already listed in `.gitmodules`, with the same type heuristics
- [ ] Skip-list is hard-coded: `node_modules`, `.local`, `.git`, `coverage`, `dist`, `build`, `.next`, `out`
- [ ] Each recommendation carries `rationale` describing the detection signal (e.g., `submodule declared in .gitmodules`, `nested .git directory`, `git submodule (gitfile)`)
- [ ] No invocation of `CodeAnalyzer` or any LLM analyzer

---

### Task 4: Wire layout detector + persistence into `detectRepositoryBoundaries`

**Phase**: GREEN
**File(s)**: `src/core/boundary-detection.ts`

**Action**: modify

Replace the always-empty implementation with a layered detector: deterministic layout seed first, optional analyzer recommendations second, persistence last.

**Acceptance**:

- [ ] `detectRepositoryBoundaries` calls `detectRepositoryLayout(rootPath)` first to obtain a deterministic seed
- [ ] Still invokes `analyzer.analyze(serialized)` and merges its recommendations into the result, but de-duplicates by `shortHash(name + path)` and drops any analyzer entry whose hash collides with a layout-detected entry (deterministic wins)
- [ ] When `opts.persist === true`, iterates the merged recommendations and calls `saveRepository({ hash, name, type, path }, rootPath)` for each entry where `getRepositoryByHash(hash, rootPath)` returns `undefined`
- [ ] Returns `{ recommendations, persisted: opts.persist === true && newRowsWritten > 0 }`
- [ ] Logs (via `logger.info`) the count of layout-seeded vs analyzer-suggested vs newly-persisted repos
- [ ] The `repos_detect` MCP action and `zeno repos detect --apply` CLI both observe populated `repositories` table after invocation on this very project (root + planning submodule, if applicable)
- [ ] Existing `boundary-detection.ts` exports (`serializeForBoundaryDetection`, `parseBoundaryRecommendations`, `ArchitectReviewerBoundaryAnalyzer`, `BoundaryAnalyzer` interface) remain unchanged

---

### Task 5: Run detection during `zeno init` to seed the table on first use

**Phase**: GREEN
**File(s)**: `src/cli/commands/init.ts`

**Action**: modify

Invoke layout-based detection at the end of `zeno init` so newly initialized projects start with a populated `repositories` table.

**Acceptance**:

- [ ] After `initializeDatabase` completes successfully, `init` calls `detectRepositoryBoundaries(projectRoot, { persist: true })` and logs the count of seeded repos
- [ ] Failure of detection is non-fatal: a warning is logged and `init` still exits 0
- [ ] Existing `init` behavior, prompts, and exit codes are unchanged on the happy path
- [ ] Existing tests for `zeno init` continue to pass

---

## Files Affected

**Rules**:

- Every entry MUST be a fully-qualified file path — no directories, no globs, no wildcards
- This table is the authoritative scope boundary; the scope validator rejects modifications to unlisted files

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `tests/core/repository-layout-detector.test.ts` | RED | create | Unit tests for deterministic layout detector |
| `tests/core/boundary-detection.test.ts` | RED | modify | Persistence-path tests for `detectRepositoryBoundaries` |
| `src/core/repository-layout-detector.ts` | GREEN | create | `detectRepositoryLayout` — filesystem-only repo enumeration |
| `src/core/boundary-detection.ts` | GREEN | modify | Layered detector + persistence wiring |
| `src/utils/config.ts` | GREEN | modify | Export `isDirGitSubmodule` for reuse by detector |
| `src/cli/commands/init.ts` | GREEN | modify | Seed `repositories` table during `zeno init` |

---

## Implementation Notes

**Why deterministic-first.** The existing `ArchitectReviewerBoundaryAnalyzer` is a stub returning `[]` and there is no concrete plan for wiring a real LLM invocation in this proposal's scope. A deterministic layout-based seed gives every project a populated `repositories` table on day one without requiring any LLM call — the analyzer remains a future enrichment layer. This mirrors how `getZenoDir` chose deterministic filesystem probing over configuration to make layout detection reliable across CI, fresh clones, and partially-initialized projects.

**Type heuristics.** Path-based classification (`services/*` → `service`, etc.) is a pragmatic default that matches common monorepo conventions (Nx, Turborepo, Lerna, Yarn workspaces). Misclassification is recoverable via `repos_adjust` or `zeno repos add --type <type>` — the `updateRepository` CRUD already supports it.

**Idempotency.** Detection should be safe to re-run after every `zeno init`, on demand via `repos_detect`, and as part of `repos_adjust`. The `getRepositoryByHash` pre-flight check prevents UNIQUE-constraint violations and avoids the need for `INSERT OR IGNORE` (which would mask genuine errors).

**Rejected alternatives.**

- *Auto-detect via `CodeAnalyzer` coupling metrics alone* — produces noisy boundaries inside a single repo (e.g., `src/core` vs `src/utils`) which are NOT separate repositories. Layout signals are the correct primary indicator of repo identity; coupling is a refinement signal best left to the optional analyzer layer.
- *Make the user run `repos add` for every entry* — current state. Friction is too high for multi-repo projects to ever realistically use the feature.

---

## Rollback

**If rejected or failed**: All changes are additive (one new source file, one new test file, small targeted modifications). Revert via `git revert` on the merge commit. The `repositories` table schema is unchanged; rolling back leaves any seeded rows in place but they are inert without callers — `zeno repos list` continues to work, and a follow-up `DELETE FROM repositories` is sufficient cleanup if desired.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-04-24
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: Duccci
**Reviewers**: Duccci

### Change Log

| Version | Date         | Summary         | Author          |
| ------- | ------------ | --------------- | --------------- |
| 1.0.0   | 2026-04-24   | Initial version | Duccci          |
