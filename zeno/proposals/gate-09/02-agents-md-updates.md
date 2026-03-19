# Proposal: AGENTS.md Updates

**Hash**: #7e4b2f8ca15d3096
**Gate**: gate-09
**Status**: pending
**Roles**: feature
**Created**: 2026-03-18

---

## Summary

Updates root `AGENTS.md` and `zeno/AGENTS.md` to reflect the actual MVP implementation after gates 01-08. Corrects the command reference table, gate count references, file location table, and workflow descriptions. Also verifies `zeno/TERMINOLOGY.md` is current. Depends on proposal 01 completing the README/CLI audit first so corrections are consistent across all documentation.

---

## Implementation Notes

**Docs / Chore** — No code changes. Documentation accuracy pass only.

---

## Context

### Why This Change

The root `AGENTS.md` command table was written at project init (gate 01) and carries stale data: gate sequence references say "of 13" while the actual roadmap has fewer gates; some commands added in gates 07-08 may be absent; the workflow section predates the approval hardenings from gate 08; the file location table may reference paths that have moved. `zeno/AGENTS.md` similarly needs a review against actual workflows now that the MVP is complete.

### Dependencies

| Hash                   | Type     | Description                                                          |
| ---------------------- | -------- | -------------------------------------------------------------------- |
| #f3c9a1d4b8e70291     | requires | README & CLI audit must complete first to establish canonical command list |

---

## Tasks

### Task 1 — Update root AGENTS.md command reference table

**File(s)**: AGENTS.md

The **Complete Command Reference** table in root `AGENTS.md` is the authoritative list of commands for AI agents. Using the corrected CLI list produced by proposal 01:

- [x] Add any commands missing from the table (worktree, rescope, registry, db, doctor, metrics — to the extent they are confirmed implemented by proposal 01)
- [x] Remove or annotate any commands that are not implemented
- [x] Fix the gate sequence total: the description field in the registry shows "of 13" but the actual gate roadmap has ended at 9-10 gates; search for "of 13" or "13 gates" in AGENTS.md and correct to match the actual gate count returned by `zeno gates list`
- [x] Verify the `/delegate <model>` entry — if this is an LLM-only shorthand and not a real CLI command, annotate accordingly

### Task 2 — Update root AGENTS.md workflow section

**File(s)**: AGENTS.md

- [x] Review the **Typical Workflow → Planning Phase** section: verify the agent-manifest.json/pipeline-agents references are accurate for this repo's actual `agents/` structure
- [x] Review the **Typical Workflow → Execution Phase** section: confirm the `zeno-apply` slash command description is accurate or remove if not implemented
- [x] Check that the **Proposal Approval Workflow** steps match the actual validation and approval flow from gate 08 (shell validation runner, audit trail, command names)
- [x] Verify the **Quality Gates (Non-Configurable in MVP)** thresholds match `zeno/.zeno/config.json` defaults

### Task 3 — Update root AGENTS.md file locations table

**File(s)**: AGENTS.md

- [x] Verify every path in the **File Locations Quick Reference** table exists in the repository; correct any paths that have moved
- [x] Check `zeno/.zeno/registry.db` — confirm the **MCP only** warning is still accurate and the note about schema changes is current
- [x] Verify the **Cross-File Navigation** table links at the top: `zeno/PROJECT_PRD.md` should exist; `zeno/architecture/*.md` should list the actual generated files

### Task 4 — Update zeno/AGENTS.md

**File(s)**: zeno/AGENTS.md

- [x] Read and review the full file; bring any command lists, workflow steps, or gate references up to date with the MVP implementation
- [x] Confirm MCP tool dispatch instructions reference the correct tool names (`gates_action`, `reg_action`, `proposal_action`, `context_action`, `config_get`, `diagram_action`) — these are the tool names registered by the server
- [x] Remove any references to planned-but-unimplemented features surfaced during the review

### Task 5 — Review zeno/TERMINOLOGY.md

**File(s)**: zeno/TERMINOLOGY.md

- [x] Scan for terms that were renamed or removed during implementation
- [x] Add entries for key terms introduced in gates 07-08 if absent (e.g., shell validation runner, audit trail, worktree, approval workflow)
- [x] Ensure all term definitions match the usage in `zeno/AGENTS.md` and root `AGENTS.md`

---

## Files Affected

| File | Change Type |
| ---- | ----------- |
| `AGENTS.md` | Updated (command table, workflow, file locations) |
| `zeno/AGENTS.md` | Updated (command lists, MCP tool names, workflow steps) |
| `zeno/TERMINOLOGY.md` | Updated (term definitions, missing MVP terms) |

---

## Rollback

| Step | Action |
| ---- | ------ |
| 1 | Run `git revert <commit>` targeting the merge commit for this proposal |
| 2 | No production code changes — rollback carries zero risk of functionality regression |
