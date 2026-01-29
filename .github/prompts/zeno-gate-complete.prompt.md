---
name: zeno-gate-complete
description: Complete a gate by archiving it and consolidating associated proposals.
agent: agent
model: qwen3-coder
---

<!-- ZENO:START -->
**Guardrails**
- Only complete gates with status `in_progress` that have all proposals archived
- Verify all requirements are status `tested` before completing gate
- Consolidate proposals automatically as part of gate completion
- Create git tag for gate release
- Refer to `zeno/AGENTS.md` for project conventions and hash reference patterns
- **Invoke status updates** when completing gate operations

**Steps**
Track these steps as TODOs and complete them one by one.

1. **Identify the gate to complete**
   - If the prompt includes a gate ID (e.g., `gate-01`), use that directly
   - If the conversation references a gate loosely, run `zeno gates list` or inspect `zeno/gates/` to identify candidates
   - Confirm which gate the user intends before proceeding
   - If no gate can be identified, stop and ask for clarification

2. **Validate gate is ready for completion**
   - Read the gate PRD from `zeno/gates/gate-XX-name.md`
   - Verify gate status is `in_progress`
   - Check that all proposals for this gate are completed and archived:
     - List proposals in `zeno/proposals/completed/` that match this gate
     - Verify all proposals have status `completed` and are archived
     - Check gate document **Proposal Status** table
   - Verify all requirements are status `tested`:
     - Run `zeno req list --gate <gate-id>` or check requirements in gate document
     - All requirements should be `tested`, not `pending` or `implemented`
   - If validation fails, report what's incomplete and stop

3. **Consolidate archived proposals**
   - Use consolidation utility: `src/utils/gate-consolidation.ts`
   - Call `consolidateGateProposals(gateId)` to extract:
     - Requirements fulfilled (from proposal Requirement fields)
     - Lessons learned (from proposal Implementation Notes)
     - Next dependencies (from proposal Dependencies tables, type `blocks`)
     - High-level delta (from proposal Summary and Completion Summary)
   - Generate consolidation markdown using `generateConsolidationMarkdown()`
   - Insert consolidation section into gate document (after **Proposal Status**, before **Notes**)

4. **Update gate document status**
   - Change gate status from `in_progress` to `completed`
   - Add completion date: `**Completed**: [DATE]`
   - Update **Last Updated** date if present
   - Mark all objectives as complete: `- [x]` instead of `- [ ]`

5. **Create completion summary in gate document**
   Add section before **Notes**:
   ```markdown
   ## Gate Completion Summary
   
   **Completed**: [DATE]  
   **Proposals Completed**: X  
   **Requirements Fulfilled**: Y  
   **Quality Metrics**: Coverage Z%, Security 0, Lint W%
   
   All proposals for this gate have been completed and archived. See **Consolidated Proposals Summary** section for detailed breadcrumbs.
   ```

6. **Create git tag for gate release**
   - Tag format: `gate-XX-name` (e.g., `gate-01-core-infrastructure`)
   - Tag message:
     ```
     Gate XX: [Gate Name]
     
     Completed: [DATE]
     Proposals: X
     Requirements: Y
     
     See zeno/gates/gate-XX-name.md for details.
     ```
   - Use git command: `git tag -a gate-XX-name -m "[message]"`

7. **Update project state**
   - If database exists, update gate status to `completed` in database
   - Update `current_gate_id` to next pending gate if available
   - Record completion timestamp

8. **Commit gate completion**
   If auto-commit enabled, create commit:
   ```
   chore(gate): Complete gate-XX - [Gate Name]
   
   - Status: in_progress -> completed
   - Proposals consolidated: X
   - Git tag: gate-XX-name
   - Requirements fulfilled: Y
   
   Gate: gate-XX
   ```

9. **Summary output**
   ```
   Completed Gate XX: [Gate Name]
   
   Status: in_progress -> completed
   Proposals consolidated: X
   Requirements fulfilled: Y
   Git tag created: gate-XX-name
   
   Consolidation added to: zeno/gates/gate-XX-name.md
   
   Next steps:
   - Review consolidated proposals summary in gate document
   - Continue to next gate: `zeno gates start gate-XX+1`
   ```

**Consolidation Details**

The consolidation process automatically extracts and aggregates:
- **Requirements Fulfilled**: All requirement hashes from proposal headers, deduplicated
- **Lessons Learned**: Implementation notes from all proposals, deduplicated
- **Next Dependencies**: All proposals/requirements unblocked by this gate (from dependency tables)
- **High-Level Delta**: Combined summaries, artifacts, and aggregate quality metrics

This reduces context size while preserving critical breadcrumbs for future reference.

**Status Update Summary**

| Action | Function Invoked | Status Change |
|--------|------------------|---------------|
| Complete gate | `zeno gates complete <id>` | in_progress -> completed |
| Consolidate proposals | Automatic during completion | (adds section to gate doc) |
| Create git tag | `git tag -a` | (creates release tag) |

**Reference**
- Use `zeno gates list` to find gates ready for completion
- Use `zeno gates show <gate-id>` to view gate details
- Use `zeno proposal list --gate <id> --status completed` to verify all proposals archived
- Use `zeno req list --gate <id>` to verify all requirements tested
- Consolidation utility: `src/utils/gate-consolidation.ts`
<!-- ZENO:END -->
