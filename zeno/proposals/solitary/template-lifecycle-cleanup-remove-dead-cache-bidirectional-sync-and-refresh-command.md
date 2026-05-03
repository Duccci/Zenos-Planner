---
zeno:
  hash: 'bbc864cd'
  gate_id: null
  requirement_id: null
  status: validated
  roles: 'feature'
  parallel_set_index: null
  created_at: '2026-04-01'
---

# Proposal: Template Lifecycle Cleanup: Remove Dead Cache, Bidirectional Sync, and Refresh Command

**Hash**: #bbc864cd
**Gate**: Solitary
**Status**: validated
**Roles**: feature
**Created**: 2026-04-01

<!-- LLM AGENT - MANDATORY PRE-EXECUTION STEP
Do NOT read tasks and begin implementing. You MUST call the MCP tool first:

  proposal_action:start { "hash": "#bbc864cd" }

This registers the proposal as in_progress and returns the worktree path.
All file edits and commits must happen inside that worktree - not in the main workspace.
Skipping this step bypasses worktree isolation and breaks the approve/merge workflow.
-->

---

## Summary

The template system has four structural issues: (1) copyTemplateToLocal is dead code with no consumers in the core pipeline, (2) proposal DB status and YAML frontmatter can diverge with no bidirectional sync, (3) there is no command to refresh stale rendered artifacts from updated templates, and (4) proposal-template.md contains double-encoded UTF-8 characters (mojibake) that corrupt generated proposal scaffolds. This proposal removes the dead cache, adds YAML frontmatter sync on status transitions, introduces a `zeno refresh` command that re-renders auto-managed sections of gate PRDs and AGENTS.md from current templates, and fixes the garbled characters in the proposal template.

---

## Context

### Why This Change

Three structural issues degrade the template system's reliability: `copyTemplateToLocal` stages templates to `.local/zeno-templates/` but nothing reads from that path, wasting I/O and creating a stale shadow copy; proposal status transitions only update the DB, leaving YAML frontmatter out of sync for any tool reading files directly; and after a Zeno package upgrade, there is no way to propagate template improvements into previously rendered artifacts. Additionally, `proposal-template.md` contains double-encoded UTF-8 characters (mojibake sequences like `â€"` for em dash, `â†'` for arrow) introduced when the file was edited with a Windows-1252–interpreting tool, which causes all newly generated proposal scaffolds to contain garbled text.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #b839e29b | requires | Gate PRD Reconciliation provides reconcileGatePRD used by the refresh command |

---

## Open Questions

N/A

---

## Tasks

### Task 1: Remove dead copyTemplateToLocal code

**Phase**: GREEN
**File(s)**: `src/generation/template-discovery.ts`
**Action**: modify

Remove the `copyTemplateToLocal` export from `src/generation/template-discovery.ts`. Remove the import and call in `src/generation/artifact-discovery-service.ts` (the `getArtifact('template', id)` handler that calls `copyTemplateToLocal`). The getArtifact template case should return content from `loadTemplateContent` directly without staging to `.local/`. Update `tests/generation/template-discovery.test.ts` to remove any `copyTemplateToLocal` test cases.

**Acceptance**:

- [x] copyTemplateToLocal export removed from template-discovery.ts
- [x] artifact-discovery-service no longer imports or calls copyTemplateToLocal
- [x] getArtifact('template', id) still returns template content correctly via loadTemplateContent
- [x] All existing template-discovery tests pass
- [x] No references to copyTemplateToLocal remain in src/

---

### Task 2: Bidirectional proposal status sync to YAML frontmatter

**Phase**: GREEN
**File(s)**: `src/integration/proposals-registry.ts`
**Action**: modify

After each proposal status transition (proposal_start sets in_progress, proposal_approve/proposal_complete sets completed, proposal_reject sets rejected, proposal_cancel sets cancelled, proposal_defer sets backlog), locate the proposal markdown file via `findProposalByHash` from `utils/artifact-locator.ts` and update the `status` field in the YAML frontmatter. Use a regex replace on the frontmatter status line. Best-effort: wrap in try/catch with `logger.warn` so DB transitions are never blocked by file I/O failures.

**Acceptance**:

- [x] After proposal_start, the proposal .md file YAML frontmatter shows status: in_progress
- [x] After proposal_approve, the file shows status: completed
- [x] After proposal_reject, the file shows status: rejected
- [x] After proposal_cancel, the file shows status: cancelled
- [x] After proposal_defer, the file shows status: backlog
- [x] If file is missing or write fails, DB transition still succeeds with a warning log

---

### Task 3: Tests for proposal status sync

**Phase**: GREEN
**File(s)**: `tests/integration/proposal-frontmatter-sync.test.ts`
**Action**: create

Add test cases verifying: (1) after a proposal status transition, the YAML frontmatter in the .md file reflects the new status, (2) if the file is missing, the DB transition still succeeds, (3) a subsequent `syncProposalsFromDisk` does not revert the DB status after frontmatter was updated.

**Acceptance**:

- [x] Test confirms DB status is authoritative when file and DB disagree
- [x] Test confirms frontmatter sync does not create feedback loops with syncProposalsFromDisk

---

### Task 4: Add zeno refresh CLI command

**Phase**: GREEN
**File(s)**: `src/cli/commands/refresh.ts`
**Action**: create

New CLI command that iterates all gate PRD files in `zeno/gates/`, reads the `template_hash` from YAML frontmatter, compares against the current template hash, and for stale files re-renders auto-managed sections using `reconcileGatePRD` from `src/core/gate-prd-reconciler.ts`. Also re-renders AGENTS.md using the ZENO:START/ZENO:END marker mechanism from `agents-writer.ts`. Provides `--dry-run` flag to preview changes without writing. Register the command in `src/cli/commands/index.ts`.

**Acceptance**:

- [x] zeno refresh updates stale gate PRDs with current template content + live DB data
- [x] zeno refresh updates AGENTS.md Zeno block from current template
- [x] zeno refresh --dry-run lists files that would change without modifying them
- [x] Command is registered and appears in zeno --help output

---

### Task 5: Unit tests for refresh command

**Phase**: GREEN
**File(s)**: `tests/cli/refresh.test.ts`
**Action**: create

Unit tests covering: (1) stale gate PRD is refreshed when template_hash mismatches, (2) up-to-date gate PRD is skipped, (3) AGENTS.md Zeno block is updated from template, (4) --dry-run mode reports changes without writing, (5) missing gate files are skipped gracefully.

**Acceptance**:

- [x] Tests cover stale PRD detection and refresh
- [x] Tests cover dry-run mode
- [x] Tests cover AGENTS.md refresh via markers
- [x] Coverage meets 90% threshold for src/cli/commands/refresh.ts

---

### Task 6: Fix garbled UTF-8 characters in proposal-template.md

**Phase**: GREEN
**File(s)**: `templates/md-templates/proposal-template.md`
**Action**: modify

The proposal template contains double-encoded UTF-8 characters (mojibake) — sequences like `â€"` where em dashes (—) should be, `â†'` where arrows (→) should be, and similar for curly quotes. These result from UTF-8 bytes being misread as Latin-1/Windows-1252 and then re-encoded. Fix by replacing all mojibake sequences with their correct UTF-8 equivalents or ASCII fallbacks (e.g., `--` for em dash, `->` for arrow). Also add a UTF-8 encoding guard to `src/generation/proposal-template.ts` in `loadProposalTemplate()` that validates the loaded string contains no replacement characters (`\uFFFD`) and logs a warning if non-ASCII characters appear in unexpected positions.

