# Proposal: zeno doctor: Local Setup Diagnostics Command

**Hash**: #71586e28  
**Gate**: Solitary  
**Status**: pending  
**Created**: 2026-03-01

---

## Summary

Implements a `zeno doctor` CLI command that audits the local environment for all prerequisites required by Zeno's Planner — Graphviz, Node.js version, Git version, better-sqlite3 native binding availability, and LLM tool-calling reachability — and reports a structured, actionable results table with per-platform remediation instructions. Directly mitigates R-02 (Graphviz silent failure), R-03 (better-sqlite3 native compilation), and R-10 (single-developer setup friction) as identified in the R&O Matrix.

---

## Proposal Type

**RED** | **GREEN** | **Test Refinement**

- **RED**: Test-first phase defining acceptance criteria. Focuses on coverage target (from `config.qualityThresholds.codeCoverage`). No implementation code.
- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.
- **Test Refinement**: Final proposal refining coverage gaps and validating all tests pass.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: [Inherited from config, e.g., 90%]
- **Lines to Cover**: [Estimated count of lines in affected modules]
- **Target Coverage**: (lines × threshold) ÷ 100 = [number] lines must be tested

---

## Single-Phase Requirement

**All proposals must deliver a complete, testable unit of work in a SINGLE implementation phase.**

**NOT Allowed** — Forced sequentiality indicating multi-phased work:

- "Phase 1: [task], Phase 2: [task]" or "Stage 1/2/3"
- "First implement X, then Y, then Z" (sequential steps that form required phases)
- "Implementation deferred to a future phase/gate/proposal"
- "Later, we will also implement [feature]"
- Tasks that logically require strict ordering as distinct phases

**Correct Approach** — Parallelizable work designed for one sitting:

- Multiple independent tasks that can run in parallel (many tasks OK if independent)
- Create separate proposals for work with inherent sequentiality (e.g., foundation → integration)
- Use `Dependencies: requires` to establish ordering without forced phases
- Each proposal independently completes and tests in one implementation session
- Dependencies ensure sequencing without multi-phasing

**If You See Multi-Phase Patterns:**

1. Split into separate proposals (one per logical phase/gate)
2. Update Dependencies to sequence them (e.g., "Proposal B requires Proposal A")
3. Each proposal stands alone and can be reviewed/tested independently

---

## Context

### Why This Change

Sourced from three open risks in the R&O Matrix (ro-matrix.md):
- R-02 (L:4 I:3 Score:12) — Graphviz must be installed as a native binary; Windows users may not have it; silent failure hurts first impressions. Mitigation: add `zeno doctor` that verifies system deps and provides install instructions per platform.
- R-03 (L:3 I:4 Score:12) — better-sqlite3 native binding compilation failures are common after Node.js version changes or on ARM/Windows. Mitigation: `zeno doctor` detects and reports binding failures with actionable remediation.
- R-10 (L:4 I:3 Score:12) — High setup cost before any value is delivered (Graphviz + Node >= 24 + Git >= 2 + better-sqlite3 + LLM). Mitigation: `zeno doctor` checker as part of zero-config quickstart experience.
The command should be a read-only, side-effect-free diagnostic that a user can run before `zeno init` or after any setup problem.

### Dependencies

List only valid hash references. It is acceptable to have no dependencies if this proposal is self-contained or first in a gate.

**Hash Usage Rules**:

