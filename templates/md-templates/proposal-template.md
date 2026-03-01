# Proposal: {{OBJECTIVE}}

**Hash**: #{{HASH}}  
**Gate**: {{GATE_ID}}  
**Requirement**: #[Requirement Hash] (optional - may address gate-level objective)  
**Status**: pending  
**Created**: {{DATE}}

---

## Summary

[2-3 sentence description of what this proposal accomplishes. Focus on the outcome, not the process.]

---

## Proposal Type

**RED** | **GREEN** | **Test Refinement**

- **RED**: Test-first phase defining acceptance criteria. Focuses on coverage target (from `config.qualityThresholds.codeCoverage`). No implementation code.
- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.
- **Test Refinement**: Final proposal refining coverage gaps and validating all tests pass.

---

## Coverage & Estimates

> **RED phase only** — Omit this section for GREEN and Test Refinement proposals.

### Target Coverage

- **Coverage Threshold**: [Inherited from config, e.g., 90%]
- **Lines to Cover**: [Estimated count of lines in affected modules]
- **Target Coverage**: (lines × threshold) ÷ 100 = [number] lines must be tested

---

## Context

### Why This Change

[1-2 sentences explaining the problem or need this addresses. Reference the gate objective or requirement.]

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

### Task 1: [Task Title]

**Phase**: RED | GREEN | Test Refinement  
**File(s)**: `[path/to/file.ts]` | `[path/to/file.test.ts]`  
**Action**: create | modify | delete | refactor

[2-4 line description of what to implement. For RED: test cases, fixtures, mocks. For GREEN: implementation following RED tests. Name specific functions, interfaces, or patterns to follow. Do NOT embed code snippets — the apply agent reads the actual source files.]

**Acceptance**:
```

- [ ] [Specific, verifiable condition]
- [ ] [Another verifiable condition]
- [ ] For GREEN: All RED tests pass
- [ ] For GREEN: Guardrails verified (no new tests, coverage target met)

---

### Task 2: [Task Title]

**Phase**: RED | GREEN | Test Refinement  
**File(s)**: `[path/to/file.ts]` | `[path/to/file.test.ts]`  
**Action**: create | modify | delete | refactor

[2-4 line description. For RED: test cases and fixtures. For GREEN: implementation. No code snippets — name types and functions, the apply agent reads actual source.]

**Acceptance**:

- [ ] [Condition]
- [ ] [Condition]
- [ ] For GREEN: All RED tests pass
- [ ] For GREEN: Guardrails verified (no new tests)

---

### Task 3: [Task Title - Test Refinement for Gate's Final Proposal]

**Phase**: Test Refinement  
**File(s)**: `[path/to/file.test.ts]`  
**Action**: modify

Refine and validate test coverage for gate completion. Ensure all RED tests pass, coverage meets threshold, and no implementation gaps exist. Add edge case tests if coverage analysis reveals gaps.

**Acceptance**:

- [ ] All RED tests pass
- [ ] Coverage meets or exceeds target threshold (e.g., 90%)
- [ ] No uncovered code paths with business logic
- [ ] Edge cases covered (boundary conditions, error handling)
- [ ] Lint and type errors cleared for test files
- [ ] Documentation in test files explains test strategy

---

## Files Affected

**Rules**:

- Every entry MUST be a fully-qualified file path — no directories, no globs, no wildcards
- This table is the authoritative scope boundary; the scope validator rejects modifications to unlisted files
- Each file path must match exactly one file in the repository
- RED phase entries: test files only
- GREEN phase entries: implementation files (no new test files)
- Test Refinement entries: refinement and validation of test files only

| File                          | Phase             | Action        | Description                                                                                                            |
| ----------------------------- | ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tests/[path]/[file].test.ts` | RED               | create/modify | [Test file — RED phase defines acceptance tests]                                                                       |
| `src/[path]/[file].ts`        | GREEN             | create/modify | [Implementation file — GREEN phase implements to pass RED tests]                                                       |
| `tests/[path]/[file].test.ts` | Test Refinement   | modify        | [Test refinement — final proposal validates coverage and edge cases]                                                   |

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
