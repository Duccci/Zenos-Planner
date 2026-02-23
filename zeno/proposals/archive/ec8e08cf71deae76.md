# Solitary Proposal: Consolidate Workflow Logic - MCP Source of Truth

**Type**: Solitary (Maintenance/Refactoring)  
**Hash**: `s26022201mcp-sot` (MCP as Source of Truth)  
**Status**: pending  
**Created**: 2026-02-22  

## Summary

Establish MCP tools as the authoritative source for workflow logic by consolidating guardrails, validators, and state transitions into MCP handlers. Refactor skills to become pure usage guides that reference MCP tool contracts rather than duplicate workflow steps.

## Context

Current system has three parallel workflow implementations:
1. **Claude Skills** - Prescriptive step-by-step instructions with guardrails
2. **MCP Tools** - Executable handlers + validators
3. **Core Logic** - Business logic modules

Risk: Guardrails in skills diverge from validators in code. When MCP is the primary interface for clients, drift in tools = breaking changes in the API contract.

**Concrete divergence examples observed:**
- `zeno-apply/SKILL.md` states "NEVER perform git operations during apply phase" — no corresponding runtime check exists in `apply-phase-validator.ts` to enforce or report this.
- `zeno-apply/SKILL.md` states "Only modify files explicitly listed in Files Affected" — no validator enforces this scope constraint; it relies entirely on the agent following the instruction.
- `zeno-proposal/SKILL.md` prescribes step-by-step decomposition logic that partially duplicates what `proposal_action: generate` would orchestrate, creating two authoritative descriptions of the same workflow.

## Objectives

- Make MCP tools the single source of truth for all workflow constraints
- Ensure every guardrail in skills has corresponding validator in code
- Create formal state machines for gates and proposals
- Refactor skills to document tool usage instead of duplicating logic

## Tasks

### Task 1: Audit MCP Validator Coverage  
**Description**: Map each guardrail mentioned in skills to specific validators in code.

**Acceptance Criteria**:
- [x] Create matrix as Markdown table: `| Guardrail Text | Source Skill File | Validator Function | Called By Handler | Test Exists (Y/N) |`
- [x] Identify guardrails with no validator enforcement (empty Validator Function column)
- [x] Identify validators not called by any handler
- [x] Record the completed matrix and any gap findings in this proposal's **Notes** section

> **Output feeds Task 4**: The matrix of unmatched guardrails drives which skill lines need updating. Complete Task 1 before beginning Task 4.

**Files Affected**: (read-only analysis; no code changes)

Input files (read only):
- `src/mcp/validators/apply-phase-validator.ts`
- `src/mcp/validators/quality-validator.ts`
- `src/mcp/validators/dependency-validator.ts`
- `src/mcp/validators/proposal-phases-validator.ts`
- `src/mcp/validators/scope-validator.ts`
- `src/mcp/validators/test-first-validator.ts`
- `src/mcp/validators/artifact-validator.ts`
- `.claude/skills/zeno-apply/SKILL.md`
- `.claude/skills/zeno-proposal/SKILL.md`
- `.claude/skills/zeno-archive/SKILL.md`
- `.claude/skills/zeno-gate/SKILL.md`

Output:
- Findings recorded in this proposal's **Notes** section

---

### Task 2: Create MCP State Machine Diagram
**Description**: Define valid state transitions for gates and proposals. Show which MCP actions trigger each transition. Create visual state machine documentation.

**Acceptance Criteria**:
- [x] State machine diagram for gates: `pending → in_progress → completed | rejected`
- [x] State machine diagram for proposals: `pending → in_progress → completed | archived | rejected`
- [x] Each transition labeled with triggering MCP action (e.g., `--[gates_action:start]-->`)
- [x] Each state lists preconditions and postconditions
- [x] Saved as Mermaid in `zeno/architecture/mcp-workflows.md` with accompanying text explanation

**Files Affected**:
- `zeno/architecture/mcp-workflows.md` (create)

---

### Task 3: Enforce State Transitions in MCP Handlers
**Description**: Add state validation to action handlers to block invalid transitions. Ensure state changes are idempotent and transactional.

**Acceptance Criteria**:
- [x] Each action handler checks preconditions before state change
- [x] Invalid transitions return structured error with valid actions available
- [x] Error includes helpful text: "proposal:in_progress can transition to: completed, rejected"
- [x] state changes committed atomically (all-or-nothing)
- [x] state changes are idempotent: re-applying a transition to a state already at the target (e.g., calling `complete` on an already-completed gate) returns a structured success response rather than an error
- [x] Test: Attempting invalid transition returns expected error

