---
zeno:
  hash: 'b839e29b'
  gate_id: null
  requirement_id: null
  status: validated
  roles: 'feature'
  parallel_set_index: null
  created_at: '2026-04-01'
---

# Proposal: Gate PRD Reconciliation: Live-Update Stale Sections After Gate Start

**Hash**: #b839e29b
**Gate**: Solitary
**Status**: validated
**Roles**: feature
**Created**: 2026-04-01

<!-- LLM AGENT - MANDATORY PRE-EXECUTION STEP
Do NOT read tasks and begin implementing. You MUST call the MCP tool first:

  proposal_action:start { "hash": "#b839e29b" }

This registers the proposal as in_progress and returns the worktree path.
All file edits and commits must happen inside that worktree - not in the main workspace.
Skipping this step bypasses worktree isolation and breaks the approve/merge workflow.
-->

---

## Summary

Gate PRDs contain placeholder text for Requirements and Proposals sections that become stale after gates start and proposals are generated. This proposal adds a reconciliation function that rewrites those sections with live DB data, hooked into startGate and proposal generation flows. Also embeds a template_hash in YAML frontmatter for staleness detection via zeno doctor.

---

## Context

### Why This Change

Gate PRD files are rendered once from template during `zeno init` or `gates replan` and never updated afterward. After `gates start` generates requirements and `proposal_action:generate` creates proposals, the gate PRD still shows placeholder text like "Requirements will be generated when gate is started" -- misleading any agent or human reading the file directly.

### Dependencies

*No dependencies.*

---

## Open Questions

N/A

---

## Tasks

### Task 1: Create gate-prd-reconciler module

**Phase**: GREEN
**File(s)**: `src/core/gate-prd-reconciler.ts`
**Action**: create

Create a new module that reads a gate PRD file from disk, identifies auto-managed sections (Requirements table and Proposals section), queries live data from the SQLite DB via `getDatabase()`, and rewrites those sections with actual requirement rows and proposal rows. Preserves all user-edited content outside auto-managed sections. Uses `findGateByGateId` from `utils/artifact-locator.ts` to locate the gate file. Embeds `template_hash` in YAML frontmatter. Exports `reconcileGatePRD(gateId: string, projectRoot: string): Promise<void>`.

**Acceptance**:

- [x] reconcileGatePRD replaces stale "Requirements will be generated when gate is started" placeholder with live requirement rows from DB
- [x] reconcileGatePRD replaces stale "Proposals will be generated when gate is started" placeholder with live proposal hash/title/status rows from DB
- [x] User-edited sections (Overview, Objectives, Context, Technical Decisions) are preserved byte-for-byte
- [x] Function handles missing gate file gracefully (logs warning, returns without error)
- [x] template_hash is written into YAML frontmatter based on SHA-256 of raw template content

---

### Task 2: Hook reconcileGatePRD into startGate

**Phase**: GREEN
**File(s)**: `src/core/completions.ts`
**Action**: modify

In `startGate()`, after the existing status sync block (where the status regex replace happens), add a best-effort call to `reconcileGatePRD`. Wrap in try/catch with `logger.warn` on failure so it never blocks gate start. Import from `./gate-prd-reconciler.js`.

**Acceptance**:

- [x] reconcileGatePRD is called after status sync in startGate
- [x] Failure in reconciliation does not prevent gate from starting
- [x] Warning is logged if reconciliation fails

---

### Task 3: Hook reconcileGatePRD into proposal generation

**Phase**: GREEN
**File(s)**: `src/integration/workflow-registry.ts`
**Action**: modify

After the `generateProposals` handler completes successfully for a gate-tied proposal, call `reconcileGatePRD` to update the Proposals table in the gate PRD with freshly created proposal information. Best-effort pattern: catch + `logger.warn`. The handler lives in `registerWorkflowOps` in `workflow-registry.ts`, not `gates-registry.ts`.

**Acceptance**:

- [x] After proposal generation for a gate, the gate PRD Proposals section reflects the new proposal hashes and titles
- [x] Failure in reconciliation does not prevent proposal generation from succeeding

