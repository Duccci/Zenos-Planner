---
zeno:
  hash: 'cbf3a130'
  gate_id: null
  requirement_id: null   # replace with requirement hash or remove
  status: validated
  roles: ''
  parallel_set_index: null
  created_at: '2026-04-25'
  template_hash: '{{PROPOSAL_TEMPLATE_HASH}}'
---

# Proposal: Multi-Project Workspace Support for MCP Tools

**Hash**: #cbf3a130
**Gate**: Solitary - [Gate Name]
**Requirement**: #[Requirement Hash] (optional - may address gate-level objective)
**Status**: validated
**Roles**:
**Created**: 2026-04-25

---

## Summary

Enable Zeno's MCP tools (gates_action, reg_action, proposal_action, etc.) to target any of multiple Zeno projects coexisting under one workspace root, instead of being bound to a single negotiated root. Adds an optional `project` parameter on every tool, a project resolver that maps names/paths to absolute roots, a per-project config cache so concurrent calls do not clobber each other's `zenoDir`, and a discovery tool that lists detected projects. Existing single-project usage remains unchanged when `project` is omitted.

---

## Single-Phase Requirement

[Optional: Meta-constraint guidance for contributors — omit this section from submitted proposals.]

**All proposals must deliver a complete, testable unit of work in a SINGLE implementation phase.**

**NOT Allowed** -- Forced sequentiality indicating multi-phased work:

"Phase 1: [task], Phase 2: [task]" or "Stage 1/2/3"

"First implement X, then Y, then Z" (sequential steps that form required phases)

"Implementation deferred to a future phase/gate/proposal"

"Later, we will also implement [feature]"

Tasks that logically require strict ordering as distinct phases

**Correct Approach** -- Parallelizable work designed for one sitting:

Multiple independent tasks that can run in parallel (many tasks OK if independent)

Create separate proposals for work with inherent sequentiality (e.g., foundation -> integration)

Use `Dependencies: requires` to establish ordering without forced phases

Each proposal independently completes and tests in one implementation session

Dependencies ensure sequencing without multi-phasing

**If You See Multi-Phase Patterns:**

1. Split into separate proposals (one per logical phase/gate)

2. Update Dependencies to sequence them (e.g., "Proposal B requires Proposal A")

3. Each proposal stands alone and can be reviewed/tested independently

---

## Context

### Why This Change

[1-2 sentences explaining the problem or need this addresses. Reference the gate objective or requirement.]

### Dependencies

List only valid hash references. It is acceptable to have no dependencies if this proposal is self-contained or first in a gate.

**Hash Usage Rules**:

Proposal hashes (#xxxxx) should only appear in: the proposal's own header, the associated gate's proposal table, and dependency tables

Do not reference proposal hashes in body text, task descriptions, or other sections

Use descriptive names instead of hashes for readability in all other contexts

**Performance**: This restriction prevents excessive file searches and context window bloat when LLMs need to find proposal references

| Hash | Type | Description |
|------|------|-------------|
| #[hash] | requires | [What this proposal depends on] |
| #[hash] | blocks | [What this unblocks when complete] |

**Rules**:

Omit rows for dependency types that do not apply

Never use placeholder values like "None" or "N/A" as hash references

If no dependencies exist, replace the entire Dependencies section (header through table) with: `*No dependencies.*`

The Description column must be self-contained -- the apply agent reads only this table, not the dependency files

---

## Open Questions

[Optional: Capture questions that need resolution before or during implementation. Mark each item `[x]` once the question is answered. The validator requires every listed question to be resolved (`[x]`) before approval — or set this section to `N/A` if there are no open questions. Remove this section entirely if it is not needed.]

- [ ] [Question text — replace once resolved or remove this placeholder]

---

## Tasks

Atomic, LLM-executable tasks. Each task should be completable in a single implementation session.

**File Scoping Rules**:

Every `File(s)` entry MUST be an explicit file path (e.g., `src/core/archive-logic.ts`)

NEVER use directory globs or wildcards (e.g., ~~`src/mcp/tools/*.ts`~~)

NEVER use directory-only references (e.g., ~~`src/mcp/tools/`~~)

If a refactoring touches many files, list each one explicitly -- this is the cost signal that justifies splitting the proposal

Each task should touch 1-3 files maximum; if more are needed, split into additional tasks

**Test Scoping Rules**:

**Gate-tied proposals**: Omit test tasks. A dedicated test proposal will be created as the final proposal in the gate to meet quality thresholds.

**Solitary proposals**: MUST include test tasks inline. Solitary proposals are self-contained and have no gate-level test proposal.

### Task 1: Create `src/mcp/project-resolver.ts` exporting `resolveProjectPath(input?: string, workspaceRoot?: string): string`. Reuse `findZenoProjects()` from `src/mcp/resources/index.ts` to map a project name (e.g. `Pterosaur-Core`) or absolute path to an absolute Zeno project root. Reject ambiguous names. Return active workspace root when input is omitted.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

Create `src/mcp/project-resolver.ts` exporting `resolveProjectPath(input?: string, workspaceRoot?: string): string`. Reuse `findZenoProjects()` from `src/mcp/resources/index.ts` to map a project name (e.g. `Pterosaur-Core`) or absolute path to an absolute Zeno project root. Reject ambiguous names. Return active workspace root when input is omitted.

**Acceptance**:

- [ ] Implementation complete

---

### Task 2: Convert the single global `zenoDir` cache in `src/utils/config.ts` into a `Map<absolutePath, zenoDir>` keyed by project root. Update `loadConfig()`, `getZenoDir()`, `getZenoGitDir()`, and `isZenoProject()` so concurrent multi-project tool calls do not clobber each other's layout cache.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

Convert the single global `zenoDir` cache in `src/utils/config.ts` into a `Map<absolutePath, zenoDir>` keyed by project root. Update `loadConfig()`, `getZenoDir()`, `getZenoGitDir()`, and `isZenoProject()` so concurrent multi-project tool calls do not clobber each other's layout cache.

**Acceptance**:

- [ ] Implementation complete

---

### Task 3: Add an optional `project: string` field to shared MCP input schemas in `src/mcp/schemas/*` (gates, reg, proposal, context, diagram, worktree, artifact, repos, git-trace). Field accepts a project name relative to the workspace root or an absolute path.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

Add an optional `project: string` field to shared MCP input schemas in `src/mcp/schemas/*` (gates, reg, proposal, context, diagram, worktree, artifact, repos, git-trace). Field accepts a project name relative to the workspace root or an absolute path.

**Acceptance**:

- [ ] Implementation complete

---

### Task 4: In every handler under `src/mcp/tools/*`, call `resolveProjectPath(input.project)` and pass the result to `getDatabase()`, `loadConfig()`, and helpers that currently default to `process.cwd()` or the active workspace root. Cover gates, reg, proposal, context, diagram, worktree (`worktree-tools.ts:133`), artifact, config, project, repos, git-trace.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

In every handler under `src/mcp/tools/*`, call `resolveProjectPath(input.project)` and pass the result to `getDatabase()`, `loadConfig()`, and helpers that currently default to `process.cwd()` or the active workspace root. Cover gates, reg, proposal, context, diagram, worktree (`worktree-tools.ts:133`), artifact, config, project, repos, git-trace.

**Acceptance**:

- [ ] Implementation complete

---

### Task 5: In `src/integration/function-implementations.ts` and `workflow-registry.ts`, replace `process.cwd()` calls (e.g. `reconcileGatePRD(..., process.cwd())`) with the resolved `projectPath` threaded from the validated tool input.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

In `src/integration/function-implementations.ts` and `workflow-registry.ts`, replace `process.cwd()` calls (e.g. `reconcileGatePRD(..., process.cwd())`) with the resolved `projectPath` threaded from the validated tool input.

**Acceptance**:

- [ ] Implementation complete

---

### Task 6: Add a `workspace_action` MCP tool (or extend `config_get`) returning detected Zeno projects in the current workspace as `{ name, absolutePath, hasZenoDir }[]` so LLM clients can discover valid `project` values without filesystem snooping.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

Add a `workspace_action` MCP tool (or extend `config_get`) returning detected Zeno projects in the current workspace as `{ name, absolutePath, hasZenoDir }[]` so LLM clients can discover valid `project` values without filesystem snooping.

**Acceptance**:

- [ ] Implementation complete

---

### Task 7: Add tests under `tests/mcp/` for: (a) `resolveProjectPath` with name/path inputs and ambiguity errors, (b) per-project config cache isolation, (c) two parallel `gates_action list` calls against different projects returning different gate sets, (d) backward compatibility - omitting `project` still works in a single-project workspace.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

Add tests under `tests/mcp/` for: (a) `resolveProjectPath` with name/path inputs and ambiguity errors, (b) per-project config cache isolation, (c) two parallel `gates_action list` calls against different projects returning different gate sets, (d) backward compatibility - omitting `project` still works in a single-project workspace.

**Acceptance**:

- [ ] Implementation complete

---

### Task 8: Boot the MCP server against a temp workspace containing two sibling Zeno projects. Call `gates_action`, `reg_action`, and `proposal_action` against each via `project: <name>` and assert responses come from the correct `registry.db`.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

Boot the MCP server against a temp workspace containing two sibling Zeno projects. Call `gates_action`, `reg_action`, and `proposal_action` against each via `project: <name>` and assert responses come from the correct `registry.db`.

**Acceptance**:

- [ ] Implementation complete

---

### Task 9: Update `AGENTS.md` and `docs/MCP-TOOLS.md` with a `Multi-Project Workspaces` section: optional `project` parameter, name resolution rules, the discovery tool, and a migration note that existing single-project usage is unchanged.

**Phase**: GREEN
**File(s)**: `src/[module]/[file].ts`
**Action**: modify

Update `AGENTS.md` and `docs/MCP-TOOLS.md` with a `Multi-Project Workspaces` section: optional `project` parameter, name resolution rules, the discovery tool, and a migration note that existing single-project usage is unchanged.

**Acceptance**:

- [ ] Implementation complete

---

## Files Affected

**Rules**:

Every entry MUST be a fully-qualified file path -- no directories, no globs, no wildcards

This table is the authoritative scope boundary; the scope validator rejects modifications to unlisted files

Each file path must match exactly one file in the repository

| File | Action | Description |
|------|--------|-------------|
| `src/[path]/[file].ts` | create/modify | [Brief change description] |
| `tests/[path]/[file].test.ts` | create/modify | [Test description -- include for solitary proposals only; gate-tied proposals defer tests] |

---

## Implementation Notes

[Optional: Technical approach, edge cases to handle, patterns to use. Keep brief - this is guidance, not specification. Omit if straightforward.]

---

## Rollback

**If rejected or failed**: [Brief description of how to revert changes, or "No rollback needed - isolated change"]

---

**Document Version**: [MAJOR.MINOR.PATCH]
**Last Updated**: [YYYY-MM-DD]
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: [git.user.name]
**Reviewers**: [git.user.name]

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | [YYYY-MM-DD] | Initial version | [git.user.name] |
