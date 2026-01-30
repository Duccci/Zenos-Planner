---
name: zeno-archive
description: Archive a completed artifact (gate or proposal) and update dependent artifacts.
agent: agent
---

<!-- ZENO:START -->
**Guardrails**
- For proposals: Only archive proposals with status `completed` (approved by human, all tasks done).
- For gates: Only archive gates with status `in_progress` that have all proposals archived.
- Verify all acceptance criteria are marked `[x]` before archiving proposals.
- Verify all requirements are status `tested` before archiving gates.
- Update all dependent artifacts (gates, requirements) as part of archival.
- Refer to `zeno/AGENTS.md` for project conventions and hash reference patterns.
- Preserve audit trail by documenting completion metadata in archived artifacts.
- **Invoke status updates** for requirements when archiving.

**Artifact Type Detection**
The command automatically detects artifact type based on input:
- **Gate**: IDs starting with `gate-` (e.g., `gate-01`, `gate-02-core-infrastructure`)
- **Proposal**: Hashes starting with `#` and typically `p` (e.g., `#p01projconf01`) or filenames in `zeno/proposals/gate-XX/`

**Steps**
Track these steps as TODOs using the manage_todo_list tool. **CRITICAL:**
- **Create TODO list with workflow steps** (listed below)
- **Mark each workflow step as in-progress when you begin, and mark it completed IMMEDIATELY after finishing**
- **Do not batch completions** - mark items completed as soon as they are done

1. **Identify the artifact to archive**
   - If the prompt includes a gate ID (e.g., `gate-01`), treat as gate archive.
   - If the prompt includes a proposal hash (e.g., `#p01projconf01`) or filename (e.g., `01-project-configuration`), treat as proposal archive.
   - If the conversation references an artifact loosely:
     - For gates: Run `zeno gates list` or inspect `zeno/gates/` to identify candidates.
     - For proposals: Run `zeno proposal list` or inspect `zeno/proposals/gate-XX/` to identify candidates.
   - Confirm which artifact the user intends before proceeding.
   - If no artifact can be identified, stop and ask for clarification.

2. **Route to appropriate workflow based on artifact type**

   **If archiving a GATE**, proceed to steps 2A-10A.
   **If archiving a PROPOSAL**, proceed to steps 2B-9B.

---

## GATE ARCHIVE WORKFLOW

2A. **Validate gate is ready for archive**
   - Read the gate PRD from `zeno/gates/gate-XX-name.md`.
   - Verify gate status is `in_progress`.
   - Check that all proposals for this gate are completed and archived:
     - List proposals in `zeno/proposals/archive/` that match this gate.
     - Verify all proposals have status `completed` and are archived.
     - Check gate document **Proposal Status** table.
   - Verify all requirements are status `tested`:
     - Run `zeno req list --gate <gate-id>` or check requirements in gate document.
     - All requirements should be `tested`, not `pending` or `implemented`.
   - If validation fails, report what's incomplete and stop.

3A. **Consolidate archived proposals**
   - Use consolidation utility: `src/utils/gate-consolidation.ts`.
   - Call `consolidateGateProposals(gateId)` to extract:
     - Requirements fulfilled (from proposal Requirement fields).
     - Lessons learned (from proposal Implementation Notes).
     - Next dependencies (from proposal Dependencies tables, type `blocks`).
     - High-level delta (from proposal Summary and Completion Summary).
   - Generate consolidation markdown using `generateConsolidationMarkdown()`.
   - Insert consolidation section into gate document (after **Proposal Status**, before **Notes**).

4A. **Update gate document status**
   - Change gate status from `in_progress` to `completed`.
   - Add completion date: `**Completed**: [DATE]`.
   - Update **Last Updated** date if present.
   - Mark all objectives as complete: `- [x]` instead of `- [ ]`.

5A. **Create completion summary in gate document**
   Add section before **Notes**:
   ```markdown
   ## Gate Completion Summary
   
   **Completed**: [DATE]  
   **Proposals Completed**: X  
   **Requirements Fulfilled**: Y  
   **Quality Metrics**: Coverage Z%, Security 0, Lint W%
   
   All proposals for this gate have been completed and archived. See **Consolidated Proposals Summary** section for detailed breadcrumbs.
   ```

6A. **Move gate document to archive folder**
   - Create archive directory if it doesn't exist: `zeno/gates/archive/`
   - Move gate document from `zeno/gates/gate-XX-name.md` to `zeno/gates/archive/gate-XX-name.md`
   - Verify the move succeeded
   - Update any references to the gate document path in related files if necessary

7A. **Create git tag for gate release**
   - Tag format: `gate-XX-name` (e.g., `gate-01-core-infrastructure`).
   - Tag message:
     ```
     Gate XX: [Gate Name]
     
     Completed: [DATE]
     Proposals: X
     Requirements: Y
     
     See zeno/gates/archive/gate-XX-name.md for details.
     ```
   - Use git command: `git tag -a gate-XX-name -m "[message]"`.

8A. **Update project state**
   - If database exists, update gate status to `completed` in database.
   - Update `current_gate_id` to next pending gate if available.
   - Record completion timestamp.

9A. **Commit gate archive**
   If auto-commit enabled:
   - Stage all changes: `git add -A`
   - Create commit: `chore(archive): Archive gate-XX - [Gate Name]`
   - Push commit and tag to remote