**Acceptance**:

- [x] proposal-template.md contains no mojibake sequences (no `â€"`, `â†'`, `â€œ`, `~~` strikethrough workarounds for garbled chars)
- [x] Newly generated proposal scaffolds contain correct characters (or ASCII equivalents) in the Single-Phase Requirement section
- [x] loadProposalTemplate() logs a warning if the template contains the Unicode replacement character (U+FFFD)
- [x] All existing template-rendering tests pass after the fix

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/template-discovery.ts` | modify | Remove copyTemplateToLocal dead code |
| `src/generation/artifact-discovery-service.ts` | modify | Remove copyTemplateToLocal import/call, use loadTemplateContent directly |
| `src/integration/proposals-registry.ts` | modify | Add YAML frontmatter status sync after each status transition |
| `src/cli/commands/refresh.ts` | create | New zeno refresh command |
| `src/cli/commands/index.ts` | modify | Register refresh command |
| `templates/md-templates/proposal-template.md` | modify | Fix mojibake: replace double-encoded UTF-8 sequences with correct characters |
| `src/generation/proposal-template.ts` | modify | Add encoding guard in loadProposalTemplate |
| `tests/generation/template-discovery.test.ts` | modify | Remove copyTemplateToLocal test cases |
| `tests/integration/proposal-frontmatter-sync.test.ts` | create | Tests for YAML frontmatter sync |
| `tests/cli/refresh.test.ts` | create | Tests for zeno refresh command |

---

## Implementation Notes

For YAML frontmatter status sync, use a simple regex: `/^(\s*status:\s*).+$/m` to find and replace the status line within the `---` frontmatter block. Parse only the frontmatter (first `---` to second `---`), do not touch body content.

For the refresh command, leverage `reconcileGatePRD` from Proposal 1 for gate PRDs. For AGENTS.md, use the existing `ZENO:START`/`ZENO:END` block replacement pattern from `agents-writer.ts`.

For the template encoding fix, the mojibake pattern is: UTF-8 bytes for a multi-byte code point were decoded as Windows-1252 and then re-encoded as UTF-8. The canonical mapping is: `â€"` → `—`, `â€"` → `—` (en dash depending on context), `â†'` → `→`, `â€œ` → `"`, `â€` → `"`, `â€˜` → `'`, `â€™` → `'`. An alternative is to replace all with safe ASCII equivalents (`--`, `->`, `"`, `"`) since the template is developer-facing prose.

---

## Rollback

**If rejected or failed**: Restoring `copyTemplateToLocal` is a git revert. The frontmatter sync additions are additive and inert if removed. The `zeno refresh` command can be unregistered from `src/cli/index.ts` and its file deleted.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-04-01
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-04-01 | Initial version | AI-generated |
