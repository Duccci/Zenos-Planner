---
**Hash**: #m26020402tool  
**Type**: solitary  
**Status**: pending  
**Created**: 2026-02-04  
**Assigned**: Identified in FINDINGS_SUMMARY.md § Critical Issues

---

# Proposal: MCP Implementation - Critical Tools & Guardrails

## Summary

Implement 3 critical missing MCP tools (`config_get`, `gate_create`, `proposal_create`), expose all CLI commands as MCP tools for complete LLM-driven workflow support, and add guardrail enforcement validators to prevent scope violations. Achieves 100% CLI command coverage via MCP and fills workflow gaps from 60% to 95% coverage.

## Context

Current MCP implementation lacks tools required for LLM-driven workflows:
- **`config_get`** - Quality thresholds not accessible; prompts require config-based validation
- **`gate_create`** - Gate generation workflow cannot run end-to-end; requires direct file writing
- **`proposal_create`** - Proposal generation workflow incomplete; requires direct file writing
- **CLI Command Coverage** - 13 CLI commands not accessible via MCP; LLMs must use CLI directly
- **Guardrail validators** - No tool-level enforcement of scope, dependency, or quality constraints

**Analysis Source**: FINDINGS_SUMMARY.md § Critical Issues (3-4), ANALYSIS_MCP_vs_PROMPTS.md § 1-2

## Dependencies

- Related to: #m26020401refa (refactoring enables easier tool addition)
- Blocks: Complete workflow implementation in gate-03

## Tasks

### Task 1: Implement `config_get` Tool
Expose project configuration including quality thresholds to all workflows:

- [ ] Create schema `src/mcp/schemas/config-schemas.ts` with `ConfigGetOutputSchema`
- [ ] Implement `config_get` registration in `src/integration/config-registry.ts`
- [ ] Create tool definition in `src/mcp/tools/config-tools.ts`
- [ ] Add handler registration in MCP server
- [ ] Document output format (thresholds, git settings, version)

**Acceptance Criteria**:
- Returns: `{ qualityThresholds, git, version }`
- Thresholds include: coverage, security, lintErrors, typeErrors
- Accessible to all workflow tools via MCP
- Handles missing config.json gracefully (sensible defaults)

### Task 2: Implement `gate_create` Tool
Enable LLM-driven gate creation through MCP instead of direct file writing:

- [ ] Create schema `src/mcp/schemas/gate-create-schemas.ts`
- [ ] Implement `gate_create` registration in `src/integration/gates-registry.ts`
- [ ] Parse gate PRD input (Name, Type, Sequence, Dependencies, Objectives)
- [ ] Validate gate structure (no circular dependencies, valid types)
- [ ] Write gate file to `zeno/gates/gate-XX-name.md`
- [ ] Update gate-roadmap.md automatically
- [ ] Create tool definition in `src/mcp/tools/gate-tools.ts`

**Acceptance Criteria**:
- Input: gateId, name, type, dependencies, objectives
- Output: gate file path, validation results
- Validates: No duplicate IDs, valid gate types (feature/quality/rescope)
- Updates diagrams: gate-roadmap.md reflects new gate
- Error handling: Clear messages for validation failures

### Task 3: Implement `proposal_create` Tool
Enable LLM-driven proposal creation through MCP:

- [ ] Create schema `src/mcp/schemas/proposal-create-schemas.ts`
- [ ] Implement `proposal_create` registration in `src/integration/proposals-registry.ts`
- [ ] Parse proposal input (gateId/solitary, title, summary, tasks, filesAffected)
- [ ] Generate short hash (8 chars) for proposal
- [ ] Write proposal file to appropriate directory:
  - Gate-tied: `zeno/proposals/gate-XX/NN-name.md`
  - Solitary: `zeno/proposals/solitary/YYYY-MM-DD-NN-name.md`
- [ ] Validate proposal structure matches template
- [ ] Create tool definition in `src/mcp/tools/proposal-tools.ts`

**Acceptance Criteria**:
- Input: gateId or solitary flag, title, summary, tasks array, filesAffected array
- Output: proposal file path, hash, validation results
- Tasks include: description, acceptance criteria ([ ] unchecked)
- Status always: "pending"
- Hash: 8-character alphanumeric, stored in proposal metadata
- Directory structure respected (no overwrites)

### Task 4: Consolidate Proposal & Gate Actions into Unified Tools
Instead of exposing every individual CLI action, consolidate closely related lifecycle operations into two action-based MCP tools optimized for LLM-driven workflows:

- `proposal_action` — single entrypoint for proposal lifecycle actions (actions: `start` | `approve` | `reject` | `validate` | `generate`)
  - Input: discriminated union `{ action: 'start'|'approve'|'reject'|'validate'|'generate', payload: <per-action schema> }`
  - Output: discriminated union where each action maps to its existing output schema (e.g., `ProposalApproveOutputSchema`, `ProposalStartOutputSchema`, etc.)
  - Notes: LLMs can choose an action and provide structured payloads; the handler dispatches to internal implementations (or directly implements orchestration) and returns a validated structured response.

- `gates_action` — single entrypoint for gate lifecycle actions (actions: `start` | `complete` | `regenerate` | `create`)
  - Input: discriminated union `{ action: 'start'|'complete'|'regenerate'|'create', payload: <per-action schema> }`
  - Output: discriminated union mapped to existing gate output schemas

Key implementation details (no backwards-compatibility required):
- Create `src/mcp/schemas/proposal-action-schemas.ts` and `src/mcp/schemas/gates-action-schemas.ts` with Zod discriminated unions for inputs and outputs.
- Implement `proposal_action` and `gates_action` handlers in `src/mcp/tools/proposal-tools.ts` and `src/mcp/tools/gate-tools.ts` respectively using `createSchemaValidatingHandler` or a small dispatcher.
- Register the new tools (replace per-action tools; removing `proposal_approve`, `proposal_reject`, `proposal_start`, `gates_start`, `gates_complete`, `gates_regenerate` is acceptable since breaking changes are allowed).
- Update prompt guidance to show example usage for LLMs (e.g., instruct LLMs to call `proposal_action` with action=`approve` and payload including `approverNotes`).

Acceptance Criteria:
- `proposal_action` supports all proposal lifecycle actions and validates per-action payloads
- `gates_action` supports gate lifecycle actions including `create` and validates payloads
- Tools return validated structured outputs using existing schemas where possible
- Tests cover dispatch correctness and per-action schema validation
- No compatibility wrappers will be maintained (breaking changes allowed; LLM navigation will be updated)

### Task 5: Create Guardrail Validators
Implement tool-level enforcement of workflow constraints:

- [ ] Create `src/mcp/validators/apply-phase-validator.ts`
  - Validates: No git operations during proposal_start/approve
  - Validates: Changes scoped to Files Affected
  - Validates: Quality thresholds met before approval
  
- [ ] Create `src/mcp/validators/scope-validator.ts`
  - Validates: Modified files match Files Affected list
  - Rejects: Unrelated refactoring or scope expansion
  
- [ ] Create `src/mcp/validators/dependency-validator.ts`
  - Validates: Dependencies belong to same/earlier gate
  - Detects: Circular dependencies
  - Validates: All blocking dependencies listed
  
- [ ] Create `src/mcp/validators/quality-validator.ts`
  - Validates: Coverage >= configured threshold
  - Validates: Type errors == 0
  - Validates: Lint errors < configured threshold

**Acceptance Criteria**:
- Each validator exports `validate<X>(context): ValidationResult`
- Result includes: `{ allowed: boolean, errors?: string[], warnings?: string[] }`
- All validators use `config_get()` for thresholds
- Error messages point to specific violations
- Can be used in pre-flight checks

### Task 6: Integrate Validators into Workflow Tools
Wire validators into apply, gate, and proposal workflows:

- [ ] Add validator checks to `proposal_action` handler (for `start`/`approve` actions)
- [ ] Add validator checks to `gates_action` handler (for `create`/`complete` actions)
- [ ] Add validator checks to `proposal_create` / `gate_create` implementations if still present
- [ ] Return validation results in tool output (warnings, errors)
- [ ] Fail on critical errors, warn on non-blocking issues

**Acceptance Criteria**:
- Validators run before state changes
- Tool response includes validation summary
- Critical errors prevent operation (isError: true)
- Warnings logged but allow operation
- Clear guidance on resolution

### Task 7: Add Guardrail Documentation
Document guardrails in tool descriptions and error messages:

- [ ] Update MCP tool descriptions with guardrail warnings
- [ ] Add guardrail explanation to tool JSDoc
- [ ] Create `src/mcp/GUARDRAILS.md` explaining each constraint
- [ ] Add examples of constraint violations
- [ ] Document recovery procedures

**Acceptance Criteria**:
- All guardrails documented with examples
- Tool descriptions include warnings
- Error messages reference specific guardrails
- Recovery instructions provided for violations

### Task 8: Add Config Integration Tests
Ensure tools properly use config values:

- [ ] Test `config_get` returns all required fields
- [ ] Test validators use config thresholds
- [ ] Test `proposal_action` & `gates_action` per-action schema validation
- [ ] Test gate/proposal creation respects config
- [ ] Test quality validator applies correct thresholds

**Acceptance Criteria**:
- 15+ new tests covering config usage
- All validators tested with different config values
- Edge cases covered (missing config, invalid values)
- Tests pass with current project config

### Task 9: Update Workflow Prompts to Reference Tools
Document tool availability in prompt files:

- [ ] Update `zeno-apply.prompt.md` to reference validators
- [ ] Update `zeno-gate.prompt.md` to reference `gates_action`
- [ ] Update `zeno-proposal.prompt.md` to reference `proposal_action`
- [ ] Add examples of using new tools (discriminated union payload examples)
- [ ] Reference guardrail enforcement

**Acceptance Criteria**:
- All 3 prompts updated with tool references
- Examples show correct usage for LLMs
- Guardrails explained in each prompt
- Functions listed match actual implementations

## Files Affected

**Created**:
- `src/mcp/schemas/config-schemas.ts`
- `src/mcp/schemas/gate-create-schemas.ts`
- `src/mcp/schemas/proposal-create-schemas.ts`
- `src/mcp/schemas/proposal-action-schemas.ts` (new consolidated proposal-action schemas)
- `src/mcp/schemas/gates-action-schemas.ts` (new consolidated gates-action schemas)
- `src/mcp/validators/apply-phase-validator.ts`
- `src/mcp/validators/scope-validator.ts`
- `src/mcp/validators/dependency-validator.ts`
- `src/mcp/validators/quality-validator.ts`
- `src/mcp/GUARDRAILS.md`
- `src/mcp/TOOLS.md` (complete tool reference; show action-based usage examples for LLMs)

**Modified (Tool Consolidation)**:
- `src/mcp/tools/proposal-tools.ts` (add `proposal_action` tool; remove per-action tools)
- `src/mcp/tools/gate-tools.ts` (add `gates_action` tool; remove per-action tools)
- `src/mcp/tools/index.ts` (register `proposal_action` and `gates_action`)
- `src/mcp/tools/template-tools.ts` (add LLM-friendly examples to `template_context`)

**Modified (Core Implementations)**:
- `src/integration/config-registry.ts` (add `config_get` registration)
- `src/integration/gates-registry.ts` (add `gate_create` registration; adapt to `gates_action` flows)
- `src/integration/proposals-registry.ts` (add `proposal_create` registration; adapt to `proposal_action` flows)
- `src/mcp/tools/config-tools.ts` (add `config_get` tool definition)
- `.github/prompts/zeno-apply.prompt.md` (reference validators and sample `proposal_action` usage)
- `.github/prompts/zeno-gate.prompt.md` (reference `gates_action`)
- `.github/prompts/zeno-proposal.prompt.md` (reference `proposal_action`)

**Tests Added / Modified**:
- `tests/mcp/validators/apply-phase-validator.test.ts`
- `tests/mcp/validators/scope-validator.test.ts`
- `tests/mcp/validators/dependency-validator.test.ts`
- `tests/mcp/validators/quality-validator.test.ts`
- `tests/mcp/tools/config-tools.test.ts`
- `tests/mcp/tools/gates-action.test.ts` (validate all gates actions)
- `tests/mcp/tools/proposal-action.test.ts` (validate all proposal actions)
- `tests/mcp/tools/action-dispatch.test.ts` (dispatch correctness and schema validation)

## Completion Summary

**Metrics**:
- Workflow coverage: 60% → 95% (+35%)
- Guardrail enforcement: 40% → 85% (+45%)
- CLI command coverage: 60% → 100% of workflow domains (via consolidated actions)
- New tools: +3 critical, +2 consolidated action tools, +4 validators
- New test cases: 55+ validator, integration, and action tests
- Documentation: 3 updated prompts, GUARDRAILS.md, and updated TOOLS.md

**Quality Checkpoints**:
- Build: TypeScript strict mode, zero errors
- Tests: All new tests passing in CI
- Linting: Zero lint errors
- Coverage: 90%+ on new validators and action handlers
- Backwards compatibility: Not required — breaking changes allowed (LLM-driven workflows will be updated)

---

**Effort Estimate**: 7-10 hours (includes schema design, dispatch handlers, and tests)
**Priority**: CRITICAL (enables full workflows, enforces safety, focused on LLM-first UX)
**Blocking**: Proposal #m26020401refa (should follow refactoring)
**Blocked by**: None