---

### Task 4: Embed template_hash in rendered gate PRDs

**Phase**: GREEN
**File(s)**: `src/generation/gate-template.ts`
**Action**: modify

In `renderGateTemplate` (or `renderGatePRDTemplate`), compute the SHA-256 hash of the raw template content before placeholder substitution and embed it in the YAML frontmatter as `template_hash`. Use `createHash` from `node:crypto`.

**Acceptance**:

- [x] Rendered gate PRDs include template_hash field in YAML frontmatter
- [x] template_hash is computed from raw template content before any substitution
- [x] Hash is stable: same template always produces same hash

---

### Task 5: Add template drift check to zeno doctor

**Phase**: GREEN
**File(s)**: `src/cli/commands/doctor/checks/template-drift.ts`, `src/cli/commands/doctor/runner.ts`
**Action**: create / modify

Create `src/cli/commands/doctor/checks/template-drift.ts` following the existing check pattern (same as `node-version.ts`, `sqlite-binding.ts` etc.). The check iterates all gate PRD files in `zeno/gates/`, reads the `template_hash` from YAML frontmatter, computes the current template hash from the shipped `gate-prd-template.md`, and reports mismatches as a `warn` status. Skip files without `template_hash` (legacy PRDs). Register the new check in `runner.ts` via `checkTemplateDrift()` in the `runAllChecks` function.

**Acceptance**:

- [x] zeno doctor reports "Template drift detected" warning for gate PRDs with mismatched template_hash
- [x] Gate PRDs without template_hash are skipped without error
- [x] Check loads the template once and compares against all gate PRDs

---

### Task 6: Unit tests for gate-prd-reconciler

**Phase**: GREEN
**File(s)**: `tests/core/gate-prd-reconciler.test.ts`
**Action**: create

Unit tests covering `reconcileGatePRD`: (1) stale Requirements section replaced with real data, (2) stale Proposals section replaced with real data, (3) user-edited sections preserved, (4) template_hash embedded correctly, (5) missing gate file handled gracefully without throwing, (6) gate with no requirements/proposals still writes valid (empty) tables.

**Acceptance**:

- [x] Tests cover happy path: stale sections replaced with live data
- [x] Tests cover edge case: missing gate file logs warning
- [x] Tests cover edge case: gate with zero requirements and proposals
- [x] Tests cover preservation of user-edited sections
- [x] Coverage meets 90% threshold for src/core/gate-prd-reconciler.ts

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/core/gate-prd-reconciler.ts` | create | New module: reconcileGatePRD reads gate PRD, rewrites auto-managed sections from DB |
| `src/core/completions.ts` | modify | Hook reconcileGatePRD after status sync in startGate |
| `src/integration/workflow-registry.ts` | modify | Hook reconcileGatePRD after generateProposals handler |
| `src/generation/gate-template.ts` | modify | Compute and embed template_hash in YAML frontmatter |
| `src/cli/commands/doctor/checks/template-drift.ts` | create | New doctor check: template drift detection |
| `src/cli/commands/doctor/runner.ts` | modify | Register template-drift check |
| `tests/core/gate-prd-reconciler.test.ts` | create | Unit tests for reconcileGatePRD |

---

## Implementation Notes

Use heading-marker approach for section identification: locate `### Project Requirements` / `### Proposal Status` headings and replace content up to the next `###` or `---` boundary. This avoids brittle regex on table content. The auto-managed sections should be wrapped with `<!-- ZENO:AUTO:START:requirements -->` / `<!-- ZENO:AUTO:END:requirements -->` comment markers (and equivalent for proposals) to make boundaries explicit for future reconciliation passes.

---

## Rollback

**If rejected or failed**: Revert the new `src/core/gate-prd-reconciler.ts` file and remove the two call sites in `completions.ts` and `gates-registry.ts`. The template_hash addition to `gate-template.ts` and doctor check are inert without the reconciler -- can be reverted independently.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-04-01
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-04-01 | Initial version | AI-generated |
