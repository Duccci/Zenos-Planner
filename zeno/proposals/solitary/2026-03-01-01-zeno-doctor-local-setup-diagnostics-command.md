# Proposal: zeno doctor: Local Setup Diagnostics Command

**Hash**: #71586e28  
**Gate**: Solitary  
**Status**: pending  
**Created**: 2026-03-01

---

## Summary

Implements a `zeno doctor` CLI command that audits the local environment for all prerequisites required by Zeno's Planner — Graphviz, Node.js version, Git version, better-sqlite3 native binding availability, and LLM tool-calling reachability — and reports a structured, actionable results table with per-platform remediation instructions. Directly mitigates R-02 (Graphviz silent failure), R-03 (better-sqlite3 native compilation), and R-10 (single-developer setup friction) as identified in the R&O Matrix.

---

## Context

### Why This Change

Sourced from three open risks in the R&O Matrix (ro-matrix.md):

- R-02 (L:4 I:3 Score:12) — Graphviz must be installed as a native binary; Windows users may not have it; silent failure hurts first impressions. Mitigation: add `zeno doctor` that verifies system deps and provides install instructions per platform.
- R-03 (L:3 I:4 Score:12) — better-sqlite3 native binding compilation failures are common after Node.js version changes or on ARM/Windows. Mitigation: `zeno doctor` detects and reports binding failures with actionable remediation.
- R-10 (L:4 I:3 Score:12) — High setup cost before any value is delivered (Graphviz + Node >= 24 + Git >= 2 + better-sqlite3 + LLM). Mitigation: `zeno doctor` checker as part of zero-config quickstart experience.
The command should be a read-only, side-effect-free diagnostic that a user can run before `zeno init` or after any setup problem.

### Dependencies

*No dependencies.*

---

## Tasks

### Task 1: Write failing tests for the doctor check functions

**File(s)**: `tests/cli/doctor.test.ts`
**Action**: create

**Acceptance**:

- [ ] Tests cover each check: node version, git version, graphviz binary, better-sqlite3 binding, and overall pass/fail summary
- [ ] Tests mock child_process and fs so they are hermetic and platform-independent
- [ ] Tests assert check result shape: { id, label, status: 'ok'|'warn'|'fail', detail, fix }

---

### Task 2: Implement doctor check modules

**File(s)**: `src/cli/commands/doctor/types.ts`, `src/cli/commands/doctor/checks/node-version.ts`, `src/cli/commands/doctor/checks/git-version.ts`, `src/cli/commands/doctor/checks/graphviz.ts`, `src/cli/commands/doctor/checks/sqlite-binding.ts`, `src/cli/commands/doctor/runner.ts`
**Action**: create

Implement doctor check modules in src/cli/commands/doctor/

**Acceptance**:

- [ ] node-version check passes when Node.js >= 24.0.0, warns on >= 20 < 24, fails below 20
- [ ] git-version check passes when Git >= 2.0.0, fails when not found
- [ ] graphviz check passes when `dot -V` exits 0, fails with platform-specific install hint (brew/apt/choco/winget)
- [ ] sqlite-binding check attempts `require('better-sqlite3')` in a try/catch and reports compile error with `npm rebuild better-sqlite3` fix hint
- [ ] runner.ts aggregates all check results and returns { passed, warned, failed, checks[] }
- [ ] All checks exported as DoctorCheck instances conforming to types.ts interface

---

### Task 3: Wire doctor command into the CLI and implement formatted output

**File(s)**: `src/cli/commands/doctor.ts`, `src/cli/index.ts`
**Action**: create, modify

**Acceptance**:

- [ ] `zeno doctor` is registered as a CLI subcommand in src/cli/index.ts
- [ ] Output renders a table with columns: Check | Status | Detail | Fix
- [ ] Status column uses colored symbols: green check (ok), yellow warning (warn), red cross (fail)
- [ ] Exit code is 0 when all checks pass or warn; non-zero (1) when any check fails
- [ ] --json flag outputs raw JSON of the check results array for scripting/CI use
- [ ] Command documented in help text with description referencing R-02/R-03/R-10 setup requirements

---

### Task 4: Integration smoke test

**File(s)**: `tests/cli/doctor-integration.test.ts`
**Action**: create

Integration smoke test and CI matrix validation

**Acceptance**:

- [ ] Integration test runs `zeno doctor --json` as a child process and parses output
- [ ] Test asserts that node_version and git_version checks return 'ok' in the CI environment
- [ ] Test asserts exit code 0 when all checks pass
- [ ] Test asserts --json flag produces valid parseable JSON with expected schema

---

## Files Affected

| File | Action | Description |
| ---- | ------ | ----------- |
| `src/cli/commands/doctor/types.ts` | create | DoctorCheck interface and result types |
| `src/cli/commands/doctor/checks/node-version.ts` | create | Node.js version check (pass >=24, warn >=20, fail <20) |
| `src/cli/commands/doctor/checks/git-version.ts` | create | Git version check (pass >=2.0, fail if not found) |
| `src/cli/commands/doctor/checks/graphviz.ts` | create | Graphviz dot binary check with per-platform install hints |
| `src/cli/commands/doctor/checks/sqlite-binding.ts` | create | better-sqlite3 native binding check with rebuild hint |
| `src/cli/commands/doctor/runner.ts` | create | Aggregates all checks, returns { passed, warned, failed, checks[] } |
| `src/cli/commands/doctor.ts` | create | CLI command handler with table output and --json flag |
| `src/cli/index.ts` | modify | Register `zeno doctor` subcommand |
| `tests/cli/doctor.test.ts` | create | Unit tests for all check modules and runner |
| `tests/cli/doctor-integration.test.ts` | create | Integration smoke test running `zeno doctor --json` as child process |

---

## Implementation Notes

All check functions should spawn child processes with a timeout (default 3s) to avoid hanging on slow systems. Use `spawnSync` from Node.js `child_process` with `{ encoding: 'utf8', timeout: 3000 }`. The sqlite-binding check should use a dynamic `require` wrapped in try/catch rather than spawning a process. Colored output requires the `chalk` package already present in the project dependencies.

---

## Open Questions

N/A

---

## Rollback

**If rejected or failed**: No rollback needed — all changes are new files (`src/cli/commands/doctor/`) and a new CLI subcommand registration. Delete the new files and revert the `src/cli/index.ts` registration line.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-01
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: Duccci
**Reviewers**: Duccci

### Change Log

| Version | Date       | Summary         | Author |
| ------- | ---------- | --------------- | ------ |
| 1.0.0   | 2026-03-01 | Initial version | Duccci |
