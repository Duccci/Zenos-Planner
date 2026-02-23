# Proposal: Consolidate Workflow Logic - MCP Source of Truth

**Hash**: #ec8e08cf71deae76  
**Gate**: solitary - Solitary Proposal  
**Requirement**: #[Requirement Hash] (optional - may address gate-level objective)  
**Status**: pending | in_progress | completed | rejected  
**Created**: 2026-02-22T23:35:38.988Z

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

### Target Coverage

- **Coverage Threshold**: [Inherited from config, e.g., 90%]
- **Lines to Cover**: [Estimated count of lines in affected modules]
- **Target Coverage**: (lines Ã— threshold) Ã· 100 = [number] lines must be tested

---

## Single-Phase Requirement

**All proposals must deliver a complete, testable unit of work in a SINGLE implementation phase.**

**NOT Allowed** â€” Forced sequentiality indicating multi-phased work:

- "Phase 1: [task], Phase 2: [task]" or "Stage 1/2/3"
- "First implement X, then Y, then Z" (sequential steps that form required phases)
- "Implementation deferred to a future phase/gate/proposal"
- "Later, we will also implement [feature]"
- Tasks that logically require strict ordering as distinct phases

**Correct Approach** â€” Parallelizable work designed for one sitting:

- Multiple independent tasks that can run in parallel (many tasks OK if independent)
- Create separate proposals for work with inherent sequentiality (e.g., foundation â†’ integration)
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
- The Description column must be self-contained â€” the apply agent reads only this table, not the dependency files

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
- If a refactoring touches many files, list each one explicitly â€” this is the cost signal that justifies splitting the proposal
- Each task should touch 1-3 files maximum; if more are needed, split into additional tasks

**Test Scoping Rules**:

- **Gate-tied proposals**: RED phase creates test proposals as early proposals in the gate; GREEN phase implementation proposals omit new test files; final proposal refines coverage
- **Solitary proposals**: MUST include test tasks inline. Solitary proposals are self-contained and combine RED and GREEN.

### Task 1: [Task Title]

**Phase**: RED | GREEN | Test Refinement  
**File(s)**: `[path/to/file.ts]` | `[path/to/file.test.ts]`  
**Action**: create | modify | delete | refactor

[2-4 line description of what to implement. For RED: test cases, fixtures, mocks. For GREEN: implementation following RED tests. Name specific functions, interfaces, or patterns to follow. Do NOT embed code snippets â€” the apply agent reads the actual source files.]

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

[2-4 line description. For RED: test cases and fixtures. For GREEN: implementation. No code snippets â€” name types and functions, the apply agent reads actual source.]

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

- Every entry MUST be a fully-qualified file path â€” no directories, no globs, no wildcards
- This table is the authoritative scope boundary; the scope validator rejects modifications to unlisted files
- Each file path must match exactly one file in the repository
- RED phase entries: test files only
- GREEN phase entries: implementation files (no new test files)
- Test Refinement entries: refinement and validation of test files only

| File                          | Phase             | Action        | Description                                                                                                            |
| ----------------------------- | ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tests/[path]/[file].test.ts` | RED               | create/modify | [Test file â€” RED phase defines acceptance tests]                                                                       |
| `src/[path]/[file].ts`        | GREEN             | create/modify | [Implementation file â€” GREEN phase implements to pass RED tests]                                                       |
| `tests/[path]/[file].test.ts` | Test Refinement   | modify        | [Test refinement â€” final proposal validates coverage and edge cases]                                                   |

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

## Completion Summary

See full implementation details in `zeno/proposals/solitary/2026-02-22-01-mcp-source-of-truth.md`.

**Tasks Completed**: 4/4

**Files Modified/Created**:
- `src/mcp/tools/entity-action-handler.ts` — `createStateTransitionValidator` helper
- `src/mcp/tools/gate-tools.ts` — `GATE_TRANSITIONS`, state validators, idempotent handlers
- `src/mcp/tools/proposal-tools.ts` — `PROPOSAL_TRANSITIONS`, state validators, idempotent handlers
- `tests/mcp/tools/state-transitions.test.ts` — 15 new passing tests
- `zeno/architecture/mcp-workflows.md` — Mermaid state machines + error contract
- `.claude/skills/zeno-apply/SKILL.md` — MCP handler references
- `.claude/skills/zeno-proposal/SKILL.md` — `proposal_action: generate` reference
- `.claude/skills/zeno-gate/SKILL.md` — Status Values Reference with MCP handler refs
- `.claude/skills/zeno-archive/SKILL.md` — `createStateTransitionValidator` reference

### Quality Metrics

- Build: clean (0 TypeScript errors)
- New tests: 15/15 passing
- Coverage: 94% (threshold: 90%)
- Security: 0 vulnerabilities
- State transitions enforced at MCP handler level for all 5 actions
