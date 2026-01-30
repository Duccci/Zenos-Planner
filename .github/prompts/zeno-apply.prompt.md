---
name: zeno-apply
description: Implement an approved Zeno proposal and track task completion.
agent: agent
---

<!-- ZENO:START -->
**Guardrails**
- Favor straightforward, minimal implementations first; add complexity only when explicitly required.
- Keep changes tightly scoped to the proposal's defined tasks.
- Respect quality thresholds: 90% coverage, 0 security vulnerabilities, <0.01% lint error rate, 0 TypeScript errors.
- Wait for human approval before marking tasks complete if any automated checks fail.
- **Invoke status updates** at each workflow stage to maintain accurate project state.
- Refer to `zeno/AGENTS.md` for project-specific conventions and `AGENTS.md` (root) for tool usage.

**Steps**
Track these steps as TODOs using the manage_todo_list tool. **CRITICAL:**
- **Create TODO list with TWO levels**: Workflow steps (listed below) AND proposal tasks (from gate proposal document)
- **Mark each workflow step as in-progress when you begin, and mark it completed IMMEDIATELY after finishing**
- **Mark each proposal task as in-progress when you begin, and mark it completed IMMEDIATELY after finishing**
- **Do not batch completions** - mark items completed as soon as they are done

1. **Identify the proposal**
   - If the prompt includes a proposal hash (e.g., `#p01projconf01`) or filename (e.g., `01-project-configuration`), use that directly.
   - Otherwise, run `zeno proposal list` or inspect `zeno/proposals/gate-XX/` to identify the target.
   - Confirm the proposal status is `pending` before proceeding.

2. **Read proposal documentation**
   - Read the proposal file from `zeno/proposals/gate-XX/<name>.md` or use `zeno proposal show <hash>`.
   - Review: Summary, Context, Dependencies, all Tasks with Acceptance criteria, Files Affected.
   - Note any blocked proposals (check Dependencies table for `blocks` entries).

3. **Check dependencies**
   - Verify all `requires` dependencies are complete (status: `completed`).
   - If dependencies are incomplete, stop and report which proposals must be implemented first.
   - Use `zeno req deps <hash>` for dependency graph if needed.

4. **Start proposal implementation**
   - **Invoke**: `zeno proposal start <hash>` to set status: `pending` -> `in_progress`
   - This signals work has begun on this proposal.

5. **Implement tasks sequentially**
   - **Create TODO items** for each Task listed in the proposal (Task 1, Task 2, etc.)
   - Work through each Task in order:
     - **Mark the task as in-progress** in your TODO list before starting
     - Read the **File(s)** and **Action** (create/modify/delete/refactor)
     - Implement the change following the description and **Acceptance** criteria
     - Mark acceptance criteria as complete in the proposal file: `- [x]` when verified
     - **Mark the task as completed** in your TODO list immediately after finishing
   - Keep edits minimal and focused; do not refactor beyond scope.
   - **Mark this workflow step completed** after ALL proposal tasks are done (not before)

6. **Update requirements and run tests**
   - For each requirement referenced in the proposal's **Requirement** field:
     - **Invoke**: `zeno req status <hash> implemented` when code is written
     - **Invoke**: `zeno req status <hash> tested` after tests pass
   - Implement test tasks (usually last task in each proposal).
   - Aim for 90%+ coverage on touched files.
   - Run tests locally: `npm test` or equivalent.

7. **Run automated checks**
   - **Invoke**: `zeno proposal validate <hash>` to run full validation suite
   - Or execute manually: `npm run typecheck && npm run lint && npm test -- --coverage && npm audit`
   - All checks must pass before proceeding.
   - If checks fail, fix issues and re-validate.

8. **Request human approval**
   - Present validation results to user.
   - Wait for explicit approval or rejection.
   - On approval: **Invoke** `zeno proposal approve <hash>` (status: `in_progress` -> `completed`)
   - On rejection: **Invoke** `zeno proposal reject <hash>` (status: -> `rejected`)
   - If rejected, stop and await further instructions.

9. **Commit changes**
    - Use structured commit message format: `type(scope): Brief description #hash`
    - Include proposal and gate references in commit body
    - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

10. **Move proposal to completed** (if applicable)
    - Move file from `zeno/proposals/gate-XX/<name>.md` to `zeno/proposals/archive/<hash>.md` (automatic on approval).
    - Update proposal **Status** field to `completed` in the file.

11. **Check gate progress**
    - After proposal completion, check if all gate proposals are done.
    - If all proposals completed, notify user that gate may be ready:
      ```
      All proposals for Gate XX completed.
      Ready for gate completion: `zeno gates complete <gate-id>`
      ```

**Reference**
- Use `zeno proposal show <hash>` for proposal details during implementation.
- Use `zeno show <hash>` to resolve any hash reference to its entity.
- Use `zeno req deps <hash>` to verify dependency chains.
- Consult `zeno/architecture/*.md` for system context.
<!-- ZENO:END -->
