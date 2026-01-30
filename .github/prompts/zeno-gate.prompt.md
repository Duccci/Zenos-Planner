---
name: zeno-gate
description: Dynamically generate or regenerate gates to rebaseline project scope.
agent: agent
---

<!-- ZENO:START -->
**Guardrails**
- Do not write implementation code during gate generation. Only create gate PRDs and update project artifacts.
- Gates represent concrete deliverables, not percentages or time estimates.
- Refer to `zeno/AGENTS.md` for project conventions and `zeno/PROJECT_PRD.md` for end state.
- Identify vague scope definitions and ask clarifying questions before generating gates.
- Preserve completed gates during rebaseline; only regenerate pending/future gates.
- Each gate must have measurable completion criteria and clear scope boundaries.
- **Invoke status updates** when starting or completing gate operations.
- **Requirements-first workflow**: Requirements are primarily defined at project inception (`zeno init`) before gate generation. Gates attribute existing requirements to gates. Requirements can be updated or added during rebaseline/rescope operations, but init is the primary source. Requirements are decomposed into tasks during proposal generation.

**Steps**
Track these steps as TODOs using the manage_todo_list tool. **CRITICAL:**
- **Create TODO list with workflow steps** (listed below)
- **Mark each workflow step as in-progress when you begin, and mark it completed IMMEDIATELY after finishing**
- **Do not batch completions** - mark items completed as soon as they are done

1. **Determine operation mode**
   - **New gates**: Generate gates for a fresh project or extend existing roadmap
   - **Rebaseline**: Regenerate future gates based on changed scope or rescope request
   - **Single gate**: Generate or update a specific gate
   - If unclear, ask user which operation is intended.

2. **Gather context**
   - Read `zeno/PROJECT_PRD.md` for end state definition and project scope
   - Read `zeno/AGENTS.md` for project conventions
   - **Verify requirements exist**: Run `zeno req list --project` or query `zeno/.zeno/requirements.db` to confirm project-level requirements are defined
   - If requirements don't exist for new projects, STOP and inform user: Requirements should be defined at project inception (`zeno init`) before gates can be generated
   - For rebaseline operations: Requirements may be updated or added as part of rescoping
   - Run `zeno gates list` or inspect `zeno/gates/` for existing gates
   - Identify current gate status (pending, in_progress, completed)
   - Note any completed gates that must be preserved

3. **Analyze current state**
   - For **new projects**: Analyze existing codebase if present
     - Inspect `src/`, `package.json`, existing architecture
     - Run `zeno analyze` if available
     - Identify what infrastructure already exists
   - For **rebaseline**: Determine the rebaseline point
     - Find last completed gate (anchor point)
     - Identify what changed (scope, requirements, end state)
     - Document the rescope reason for audit trail

4. **Define gate boundaries using Zeno's methodology**
   Apply iterative decomposition:
   - Start with end state from `PROJECT_PRD.md`
   - Review existing project-level requirements (from step 2)
   - Decompose into major milestones that progressively approach completion
   - Each gate should:
     - Represent concrete, testable deliverables
     - Build on previous gate's capabilities
     - Enable future gates
     - Be completable as a coherent unit
     - **Attribute existing requirements** (do not create new requirements here)

   **Gate sizing heuristics**:
   - 3-8 requirements per gate (avoid scope sprawl)
   - Clear dependency chain (later gates depend on earlier)
   - Parallel gates only when truly independent
   - Infrastructure/foundation gates precede feature gates
   - **Requirements attribution**: Map project-level requirements to gates based on logical grouping and dependencies

5. **Generate gate sequence**
   For each gate, determine:
   ```
   Sequence: [N of Total]
   Name: [Descriptive, action-oriented name]
   Type: feature | quality | rescope
   Status: pending
   Dependencies: [Which gates this depends on]
   Objectives: [3-5 measurable outcomes]
   ```

   **Gate types**:
   - `feature`: Delivers new capabilities
   - `quality`: Improves existing code (refactoring, testing, docs)
   - `rescope`: Documents scope change (auto-generated during rebaseline)

6. **Create gate PRD files**
   For each gate, create `zeno/gates/gate-XX-name.md` using the template structure from `templates/md-templates/gate-prd-template.md`:

   ```markdown
   # Gate [XX]: [Gate Name]

   **Status**: pending  
   **Type**: [feature | quality | rescope]  
   **Created**: [DATE]  
   **Sequence**: [X of Y]  
   **Hash**: #g[XX][abbrev]

   ## Overview
   [2-3 sentences: what this gate accomplishes]

   ## Objectives
   - [ ] [Measurable objective 1]
   - [ ] [Measurable objective 2]

   ## Context
   [What was completed before, what this enables, scope boundaries]

   ## Requirements
   [Table of attributed requirements with hashes, names, types, priorities, status]

   ## Technical Decisions
   [Gate-specific choices]

   ## Architecture Updates
   [Components to create/modify]

   ## Dependencies
   [Depends on/blocks other gates]

   ## Implementation Steps
   [3-6 ordered steps]

   ## Gate Completion Criteria
   [Measurable completion criteria]
   ```

