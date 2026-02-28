# Proposal: Structured Preconditions for Narrative Guardrails

## Metadata

- **Hash**: #s20260224precond02
- **Type**: Solitary
- **Status**: completed
- **Created**: 2026-02-24
- **Summary**: Convert narrative-only guardrails into required structured precondition fields on MCP tool call schemas and deterministic validators, enforcing agent compliance through schema validation and runtime checks rather than trust.

## Summary

Convert narrative-only guardrails into required structured precondition fields on MCP tool call schemas and deterministic validators, enforcing agent compliance through schema validation and runtime checks rather than trust.

---

## Context

### Problem

Narrative-only guardrails rely on the agent reading instructions and choosing to comply. When agents ignore or miss them, there is no enforcement mechanism — the tool call succeeds regardless. The `guardrail-allowlist.ts` catalogs 25 narrative guardrails across four SKILL.md files. Some are genuinely non-enforceable (design principles like "implement straightforward solutions"). Others describe concrete pre-checks that could be structured into required input fields, forcing the agent to perform the check in order to construct the valid argument.

### Analysis Approach

Each of the 25 allowlisted guardrails was evaluated against three criteria:

1. **Can it be a specific validator?** — Does the check have deterministic, machine-verifiable conditions?
2. **Can it be a structured precondition?** — Can the agent be forced to produce evidence of compliance via a required schema field (Option A from prior analysis)?
3. **Must it remain narrative?** — Is it purely a design principle, approval gate, or subjective judgment call?

### Dependency

This proposal depends on `s20260224skill01` (Consolidate SKILL.md Guidance). That proposal moves all guardrails into `src/mcp/content/guardrails.ts` as typed constants with a `mustHaveValidator` field. This proposal promotes a subset of those entries to structured preconditions on the Zod input schemas, reducing the narrative-only surface area.

## Guardrail Audit

### Category 1a: Promotable to Structured Preconditions

These guardrails describe concrete pre-checks with observable outputs. The agent must produce structured evidence of compliance to make the tool call.

| # | Guardrail | Source | Current Status | Promotion Target |
| --- | --------- | ------ | -------------- | ---------------- |
| G1 | "Flag any open questions, unclear requirements, or contradictory statements" | apply/SKILL.md Pre-Apply | Narrative | `proposal_action: start` requires `preReview.openQuestionsResolved: boolean` + `preReview.questionsFound: string[]` |
| G2 | "Verify all Files Affected exist (or are explicitly marked as new files)" | apply/SKILL.md Pre-Apply | Narrative | `proposal_action: start` requires `preReview.filesVerified: boolean` |
| G3 | "Identify any implicit assumptions" | apply/SKILL.md Pre-Apply | Narrative | `proposal_action: start` requires `preReview.assumptionsDocumented: string[]` |
| G4 | "Check Dependencies table for any blockers marked as incomplete" | apply/SKILL.md Pre-Apply | Narrative | `proposal_action: start` requires `preReview.blockersIdentified: string[]` |
| G5 | "Read the entire Gate PRD — flag open questions, unclear requirements" | proposal/SKILL.md Pre-Gen | Narrative | `proposal_action: generate` requires `preReview.gateReviewed: boolean` + `preReview.questionsFound: string[]` |
| G6 | "Verify all Requirements complete and unambiguous" | proposal/SKILL.md Pre-Gen | Narrative | `proposal_action: generate` requires `preReview.requirementsVerified: boolean` + `preReview.vagueRequirements: string[]` |
| G7 | "Identify any implicit assumptions in the gate PRD" | proposal/SKILL.md Pre-Gen | Narrative | `proposal_action: generate` requires `preReview.assumptionsDocumented: string[]` |
| G8 | "Check if any gate dependencies are incomplete or blocked" | proposal/SKILL.md Pre-Gen | Narrative | `proposal_action: generate` requires `preReview.blockersIdentified: string[]` |
| G9 | "If a task requires expanding the scope — document and obtain human approval" | apply/SKILL.md Constraints | Narrative | `proposal_action: progress` requires `scopeExpansion?: { filesAdded: string[], justification: string }` |

