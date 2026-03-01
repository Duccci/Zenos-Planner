# Proposal: zeno onboarding: Interactive Guided First-Run Experience

**Hash**: #d379f29e  
**Gate**: Solitary  
**Status**: pending  
**Created**: 2026-03-01

---

## Summary

Implements a `zeno onboarding` CLI command that walks new users through an interactive, step-by-step guided tour of Zeno's core concepts — gates, requirements, proposals, and the MCP server. Designed as a teaching tool targeting bootcamp graduates and developers unfamiliar with agentic project management, the command doubles as an on-ramp that initialises a sample project and demonstrates the full Zeno workflow end-to-end.

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

Addresses O-08 (Teaching Tool Positioning). Zeno's iterative gate decomposition model is pedagogically valuable, but the current entry-point assumes deep familiarity with the tooling. A guided onboarding command lowers the barrier to entry, builds a loyal user base, and encourages community contributions from early adopters. The onboarding command requires no gate and is solitary — it ships as a standalone CLI improvement independent of the gate roadmap.

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

### Task 1: Define onboarding flow structure and step registry

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Define onboarding flow structure and step registry

**Acceptance**:
- [ ] OnboardingStep interface defined with id, title, description, run(), and optional skip() predicate
- [ ] Step registry exports an ordered array of all onboarding steps
- [ ] Unit tests cover step ordering and interface shape

---

### Task 2: Implement core onboarding steps: welcome, concept tour, sample project init, and first gate walkthrough

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Implement core onboarding steps: welcome, concept tour, sample project init, and first gate walkthrough

**Acceptance**:
- [ ] Welcome step prints Zeno tagline and high-level overview
- [ ] Concept tour step explains gates, requirements, and proposals with concrete one-line examples
- [ ] Sample-init step creates a temporary sandbox project in .local/onboarding-demo/ using zeno init with pre-filled answers
- [ ] First-gate step shows `zeno gates list`, `zeno gates start gate-01`, and simulates a proposal approval
- [ ] MCP intro step explains how to wire the MCP server into Claude Desktop / Cursor and prints the config snippet
- [ ] Next-steps step links to README, AGENTS.md, and the GitHub Discussions page
- [ ] Each step prints a clear section header and uses chalk for coloured output
- [ ] All steps are unit-testable with a mocked I/O interface

---

### Task 3: Wire `zeno onboarding` command into Commander.js CLI and add --skip-sandbox flag

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Wire `zeno onboarding` command into Commander.js CLI and add --skip-sandbox flag

**Acceptance**:
- [ ] `zeno onboarding` appears in `zeno --help` output
- [ ] --skip-sandbox flag bypasses step 3 (sample project init) for users who already have a project
- [ ] --step <id> flag allows jumping to a specific step for repeat learners
- [ ] Command is exported and registered in the main CLI entry-point

---

### Task 4: Add MCP tool: onboarding_start to expose guided onboarding to LLM agents

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Add MCP tool: onboarding_start to expose guided onboarding to LLM agents

**Acceptance**:
- [ ] MCP tool `onboarding_start` registered alongside existing tools
- [ ] Tool accepts optional { skipSandbox: boolean } input and returns a structured step-by-step guide as text content
- [ ] Tool output is deterministic and does not create side-effects (sandbox creation is opt-in)
- [ ] Tool appears in MCP tool listing and is covered by docs coverage check

---

### Task 5: Write integration test: full onboarding flow in non-interactive mode

**Phase**: GREEN  
**File(s)**: `src/[module]/[file].ts`  
**Action**: modify

Write integration test: full onboarding flow in non-interactive mode

**Acceptance**:
- [ ] Integration test runs `zeno onboarding --skip-sandbox` end-to-end and asserts exit code 0
- [ ] Test asserts all step headers appear in stdout
- [ ] Test verifies that --step welcome prints only the welcome step output
- [ ] Coverage for onboarding module meets the 90% threshold

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
| `src/cli/commands/onboarding.ts` | - | modify | Implementation file |
| `src/cli/onboarding/types.ts` | - | modify | Implementation file |
| `src/cli/onboarding/steps.ts` | - | modify | Implementation file |
| `src/cli/onboarding/steps/01-welcome.ts` | - | modify | Implementation file |
| `src/cli/onboarding/steps/02-concepts.ts` | - | modify | Implementation file |
| `src/cli/onboarding/steps/03-sample-init.ts` | - | modify | Implementation file |
| `src/cli/onboarding/steps/04-first-gate.ts` | - | modify | Implementation file |
| `src/cli/onboarding/steps/05-mcp-intro.ts` | - | modify | Implementation file |
| `src/cli/onboarding/steps/06-next-steps.ts` | - | modify | Implementation file |
| `src/cli/index.ts` | - | modify | Implementation file |
| `src/mcp/tools/onboarding-tool.ts` | - | modify | Implementation file |
| `tests/cli/onboarding.test.ts` | - | modify | Implementation file |

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
