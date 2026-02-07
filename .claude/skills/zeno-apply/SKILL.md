---
name: zeno-apply
description: Implement an approved Zeno proposal and track task completion.
---

**Guardrails**

- Implement straightforward solutions; add complexity only when required
- Keep changes tightly scoped to proposal tasks
- Only modify files and target objects explicitly listed in the proposal's **Files Affected** or the task description (for example, specific functions, classes, modules). Avoid unrelated edits or large refactors that extend beyond the stated scope.
- Limit test changes to those that directly validate the updated target objects; do not broadly alter the test suite without explicit approval.
- If a task requires expanding the scope (additional files, refactors, or cross-cutting changes), document the proposed additions in the implementation output and obtain human approval before making those changes.
- Review dependencies for context only; do not act on, implement, or pre-empt work that belongs to other proposals or later gates. If a dependency is incomplete and belongs to future work, document it as a blocker in the proposal and notify a human for clarification.
- Use quality thresholds from `config_get()` instead of hard-coded values
- Wait for human approval if automated checks fail
- **NEVER perform git operations during apply phase** - commits occur ONLY at gate completion
- **DO NOT use git add, git commit, or any git commands** during proposal implementation
- **DO NOT use manage_todo_list tool** if it triggers git operations - use simple text tracking instead
- **DO NOT rename proposal files to their hash values**
- **DO NOT move proposal files to the archive directory**

**Functions**

- `getTemplate(name)` - Load template by name
- `config_get()` - Get project configuration
- `manage_todo_list()` - Track task progress (mark in-progress, then completed) - AVOID if it triggers git operations

**Steps**
Track progress by outputting step completion messages. **DO NOT use manage_todo_list if it triggers git operations.**

1. **Identify proposal** - Use hash or filename to locate proposal
2. **Read proposal** - Review Summary, Context, Dependencies, Tasks, Files Affected
3. **Check dependencies** - Review the proposal's `Dependencies` and gate context for situational awareness. Use them for context only and do not implement or modify dependencies that belong to other proposals or later gates. If a dependency is incomplete or scheduled for a later gate, document it as a blocker in the proposal and notify a human for clarification. Continue implementing tasks that do not depend on the incomplete item; if the blocker prevents any meaningful progress, document it and escalate.
4. **Start proposal** - Invoke: `zeno proposal start <hash>`
5. **Implement tasks** - For each task in the proposal:
   - Output: "Starting task: [task description]"
   - Implement the task
   - Verify acceptance criteria are met
   - Update the proposal markdown **immediately after completing each task**:
     - Mark the task's acceptance items as met (change `- [ ]` to `- [x]`), and update any `completed` flags if the proposal schema is represented in structured metadata.
     - Add or update a **Completion Summary** section (`## Completion Summary`) that includes at minimum:
       - `**Tasks Completed**: X/Y` (update X as tasks are completed)
       - `**Files Modified**: N`
       - `**Test Coverage**: XX%`
       - `### Artifacts Created` (list any new artifacts)
       - `### Quality Metrics` (coverage, security, lint/type errors)
     - Only edit the proposal file and files explicitly listed in **Files Affected** unless you have documented the scope expansion and obtained human approval.
   - Output: "Completed task: [task description]"
6. **Update requirements** - For each requirement: either run `zeno req status <hash> implemented` or note that `zeno proposal approve <hash>` will automatically set the associated requirement to `implemented` when applicable. Final verification that requirement status becomes `tested` occurs during gate completion (`zeno gates complete <gate-id>`).
7. **Run checks** - Invoke: `zeno proposal validate <hash>` and fix failures
   - Before approving, **confirm the proposal file contains an up-to-date Completion Summary and all task acceptance boxes are checked**; consolidation and gate metrics are generated from this content.
   - **DO NOT perform any git operations** - let human decide when to commit via gate completion
8. **Request gate completion** - If all gate proposals done: Output message for human approval to run `zeno gates complete <gate-id>`
   - Note: Git commits occur ONLY at gate completion, not during proposal approval (preserves human-in-the-loop)

**Reference**

- `zeno proposal show <hash>` - Proposal details
- `zeno show <hash>` - Resolve hash to entity
- `zeno req deps <hash>` - Dependency chain
- `zeno/architecture/*.md` - System context