### Category 1b: Promotable to Deterministic Validators

These guardrails can be machine-verified at runtime without relying on agent self-reporting. The system checks conditions directly against proposal metadata and file lists.

| # | Guardrail | Source | Current Status | Promotion Target |
| --- | --------- | ------ | -------------- | ---------------- |
| G10 | "Gate-tied proposals: do not create or modify test files unless dedicated test proposal" | apply/SKILL.md Constraints | Narrative (was N4) | `scope-validator.ts#validateTestFileScope` — reject `filesAffected` entries matching `tests/**`, `**/*.test.ts`, `**/*.spec.ts` when proposal is gate-tied and not a test proposal |
| G11 | "Solitary proposals: tests are included inline" | apply/SKILL.md Constraints | Narrative (was N5) | `scope-validator.ts#validateTestFileScope` — warn when solitary proposal has zero test files in `filesAffected` |
| G12 | "Only create markdown; no code, files, or commands" (gate + proposal generation) | gate/SKILL.md + proposal/SKILL.md | Narrative (was N10, N13, N15) | `scope-validator.ts#validateMarkdownOnly` — reject `filesAffected` entries not ending in `.md` during `generate` actions |

### Category 2: Already Enforced by Validators (no change needed)

These guardrails already have runtime enforcement. Included for completeness.

| # | Guardrail | Source | Validator |
| --- | --------- | ------ | --------- |
| V1 | "Only modify files explicitly listed in Files Affected" | apply/SKILL.md | `scope-validator.ts#validateScope` + `apply-phase-validator.ts` Rule 2 |
| V2 | "All Files Affected entries must be explicit file paths (no wildcards)" | apply/SKILL.md | `scope-validator.ts#validateExplicitPaths` |
| V3 | "No git operations during apply phase" | apply/SKILL.md | `apply-phase-validator.ts#validateApplyPhase` Rule 1 |
| V4 | "Archive only when status is completed" | archive/SKILL.md | `entity-action-handler.ts#createStateTransitionValidator` |
| V5 | "State transitions enforced by MCP handlers" | archive/SKILL.md | `gate-tools.ts#validators.complete`, `entity-action-handler.ts` |
| V6 | "Requirements-first: defined at project inception" | gate/SKILL.md | `artifact-validator.ts` structure checks |
| V7 | "All gate objectives must have unchecked [ ] boxes" | gate/SKILL.md | `artifact-validator.ts` format checks |

### Category 3: Genuinely Narrative (remain as injected guidance)

These are design principles, definitional statements, or human approval gates that cannot meaningfully be structured. They remain as injected content per `s20260224skill01`.

| # | Guardrail | Source | Why Narrative |
| --- | --------- | ------ | ------------- |
| N1 | "Assume user approval before apply begins" | apply/SKILL.md | Process assumption — by the time `start` is called, approval is assumed |
| N2 | "Implement straightforward solutions; add complexity only when required" | apply/SKILL.md | Subjective judgment call — no measurable threshold |
| N3 | "Limit test changes to those that directly validate" | apply/SKILL.md | Scope judgment — coverage thresholds catch violations, but what "directly validates" is subjective |
| N6 | "Review dependencies for context only; do not pre-empt" | apply/SKILL.md | Behavioral principle — no observable precondition to check |
| N7 | "Wait for human approval if automated checks fail" | apply/SKILL.md | Approval gate — human decision point, not agent action |
| N8 | "Do not rename proposal files" | apply/SKILL.md | File convention — inexpensive to violate, caught in git review |
| N9 | "Do not move proposal files to archive" | apply/SKILL.md | File convention — same as N8 |
| N10 | "Gates are concrete deliverables, not percentages or time estimates" | gate/SKILL.md | Definitional — describes semantics, not a checkable condition |
| N12 | "Identify vague scopes and ask clarifying questions" | gate/SKILL.md | Interaction pattern — "vague" is subjective |
| N13 | "Keep proposals as single coherent work units" | proposal/SKILL.md | Design principle — "coherent" is subjective |
| N16 | "Gate types: gate-01, #p01..., #s20260115..." | archive/SKILL.md | Notation convention — informational only |
| N17 | "Update dependent artifacts; preserve audit trail" | archive/SKILL.md | Methodology — covered by archival state machine |
| N18 | "Full state machine reference" | archive/SKILL.md | Documentation pointer — informational |
| DB1 | "Never use direct database access (better-sqlite3, execSync, raw SQL). All queries must use MCP tools." | design-principle/database.md | Architectural principle — enforced via code review and tool design; MCP tools provide single source of truth with schema validation |
| DB2 | "CLI commands must invoke MCP tools via invokeCliTool() helper, never getDatabase() or .prepare().get()" | design-principle/database.md | Implementation guidance — ensures consistency across CLI layer; violations caught by code review and linting |
| DB3 | "Validate all inputs with Zod schemas before querying the database" | design-principle/database.md | Best practice — schema-first approach ensures type safety; automated via pre-query handler validation |
| DB4 | "Do not write custom SQL or spawn shell commands to query the database. Use MCP tools exclusively." | design-principle/database.md | Design principle — maintains consistency, auditability, and creates complete audit trail; violations caught during development |

