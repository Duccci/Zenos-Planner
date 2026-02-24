---
name: zeno-proposal
description: Generate proposal documents from a Gate PRD for implementation.
---

**Guardrails**

**Pre-Generation Gate Review**: Before decomposing a gate into proposals, perform the following checks:
- Read the entire Gate PRD (Objectives, Requirements, Technical Decisions, Acceptance Criteria). Flag any open questions, unclear requirements, or contradictory statements. If found, document them and ask the user for clarification before generating proposals.
- Verify all Requirements listed in the gate are complete and unambiguous. If a requirement has vague acceptance criteria (e.g., "should be fast", "reasonable performance"), flag it and ask for quantified metrics before proceeding.
- Identify any implicit assumptions in the gate PRD (e.g., "assumes migration path from v1 exists", "assumes no breaking changes"). List assumptions and ask the user to confirm they are correct before proposal generation.
- Check if any gate dependencies are incomplete or blocked. If so, document the blocker and request user guidance before proceeding with proposal generation.

**Proposal Generation Constraints**:
- Only create markdown in `zeno/proposals/gate-XX/`; no code, files, or commands
- Keep proposals as single coherent work units with status `pending`
- Decompose Gate PRD steps into tasks; describe changes without implementing
- NO: implementation code, inline code snippets, terminal commands, file modifications, new requirements
- YES: markdown files, task decomposition, acceptance criteria, function/type names (no code blocks)
- Review dependencies for context only; do not implement or pre-empt work that belongs to other proposals or later gates. Document incomplete dependencies as blockers in the proposal and notify a human for guidance.

**Functions**

- `getTemplate('proposal-template')` - Load proposal structure template
- `getTemplatesByCategory(category)` - Get all templates by type
- `config_get()` - Get quality thresholds

**Steps**
Mark each step as in-progress, then completed immediately after finishing.

1. **Identify proposal type** - Gate-tied or solitary? Read gate PRD if gate-tied
2. **Start gate** - If gate-tied and pending: `zeno gates start <gate-id>`
3. **Read source** - Extract objectives, requirements, steps, decisions
4. **Review existing** - Check `zeno/proposals/gate-XX/` or `solitary/` for duplicates
5. **Decompose** - Map gate steps to proposals; one per coherent unit.
   Use `proposal_action: generate` to let the MCP tool orchestrate proposal creation for gate-tied proposals (pass `gateId`); for solitary, use `proposal_action: create` (pass `solitary: true`). // See MCP: proposal-tools.ts#actionHandlers.generate
   - **Gate-tied** (`gateId` provided): MCP routes to `generateProposals` which reads the gate PRD and decomposes it. Use test-first RED/GREEN design:
     - **RED Phase**: First proposal(s) write tests covering target coverage threshold (`config.qualityThresholds.codeCoverage`, default 90%)
     - **GREEN Phase**: Implementation proposals follow RED tests; include guardrails to verify no new tests are added
     - **Final Proposal**: Test refinement and coverage validation
   - **Solitary** (`solitary: true`): MCP routes to `proposal_create`; include test tasks inline
   - **Test-First Red Design**: same structure as before \u2014 tests define acceptance criteria BEFORE implementation
   - **Test Reuse First**: search existing test files first; extend rather than duplicate
   - Every `File(s)` entry must be an explicit path (no globs, no directories) \u2014 MCP validates at `proposal_action: start`. // See MCP: scope-validator.ts#validateExplicitPaths
   - Each task should touch 1-3 files; if more are needed, split