- Proposal hashes (#xxxxx) should only appear in: the proposal's own header, the associated gate's proposal table, and dependency tables
- Do not reference proposal hashes in body text, task descriptions, or other sections
- Use descriptive names instead of hashes for readability in all other contexts
- **Performance**: This restriction prevents excessive file searches and context window bloat when LLMs need to find proposal references

| Hash    | Type     | Description                        |
| ------- | -------- | ---------------------------------- |
| #[hash] | requires | [What this proposal depends on]    |
| #[hash] | blocks   | [What this unblocks when complete] |

**Rules**:

- Omit rows for dependency types that do not apply
- Never use placeholder values like "None" or "N/A" as hash references
- If no dependencies exist, replace the entire Dependencies section (header through table) with: `*No dependencies.*`
- The Description column must be self-contained — the apply agent reads only this table, not the dependency files

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

**File Scoping Rules**:

- Every `File(s)` entry MUST be an explicit file path (e.g., `src/core/archive-logic.ts`)
- NEVER use directory globs or wildcards (e.g., ~~`src/mcp/tools/*.ts`~~)
- NEVER use directory-only references (e.g., ~~`src/mcp/tools/`~~)
- If a refactoring touches many files, list each one explicitly — this is the cost signal that justifies splitting the proposal
- Each task should touch 1-3 files maximum; if more are needed, split into additional tasks

**Test Scoping Rules**:

- **Gate-tied proposals**: RED phase creates test proposals as early proposals in the gate; GREEN phase implementation proposals omit new test files; final proposal refines coverage
- **Solitary proposals**: MUST include test tasks inline. Solitary proposals are self-contained and combine RED and GREEN.

### Task 1: Write failing tests for the doctor check functions

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Write failing tests for the doctor check functions

**Acceptance**:
- [ ] Tests cover each check: node version, git version, graphviz binary, better-sqlite3 binding, and overall pass/fail summary
- [ ] Tests mock child_process and fs so they are hermetic and platform-independent
- [ ] Tests assert check result shape: { id, label, status: 'ok'|'warn'|'fail', detail, fix }

---

### Task 2: Implement doctor check modules in src/cli/commands/doctor/

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

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

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Wire doctor command into the CLI and implement formatted output

**Acceptance**:
- [ ] `zeno doctor` is registered as a CLI subcommand in src/cli/index.ts
- [ ] Output renders a table with columns: Check | Status | Detail | Fix
- [ ] Status column uses colored symbols: green check (ok), yellow warning (warn), red cross (fail)
- [ ] Exit code is 0 when all checks pass or warn; non-zero (1) when any check fails
- [ ] --json flag outputs raw JSON of the check results array for scripting/CI use
- [ ] Command documented in help text with description referencing R-02/R-03/R-10 setup requirements

---

### Task 4: Integration smoke test and CI matrix validation

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Integration smoke test and CI matrix validation

**Acceptance**:
- [ ] Integration test runs `zeno doctor --json` as a child process and parses output
- [ ] Test asserts that node_version and git_version checks return 'ok' in the CI environment
- [ ] Test asserts exit code 0 when all checks pass
- [ ] Test asserts --json flag produces valid parseable JSON with expected schema

---

## Files Affected

**Rules**:

- Every entry MUST be a fully-qualified file path — no directories, no globs, no wildcards
- This table is the authoritative scope boundary; the scope validator rejects modifications to unlisted files
- Each file path must match exactly one file in the repository
- RED phase entries: test files only
- GREEN phase entries: implementation files (no new test files)
- Test Refinement entries: refinement and validation of test files only

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/cli/commands/doctor/types.ts` | - | modify | Implementation file |
| `src/cli/commands/doctor/checks/node-version.ts` | - | modify | Implementation file |
| `src/cli/commands/doctor/checks/git-version.ts` | - | modify | Implementation file |
| `src/cli/commands/doctor/checks/graphviz.ts` | - | modify | Implementation file |
| `src/cli/commands/doctor/checks/sqlite-binding.ts` | - | modify | Implementation file |
| `src/cli/commands/doctor/runner.ts` | - | modify | Implementation file |
| `src/cli/commands/doctor.ts` | - | modify | Implementation file |
| `src/cli/index.ts` | - | modify | Implementation file |
| `tests/cli/doctor.test.ts` | - | modify | Implementation file |
| `tests/cli/doctor-integration.test.ts` | - | modify | Implementation file |

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

| Version | Date         | Summary         | Author          |
| ------- | ------------ | --------------- | --------------- |
| 1.0.0   | [YYYY-MM-DD] | Initial version | [git.user.name] |
