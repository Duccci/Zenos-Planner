---
name: zeno-gate
description: Dynamically generate or regenerate gates to rebaseline project scope.
agent: agent
---

<!-- ZENO:START -->

**Guardrails**

- Create gate PRDs and update artifacts only; no implementation code
- Gates are concrete deliverables, not percentages or time estimates
- All gate objectives must have unchecked `[ ]` boxes; only completed gates have `[x]`
- Requirements-first: defined at project inception; gates attribute existing requirements
- Identify vague scopes and ask clarifying questions before proceeding
- Review dependencies for context only; do not implement or pre-empt work that belongs to other proposals or later gates. Document incomplete dependencies and notify a human for clarification.

**Functions**

- `getTemplate('gate-prd-template')` - Load gate PRD structure
- `getTemplatesByCategory(category)` - Get templates by type
- `config_get()` - Get project configuration (returns qualityThresholds, git settings, version)

**MCP Tools Available**

- `gates_action` - Unified gate lifecycle tool
  - Actions: list, show, create, start, complete, regenerate
  - Example (create): `{ "action": "create", "payload": { "gateId": "gate-05", "name": "API Integration", "type": "feature", "sequence": 5, "objectives": [...] } }`
  - Example (start): `{ "action": "start", "payload": { "gateId": "gate-03" } }`
- Validators run automatically on create/complete actions (dependency checks, circular dependency detection)

**Steps**
Mark each step as in-progress, then completed immediately after finishing.

1. **Determine mode** - New gates, rebaseline, or single gate update?
2. **Gather context** - Read PROJECT_PRD.md and AGENTS.md; verify requirements exist
3. **Analyze state** - For new: check codebase; for rebaseline: find anchor point
4. **Define boundaries** - Decompose end state; 3-8 requirements per gate; clear dependencies. Treat dependencies as context only; do not implement or pre-empt later gates' work. If dependencies are incomplete, document them as blockers and notify a human for clarification.
5. **Generate sequence** - Sequence, Name, Type, Dependencies, Objectives for each gate
6. **Create PRD files** - Use template structure for `zeno/gates/gate-XX-name.md`
7. **Handle rebaseline** - Create rescope gate if scope changed; archive deprecated gates
8. **Update diagrams** - Update gate-roadmap.md; show parallel opportunities
9. **Attribute requirements** - Map project requirements to gates; verify all attributed
10. **Validate structure** - Verify hash, status, requirements, no circular dependencies
11. **Output summary** - Show gate sequence, dependencies, end state

**Status Reference**

- Gate: pending, in_progress, completed, rejected
- Requirement: pending, implemented, tested
- Proposal: pending, in_progress, completed, rejected

**Reference**

- `zeno/PROJECT_PRD.md` - End state definition
- `zeno/AGENTS.md` - Project conventions
- `zeno/architecture/gate-roadmap.md` - Visualization
- `zeno req list --project` - Verify requirements exist
<!-- ZENO:END -->

**Template Functions Available**

Use these functions to retrieve templates and configuration during gate generation:

- **getTemplate(name)**: Load a single template by name
  - Usage: `getTemplate('gate-prd-template')` when generating gate PRDs
  - Returns: Promise<string> containing template content

- **getTemplatesByCategory(category)**: Get all templates of a specific type
  - Usage: `getTemplatesByCategory('markdown')` to get all markdown templates
  - Categories: 'markdown' | 'architecture'

- **config_get()**: Get project configuration values
  - Usage: Access quality thresholds and project settings during gate planning
  - Returns: Promise<ZenoConfig> containing all configuration values

For gate generation, you'll typically use:

- `getTemplate('gate-prd-template')` - Load the gate PRD structure template
- `config_get()` - Access quality thresholds for gate requirements
- Reference this template's structure when creating `zeno/gates/gate-XX-name.md` files

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
   - **Verify requirements exist**: **Invoke** `zeno req list --project` or query `zeno/.zeno/requirements.db` to confirm project-level requirements are defined
   - If requirements don't exist for new projects, STOP and inform user: Requirements should be defined at project inception (`zeno init`) before gates can be generated
   - For rebaseline operations: Requirements may be updated or added as part of rescoping
   - **Invoke** `zeno gates list` or inspect `zeno/gates/` for existing gates
   - Identify current gate status (pending, in_progress, completed)
   - Note any completed gates that must be preserved

3. **Analyze current state**
   - For **new projects**: Analyze existing codebase if present
     - Inspect `src/`, `package.json`, existing architecture
     - **Invoke** `zeno analyze` if available
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
   For each gate, create `zeno/gates/gate-XX-name.md` using the template structure. **Invoke**: `getTemplate('gate-prd-template')` to load the gate PRD structure:

   The template includes these sections:
   - # Gate [XX]: [Gate Name]
   - **Status**, **Type**, **Created**, **Sequence**, **Hash**
   - ## Overview
   - ## Objectives (with unchecked [ ] checkboxes)
   - ## Context
   - ## Requirements (attribute existing requirements by hash)
   - ## Technical Decisions
   - ## Architecture Updates
   - ## Dependencies
   - ## Implementation Steps
   - ## Gate Completion Criteria

   Generate gates following this structure with proper formatting and all objectives unchecked.

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
    - Dependencies form a DAG (no circular references). Verify dependencies for correctness and context, but do not implement or modify dependent proposals' work. If dependencies point to future or external work, document them as blockers and notify a human for guidance.
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

| Entity      | Status Values                             | Notes                                       |
| ----------- | ----------------------------------------- | ------------------------------------------- |
| Gate        | pending, in_progress, completed, rejected | Set by `zeno gates start/complete`          |
| Requirement | pending, implemented, tested              | Set by `zeno req status`                    |
| Proposal    | pending, in_progress, completed, rejected | Set by `zeno proposal start/approve/reject` |

**Rebaseline Scenarios**

| Scenario          | Action                                                  |
| ----------------- | ------------------------------------------------------- |
| Scope expansion   | Add new gates after existing sequence                   |
| Scope reduction   | Mark gates as `rejected` or remove, create rescope gate |
| Pivot/redirect    | Create rescope gate, regenerate from current position   |
| Mid-gate change   | Complete or reject current gate, then rebaseline        |
| Dependency change | Update `depends_on` fields, verify DAG validity         |

**Requirements-First Workflow**

Requirements are primarily defined at project inception (`zeno init`) before gates. Gates attribute existing requirements to gates. Requirements can be updated during rebaseline but init is the primary source. Requirements are decomposed into tasks during proposal generation.

**Reference**

- Use `zeno/PROJECT_PRD.md` for end state and project scope.
- Use Template Function `getTemplate('gate-prd-template')` to load gate PRD structure.
- Use `zeno/architecture/gate-roadmap.md` to visualize gate sequence.
- Consult completed gates in `zeno/gates/` to maintain consistency.
- Review `zeno/AGENTS.md` for project conventions.
- Verify requirements exist: `zeno req list --project` before generating gates.
<!-- ZENO:END -->
