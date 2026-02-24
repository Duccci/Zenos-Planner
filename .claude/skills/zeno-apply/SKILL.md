---
name: zeno-apply
description: Implement an approved Zeno proposal and track task completion.
---

**Guardrails**

**Pre-Apply Review**: Before running `zeno proposal start`, read the entire proposal and perform the following checks:
- Flag any open questions, unclear requirements, or contradictory statements in the Summary, Context, or Tasks sections. If found, document them and ask the user for clarification before proceeding.
- Verify all Files Affected exist (or are explicitly marked as new files). If a file path references a non-existent directory structure, flag it and request confirmation.
- Identify any implicit assumptions in the proposal (e.g., "assume X is already installed", "assume database schema exists"). List assumptions and ask the user to confirm they are correct before implementation begins.
- Check Dependencies table (if present) for any blockers marked as incomplete. If found, document the blocker and wait for user guidance before proceeding.

**Implementation Constraints**:
- Assume user approval: proposals are reviewed and approved before apply begins (no separate approval step required)
- Implement straightforward solutions; add complexity only when required
- Keep changes tightly scoped to proposal tasks
- Only modify files and target objects explicitly listed in the proposal's **Files Affected** or the task description. Avoid unrelated edits or large refactors. // See MCP: scope-validator.ts#validateScope + apply-phase-validator.ts#validateApplyPhase (Rule 2)
- All `Files Affected` entries must be explicit file paths — MCP validates this at `proposal_action: start`: wildcards (`*.ts`) and directory references (`src/dir/`) are rejected by `validateScope.validateExplicitPaths`. If a proposal contains them, reject and request revision. // See MCP: scope-validator.ts#validateExplicitPaths
- Limit test changes to those that directly validate the updated target objects; do not broadly alter the test suite without explicit approval.
- **Gate-tied proposals**: Do not create or modify test files unless the proposal is the gate's dedicated test proposal. Implementation proposals in gates deliberately omit tests to reduce context burden.
- **Solitary proposals**: Tests are included inline and must be implemented as part of the proposal.
- **Solitary proposals – Requirement updates**: Solitary proposals have no parent gate and must directly update requirements via `zeno req status <hash> implemented` (not through gate completion). Gate completion is only for gate-tied proposals.
- If a task requires expanding the scope (additional files, refactors, or cross-cutting changes), document the proposed additions in the implementation output and obtain human approval before making those changes.
- Review dependencies for context only; do not act on, implement, or pre-empt work that belongs to other proposals or later gates. If a dependency is incomplete and belongs to future work, document it as a blocker in the proposal and notify a human for clarification.
- Use quality thresholds from `config_get()` instead of hard-coded values
- Wait for human approval if automated checks fail
- **No git operations during apply phase** — MCP tools automatically validate: `proposal_action: start` and `proposal_action: approve` both call `validateApplyPhase` which blocks if git operations are detected. Commits and archival occur ONLY at gate completion. // See MCP: apply-phase-validator.ts#validateApplyPhase (Rule 1)
- **DO NOT rename proposal files** - proposals remain in active proposals directory until gate completion
- **DO NOT move proposal files to archive** - archival happens automatically when gate is completed

**Functions**

- `getTemplate(name)` - Load template by name
- `config_get()` - Get project configuration
- `manage_todo_list()` - Track task progress (mark in-progress, then completed) - AVOID if it triggers git operations

**Steps**
Track progress by outputting step completion messages. **DO NOT use manage_todo_list if it triggers git operations.**

1. **Identify proposal** - Use hash or filename to locate proposal
2. **Read proposal** - Review Summary, Context, Tasks, Files Affected. Skip architecture docs — trust the proposal's file paths.
3. **Check dependencies** - Read the Description column in the proposal's Dependencies table only. Do NOT open or read dependency proposal files. If a description indicates an incomplete blocker, document it and notify a human. Continue implementing tasks that are not blocked.
4. **Start proposal** - Invoke: `zeno proposal start <hash>` (or `proposal_action: start`). The MCP handler enforces preconditions before transitioning: proposal must be `pending`; artifact must pass format + structure validation; no git operations permitted. Invalid state transitions return a structured error listing valid next actions. // See MCP: proposal-tools.ts#validators.start, entity-action-handler.ts#createStateTransitionValidator
5. **Implement tasks** - For each task in the proposal:
   - Output: "Starting task: [task description]"
   - Implement the task
   - Verify acceptance criteria are met
   - Mark the task's acceptance items as met (change `- [ ]` to `- [x]`)
   - Only edit the proposal file and files explicitly listed in **Files Affected** unless you have documented the scope expansion and obtained human approval.
   - Output: "Completed task: [task description]"
   - **Do NOT write a Completion Summary after each task** — write it once after all tasks are done.
6. **Write Completion Summary** - After all tasks are done, add a single `## Completion Summary` section:
   - `**Tasks Completed**: X/Y`
   - `**Files Modified/Created**: [list]`
   - `### Quality Metrics` (coverage, lint/type errors if applicable)
7. **Update requirements** - For each requirement:
   - **Solitary proposals** (no parent gate): Directly run `zeno req status <hash> implemented` for each requirement
   - **Gate-tied proposals**: Do NOT update requirements yet. Gate completion (`zeno gates complete <gate-id>`) will automatically set all associated requirements to `implemented` when the gate is completed by a human
8. **Run checks** - Invoke: `zeno proposal validate <hash>` and fix failures
   - Confirm the proposal file has a Completion Summary and all acceptance boxes are checked.
   - No git operations allowed during apply — enforced by MCP validators (not just a convention). // See MCP: apply-phase-validator.ts#validateApplyPhase
9. **Request approval and completion**:
   - **Solitary proposals**: Output message requesting human approval to run `zeno proposal approve <hash>` (which will archive the proposal)
   - **Gate-tied proposals**: Output message for human approval to run `zeno gates complete <gate-id>`
     - Note: This single command will implement, commit, archive all proposals, and tag the gate (preserves human review at gate level only)

**Reference**

- `zeno proposal show <hash>` - Proposal details
- `zeno show <hash>` - Resolve hash to entity
- `zeno req deps <hash>` - Dependency chain
- Architecture docs are for gate-level planning, not proposal apply. Do not read them during apply.
