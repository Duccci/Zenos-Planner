---
name: zeno-proposal
description: Generate proposal documents from a Gate PRD for implementation.
agent: agent
model: qwen3-coder
---

<!-- ZENO:START -->
**Guardrails**
- Do not write implementation code during the proposal stage. Only create proposal documents.
- Keep proposals tightly scoped to single, coherent work units.
- Refer to `zeno/AGENTS.md` for project-specific conventions and hash reference patterns.
- Identify vague or ambiguous details in the Gate PRD and ask clarifying questions before creating proposals.
- Respect dependency ordering; proposals that depend on others must reference them in the Dependencies table.
- Use the proposal template in `templates/md-templates/proposal-template.md` as the structural guide.
- **Set initial status to `pending`** for all new proposals.

**Steps**
Track these steps as TODOs and complete them one by one.

1. **Identify the gate**
   - If the prompt specifies a gate (e.g., `gate-01`, `#g01c0re1nfra`), locate `zeno/gates/gate-XX-name.md`.
   - Otherwise, run `zeno gates list` or inspect `zeno/gates/` to identify the target gate.
   - Confirm the gate status is `pending` or `in_progress`.

2. **Start gate if pending**
   - If gate status is `pending`:
     - **Invoke**: `zeno gates start <gate-id>` to set status: `pending` -> `in_progress`
   - This signals work has begun on this gate.

3. **Read and analyze the Gate PRD**
   - Read the full Gate PRD file: `zeno/gates/gate-XX-name.md`.
   - Extract key information:
     - **Objectives**: High-level goals for the gate
     - **Requirements Table**: Hash references, names, types, priorities
     - **Implementation Steps**: Ordered work units with descriptions
     - **Technical Decisions**: Choices that affect implementation
     - **Architecture Updates**: Components to create/modify
     - **Dependencies**: What this gate requires and blocks
   - Note any ambiguities or gaps requiring clarification.

4. **Review existing codebase and proposals**
   - Inspect `zeno/proposals/active/` for existing proposals in this gate.
   - Check related code via `ls src/` and `rg` searches to ground proposals in current state.
   - Run `zeno req list --gate <id>` if CLI is available.
   - Identify what already exists vs. what needs to be created.

5. **Decompose into proposals**
   - Map each **Implementation Step** from the Gate PRD to one or more proposals.
   - Grouping strategy:
     - One proposal per cohesive work unit (typically 1-5 files)
     - Tests belong in the same proposal as the code they test
     - Configuration changes can be grouped if logically related
   - Establish ordering based on dependencies (later proposals reference earlier ones).
   - Assign sequential filenames: `01-name.md`, `02-name.md`, etc.

6. **Generate proposal files**
   For each proposal, create `zeno/proposals/active/XX-name.md` using this structure:

   ```markdown
   # Proposal: [Descriptive Title]

   **Hash**: #p[gate][seq][abbrev]  
   **Gate**: gate-XX - [Gate Name]  
   **Requirement**: #[hash1], #[hash2] (from Requirements table)  
   **Status**: pending  
   **Created**: [DATE]

   ---

   ## Summary

   [2-3 sentences: what this accomplishes and why it matters for the gate.]

   ---

   ## Context

   ### Requirements Context

   This proposal implements tasks derived from requirements. Requirements are primarily defined during `zeno init` at project inception and attributed to gates during gate generation. Requirements may be updated or added during rebaseline/rescope operations, but init is the primary source. This proposal breaks down the referenced requirement(s) into individual implementation tasks.

   ### Why This Change

   [Reference the gate objective or requirement this addresses.]

   ### Dependencies

   | Hash | Type | Description |
   |------|------|-------------|
   | #[hash] | requires | [Proposal/requirement this depends on] |
   | #[hash] | blocks | [Proposal/requirement this unblocks] |

   ---

   ## Tasks

   ### Task 1: [Task Title]

   **File(s)**: `[path/to/file.ts]`  
   **Action**: create | modify | delete | refactor

   [2-4 lines describing what to implement.]

   **Acceptance**:
   - [ ] [Specific, verifiable condition]
   - [ ] [Another condition]

   ---

   [Repeat for each task]

   ---

   ## Files Affected

   | File | Action | Description |
   |------|--------|-------------|
   | `src/[path]` | create/modify | [Brief description] |
   | `tests/[path]` | create/modify | [Test description] |

   ---

   ## Implementation Notes

   [Optional: Technical guidance, patterns to follow, edge cases.]

   ---

   ## Rollback

   **If rejected or failed**: [How to revert, or "Delete created files"]
   ```

7. **Establish dependency chain**
   - First proposal in a gate: `*No dependencies - first proposal in gate.*`
   - Subsequent proposals: Reference earlier proposals with `requires` type
   - Update `blocks` entries to show what each proposal enables
   - Verify no circular dependencies exist.

8. **Validate proposal structure**
   - Each proposal has: Hash, Gate, **Status: pending**, Summary, Tasks, Files Affected
   - Each task has: File(s), Action, description, Acceptance criteria
   - All hash references are valid format (`#[a-z0-9]{8,16}`)
   - Dependencies form a directed acyclic graph (DAG)

9. **Cross-reference with architecture**
   - Read `zeno/architecture/system-overview.md` to understand component placement
   - Verify file paths in proposals match expected architecture locations
   - Reference architecture diagrams in proposals if helpful for context

10. **Summary output**
    After generating all proposals, provide a summary:
    ```
    Generated X proposals for Gate XX:

    1. XX-name.md (#hash) - Status: pending
       Summary: [Brief description]
       Requires: none
       Blocks: #hash2, #hash3

    2. XX-name.md (#hash) - Status: pending
       Summary: [Brief description]
       Requires: #hash1
       Blocks: #hash3

    ...

    Dependency order: #hash1 -> #hash2 -> #hash3 -> ...

    To implement first proposal: `/zeno-apply #hash1`
    ```

**Status Lifecycle**

| Stage | Status | Set By |
|-------|--------|--------|
| Proposal created | pending | /zeno-proposal (this command) |
| Implementation started | in_progress | `zeno proposal start <hash>` |
| Checks pass + approved | completed | `zeno proposal approve <hash>` |
| Human rejects | rejected | `zeno proposal reject <hash>` |

**Reference**
- Use `zeno/gates/gate-XX-name.md` as the authoritative source for each gate.
- Use `templates/md-templates/proposal-template.md` for structural reference.
- Use `zeno req show <hash>` to get detailed requirement information.
- Consult `zeno/architecture/*.md` for component locations and data flow.
- Inspect existing proposals in `zeno/proposals/active/` to maintain consistency.
<!-- ZENO:END -->
