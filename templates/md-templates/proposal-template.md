---
zeno:
  hash: '{{HASH}}'
  gate_id: '{{GATE_ID}}'
  requirement_id: null   # replace with requirement hash or remove
  status: pending
  roles: '{{ROLES}}'
  parallel_set_index: null
  created_at: '{{DATE}}'
---

# Proposal: [Proposal Title]

**Hash**: #{{HASH}}
**Gate**: {{GATE_ID}} - [Gate Name]
**Requirement**: #[Requirement Hash] (optional - may address gate-level objective)
**Status**: pending
**Roles**: {{ROLES}}
**Created**: {{DATE}}

---

## Summary

<!-- LLM Instructions — write a concise outcome-focused summary paragraph here focused on results and deliverables -->

[2-3 sentence description of what this proposal accomplishes. Focus on the outcome, not the process.]

---

## Single-Phase Requirement

[Optional: Meta-constraint guidance for contributors — omit this section from submitted proposals.]

**All proposals must deliver a complete, testable unit of work in a SINGLE implementation phase.**

**NOT Allowed** â€” Forced sequentiality indicating multi-phased work:

"Phase 1: [task], Phase 2: [task]" or "Stage 1/2/3"

"First implement X, then Y, then Z" (sequential steps that form required phases)

"Implementation deferred to a future phase/gate/proposal"

"Later, we will also implement [feature]"

Tasks that logically require strict ordering as distinct phases

**Correct Approach** â€” Parallelizable work designed for one sitting:

Multiple independent tasks that can run in parallel (many tasks OK if independent)

Create separate proposals for work with inherent sequentiality (e.g., foundation â†’ integration)

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

The Description column must be self-contained â€” the apply agent reads only this table, not the dependency files

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

If a refactoring touches many files, list each one explicitly â€” this is the cost signal that justifies splitting the proposal

Each task should touch 1-3 files maximum; if more are needed, split into additional tasks

**Test Scoping Rules**:

**Gate-tied proposals**: Omit test tasks. A dedicated test proposal will be created as the final proposal in the gate to meet quality thresholds.

**Solitary proposals**: MUST include test tasks inline. Solitary proposals are self-contained and have no gate-level test proposal.

### Task 1: [Task Title]

**File(s)**: `[path/to/file.ts]`
**Action**: create | modify | delete | refactor

[2-4 line description of what to implement. Name specific functions, interfaces, or patterns to follow. Do NOT embed code snippets â€” the apply agent reads the actual source files.]

**Acceptance**:

[ ] [Specific, verifiable condition]

[ ] [Another verifiable condition]

---

### Task 2: [Task Title]

**File(s)**: `[path/to/file.ts]`
**Action**: create | modify | delete | refactor

[2-4 line description. No code snippets â€” name types and functions, the apply agent reads actual source.]

**Acceptance**:

[ ] [Condition]

[ ] [Condition]

---

### Task 3: [Task Title] (Solitary proposals only)

**File(s)**: `[path/to/file.test.ts]`
**Action**: create | modify

[Test task - required for solitary proposals. Gate-tied proposals defer testing to a dedicated test proposal.]

**Acceptance**:

- [ ] Tests cover happy path

- [ ] Tests cover error cases

- [ ] Coverage meets 90% threshold for touched files

---

## Files Affected

**Rules**:

Every entry MUST be a fully-qualified file path â€” no directories, no globs, no wildcards

This table is the authoritative scope boundary; the scope validator rejects modifications to unlisted files

Each file path must match exactly one file in the repository

| File | Action | Description |
|------|--------|-------------|
| `src/[path]/[file].ts` | create/modify | [Brief change description] |
| `tests/[path]/[file].test.ts` | create/modify | [Test description â€” include for solitary proposals only; gate-tied proposals defer tests] |

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
