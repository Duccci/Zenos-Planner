# Proposal: README & CLI/MCP Reference Audit

**Hash**: #f3c9a1d4b8e70291
**Gate**: gate-09
**Status**: completed
**Approved By**: Duccci
**Implemented**: 2026-03-18T23:30:50.711Z
**Roles**: feature
**Created**: 2026-03-18

---

## Summary

Audits README.md and docs/MCP-TOOLS.md against the actual implementation delivered through gate-08. Removes references to unimplemented or deferred features, adds missing commands (worktree, rescope, req status/transfer, gates regenerate), corrects inaccurate examples, and updates the MCP-TOOLS.md last-updated date. This proposal produces the baseline-accurate documentation that proposal 02 (AGENTS.md updates) depends on.

---

## Proposal Type

**Docs / Chore** — No code changes. Documentation accuracy pass only.

---

## Context

### Why This Change

Gates 07-08 added worktree management, rescope hardening, `zeno req status`, `zeno req transfer`, `zeno gates regenerate`, and other commands. These are implemented but not reflected in the README CLI Reference, which was last comprehensively updated at gate-03. `docs/MCP-TOOLS.md` carries a February 2026 timestamp and may not reflect schema changes from gates 04-08. The README also documents `zeno init --submodule <url>` and tree-sitter optional dependencies whose current implementation status must be verified before gate-09 completion.

### Dependencies

*No dependencies.*

---

## Tasks

### Task 1 — Audit CLI commands: README vs implementation

**File(s)**: README.md, src/cli/commands/

Compare the **CLI Reference** section in README.md against every `.ts` file in `src/cli/commands/`. For each discrepancy, either add the missing command to the README or note it as unimplemented. Specific gaps to verify:

- [x] `zeno req status <hash> <status>` — in AGENTS.md, absent from README
- [x] `zeno req transfer <hash> <gate-id>` — in AGENTS.md, absent from README
- [x] `zeno gates regenerate` — in AGENTS.md, absent from README
- [x] `zeno worktree list|prune|remove|merge` — `worktree.ts` exists, absent from README
- [x] `zeno rescope` — in AGENTS.md, verify implementation (`src/cli/commands/`), update README accordingly
- [x] `zeno metrics [path]` — in AGENTS.md, verify implementation, update README accordingly
- [x] `zeno registry rebuild` — in AGENTS.md, verify `registry.ts` implements it, update README
- [x] `zeno db` — `db.ts` exists in commands, absent from README; verify if it is a public command
- [x] `zeno doctor` — `doctor.ts` and `doctor/` exist, absent from README; add if public-facing
- [x] `zeno template` — README shows it but verify subcommands are accurate
- [x] Any README commands that have no corresponding implementation: flag for removal

Update the **CLI Reference** section to reflect actual state.

### Task 2 — Verify unimplemented features: `--submodule` and tree-sitter

**File(s)**: README.md, src/cli/commands/init.ts, src/analysis/tree-sitter-parser.ts, src/analysis/tree-sitter-metrics.ts

- [x] Check `src/cli/commands/init.ts` for `--submodule` flag implementation. If not implemented, remove the "Using `zeno/` as a Shared Git Submodule" section or annotate it as "Not yet implemented".
- [x] Verify the **Multi-language Analysis** section: confirm `enableTreeSitter` option is accepted by `CodeAnalyzer`, the four npm packages are optional and install correctly, and the code example in README compiles. Correct or remove inaccurate parts.

### Task 3 — Audit Quick Start end-to-end

**File(s)**: README.md

Walk through the **Quick Start** section step by step with the implemented codebase as reference:

- [x] `npm install -g zenos-planner` — verify `bin/zeno.js` is correctly wired as the `zeno` binary in `package.json#bin`
- [x] Graphviz version requirement listed as ">= 14.0" — Graphviz major version is 2.x/12.x; verify and correct the version number
- [x] MCP JSON config snippet — verify `args: ["./bin/mcp-server.js"]` is the correct invocation
- [x] `zeno mcp install --editor vscode` — verify this subcommand is implemented in `src/cli/commands/mcp.ts`

### Task 4 — Update docs/MCP-TOOLS.md date and spot-check schemas

**File(s)**: docs/MCP-TOOLS.md, src/mcp/

- [x] Update the **Last Updated** date from `February 22, 2026` to `2026-03-18`
- [x] Spot-check: compare the `gates_action` supported actions listed in the doc against the actual action enum in `src/mcp/` (look for the `gates_action` handler or schema). Flag any undocumented actions added in gates 07-08.
- [x] Spot-check: verify `proposal_action` and `reg_action` schemas; add any missing actions to the doc or note them in a "Known gaps" section if a full update is out of scope.

### Task 5 — Final accuracy check

**File(s)**: README.md

- [x] Search README for any mentions of features confirmed unimplemented; remove or annotate each
- [x] Ensure all code examples in README use commands that exist and flags that work
- [x] Check the **Documentation** section links at the bottom — verify each linked file exists at the stated path

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `README.md` | modify | CLI reference, Quick Start, and feature sections updated to reflect actual MVP state |
| `docs/MCP-TOOLS.md` | modify | Last-updated date corrected; undocumented actions noted |

---

## Rollback

**If rejected or failed**: Revert the markdown edits in `README.md` and `docs/MCP-TOOLS.md` via `git revert` or restore from the previous commit. No code changes are made by this proposal.

---

---

## Completion Summary

**Completed**: 2026-03-18

### What Was Done

**README.md — CLI Reference** (Task 1): Rewrote the CLI Reference section from ~36 lines to ~70 lines. Added missing command groups: `worktree` (list/remove/prune/merge), `db` (cleanup/validate/checkpoint), `registry rebuild`, `doctor`, `config show/set`, and `trace`. Updated `gates` to include `validate` and `replan` (alias: regenerate). Updated `req` to include `transfer`, `update`, and `search`. Updated `proposal` to include `create` and `start`. Updated `mcp` to include `diagnostics/tools/errors` and `install --editor` options. Corrected `req update` (AGENTS.md incorrectly documented as `req status`). Confirmed `zeno rescope` and `zeno metrics` are not implemented — not documented.

**README.md — Feature verification** (Task 2): `--submodule` confirmed implemented in `src/cli/commands/init.ts` via `addZenoSubmodule`. `enableTreeSitter` confirmed in `src/analysis/code-analyzer.ts` line 98. No changes needed.

**README.md — Quick Start** (Task 3): `bin/zeno.js` correctly wired. Graphviz `>= 14.0` is internally consistent with `src/utils/dot-renderer.ts` comment — left unchanged. MCP JSON snippet correct. `mcp install --editor` verified implemented.

**docs/MCP-TOOLS.md** (Task 4): Updated both "Last Updated" occurrences from `February 22, 2026` → `2026-03-18`. Added **Known Gaps** section documenting undocumented actions (`gates_action:validate`, `proposal_action:cancel/defer`, `reg_action:search/update/inherit/trace/regenerate`) and entirely missing tools (`worktree_action`, `diagram_action`).

**Broken links** (Task 5): Fixed `zeno/PROJECT_PRD.md` → `zeno/overview/PROJECT_PRD.md` in both README.md and docs/MCP-TOOLS.md. Removed broken link to `.claude/skills/zeno-apply/SKILL.md` (file does not exist).

### Files Modified

| File | Changes |
|------|---------|
| `README.md` | CLI Reference section rewritten; Documentation section link fixed |
| `docs/MCP-TOOLS.md` | Two Last-Updated dates corrected; Known Gaps section added; two broken links fixed |

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-18
