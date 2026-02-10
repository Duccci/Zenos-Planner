# Proposal: Core Diagram Generators

**Hash**: #p05g03corediag0
**Gate**: gate-05 - Architecture & Diagram Generation
**Status**: pending
**Created**: 2026-02-09

---

## Summary

Implements the 5 core diagram generators that are always produced for every project: system overview, data flow, gate lifecycle, gate roadmap, and context diagram. Each generator extends the base classes from proposal 02, uses templates from `templates/architecture-templates/`, and produces LLM-driven content via MCP template exposure.

---

## Context

### Why This Change

Gate 05 Technical Decision 4 specifies LLM-driven content generation where templates define strict structure and the LLM fills in project-specific content. The 5 core diagrams form the mandatory baseline for every Zeno project. These generators bridge the templates (already existing) to the rendering infrastructure (proposal 02) and produce the same quality of output as the manually-authored diagrams in `zeno/architecture/`.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g02rendbase0 | requires | Provides DiagramGeneratorBase, DiagramContext, MermaidRenderer, and GraphvizRenderer |

---

## Tasks

### Task 1: Implement System Overview Generator

**File(s)**: `src/generation/diagrams/system-overview-generator.ts`
**Action**: create

Create `SystemOverviewGenerator` extending `DiagramGeneratorBase`. Implement the `generate` method to: load `system-overview-template` via the template registry, populate `DiagramContext` with project gates and component inventory, and return structured content matching the template format. The generator reads existing `zeno/architecture/system-overview.md` if present (for incremental updates) and uses the complexity analyzer to determine Mermaid vs. DOT rendering. Output file: `zeno/architecture/system-overview.md`. Reference the existing `zeno/architecture/system-overview.md` for the expected output structure (7-layer architecture with Mermaid graph).

**Acceptance**:
- [ ] `SystemOverviewGenerator` extends `DiagramGeneratorBase`
- [ ] Loads template via template registry
- [ ] Reads existing diagram for incremental context when available
- [ ] Uses complexity analyzer to select rendering backend
- [ ] Produces output matching existing `system-overview.md` structure

---

### Task 2: Implement Data Flow Generator

**File(s)**: `src/generation/diagrams/data-flow-generator.ts`
**Action**: create

Create `DataFlowGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `data-flow-template`, populate context with end-to-end data processing paths derived from gates and requirements, and produce a diagram showing data transformations across system phases. Output file: `zeno/architecture/data-flow.md`. Reference existing `zeno/architecture/data-flow.md` for expected structure.

**Acceptance**:
- [ ] `DataFlowGenerator` extends `DiagramGeneratorBase`
- [ ] Loads data-flow-template via template registry
- [ ] Produces data flow diagram showing processing phases
- [ ] Uses complexity analyzer to select rendering backend

---

### Task 3: Implement Gate Lifecycle Generator

**File(s)**: `src/generation/diagrams/gate-lifecycle-generator.ts`
**Action**: create

Create `GateLifecycleGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `lifecycle-template`, populate context with gate state machine transitions (pending, in_progress, completed, rejected) and feedback loops (automated checks, human review, rescoping). Output file: `zeno/architecture/gate-lifecycle.md`. This generator uses `stateDiagram-v2` Mermaid syntax as seen in the existing diagram.

**Acceptance**:
- [ ] `GateLifecycleGenerator` extends `DiagramGeneratorBase`
- [ ] Loads lifecycle-template via template registry
- [ ] Produces state diagram with all gate/proposal state transitions
- [ ] Uses stateDiagram-v2 Mermaid syntax for simple cases

---

### Task 4: Implement Gate Roadmap Generator

**File(s)**: `src/generation/diagrams/gate-roadmap-generator.ts`
**Action**: create

Create `GateRoadmapGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `gate-roadmap-template`, query all gates from the database or filesystem, and produce a diagram showing gate sequence, dependencies, parallel opportunities, and critical path. Output file: `zeno/architecture/gate-roadmap.md`. Reference existing `zeno/architecture/gate-roadmap.md` for expected Gantt/dependency format.

**Acceptance**:
- [ ] `GateRoadmapGenerator` extends `DiagramGeneratorBase`
- [ ] Loads gate-roadmap-template via template registry
- [ ] Reads gate data from database or filesystem
- [ ] Produces roadmap showing sequence, dependencies, and parallelization opportunities

---

### Task 5: Implement Context Diagram Generator

**File(s)**: `src/generation/diagrams/context-diagram-generator.ts`
**Action**: create

Create `ContextDiagramGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `context-diagram-template`, populate context with system boundary definition, external dependencies (npm packages, system tools like Graphviz, Git), and actor interactions (CLI user, LLM, CI/CD). Output file: `zeno/architecture/context.md`. This is the only core diagram without an existing manually-authored counterpart.

**Acceptance**:
- [ ] `ContextDiagramGenerator` extends `DiagramGeneratorBase`
- [ ] Loads context-diagram-template via template registry
- [ ] Identifies system boundary, external dependencies, and actors
- [ ] Produces context diagram showing system-environment relationships

---

### Task 6: Create Diagrams Module Index

**File(s)**: `src/generation/diagrams/index.ts`
**Action**: create

Create barrel export file re-exporting all 5 core generators from their respective modules. Export a `CORE_DIAGRAM_GENERATORS` array containing instances or constructors of all 5 generators, and a `CoreDiagramType` string literal union type (`'system-overview' | 'data-flow' | 'gate-lifecycle' | 'gate-roadmap' | 'context'`).

**Acceptance**:
- [ ] All 5 core generators re-exported
- [ ] `CORE_DIAGRAM_GENERATORS` array exported
- [ ] `CoreDiagramType` type exported

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/diagrams/system-overview-generator.ts` | create | System overview diagram generator |
| `src/generation/diagrams/data-flow-generator.ts` | create | Data flow diagram generator |
| `src/generation/diagrams/gate-lifecycle-generator.ts` | create | Gate lifecycle state diagram generator |
| `src/generation/diagrams/gate-roadmap-generator.ts` | create | Gate roadmap and dependency diagram generator |
| `src/generation/diagrams/context-diagram-generator.ts` | create | Context diagram generator (system boundary) |
| `src/generation/diagrams/index.ts` | create | Barrel exports and generator registry |

---

## Implementation Notes

Each generator follows the same pattern: load template, build context, invoke complexity analyzer, select renderer, produce markdown. The LLM-driven aspect (Technical Decision 4) means the generators prepare structured context for MCP tool interactions rather than performing string interpolation. The `generate` method returns a `DiagramGenerationResult` containing the rendered content, metadata, and rendering backend used. Generators should handle the case where no existing architecture file exists (first generation) vs. when one exists (incremental update with existing content as context).

---

## Rollback

**If rejected or failed**: Delete `src/generation/diagrams/` directory. No other modules reference these generators yet.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-09
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-09 | Initial version | Zeno |
