---
name: /zeno-apply
id: zeno-apply
category: Zeno
description: Implement an approved Zeno proposal and track task completion.
---
<!-- ZENO:START -->
**Guardrails**
- Favor straightforward, minimal implementations first; add complexity only when explicitly required.
- Keep changes tightly scoped to the proposal's defined tasks.
- Refer to `zeno/AGENTS.md` for project-specific conventions and `AGENTS.md` (root) for tool usage.
- Respect quality thresholds: 90% coverage, 0 security vulnerabilities, <0.01% lint error rate, 0 TypeScript errors.
- Wait for human approval before marking tasks complete if any automated checks fail.
- **Invoke status updates** at each workflow stage to maintain accurate project state.

**Steps**
Track these steps as TODOs and complete them one by one.

1. **Identify the proposal**
   - If the prompt includes a proposal hash (e.g., `#p01projconf01`) or filename (e.g., `01-project-configuration`), use that directly.
   - Otherwise, run `zeno proposal list` or inspect `zeno/proposals/active/` to identify the target.
   - Confirm the proposal status is `pending` before proceeding.

2. **Read proposal documentation**
   - Read the proposal file from `zeno/proposals/active/<name>.md` or use `zeno proposal show <hash>`.
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
   - Work through each Task in order (Task 1, Task 2, etc.).
   - For each task:
     - Read the **File(s)** and **Action** (create/modify/delete/refactor).
     - Implement the change following the description and **Acceptance** criteria.
     - Mark acceptance criteria as complete: `- [x]` when verified.
   - Keep edits minimal and focused; do not refactor beyond scope.

6. **Update requirement status**
   - For each requirement referenced in the proposal's **Requirement** field:
     - **Invoke**: `zeno req status <hash> implemented` when code is written
   - This tracks requirement progress independent of proposal status.

7. **Write tests**
   - Implement test tasks (usually last task in each proposal).
   - Aim for 90%+ coverage on touched files.
   - Run tests locally: `npm test` or equivalent.
   - After tests pass:
     - **Invoke**: `zeno req status <hash> tested` for each requirement with passing tests

8. **Run automated checks**
   - **Invoke**: `zeno proposal validate <hash>` to run full validation suite
   - Or execute manually:
     ```powershell
     npm run typecheck
     npm run lint
     npm test -- --coverage
     npm audit
     ```
   - All checks must pass before proceeding.
   - If checks fail, fix issues and re-validate.

9. **Request human approval**
   - Present validation results to user.
   - Wait for explicit approval or rejection.
   - On approval: **Invoke** `zeno proposal approve <hash>` (status: `in_progress` -> `completed`)
   - On rejection: **Invoke** `zeno proposal reject <hash>` (status: -> `rejected`)
   - If rejected, stop and await further instructions.

10. **Commit changes**
    - Use structured commit message format:
      ```
      type(scope): Brief description #hash

      - Task 1: [summary]
      - Task 2: [summary]

      Proposal: #<proposal-hash>
      Gate: <gate-id>
      Quality: coverage X%, security 0, lint Y%
      ```
    - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

11. **Move proposal to completed** (if applicable)
    - Move file from `zeno/proposals/active/<name>.md` to `zeno/proposals/completed/<hash>.md`.
    - Update proposal **Status** field to `completed` in the file.

12. **Check gate progress**
    - After proposal completion, check if all gate proposals are done.
    - If all proposals completed, notify user that gate may be ready:
      ```
      All proposals for Gate XX completed.
      Ready for gate completion: `zeno gates complete <gate-id>`
      ```

**Status Update Summary**

| Stage | Function Invoked | Status Transition |
|-------|------------------|-------------------|
| Begin work | `zeno proposal start <hash>` | pending -> in_progress |
| Code written | `zeno req status <hash> implemented` | pending -> implemented |
| Tests pass | `zeno req status <hash> tested` | implemented -> tested |
| Validation | `zeno proposal validate <hash>` | (runs checks) |
| Approved | `zeno proposal approve <hash>` | in_progress -> completed |
| Rejected | `zeno proposal reject <hash>` | -> rejected |

**Reference**
- Use `zeno proposal show <hash>` for proposal details during implementation.
- Use `zeno show <hash>` to resolve any hash reference to its entity.
- Use `zeno req deps <hash>` to verify dependency chains.
- Consult `zeno/architecture/*.md` for system context.
<!-- ZENO:END -->