10A. **Summary output (Gate)**
   ```
   Archived Gate XX: [Gate Name]
   
   Status: in_progress -> completed
   Proposals consolidated: X
   Requirements fulfilled: Y
   Git tag created: gate-XX-name
   
   Consolidation added to: zeno/gates/archive/gate-XX-name.md
   Gate document moved to: zeno/gates/archive/
   
   Changes committed and pushed:
     - All gate implementation files (src/, bin/, tests/)
     - All proposals (zeno/proposals/archive/)
     - Gate documentation moved to archive folder
     - State files updated
     - Git tag pushed to remote
   
   Next steps:
     - Review consolidated proposals summary in archived gate document
     - Continue to next gate: `zeno gates start gate-XX+1`
   ```

---

## PROPOSAL ARCHIVE WORKFLOW

2B. **Validate proposal is ready for archive**
   - Read the proposal file from `zeno/proposals/gate-XX/<name>.md`.
   - Verify:
     - **Status** is `completed` (human approved).
     - All **Tasks** have acceptance criteria marked `- [x]`.
     - All automated checks passed.
   - If validation fails, report what's incomplete and stop.

3B. **Ensure requirements are updated**
   - Read the **Requirement** field from the proposal header.
   - For each requirement hash referenced:
     - **Invoke**: `zeno req status "<hash>" tested` (if tests passed).
     - Or verify status is already `tested`.
   - This ensures requirement tracking reflects completion.

4B. **Clean up the proposal document**
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

5B. **Update the parent gate**
   - Read the gate PRD from `zeno/gates/gate-XX-name.md`.
   - Check if all proposals for this gate are now completed/archived:
     - If yes, gate may be ready for archive (notify user).
     - If no, report remaining active proposals.

   Update gate document if applicable:
   ```markdown
   ## Proposal Status

   | Proposal | Status | Archived |
   |----------|--------|----------|
   | #p01projconf01 | completed | 2026-01-04 |
   | #p01errlogs02 | completed | pending archive |
   | #p01fileutil03 | in_progress | - |
   ```

6B. **Update dependencies**
   - Read the **Dependencies** table from the proposal.
   - For entries with type `blocks`:
     - Those proposals/requirements are now unblocked.
     - Notify user which proposals can now proceed.
   - Verify no circular dependencies created.

7B. **Move proposal to completed directory**
   - Rename file from `zeno/proposals/gate-XX/<name>.md` to `zeno/proposals/archive/<hash>.md` (if not already moved by approval).
   - Hash becomes the canonical filename (e.g., `p01projconf01.md`).
   - Verify the move succeeded.

8B. **Commit proposal archive**
   If auto-commit enabled:
   - Stage all changes: `git add -A`
   - Create commit: `chore(archive): Archive proposal #<hash>`
   - Push commit to remote

9B. **Check gate completion**
   After archiving, check if gate is ready for archive:
   - All proposals completed/archived?
   - All requirements status `tested`?
   - All quality gates met?
   
   If yes, prompt user:
   ```
   All proposals for Gate XX are completed.
   
   To archive the gate: `/zeno-archive gate-XX`
   This will:
   - Set gate status: in_progress -> completed
   - Consolidate proposals
   - Create git tag for the gate release
   ```

10B. **Summary output (Proposal)**
    ```
    Archived proposal #<hash>: [Title]

    Location: zeno/proposals/archive/<hash>.md
    Gate: gate-XX - [Gate Name]
    
    Requirements updated:
      - #req1: [Name] -> tested
      - #req2: [Name] -> tested

    Unblocked proposals:
      - #p02... (now ready for implementation)

    Gate status: [X/Y proposals completed]
    
    Changes committed and pushed:
      - All implementation files, tests, and artifacts included
      - Proposal moved to completed directory
      - Gate document updated
    
    Next steps:
      - If more proposals remain: `/zeno-apply #next-hash`
      - If gate complete: `/zeno-archive gate-XX`
    ```

**Consolidation Details (Gates)**

The consolidation process automatically extracts and aggregates:
- **Requirements Fulfilled**: All requirement hashes from proposal headers, deduplicated.
- **Lessons Learned**: Implementation notes from all proposals, deduplicated.
- **Next Dependencies**: All proposals/requirements unblocked by this gate (from dependency tables).
- **High-Level Delta**: Combined summaries, artifacts, and aggregate quality metrics.

This reduces context size while preserving critical breadcrumbs for future reference.

**Batch Archive**

To archive multiple proposals at once:
1. List all completed proposals: `zeno proposal list --status completed`.
2. For each proposal, run archive steps.
3. Group by gate for efficient gate/requirement updates.
4. Single summary at end with all archived proposals.

**Reference**
- Use `zeno gates list` to find gates ready for archive.
- Use `zeno gates show <gate-id>` to view gate details.
- Use `zeno proposal list --status completed` to find archivable proposals.
- Use `zeno proposal show "<hash>"` to verify proposal details.
- Use `zeno req show "<hash>"` to check requirement status after archive.
- Use `zeno req list --gate <id>` to verify all requirements tested.
- Consolidation utility: `src/utils/gate-consolidation.ts`.
- Archived artifacts are immutable; create new proposal if changes needed.
<!-- ZENO:END -->