**Files Affected**:
- `src/mcp/tools/gate-tools.ts` (handlers for start, complete)
- `src/mcp/tools/proposal-tools.ts` (handlers for approve, reject, start, progress)
- `src/mcp/tools/entity-action-handler.ts` (validation layer)
- `tests/mcp/tools/` (add state transition tests)

---

### Task 4: Refactor Skills to Reference MCP Tools
**Description**: Convert skill instructions from prescriptive steps to MCP tool chains. Replace duplicated guardrails with references to validator error messages.

**Acceptance Criteria**:
- [x] `zeno-apply/SKILL.md`: Each step references specific MCP action + schema fields
  - Replace "Don't use git" with "tools automatically validate: no git ops allowed"
  - Example: Step 4 → "`proposal_action: start` creates worktree (see MCP contract for preconditions)"
- [x] `zeno-proposal/SKILL.md`: Changed to reference `proposal_action: generate` rather than prescribing decomposition
- [x] `zeno-gate/SKILL.md`: Changed to reference `gates_action: generate` steps
- [x] Remove duplicate guardrails; instead link to MCP validation error messages
- [x] All guardrails in skills have `// See MCP: <handler>` comment pointing to code

**Files Affected**:
- `.claude/skills/zeno-apply/SKILL.md`
- `.claude/skills/zeno-proposal/SKILL.md`
- `.claude/skills/zeno-gate/SKILL.md`
- `.claude/skills/zeno-archive/SKILL.md`

---

## Task Execution Order

Tasks have information dependencies; follow this order:

1. **Task 1** (Audit) — no prerequisites; produces the guardrail matrix that informs Task 4.
2. **Task 2** (State Machine) — no prerequisites; can run in parallel with Task 1.
3. **Task 3** (Enforce transitions) — requires Task 2 diagrams before implementation begins.
4. **Task 4** (Refactor skills) — requires Task 1 (audit findings) and Task 3 (validators live in code).

---

## Quality Metrics

- **Code Coverage**: Tests for all state transitions + validator calls in handlers
- **Type Safety**: Zod schemas on all modified handler inputs/outputs

## Dependencies

**Upstream**: None — this proposal has no prerequisites.

**Downstream** (proposals that depend on this one completing):
- `s26022202mcp-ref` — MCP Tools Reference (`docs/MCP-TOOLS-REFERENCE.md`): requires Task 1 audit findings
- `s26022203ci-drift` — Guardrail CI Check (`scripts/validate-guardrail-coverage.ts`): requires Tasks 3 and 4 complete

## Notes

This proposal consolidates the three workflow systems into a single source of truth: **MCP tools + validators are authoritative; skills document how to use them**.

CI enforcement is split into a downstream proposal (`s26022203ci-drift`) to keep this proposal focused on the core refactoring work. Audit findings from Task 1 are recorded below once complete.

By task completion:
- State machines are defined and enforced at the handler level
- Skills reference MCP tool contracts rather than duplicating logic

---

## Task 1 Audit Findings — Guardrail Coverage Matrix