7. **Handle rebaseline-specific artifacts**
   If rebaselining:
   - Create a **rescope gate** to document the change:
     ```markdown
     # Gate [XX]: Rescope - [Reason]

     **Status**: completed  
     **Type**: rescope  
     **Created**: [DATE]

     ## Rescope Summary
     - **Previous End State**: [Old goal]
     - **New End State**: [Updated goal]
     - **Reason**: [Why the change]
     - **Impact**: [Gates affected]

     ## Preserved Gates
     [List gates that remain unchanged]

     ## Regenerated Gates
     [List gates that were regenerated]

     ## Deprecated Gates
     [List gates that were removed]
     ```
   - Archive deprecated gate files to `.local/deprecated-gates/`
   - Update `zeno/PROJECT_PRD.md` with new end state if changed

8. **Update architecture diagrams**
   - Update `zeno/architecture/gate-roadmap.md` with new gate sequence
   - Show parallel relationships where gates can execute simultaneously
   - Update `zeno/architecture/system-overview.md` if components changed
   - Regenerate with `zeno arch generate` when available

9. **Attribute requirements to gates**
   **PRIMARY SOURCE**: Requirements are primarily defined at project inception (`zeno init`). This step attributes existing requirements to gates.
   
   For each gate:
   - **Query existing project-level requirements** via `zeno req list --project`
   - **Map requirements to gates** based on:
     - Logical grouping (related requirements together)
     - Dependency order (foundation requirements in earlier gates)
     - Gate objectives (requirements that fulfill gate objectives)
   - **Create requirement-gate associations** in the database:
     - Update `requirements.gate_id` for gate-specific requirements
     - Set `requirements.project_requirement_id` to link gate requirements to project requirements
     - Set `requirements.source` to 'inherited' if derived from project requirement, 'generated' if gate-specific
   - **For rebaseline operations**: Requirements may be updated or added as part of rescoping
     - Update existing requirements if scope changed
     - Add new requirements if rescope introduces new capabilities
     - Document requirement changes in rescope gate
   - **Document in gate PRD**: List attributed requirements with their hashes
   - **Note**: Requirements are decomposed into individual tasks during proposal generation (`/zeno-proposal`), not during gate generation
   
   **If requirements don't exist for new projects**: STOP gate generation and inform user that requirements should be defined first at project inception (`zeno init`).

10. **Validate gate structure**
    - Each gate has: Hash, Status (`pending`), Objectives, Requirements table, Dependencies
    - **Each gate has at least one attributed requirement** (verify via `zeno req list --gate <id>`)
    - All attributed requirements exist in database (no orphaned references)
    - Dependencies form a DAG (no circular references)
    - Sequence numbers are contiguous
    - First gate has no dependencies (or only external)
    - Final gate achieves end state
    - **Requirements coverage**: All project-level requirements are attributed to at least one gate

11. **Summary output**
    After generating gates, provide:
    ```
    Generated/Updated X gates:

    Gate 1: [Name] (#hash)
      Status: pending
      Objectives: [count]
      Dependencies: none
      Blocks: Gate 2, Gate 3

    Gate 2: [Name] (#hash)
      Status: pending
      Objectives: [count]
      Dependencies: Gate 1
      Blocks: Gate 4

    ...

    Dependency order: Gate 1 -> Gate 2 -> Gate 3 -> ...
    Parallel opportunities: [Gate 2, Gate 3 can run in parallel]

    End state: [From PROJECT_PRD.md]

    To start work on first gate: `zeno gates start gate-01`
    ```

**Status Values Reference**

| Entity | Status Values | Notes |
|--------|---------------|-------|
| Gate | pending, in_progress, completed, rejected | Set by `zeno gates start/complete` |
| Requirement | pending, implemented, tested | Set by `zeno req status` |
| Proposal | pending, in_progress, completed, rejected | Set by `zeno proposal start/approve/reject` |

**Rebaseline Scenarios**

| Scenario | Action |
|----------|--------|
| Scope expansion | Add new gates after existing sequence |
| Scope reduction | Mark gates as `rejected` or remove, create rescope gate |
| Pivot/redirect | Create rescope gate, regenerate from current position |
| Mid-gate change | Complete or reject current gate, then rebaseline |
| Dependency change | Update `depends_on` fields, verify DAG validity |

**Requirements-First Workflow**

Requirements are primarily defined at project inception (`zeno init`) before gates. Gates attribute existing requirements to gates. Requirements can be updated during rebaseline but init is the primary source. Requirements are decomposed into tasks during proposal generation.

**Reference**
- Use `zeno/PROJECT_PRD.md` for end state and project scope.
- Use `templates/md-templates/gate-prd-template.md` for structural reference (exclude HTML comments from generated gates).
- Use `zeno/architecture/gate-roadmap.md` to visualize gate sequence.
- Consult completed gates in `zeno/gates/` to maintain consistency.
- Review `zeno/AGENTS.md` for project conventions.
- Verify requirements exist: `zeno req list --project` before generating gates.
<!-- ZENO:END -->
