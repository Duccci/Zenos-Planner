# Architecture Documentation

This directory contains **forward-looking architecture diagrams and design documents** for Zeno's Planner (Gates 1-14). These documents describe the **target end state**, not just the current implementation. Architecture guides implementation, not the reverse.

**Implementation Status**:

- IMPLEMENTED (Gates 1-5 complete) — shown in green (#4CAF50)
- IN_PROGRESS (Gate 6 started) — shown in amber (#FFC107)
- PLANNED (Gates 7-14, in sequence) — shown in blue (#2196F3)

---

---

## Core Documents

| Document | Purpose | Status | Gates |
| ---------- | ------- | ------ | ----- |
| **`system-overview.md`** | Component architecture with all layers (UI, Orchestration, Core, Analysis, Generation, Validation, Storage, Integration) showing implementation status | 2.0.0 | 1-14 |
| **`data-flow.md`** | Workflow paths: happy path, error recovery, rejection/replan, parallel execution, rescope | 2.0.0 | 1-14 |
| **`gate-lifecycle.md`** | State machine for gate/proposal lifecycles with all transitions and recovery scenarios | 2.0.0 | 1-14 |
| **`gate-roadmap.md`** | Sequential gate structure and parallel relationships | 1.0 | 1-14 |
| **`mcp-workflows.md`** | Formal MCP state machine contracts for handlers | Latest | 1-14 |

---

## How to Use These Documents

### For Understanding the System

1. Start with [`system-overview.md`](system-overview.md) to see the big picture and which components are implemented vs planned
2. Check [`gate-lifecycle.md`](gate-lifecycle.md) to understand how gates and proposals transition through their lifecycle
3. Review [`data-flow.md`](data-flow.md) to see the different workflow paths (happy path, error recovery, rescope, etc.)

### For Implementation

1. Reference the **component status tables** in `system-overview.md` to see which gates deliver which components
2. Check [`mcp-workflows.md`](../mcp-workflows.md) for formal state machine contracts that MCP handlers must enforce
3. See [`../PROJECT_PRD.md`](../PROJECT_PRD.md) for technical decisions and rationale

### For Planning Gate Work

1. See the **Gate-by-Gate Implementation Roadmap** table in `system-overview.md`
2. Check [`../gates/gate-XX-*.md`](../gates/) for detailed gate PRDs
3. Reference `gate-lifecycle.md` for state transitions your gate must implement

---

## Updating Architecture as Work Progresses

This is a **living, forward-looking document**. The architecture describes the target system (Gate 14 complete), and as each gate is completed, documents are updated to show progress.

### When a Gate Completes

Update the following in the affected documents:

1. **`system-overview.md`**:
   - Move components from Planned (blue) → In Progress (amber) → Implemented (green)
   - Update "Implementation Status by Layer" table
   - Update "Gate-by-Gate Implementation Roadmap" with completion date
   - Add notes on any architectural adjustments discovered

2. **`data-flow.md`**:
   - If new workflow paths are discovered, add them
   - Mark "Implementation Phases" as complete for the finished gate

3. **`gate-lifecycle.md`**:
   - If new state transitions are discovered, document them
   - Update notes on gate behavior if runtime differs from design

4. **Footer (all files)**:
   - Bump version (e.g., 2.0.0 → 2.1.0 for gate completion, 3.0.0 for major design change)
   - Update "Last Updated" date
   - Add changelog entry: "Gate 06 completion: Added Repository Detection component"

### Example: After Gate 06

```markdown
---

## Implementation Status by Layer

| Layer | Status | Implemented (Gates) | In Progress (Gate) | Planned (Gate) |
|-------|--------|---------------------|-------------------|----------------|
| **User Interface** | Complete | CLI, MCP (1-3) | — | Dashboard (12) |
| **Analysis** | Partial | Code Analyzer, Dep Tracker (2,4), **Repo Detector (6)** | Conflict (10) | — |
| ...
```

---

## Editing Guidelines

### To Update a Diagram

1. Edit the `.md` file directly—this is the source of truth
2. Update the embedded Mermaid code (for simple ≤5 element diagrams) or DOT source + SVG image (for complex >5 element diagrams)
3. Update footer: version, date, changelog

### To Add a New Diagram

1. Create `diagram-name.md` with:
   - Purpose and status
   - Embedded Mermaid diagram (simple) or DOT+SVG (complex)
   - Detailed explanation
   - Footer with version, date, changelog
2. Reference in this README under "Core Documents"
3. Update `system-overview.md` if it's a new component/layer

### Consistency Across Documents

- Use **consistent status indicators**: IMPLEMENTED (green) = Done, IN_PROGRESS (amber) = Active, PLANNED (blue) = Future
- **Link between documents**: Reference related diagrams and decisions
- **Date all updates**: Always update footer when changing content
- **Version semantically**: PATCH for clarifications, MINOR for gate completions, MAJOR for design changes

---

## Architecture Alignment Checklist

After each gate completion, verify the following:

- [ ] All new components documented in `system-overview.md` with gate reference
- [ ] State transitions documented in `gate-lifecycle.md` (if applicable)
- [ ] Workflow paths updated in `data-flow.md` (if new error/recovery paths discovered)
- [ ] All documents have updated version number, date, and changelog
- [ ] Cross-document links are accurate
- [ ] Component status indicators (Complete/Pending/Planned) are consistent across documents
- [ ] Gate-by-Gate roadmap table updated with completion date

---

## Viewing Diagrams

### In Visual Studio Code

1. Install "Markdown Preview Mermaid Support" extension
2. Open any `.md` file
3. Press `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (Mac)
4. Mermaid diagrams will render automatically

### In GitHub

- GitHub natively renders Mermaid diagrams in markdown files
- SVG images (from DOT) render inline without additional setup
- View raw `.md` files to see Mermaid source code

### In Other Viewers

- Most modern markdown viewers support Mermaid (Obsidian, Typora, etc.)
- SVG images render in any markdown viewer
- Use [Mermaid Live Editor](https://mermaid.live/) to edit/test diagrams

---

## Related Resources

- **Project Scope & Decisions**: [`../PROJECT_PRD.md`](../PROJECT_PRD.md) — Technical decisions with rationale (why, not what)
- **Gate Research & Details**: [`../gates/`](../gates/) — Gate-specific objectives and requirements
- **Implementation**: [`../../src/`](../../src/) — Actual code organized by layer
- **Requirements Database**: `.zeno/registry.db` — Queryable requirements per gate
- **Agents Guide**: [`../AGENTS.md`](../AGENTS.md) — How AI agents should read/navigate this project

---

**Last Updated**: 2026-02-23  
**Maintained By**: jamesonBatworker  
**Status**: Lives! Updated after each gate (target: within 1 week of completion)