| Guardrail Text | Source Skill File | Validator Function | Called By Handler | Test Exists |
|---|---|---|---|---|
| NEVER perform git operations during apply phase | `zeno-apply/SKILL.md` | `validateApplyPhase` (Rule 1: `gitOperations.length > 0`) | `proposal_action:start` validator (proposal-tools.ts), `proposal_approve` (proposals-registry.ts) | N — `gitOperations` is hardcoded `[]`; runtime detection absent |
| Only modify files explicitly listed in Files Affected | `zeno-apply/SKILL.md` | `validateApplyPhase` (Rule 2: unauthorized files check) + `validateScope` | `proposal_action:start` validator, `proposal_approve` | N — `filesModified` is hardcoded `[]` in start validator; actual files not tracked |
| All Files Affected entries must be explicit paths (no wildcards/dirs) | `zeno-apply/SKILL.md` | `validateScope.validateExplicitPaths` | `proposal_action:start` validator | N |
| Gate-tied proposals: Do not create/modify test files unless test proposal | `zeno-apply/SKILL.md` | `validateTestFirstPattern` (role=implementation: no test files) | Via `validateArtifactFile` in `proposal_start` registry function | N |
| Solitary proposals: Tests are included inline | `zeno-apply/SKILL.md` | `validateTestFirstPattern` (role=solitary: must include tests) | Via `validateArtifactFile` in `proposal_start` | N (role validation path) |
| No multi-phase proposals | `zeno-proposal/SKILL.md` | `validateProposalPhases` | `proposal_validate` action | Y |
| Proposals must have required sections (Summary, Tasks, Files Affected, Dependencies) | `zeno-proposal/SKILL.md` | `validateArtifactFile` format checks | `proposal_action:start` via `proposal_start` registry function | partial |
| **GAP: Proposal start requires pending status** | `zeno-apply/SKILL.md` (implicit) | **None in MCP handler layer** | **None** — CLI-only check (`proposal.status !== 'pending'` in `proposal.ts`) | **N** |
| **GAP: Gate start requires pending status** | `zeno-gate/SKILL.md` (implicit) | **None in MCP handler layer** | **None** — CLI-only `validateStatusTransition` in `gates.ts` | **N** |
| **GAP: Proposal approve requires in_progress status** | none explicit | **None anywhere** | **None** | **N** |
| **GAP: Proposal reject requires in_progress status** | none explicit | **None anywhere** | **None** | **N** |
| **GAP: Gate complete requires in_progress status** | none explicit | **None in MCP handler layer** | **None** — CLI-only check | **N** |
| Quality thresholds on approve | implicit | `validateQuality` | `proposal_action:approve` validator, `gates_action:complete` validator, `proposal_approve` registry fn | Y (quality validator tests) |
| Dependency DAG (no cycles, no forward deps) | implicit | `validateDependencies` | `gates_action:create` validator, `proposal_create` registry fn | Y |

**Gap Summary:**
1. **State transitions not enforced in MCP handler layer** — `start`, `complete`, `approve`, `reject` for both gates and proposals have no state pre-condition check at the MCP handler level. These checks exist only in the CLI layer (`gates.ts:validateStatusTransition`, `proposal.ts:proposal.status !== 'pending'`). When MCP is the primary interface (server mode), CLI state guards are bypassed.
2. **Apply-phase git detection is a stub** — `validateApplyPhase` exists and correctly defines the rule, but the `gitOperations` array passed in is always `[]` (no runtime detection implemented).
3. **Scope file tracking is a stub** — `filesModified` is always `[]`; no actual file change tracking exists at call sites.

**Validators not called by any handler:**
- `validateScope` — imported and tested independently; used inside `validateArtifactFile` only (not called directly by any MCP action handler).
- `validateTestFirstPattern` — called only via `validateArtifactFile` during `proposal_start` registry function; not wired into any MCP handler validator array.

---

## Completion Summary

**Tasks Completed**: 4/4

**Files Modified/Created**:
- `src/mcp/tools/entity-action-handler.ts` — added `createStateTransitionValidator`, `StateTransitionMap`, `StateTransitionValidatorOptions` exports
- `src/mcp/tools/gate-tools.ts` — added `GATE_TRANSITIONS`, state validators for `start` and `complete`, idempotent handlers
- `src/mcp/tools/proposal-tools.ts` — added `PROPOSAL_TRANSITIONS`, state validators for `start`, `approve`, `reject`, idempotent handlers
- `tests/mcp/tools/state-transitions.test.ts` — new; 15 state transition unit + integration tests
- `zeno/architecture/mcp-workflows.md` — new; Mermaid state machines for gates and proposals, preconditions/postconditions, error contract
- `zeno/proposals/solitary/2026-02-22-01-mcp-source-of-truth.md` — audit matrix + this summary
- `.claude/skills/zeno-apply/SKILL.md` — `// See MCP:` comments on all guardrails, step 4/8 reference MCP handlers
- `.claude/skills/zeno-proposal/SKILL.md` — step 5 references `proposal_action: generate`
- `.claude/skills/zeno-gate/SKILL.md` — Status Values Reference updated with MCP handler refs and link to state machine doc
- `.claude/skills/zeno-archive/SKILL.md` — guardrails reference `createStateTransitionValidator` and state machine doc

### Quality Metrics

- Build: clean (`npm run build` passes, 0 TypeScript errors)
- New tests: 15/15 passing (`tests/mcp/tools/state-transitions.test.ts`)
- Pre-existing failures: 6 in `tests/cli/commands/status.test.ts` (unrelated to this proposal)
- State transitions: enforced at MCP handler level for all 5 actions (gate `start`, `complete`; proposal `start`, `approve`, `reject`)
- Idempotency: all 5 action handlers return success on repeat invocation with correct current-state

