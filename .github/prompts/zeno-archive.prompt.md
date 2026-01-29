---
name: zeno-archive
description: Archive a completed proposal and update dependent gates and requirements.
agent: agent
model: qwen3-coder
---

<!-- ZENO:START -->
**Guardrails**
- Only archive proposals with status `completed` (approved by human, all tasks done).
- Verify all acceptance criteria are marked `[x]` before archiving.
- Update all dependent artifacts (gates, requirements) as part of archival.
- Refer to `zeno/AGENTS.md` for project conventions and hash reference patterns.
- Preserve audit trail by documenting completion metadata in archived proposal.
- **Invoke status updates** for requirements when archiving.

**Steps**
Track these steps as TODOs and complete them one by one.

1. **Identify the proposal to archive**
   - If the prompt includes a proposal hash (e.g., `#p01projconf01`) or filename (e.g., `01-project-configuration`), use that directly.
   - If the conversation references a proposal loosely, run `zeno proposal list` or inspect `zeno/proposals/active/` to identify candidates.
   - Confirm which proposal the user intends before proceeding.
   - If no proposal can be identified, stop and ask for clarification.

2. **Validate proposal is ready for archive**
   - Read the proposal file from `zeno/proposals/active/<name>.md`.
   - Verify:
     - **Status** is `completed` (human approved)
     - All **Tasks** have acceptance criteria marked `- [x]`
     - All automated checks passed
   - If validation fails, report what's incomplete and stop.

3. **Ensure requirements are updated**
   - Read the **Requirement** field from the proposal header.
   - For each requirement hash referenced:
     - **Invoke**: `zeno req status <hash> tested` (if tests passed)
     - Or verify status is already `tested`
   - This ensures requirement tracking reflects completion.

4. **Clean up the proposal document**
   Update the proposal file with completion metadata:
   ```markdown
   **Status**: completed  
   **Implemented**: [DATE]  
   **Archived**: [DATE]  
   **Archived By**: [git user.name or "system"]
   ```

   Add **Completion Summary** section before Rollback:
   ```markdown
   ## Completion Summary

   **Tasks Completed**: [X/X]  
   **Files Modified**: [count]  
   **Test Coverage**: [X%]  
   **Commits**: [commit hash(es)]

   ### Artifacts Created
   - `src/path/to/file.ts` - [Brief description]
   - `tests/path/to/file.test.ts` - [Brief description]

   ### Quality Metrics
   - Coverage: [X%] (threshold: 90%)
   - Security: 0 vulnerabilities
   - Lint errors: [X] (threshold: <0.01%)
   - Type errors: 0
   ```

5. **Update the parent gate**
   - Read the gate PRD from `zeno/gates/gate-XX-name.md`.
   - Check if all proposals for this gate are now completed/archived:
     - If yes, gate may be ready for completion (notify user)
     - If no, report remaining active proposals

   Update gate document if applicable:
   ```markdown
   ## Proposal Status

   | Proposal | Status | Archived |
   |----------|--------|----------|
   | #p01projconf01 | completed | 2026-01-04 |
   | #p01errlogs02 | completed | pending archive |
   | #p01fileutil03 | in_progress | - |
   ```

6. **Update dependencies**
   - Read the **Dependencies** table from the proposal.
   - For entries with type `blocks`:
     - Those proposals/requirements are now unblocked
     - Notify user which proposals can now proceed
   - Verify no circular dependencies created.

7. **Move proposal to completed directory**
   - Rename file from `zeno/proposals/active/<name>.md` to `zeno/proposals/completed/<hash>.md`.
   - Hash becomes the canonical filename (e.g., `p01projconf01.md`).
   - Verify the move succeeded.

8. **Commit archive changes**
   If auto-commit enabled, create commit:
   ```
   chore(archive): Archive proposal #<hash>

   - Moved to zeno/proposals/completed/
   - Updated gate: gate-XX
   - Requirements marked tested: #req1, #req2
   
   Proposal: #<proposal-hash>
   Gate: <gate-id>
   ```

9. **Check gate completion**
   After archiving, check if gate is ready for completion:
   - All proposals completed/archived?
   - All requirements status `tested`?
   - All quality gates met?
   
   If yes, prompt user:
   ```
   All proposals for Gate XX are completed.
   
   To complete the gate: `zeno gates complete <gate-id>`
   This will:
   - Set gate status: in_progress -> completed
   - Create git tag for the gate release
   ```

10. **Summary output**
    ```
    Archived proposal #<hash>: [Title]

    Location: zeno/proposals/completed/<hash>.md
    Gate: gate-XX - [Gate Name]
    
    Requirements updated:
      - #req1: [Name] -> tested
      - #req2: [Name] -> tested

    Unblocked proposals:
      - #p02... (now ready for implementation)

    Gate status: [X/Y proposals completed]
    
    Next steps:
    - If more proposals remain: `/zeno-apply #next-hash`
    - If gate complete: `zeno gates complete <gate-id>`
    ```

**Status Update Summary**

| Action | Function Invoked | Status Change |
|--------|------------------|---------------|
| Verify requirements | `zeno req status <hash> tested` | implemented -> tested |
| Complete gate | `zeno gates complete <id>` | in_progress -> completed |

**Batch Archive**

To archive multiple proposals at once:
1. List all completed proposals: `zeno proposal list --status completed`
2. For each proposal, run archive steps
3. Group by gate for efficient gate/requirement updates
4. Single summary at end with all archived proposals

**Reference**
- Use `zeno proposal list --status completed` to find archivable proposals.
- Use `zeno proposal show <hash>` to verify proposal details.
- Use `zeno req show <hash>` to check requirement status after archive.
- Use `zeno gates show <gate-id>` to check gate progress.
- Archived proposals are immutable; create new proposal if changes needed.
<!-- ZENO:END -->