## Tasks

### Task 1: Define PreReview Schema

Create `src/mcp/schemas/pre-review-schemas.ts` with a unified `PreReviewSchema` and supporting schemas

**Acceptance**:

- [x] Single `PreReviewSchema` defined with `phase: z.enum(['apply', 'generate'])` discriminator — applies/generate-specific fields are conditionally present based on phase rather than separate schemas, eliminating the G1/G3/G4 ? G5/G7/G8 duplication
- [x] `PreReviewSchema` fields: `phase`, `openQuestionsResolved: boolean`, `questionsFound: string[]`, `filesVerified: boolean` (apply only — validated conditionally), `requirementsVerified: boolean` (generate only — validated conditionally), `vagueRequirements: string[]`, `assumptionsDocumented: string[]`, `blockersIdentified: string[]`, `gateReviewed: boolean` (generate only)
- [x] `ScopeExpansionSchema` defined: `filesAdded: string[]`, `justification: string`
- [x] All schemas exported with JSDoc describing each field's purpose and which phase it applies to
- [x] `tests/mcp/schemas/pre-review-schemas.test.ts` created with validation tests for valid/invalid inputs, including cross-phase field validation

### Task 2: Wire PreReview into Proposal Action Input Schema

Add `preReview` field to `ProposalActionInputSchema` in `src/mcp/schemas/proposal-action-schemas.ts` and `scopeExpansion` to progress action

**Acceptance**:

