# Solitary Proposal: Guardrail CI Drift Check

**Type**: Solitary (CI / Developer Infrastructure)  
**Hash**: `s26022203ci-drift`  
**Status**: pending  
**Created**: 2026-02-22  

## Summary

Add a CI check that automatically detects drift between skill guardrails and MCP validators. The check extracts guardrail statements from all skill files, searches validators for corresponding enforcement, and fails the build when a behaviour-constraining guardrail has no matching validator — with an allow-list for intentionally narrative-only guardrails.

## Context

After `s26022201mcp-sot` completes, MCP validators and refactored skills are aligned. Without an automated check, future edits can re-introduce drift: a contributor adds a guardrail to a skill but forgets to add the corresponding validator (or vice versa). This proposal makes that class of regression impossible to merge undetected.

This proposal requires:
- **Tasks 3 and 4 of `s26022201mcp-sot`**: Validators must exist in code before the check has anything to match against; skills must be refactored so only relevant guardrails remain.

## Objectives

- Prevent guardrail/validator drift from being merged
- Make the allow-list the single place to document narrative-only guardrails
- Produce a human-readable coverage report in CI output

## Tasks

### Task 1: Author Guardrail Allow-list
**Description**: Enumerate all current guardrails that are intentionally narrative-only (no validator equivalent is needed or possible) and record them in a new allow-list file.

**Acceptance Criteria**:
- [ ] `scripts/guardrail-allowlist.txt` created with one regex pattern per line
- [ ] File header comment defines the allow-list criteria:
  - **Narrative-only** = describes agent *intent* or process steps, not a system-enforced constraint  
    Examples: "read the gate PRD before starting", "mark each step as in-progress"
  - **Must have validator** = constrains concrete system behaviour: file scope, git operations, state transitions, test modification limits
- [ ] Each allow-listed pattern has a one-line comment explaining why it is narrative-only

**Files Affected**:
- `scripts/guardrail-allowlist.txt` (create)

---

### Task 2: Write Guardrail Coverage Script
**Description**: Implement `scripts/validate-guardrail-coverage.ts` that extracts guardrails from all skill files, matches them against validator source, and reports coverage.

**Acceptance Criteria**:
- [ ] Script locates all `**Guardrails**` sections in `.claude/skills/**/*.md`
- [ ] For each bullet under a Guardrails section, the script classifies it as:
  - `matched` — found a corresponding string in `src/mcp/validators/**/*.ts` (error message, function name, or comment)
  - `allowlisted` — matches a pattern in `scripts/guardrail-allowlist.txt`
  - `unmatched` — neither; will fail CI
- [ ] Outputs a Markdown table: `| Guardrail | File | Status | Matched In |`
- [ ] Exits non-zero if any `unmatched` guardrails exist
- [ ] Coverage percentage reported: `(matched + allowlisted) / total × 100`

**Files Affected**:
- `scripts/validate-guardrail-coverage.ts` (create)
- `scripts/guardrail-allowlist.txt` (written in Task 1; read here)

---

### Task 3: Integrate with CI
**Description**: Wire the script into the vitest/CI pipeline so it runs on every PR.

**Acceptance Criteria**:
- [ ] Test in `tests/scripts/validate-guardrail-coverage.test.ts` that:
  - Verifies an unmatched guardrail triggers non-zero exit
  - Verifies an allow-listed guardrail does not fail
  - Verifies a matched guardrail passes
- [ ] `vitest.config.ts` includes the script as a CI check (or equivalent npm script added to CI workflow)
- [ ] CI output on failure lists only the unmatched guardrails with file and line, not the full table

**Files Affected**:
- `tests/scripts/validate-guardrail-coverage.test.ts` (create)
- `vitest.config.ts` (add CI check)

---

## Task Execution Order

1. **Task 1** (Allow-list) — no prerequisites.
2. **Task 2** (Script) — requires allow-list file from Task 1.
3. **Task 3** (CI integration) — requires the script from Task 2.

## Quality Metrics

- **Type Safety**: Script is TypeScript; no untyped shell globs
- **Test Coverage**: ≥3 test cases covering matched / allowlisted / unmatched paths
- **CI**: PR fails with actionable output when unmatched guardrails exist

## Dependencies

**Upstream**:
- `s26022201mcp-sot` Tasks 3 and 4 must be complete:
  - Task 3: validators in `src/mcp/validators/` enforcing behaviour-constraining guardrails
  - Task 4: skills refactored so guardrail set is stable before the check is locked in

**Downstream**: None
