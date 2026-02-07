---
name: zeno-apply
description: Implement an approved Zeno proposal and track task completion.
---

**Guardrails**

- Assume user approval: proposals are reviewed and approved before apply begins (no separate approval step required)
- Implement straightforward solutions; add complexity only when required
- Keep changes tightly scoped to proposal tasks
- Only modify files and target objects explicitly listed in the proposal's **Files Affected** or the task description (for example, specific functions, classes, modules). Avoid unrelated edits or large refactors that extend beyond the stated scope.
- All `Files Affected` entries must be explicit file paths. If a proposal contains wildcards (`*.ts`) or directory references (`src/dir/`), reject and request revision.
- Limit test changes to those that directly validate the updated target objects; do not broadly alter the test suite without explicit approval.
- **Gate-tied proposals**: Do not create or modify test files unless the proposal is the gate's dedicated test proposal. Implementation proposals in gates deliberately omit tests to reduce context burden.
- **Solitary proposals**: Tests are included inline and must be implemented as part of the proposal.
- If a task requires expanding the scope (additional files, refactors, or cross-cutting changes), document the proposed additions in the implementation output and obtain human approval before making those changes.
- Review dependencies for context only; do not act on, implement, or pre-empt work that belongs to other proposals or later gates. If a dependency is incomplete and belongs to future work, document it as a blocker in the proposal and notify a human for clarification.
- Use quality thresholds from `config_get()` instead of hard-coded values
- Wait for human approval if automated checks fail
- **NEVER perform git operations during apply phase** - commits and archival occur ONLY at gate completion
- **DO NOT use git add, git commit, or any git commands** during proposal implementation
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
4. **Start proposal** - Invoke: `zeno proposal start <hash>`
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
7. **Update requirements** - For each requirement: either run `zeno req status <hash> implemented` or note that `zeno gates complete <gate-id>` will automatically set associated requirements to `implemented` when applicable.
8. **Run checks** - Invoke: `zeno proposal validate <hash>` and fix failures
   - Confirm the proposal file has a Completion Summary and all acceptance boxes are checked.
   - **DO NOT perform any git operations** - commits and archival occur ONLY at gate completion (preserves human-in-the-loop)
9. **Request gate completion** - If all gate proposals done: Output message for human approval to run `zeno gates complete <gate-id>`
   - Note: This single command will implement, commit, archive all proposals, and tag the gate (preserves human review at gate level only)

**Reference**

- `zeno proposal show <hash>` - Proposal details
- `zeno show <hash>` - Resolve hash to entity
- `zeno req deps <hash>` - Dependency chain
- Architecture docs are for gate-level planning, not proposal apply. Do not read them during apply.
