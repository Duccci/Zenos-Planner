# Proposal: Context Budget Diagnostics: Phase-Aware Context Health Command with Remediation Advice

**Hash**: #7db476e9
**Gate**: Solitary
**Status**: validated
**Created**: 2026-03-18

<!-- LLM AGENT — MANDATORY PRE-EXECUTION STEP
Do NOT read tasks and begin implementing. You MUST call the MCP tool first:

  proposal_action:start { "hash": "#7db476e9" }

This registers the proposal as in_progress and returns the worktree path.
All file edits and commits must happen inside that worktree — not in the main workspace.
Skipping this step bypasses worktree isolation and breaks the approve/merge workflow.
-->

---

## Summary

Implements a `zeno context-health` command that measures per-workflow-phase context exposure, identifies which artifact loads during gate generation vs. proposal execution create over-budget risk, and warns when individual files or phase totals approach LLM context limits. When thresholds are exceeded, the command emits actionable remediation advice — recommending proposal splits, gate decomposition, or PRD sectioning — so developers can address bloat before it degrades generation quality. Also adds `.svg`/`.dot` exclusion from any file-system reads and a completed-gate PRD trimming rule to prevent cumulative artifact growth from silently degrading agent generation quality (R-11) or single-gate call quality (R-05).

---

## Proposal Type

**RED** | **GREEN** | **Test Refinement**

- **RED**: Test-first phase defining acceptance criteria. Focuses on coverage target (from `config.qualityThresholds.codeCoverage`). No implementation code.
- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.
- **Test Refinement**: Final proposal refining coverage gaps and validating all tests pass.

---

## Context

### Why This Change

Analysis date: 2026-03-02. Measured totals at current project state:

- PROJECT_PRD.md: 67,980 chars (single largest file; loaded on every planning/gen call)
- STRUCTURE.md: 21,439 chars
- All gate PRDs (15 files): 234,878 chars total; avg ~15,659; max 31,121 (gate-13)
- All proposals (12 files): 92,831 chars total
- Architecture docs (excl SVG/dot): 69,719 chars
- ro-matrix-heatmap.svg: 25,838 chars of XML noise — no semantic value in text context

Context window model: 128K tokens ≈ 512,000 chars at ~4 chars/token.

Workflow phase loads (what is actually read per LLM call):

- Proposal execution: 1 proposal file (3,536–15,430 chars; 0.7–3.0%) — LOW RISK
- Gate proposal generation: gate PRD + AGENTS.md (7,185–34,182 chars; 1.4–6.7%) — LOW RISK
- Gate generation / planning: PRD + STRUCTURE + AGENTS×2 (~94,794 chars; ~18.5%) — MODERATE, growing
- Gate gen + gate PRD: above + one gate PRD (~110,453 chars; ~21.6%) — MODERATE
- R-11 worst case (agent ignores lazy-load): all PRDs + proposals + arch + key docs (~473,262 chars; ~92.4%) — CRITICAL

The diagnostic must be phase-aware, not just a flat total. An agent breaking lazy-load rules during proposal execution is the primary failure mode to detect and surface.

### Dependencies

List only valid hash references. It is acceptable to have no dependencies if this proposal is self-contained or first in a gate.

**Hash Usage Rules**:

- Proposal hashes (#xxxxx) should only appear in: the proposal's own header, the associated gate's proposal table, and dependency tables
- Do not reference proposal hashes in body text, task descriptions, or other sections
- Use descriptive names instead of hashes for readability in all other contexts
- **Performance**: This restriction prevents excessive file searches and context window bloat when LLMs need to find proposal references

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
- Every File(s) entry MUST be an explicit file path (e.g., src/core/archive-logic.ts)
- NEVER use directory globs or wildcards (e.g., src/mcp/tools/*.ts)
- NEVER use directory-only references (e.g., src/mcp/tools/)
- If a refactoring touches many files, list each one explicitly — this is the cost signal that justifies splitting the proposal
- Each task should touch 1-3 files maximum; if more are needed, split into additional tasks

Test Scoping Rules:
- Gate-tied proposals: RED phase creates test proposals as early proposals in the gate; GREEN phase implementation proposals omit new test files; final proposal refines coverage
- Solitary proposals: MUST include test tasks inline. Solitary proposals are self-contained and combine RED and GREEN.
-->

### Task 1: Write failing tests for context-health service and CLI command

**Phase**: RED
**File(s)**: `tests/core/context-health.test.ts`, `tests/cli/commands/context-health.test.ts`
**Action**: create

Write failing tests for context-health service and CLI command

**Acceptance**:

- [ ] Tests verify phase-aware measurement: proposal-execution, gate-proposal-gen, gate-generation, and worst-case phases each produce correct char totals
- [ ] Tests verify threshold classification: OK / WARN (>200K) / ERROR (>350K) / CRITICAL (>450K) are returned correctly
- [ ] Tests verify SVG and .dot files are excluded from all phase measurements
- [ ] Tests verify per-file warnings fire when PROJECT_PRD.md exceeds 80,000 chars
- [ ] Tests verify CLI output format includes phase name, char count, token estimate, threshold status, and top offenders list
- [ ] Tests verify that WARN/ERROR/CRITICAL results include at least one remediation recommendation string (e.g., 'Split large proposals', 'Decompose gate into smaller gates')
- [ ] All tests fail before implementation

---

### Task 2: Implement ContextHealthService — phase-aware artifact scanner

**Phase**: GREEN
**File(s)**: `src/core/context-health.ts`
**Action**: create

Implement ContextHealthService — phase-aware artifact scanner

**Acceptance**:

- [ ] Defines ContextPhase enum: PROPOSAL_EXECUTION, GATE_PROPOSAL_GEN, GATE_GENERATION, WORST_CASE
- [ ] measurePhase(phase, projectRoot) returns { phase, totalChars, tokenEstimate, threshold, offenders[] }
- [ ] PROPOSAL_EXECUTION measures: single largest proposal in gate dir (worst single call)
- [ ] GATE_PROPOSAL_GEN measures: target gate PRD + zeno/AGENTS.md
- [ ] GATE_GENERATION measures: PROJECT_PRD + STRUCTURE.md + both AGENTS.md files
- [ ] WORST_CASE measures: all gate PRDs + all proposals + all arch docs (excl .svg, .dot) + key docs
- [ ] measureAll() returns results for all four phases plus per-file warnings
- [ ] Excludes **/*.svg and **/*.dot from all reads via configurable extension blocklist
- [ ] Reports per-file warning when any single markdown file exceeds 30,000 chars
- [ ] Reports per-file warning when PROJECT_PRD.md exceeds 80,000 chars
- [ ] For any phase at WARN or above, returns a `recommendations: string[]` array with context-specific remediation advice:
  - PROPOSAL_EXECUTION over budget: 'Split the largest proposal into smaller, focused proposals (current largest: {name}, {chars} chars)'
  - GATE_PROPOSAL_GEN over budget: 'Decompose the gate PRD — extract completed sections into archive summaries' and 'Reduce gate scope by splitting into two sequential gates'
  - GATE_GENERATION over budget: 'Trim PROJECT_PRD.md — move completed gate narratives to archive stubs' and 'Split cross-cutting concerns into a separate planning document loaded on demand'
  - WORST_CASE over budget: 'Run `zeno gates complete` on finished gates to trigger PRD trimming' and 'Archive old proposals — completed proposal files should be stubs, not full plans'

---

### Task 3: Implement `zeno context-health` CLI command

**Phase**: GREEN
**File(s)**: `src/cli/commands/context-health.ts`, `src/cli/index.ts`
**Action**: create, modify

Implement `zeno context-health` CLI command

**Acceptance**:

- [ ] Registered as `zeno context-health` subcommand
- [ ] Accepts optional `--phase <phase>` flag to measure a single phase; defaults to all phases
- [ ] Accepts `--warn-threshold`, `--error-threshold`, `--critical-threshold` overrides (defaults: 200K/350K/450K)
- [ ] Outputs a phase table: phase | chars | ~tokens | status (OK/WARN/ERROR/CRITICAL)
- [ ] For any non-OK phase, prints the top-5 largest files contributing to that phase (name + chars)
- [ ] Exits with code 1 if any phase is ERROR or CRITICAL, code 0 otherwise (enables CI gating)
- [ ] Prints a summary line: 'X of 4 phases within budget' or 'WARNING: context rot detected in <phase-names>'
- [ ] For each non-OK phase, prints remediation recommendations from ContextHealthService below the offenders list
- [ ] Recommendations are prefixed with a right-arrow indicator (`→`) for visual distinction (e.g., `→ Split the largest proposal into smaller, focused proposals`)
- [ ] When any phase is ERROR or CRITICAL, prints a prominent boxed recommendation: 'ACTION REQUIRED: Break up the largest artifacts before the next gate generation to avoid degraded output quality'

---

### Task 4: Add completed-gate PRD trimming rule to gate-writer and archive tooling

**Phase**: GREEN
**File(s)**: `src/core/gate-writer.ts`, `src/core/archive-logic.ts`
**Action**: modify

Add completed-gate PRD trimming rule to gate-writer and archive tooling

**Acceptance**:

- [ ] When a gate transitions to completed status, gate-writer appends a `## Archive Summary` section with: completion date, proposal count, total char size at completion
- [ ] archive-logic adds a 'trim-completed-gate' step that replaces the full task checklist body in completed gate PRDs with a one-line summary per proposal (title + status + hash ref)
- [ ] Trimming is non-destructive: full content is preserved in the git history; only the working-tree file is compacted
- [ ] The trimmed gate PRD shrinks to a predictable stub of < 2,000 chars (header + objectives + archive summary + proposal refs)
- [ ] Trimming is skipped if the gate PRD is already under 3,000 chars
- [ ] Existing tests for gate-writer and archive-logic continue to pass

---

### Task 5: Register context-health with CLI index and add to `proposal_action:validate` and `gates_action:validate`

**Phase**: GREEN
**File(s)**: `src/mcp/tools/proposal-tools.ts`, `src/mcp/tools/gate-tools.ts`
**Action**: modify

Register context-health with CLI index and integrate as a check in `proposal_action:validate` and `gates_action:validate`

**Acceptance**:

- [ ] `context-health` command is importable and registered in the CLI command map
- [ ] `proposal_action:validate` calls measurePhase(GATE_GENERATION) and appends a `context-budget` section to the validation report (status, totalChars, tokenEstimate, threshold); does not block validation on WARN but does surface ERROR/CRITICAL as a validation warning
- [ ] `gates_action:validate` (and `zeno gates validate <id>`) calls measurePhase(GATE_GENERATION) and appends a `context-budget` check to the gate validation report; WARN is non-blocking with a printed recommendation; ERROR or CRITICAL is a blocking failure that prints all remediation recommendations before exit
- [ ] All existing CLI tests continue to pass

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
| `tests/core/context-health.test.ts` | RED | create | Unit tests for ContextHealthService |
| `tests/cli/commands/context-health.test.ts` | RED | create | Tests for context-health CLI command output and exit codes |
| `src/core/context-health.ts` | GREEN | create | ContextHealthService, ContextPhase enum, getRemediation function |
| `src/cli/commands/context-health.ts` | GREEN | create | `zeno context-health` subcommand handler |
| `src/cli/index.ts` | GREEN | modify | Register context-health in CLI command map |
| `src/core/gate-writer.ts` | GREEN | modify | Append Archive Summary section on gate completion |
| `src/core/archive-logic.ts` | GREEN | modify | Add trim-completed-gate step |
| `src/mcp/tools/proposal-tools.ts` | GREEN | modify | Add context-budget check to proposal_action:validate |
| `src/mcp/tools/gate-tools.ts` | GREEN | modify | Add context-budget check to gates_action:validate |

---

## Implementation Notes

**Remediation engine**: Recommendations are generated by a pure function `getRemediation(phase, threshold, offenders)` inside `context-health.ts`. Each phase maps to a static set of recommendation templates; the function fills in file names and sizes from the offenders list. This keeps the logic testable without filesystem access.

**Splitting heuristics**: The recommendations intentionally stop at *advising* a split — they do not automate it. Automating proposal or gate decomposition requires human judgment on scope boundaries. The goal is to surface the problem early and name the fix, not to execute it.

---

## Rollback

**If rejected or failed**: All changes are additive (new source files + small targeted modifications to existing files). Revert via `git revert` on the merge commit. No destructive operations performed; no database schema changes.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-18
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: Duccci
**Reviewers**: Duccci

### Change Log

| Version | Date         | Summary         | Author          |
| ------- | ------------ | --------------- | --------------- |
| 1.0.0   | 2026-03-18   | Initial version | Duccci          |