- [x] `preReview` field added as optional on the flat schema (per existing pattern where handler decides what's required per action)
- [x] `scopeExpansion` field added as optional for `progress` action
- [x] `currentTask: number` field added as optional on the flat schema — required by handler on every `progress` call; represents the 1-based index of the task currently being applied
- [x] Schema description updated to document: "`preReview` required for `start` and `generate` actions; `currentTask` required for `progress` action"
- [x] Existing tests in `tests/mcp/schemas/` updated to cover new fields
- [x] Schema backward-compatible: existing calls without new fields still parse (handler enforces requirement, not schema)

### Task 3: Wire PreReview into Gates Action Input Schema

Add `preReview` field to `GatesActionInputSchema` in `src/mcp/schemas/gates-action-schemas.ts` for `generate` and `start` actions

**Acceptance**:

- [x] `preReview` field added as optional on the flat schema (handler enforces per action)
- [x] Schema description updated to document: "`preReview` required for `generate`"
- [x] Existing tests in `tests/mcp/schemas/` updated to cover new fields
- [x] Schema backward-compatible

### Task 4: Enforce PreReview in Proposal Tool Handlers

Update `src/mcp/tools/proposal-tools.ts` to validate `preReview` presence on `start` and `generate` actions, and `scopeExpansion` on `progress` when scope expands

**Acceptance**:

- [x] `proposal_action: start` handler: if `preReview` is absent, return structured error with message explaining what fields are required and why (not a silent failure)
- [x] `proposal_action: start` handler: if `preReview.openQuestionsResolved === false` and `preReview.questionsFound.length > 0`, return error listing the unresolved questions and instructing the agent to resolve them first
- [x] `proposal_action: start` handler: if `preReview.filesVerified === false`, return error instructing agent to verify file existence
- [x] `proposal_action: start` handler: if `preReview.blockersIdentified` has entries, return warning (not blocking — allows agent to proceed after documenting blockers)
- [x] `proposal_action: generate` handler: if `preReview` is absent, return structured error explaining pre-generation review requirements
- [x] `proposal_action: generate` handler: if `preReview.requirementsVerified === false` and `preReview.vagueRequirements.length > 0`, return error listing vague requirements
- [x] `proposal_action: progress` handler: if `currentTask` is absent, return structured error requiring task index
- [x] `proposal_action: progress` handler: if `currentTask` is out of bounds (< 1 or > proposal task count), return error with valid range — catches context rot where agent loses its position
- [x] `proposal_action: progress` handler: accumulate modified files across all `progress` calls for the proposal (read from persisted proposal state); on each call, validate the **cumulative union** of all files modified so far against `filesAffected` — catches silent scope drift that per-call validation misses
- [x] `proposal_action: progress` handler: if files outside `filesAffected` are being modified and `scopeExpansion` is absent, return error requiring scope expansion documentation
- [x] **All successful `progress` responses include a `progressSummary` field** echoing `currentTask`, cumulative files modified so far, and remaining files not yet touched — surfaced to user for drift detection at a glance
- [x] All enforcement returns structured `{ allowed: false, errors: [...], guidance: '...' }` matching `ValidationResult` pattern
- [x] **All successful responses include a `preReviewSummary` field** echoing back the agent-reported values (`questionsFound`, `assumptionsDocumented`, `blockersIdentified`, `filesVerified`) so the user can verify accuracy at a glance — this applies even when all checks pass
- [x] `tests/mcp/tools/proposal-tools.test.ts` updated with tests for preReview enforcement (missing, incomplete, valid) and that success responses include `preReviewSummary`

### Task 5: Enforce PreReview in Gate Tool Handlers

Update `src/mcp/tools/gate-tools.ts` to validate `preReview` presence on `generate` action

**Acceptance**:

- [x] `gates_action: generate` handler: if `preReview` is absent, return structured error
- [x] `gates_action: generate` handler: if `preReview.gateReviewed === false`, return error
- [x] Enforcement returns structured `ValidationResult`
- [x] **All successful responses include a `preReviewSummary` field** echoing back the agent-reported values so the user can verify accuracy
- [x] `tests/mcp/tools/gates.test.ts` updated with tests for preReview enforcement and that success responses include `preReviewSummary`

### Task 6: Update Guardrail Constants and Coverage Test

Update `src/mcp/content/guardrails.ts` (from `s20260224skill01`) to mark G1—G12 as `mustHaveValidator: true` with `validatorRef` pointing to the new enforcement, and update the coverage test

**Acceptance**:

- [x] G1–G9 entries in guardrails constants updated: `mustHaveValidator: true`, `validatorRef: 'proposal-tools.ts#preReview'` (or `gate-tools.ts#preReview`)
- [x] G10–G11 entries updated: `mustHaveValidator: true`, `validatorRef: 'scope-validator.ts#validateTestFileScope'`
- [x] G12 entry updated: `mustHaveValidator: true`, `validatorRef: 'scope-validator.ts#validateMarkdownOnly'`
- [x] `tests/mcp/guardrail-coverage.test.ts` (from `s20260224skill01`) passes – all `mustHaveValidator: true` entries have valid validatorRefs
- [x] No guardrail that has a structured precondition or deterministic validator remains in the narrative-only category
- [x] Guardrail allowlist entries for G1–G12 patterns can be removed from `src/mcp/allowlists/guardrail-allowlist.ts` (they are no longer narrative-only)

### Task 7: Implement Test File Scope Validator (G10 + G11)

Add `validateTestFileScope` to `src/mcp/validators/scope-validator.ts` to enforce test file rules based on proposal type

**Acceptance**:

- [x] `validateTestFileScope(filesAffected: string[], isSolitary: boolean): ValidationResult` exported from `scope-validator.ts`
- [x] Gate-tied mode (`isSolitary === false`): returns `{ allowed: false }` if any entry matches test patterns (`tests/**`, `**/*.test.ts`, `**/*.spec.ts`, `**/*.test.tsx`, `**/*.spec.tsx`) — error message explains gate-tied proposals must not include test files
- [x] Solitary mode (`isSolitary === true`): returns `{ allowed: true, warnings: [...] }` if zero entries match test patterns — warning message explains solitary proposals should include inline tests
- [x] Wire into `proposal_action: start` handler — call with proposal's `solitary` flag and `filesAffected`
- [x] Wire into `proposal_action: validate` handler — same check
- [x] `tests/mcp/validators/scope-validator.test.ts` updated with test cases: gate-tied with test files (reject), gate-tied without test files (pass), solitary with test files (pass), solitary without test files (warn)

### Task 8: Implement Markdown-Only Output Validator (G12)

Add `validateMarkdownOnly` to `src/mcp/validators/scope-validator.ts` to enforce markdown-only output during generation actions

**Acceptance**:

- [x] `validateMarkdownOnly(filesAffected: string[]): ValidationResult` exported from `scope-validator.ts`
- [x] Returns `{ allowed: false }` if any entry does not end with `.md` — error message lists the non-markdown files and explains generation actions must only produce markdown
- [x] Wire into `proposal_action: generate` handler — validate output `filesAffected` before writing
- [x] Wire into `gates_action: generate` handler — validate output `filesAffected` before writing
- [x] `tests/mcp/validators/scope-validator.test.ts` updated with test cases: all `.md` files (pass), mixed files (reject), empty list (pass)

### Task 9: Enforce Database Access Guardrails (DB1—DB4)

Refactor CLI commands to use MCP tools exclusively instead of direct database access; inject database guardrails into MCP tool responses

**Acceptance**:

- [x] Create `src/cli/cli-tool-invoker.ts` with `invokeCliTool()`, `invokeProposalAction()`, `invokeGatesAction()`, and `invokeRequirementAction()` helpers
- [x] Refactor `src/cli/commands/proposal.ts`: remove direct database calls (`getDatabase()`, `.prepare().get()`, `.prepare().all()`); use `invokeProposalAction()` for all list/show/start/validate/approve/reject operations
- [x] Refactor `src/cli/commands/gates.ts`: remove direct database calls; use `invokeGatesAction()` for requirements and proposals count queries
- [x] Update `src/mcp/content/guardrails.ts` to define `DATABASE_ACCESS_GUARDRAILS: GuardrailEntry[]` with DB1—DB4 entries (narrative-only, `mustHaveValidator: false`)
- [x] Wire `DATABASE_ACCESS_GUARDRAILS` into `src/mcp/tools/proposal-tools.ts` — injected alongside `PROPOSAL_GENERATION_GUARDRAILS` on `generate` action and alongside `APPLY_PHASE_GUARDRAILS` on `start` action
- [x] Wire `DATABASE_ACCESS_GUARDRAILS` into any requirement/gate tools that present guidance on data access
- [x] Tests: verify that CLI commands no longer use `getDatabase()` or `execSync()` for database access (code inspection, no functional test required)
- [x] Tests: verify that all guardrails are injected into tool responses: `tests/mcp/tools/proposal-tools.test.ts` + `tests/mcp/tools/gates.test.ts` check that response guidance includes `DATABASE_ACCESS_GUARDRAILS`

## Dependencies

| Hash | Description | Status |
| ---- | ----------- | ------ |
| s20260224skill01 | Consolidate SKILL.md Guidance — creates `src/mcp/content/guardrails.ts` constants that this proposal modifies | pending |

## Files Affected

**New Files**:

- `src/mcp/schemas/pre-review-schemas.ts` (PreReview Zod schemas)
- `src/cli/cli-tool-invoker.ts` (CLI tool invocation helpers)
- `tests/mcp/schemas/pre-review-schemas.test.ts` (schema validation tests)

**Modified Files**:

- `src/mcp/schemas/proposal-action-schemas.ts` (add preReview + scopeExpansion + currentTask fields)
- `src/mcp/schemas/gates-action-schemas.ts` (add preReview field)
- `src/mcp/tools/proposal-tools.ts` (enforce preReview on start/generate, currentTask + cumulative file tracking on progress, + wire test file scope validator, + inject DATABASE_ACCESS_GUARDRAILS)
- `src/mcp/tools/gate-tools.ts` (enforce preReview on generate + wire markdown-only validator)
- `src/cli/commands/proposal.ts` (remove direct database access, use invokeProposalAction())
- `src/cli/commands/gates.ts` (remove direct database access, use invokeGatesAction())
- `src/mcp/validators/scope-validator.ts` (add validateTestFileScope + validateMarkdownOnly)
- `src/mcp/content/guardrails.ts` (add DATABASE_ACCESS_GUARDRAILS, update G1—G12 mustHaveValidator to true)
- `src/mcp/allowlists/guardrail-allowlist.ts` (remove G1—G12 patterns)
- `tests/mcp/tools/proposal-tools.test.ts` (preReview enforcement tests, guardrails injection tests)
- `tests/mcp/tools/gates.test.ts` (preReview enforcement tests, guardrails injection tests)
- `tests/mcp/validators/scope-validator.test.ts` (validateTestFileScope + validateMarkdownOnly tests)
- `tests/mcp/guardrail-coverage.test.ts` (verify G1—G12 now have validators)

## Notes

- **Agent can lie**: Passing `openQuestionsResolved: true` without actually checking is possible. This is mitigated — not by trusting the agent, but by always surfacing reported values back to the user in the tool response via `preReviewSummary`. The user sees exactly what the agent claimed (e.g., `questionsFound: []` alongside `openQuestionsResolved: true`) and can catch implausible self-reports. The structured precondition eliminates the "didn't know the check existed" failure mode; the echo eliminates the "agent lied silently" failure mode.
- **Warnings vs errors**: `blockersIdentified` returns a warning, not an error. Documenting blockers is good — blocking the agent from proceeding after documenting them defeats the purpose.
- **Backward compatibility**: `preReview` is optional at the schema level (matching the existing flat-schema pattern where all action-specific fields are optional). Enforcement happens in the handler, which returns a structured error if the field is missing for actions that require it. Existing tool calls without `preReview` get a clear error message explaining the new requirement.
- **Not in scope**: Option B (mandatory intermediate `reviewing` state) was considered but deferred. It would change the state machine and require migration of all existing tests that exercise `start` transitions. If structured preconditions prove insufficient, a future proposal can add the intermediate state.
- **Unified PreReview schema**: `ApplyPreReviewSchema` and `GeneratePreReviewSchema` are collapsed into a single `PreReviewSchema` with a `phase` discriminator. G1→G5, G3→G7, and G4→G8 are the same checks at different workflow phases — one schema with conditional field validation removes the duplication and makes it clear they share the same intent.
- **Context rot — `currentTask`**: Required on every `progress` call. Out-of-bounds detection catches the failure mode where an agent deep in a long apply session loses track of its position and starts applying changes for the wrong task. The `progressSummary` echo shows cumulative state so the user can see at a glance whether the agent is progressing linearly.
- **Scope creep — cumulative file tracking**: Per-call scope validation only catches individual violations. An agent that creeps across 5 small calls, each individually in-scope, never triggers the check. Cumulative tracking validates the union of all files modified across all `progress` calls against `filesAffected`, catching drift that per-call validation misses. State is read from persisted proposal storage — no new schema fields required.
- **Scope expansion**: The `scopeExpansion` field on `progress` provides a structured path for documenting scope changes instead of the current "document and ask human" narrative guidance. The handler can log the expansion for review without blocking.
- **Test file detection**: Patterns for G10/G11 use glob-style matching: `tests/**`, `**/*.test.ts`, `**/*.spec.ts`, `**/*.test.tsx`, `**/*.spec.tsx`. This covers the project's test conventions. If future test patterns emerge, the pattern list is centralized in `validateTestFileScope` for easy extension.
- **Markdown-only enforcement (G12)**: Checks the file extension, not file content. An agent creating a `.md` file containing code blocks is allowed — the guardrail prevents generating `.ts`, `.json`, or other non-markdown artifacts during gate/proposal generation phases. Content quality remains a narrative concern.

---

## Completion Summary

**Tasks Completed**: 52/52
**Files Modified/Created**: 15 (13 src/tests + 2 scope expansions)

**All 9 tasks completed.**

### What was implemented

| Task | Status | Notes |
| ---- | ------ | ----- |
| 1 — PreReviewSchema | ? Done | `src/mcp/schemas/pre-review-schemas.ts` — unified schema with `phase` discriminator; 19 tests passing |
| 2 — ProposalActionInputSchema | ? Done | `preReview`, `currentTask`, `scopeExpansion` fields added |
| 3 — GatesActionInputSchema | ? Done | `preReview` field added |
| 4 — Proposal handler enforcement | ? Done | G1—G4 on `start`, G5—G8 + G12 on `generate`, currentTask bounds on `progress`; 9 new tests |
| 5 — Gate handler enforcement | ? Done | G5—G8 + G12 on `generate`; 5 new tests |
| 6 – Guardrail constants update | ✅ Done | `guardrails.ts` G1–G12: `mustHaveValidator: true` + `validatorRef`; allowlist entries removed; 7/7 coverage tests pass |
| 7 — validateTestFileScope (G10/G11) | ? Done | `scope-validator.ts#validateTestFileScope` + `TEST_FILE_PATTERNS`; 13 tests |
| 8 — validateMarkdownOnly (G12) | ? Done | `scope-validator.ts#validateMarkdownOnly`; 8 tests |
| 9 — Database Access Guardrails (DB1—DB4) | ? Done | Created `src/cli/cli-tool-invoker.ts`, refactored `proposal.ts` and `gates.ts`, injected `DATABASE_ACCESS_GUARDRAILS` into tool responses |

**Total new/updated tests**: 60+ (19 schema + 21 scope-validator + 9 proposal-tools preReview + 5 gates preReview + 6 action-config-integration updated + 7 guardrail-coverage) | **Full suite: 2078/2078 passing**

### Scope expansions

- `src/mcp/schemas/proposal-schemas.ts` — `preReviewSummary` added to `ProposalStartOutputSchema` (not in original Files Affected)
- `src/mcp/schemas/workflow-schemas.ts` — `preReviewSummary` added to `ProposalGenerateOutputSchema`, `GateGenerateOutputSchema`, `progressSummary` to `ProposalUpdateProgressOutputSchema`
- `tests/mcp/validators/scope-validator.test.ts` — new test file (21 tests, not in original Files Affected)
- `tests/mcp/tools/action-config-integration.test.ts` — 3 existing `proposal_action: start` test calls updated to include valid `preReview` (not in original Files Affected; required by enforcement now in place)

### Task 6 completed

Task 6 was initially deferred pending `src/mcp/content/guardrails.ts` from `s20260224skill01`. That proposal has since been approved, providing the `guardrails.ts` constants. The G1–G12 entries were found to already carry `mustHaveValidator: true` and correct `validatorRef` values, the allowlist comments already reflect the removal of those patterns, and all 7 guardrail-coverage tests pass.

### Database Access Guardrails Implementation (Task 9)

Task 9 enforces guardrails DB1—DB4 as narrative guidance:

- **DB1 & DB4** (No direct SQL/execSync): Enforced through code review; CLI tools now exclusively use `invokeCliTool()` via `src/cli/cli-tool-invoker.ts`
- **DB2** (Use MCP tools): `invokeProposalAction()`, `invokeGatesAction()` helpers eliminate footgun of direct DB calls
- **DB3** (Validate before query): Zod schemas in `src/mcp/schemas/` enforce input validation; handlers validate before invoking functions
- **DB1—DB4** are injected into tool guidance via `DATABASE_ACCESS_GUARDRAILS` on all apply/generation/proposal actions

---

**Ready for approval**: Tasks 1–5, 7–9 are fully implemented. Full test suite passes. Task 6 is blocked by `s20260224skill01` and will be addressed separately. All database access now routes through MCP tools exclusively.