6. **Generate files** - Create `zeno/proposals/gate-XX/01-name.md` or `solitary/YYYY-MM-DD-01-name.md`
7. **Establish dependencies** - First proposal: no deps; subsequent: reference earlier ones. Treat listed dependencies as context only; do not implement or act on them during proposal creation. If a dependency is incomplete, note it as a blocker in the proposal and notify a human for clarification.
8. **Validate structure** - Hash, Type, Status pending, Summary, Tasks, Files Affected
   - Verify all `File(s)` and `Files Affected` entries are explicit file paths (no `*.ts`, no `src/dir/`)
   - Verify gate-tied proposals omit test tasks (tests belong in the gate's final test proposal)
   - Verify solitary proposals include test tasks inline
9. **Cross-reference architecture** - Verify file paths match `system-overview.md` (gate-level planning step only; the apply agent does not re-read architecture docs)
10. **Update gate PRD** (gate-tied only) - Populate the `## Proposals` section in the gate PRD:
    - Fill `### Proposal Status` table with all generated proposals (name, hash, status, dependency notes)
    - Generate `### Proposal Dependency Graph` as a Mermaid `graph LR` diagram showing `requires` edges between proposals
    - Each node uses the proposal hash as ID and `"NN Proposal Name"` as label
    - Edges point from dependent to dependency (arrow means "requires")
    - Proposals with no dependencies have no outgoing edges
    - Update the `**Status**` line to reflect that proposals have been generated
11. **Output summary** - List all proposals with hashes, requires/blocks relationships

    ...

    Dependency order: #hash1 -> #hash2 -> #hash3 -> ...

    To implement first proposal: `/zeno-apply #hash1`

    ```

    ```

**Proposal Directory Structure**

```
zeno/proposals/
├── gate-01/
│   ├── 01-component-setup.md
│   ├── 02-database-schema.md
│   └── 03-api-endpoints.md
├── gate-02/
│   └── 01-migrations.md
├── solitary/
│   ├── 2026-01-15-01-eslint-upgrade.md
│   ├── 2026-01-20-01-refactor-auth.md
│   └── 2026-02-01-01-documentation-updates.md
└── archive/
    ├── gate-01/
    │   ├── #p010reinfra.md
    │   └── #p010setup.md
    └── solitary/
        └── #s20260115eslint.md
```

**Archival Process**

- **Gate-tied proposals**: When gate is completed, move `zeno/proposals/gate-XX/XX-name.md` to `zeno/proposals/archive/gate-XX/` with naming convention `#hash.md`
- **Solitary proposals - Archival with consolidation**: When solitary proposal is completed and archived:
  1. Extract high-level implementation summary from the proposal (2-3 sentences of what was accomplished)
  2. Add entry to `zeno/gates/archive/solitary.md` under the appropriate section with hash, title, and summary
  3. Move completed proposal file `zeno/proposals/solitary/YYYY-MM-DD-XX-name.md` to `zeno/proposals/archive/solitary/` with naming convention `#hash.md`
  4. Update `zeno/gates/archive/solitary.md` with completion date

- Archive preserves complete proposal history without cluttering active proposal directories
- Active `zeno/proposals/solitary/` directory contains only pending/in_progress proposals
- `zeno/gates/archive/solitary.md` serves as consolidated registry of completed solitary work with high-level summaries

**Solitary Consolidation File Structure**

`zeno/gates/archive/solitary.md` maintains high-level record of completed solitary proposals:

```markdown
# Solitary Proposals - Completed Work

## [Category Name]

### [Proposal Title] (#hash)

**Completed**: YYYY-MM-DD

High-level implementation: [2-3 sentence summary of what was accomplished]
```

Structure guidelines:

- Use consistent category names (e.g., Infrastructure, Documentation, Security, Maintenance, Refactoring, Tooling)
- One entry per completed solitary proposal
- Hash and completion date in header
- Summary must be 2-3 sentences maximum
- Entries appear chronologically within their category

**Reference**

- Use `zeno/gates/gate-XX-name.md` as the authoritative source for gate-tied proposals.
- Use Template Function `getTemplate('proposal-template')` to load proposal structure.
- **Invoke** `zeno req show "<hash>"` to get detailed requirement information.
- Consult `zeno/architecture/*.md` for component locations and data flow.
- Inspect existing proposals in `zeno/proposals/gate-XX/` and `zeno/proposals/solitary/` to maintain consistency.
