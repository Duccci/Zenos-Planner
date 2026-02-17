# Proposal: Core Diagram Generators

**Hash**: #p05g03corediag0  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Requirement**: Visual System Understanding, Automatic Diagram Generation  
**Status**: completed  
**Created**: 2026-02-13

---

## Summary

Implements the five core diagram generators that are always generated for every project: system overview, data flow, gate lifecycle, gate roadmap, and context diagram. Each generator extends the `DiagramGeneratorBase` and provides LLM-driven content generation via MCP template exposure. These generators produce the baseline architectural documentation for any Zeno-managed project.

---

## Single-Phase Requirement

All five generators are independent and can be implemented in parallel. No sequencing required between them.

---

## Context

### Why This Change

Core diagrams provide the minimum viable architectural documentation. Every Zeno project needs these five diagram types to give stakeholders and LLMs visual understanding of system structure, data flow, gate workflow, project roadmap, and system boundaries. The generators consume the rendering base classes and produce markdown files in `zeno/architecture/`.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g02rendbase0 | requires | Rendering base classes, Mermaid/Graphviz renderers, and fallback logic |

---

## Tasks

### Task 1: Implement System Overview Generator

**File(s)**: `src/generation/diagram-generators/system-overview-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.SystemOverview`, `getCategory()` to return `'core'`. Implement `generateContent()` to produce Mermaid or DOT syntax for a system overview showing architectural layers and component relationships. The generator reads the system-overview template from `templates/architecture-templates/system-overview-template.md` via the template loader and provides it as structural guidance. Content is populated from gate metadata and project structure in the `DiagramContext`. Output path: `zeno/architecture/system-overview.md`.

**Acceptance**:
- [x] Generates valid Mermaid or DOT syntax based on complexity
- [x] Output follows system-overview-template.md structure
- [x] Produces markdown with diagram, layer descriptions, and related docs section
- [x] File written to `zeno/architecture/system-overview.md`

### Task 2: Implement Data Flow Generator

**File(s)**: `src/generation/diagram-generators/data-flow-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.DataFlow`, `getCategory()` to return `'core'`. Implement `generateContent()` to produce a data flow diagram showing end-to-end data processing paths through system components. Template loaded from `templates/architecture-templates/data-flow-template.md`. Output path: `zeno/architecture/data-flow.md`.

**Acceptance**:
- [x] Generates valid Mermaid or DOT syntax for data flow
- [x] Shows data transformations between components
- [x] Output follows data-flow-template.md structure
- [x] File written to `zeno/architecture/data-flow.md`

### Task 3: Implement Gate Lifecycle Generator

**File(s)**: `src/generation/diagram-generators/gate-lifecycle-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.GateLifecycle`, `getCategory()` to return `'core'`. Implement `generateContent()` to produce a state machine diagram showing gate status transitions: `pending → in_progress → completed` with `rejected` as an alternative terminal state. Template loaded from `templates/architecture-templates/lifecycle-template.md`. Output path: `zeno/architecture/gate-lifecycle.md`.

**Acceptance**:
- [x] Generates valid Mermaid stateDiagram syntax
- [x] Shows all four gate states and valid transitions
- [x] Includes trigger labels on transitions (e.g., `gates start`, `gates complete`)
- [x] File written to `zeno/architecture/gate-lifecycle.md`

### Task 4: Implement Gate Roadmap Generator

**File(s)**: `src/generation/diagram-generators/gate-roadmap-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.GateRoadmap`, `getCategory()` to return `'core'`. Implement `generateContent()` to produce a roadmap diagram showing gate sequence and parallel relationships. Reads active gate list from `DiagramContext.gates` to build the graph. Template loaded from `templates/architecture-templates/gate-roadmap-template.md`. Output path: `zeno/architecture/gate-roadmap.md`.

**Acceptance**:
- [x] Generates valid Mermaid graph showing all active gates
- [x] Parallel gates shown as concurrent nodes
- [x] Sequential gates shown with dependency arrows
- [x] File written to `zeno/architecture/gate-roadmap.md`

### Task 5: Implement Context Diagram Generator

**File(s)**: `src/generation/diagram-generators/context-diagram-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.Context`, `getCategory()` to return `'core'`. Implement `generateContent()` to produce a context diagram showing the system boundary and external dependencies. Shows the Zeno system as a central node with external actors (User, LLM, Git, SQLite, Filesystem) connected. Template loaded from `templates/architecture-templates/context-diagram-template.md`. Output path: `zeno/architecture/context.md`.

**Acceptance**:
- [x] Generates valid Mermaid or DOT syntax for context boundary
- [x] System boundary clearly delineated from external actors
- [x] External dependencies identified and labeled
- [x] File written to `zeno/architecture/context.md`

### Task 6: Create Barrel Export for Diagram Generators

**File(s)**: `src/generation/diagram-generators/index.ts`  
**Action**: create

Create barrel export file re-exporting all five core generators: `SystemOverviewGenerator`, `DataFlowGenerator`, `GateLifecycleGenerator`, `GateRoadmapGenerator`, `ContextDiagramGenerator`. Export a `CORE_GENERATORS` array listing all core generator classes for iteration.

**Acceptance**:
- [x] All five generators importable from single path
- [x] `CORE_GENERATORS` array contains all core generator classes
- [x] No circular dependency issues

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/diagram-generators/system-overview-generator.ts` | create | System overview diagram generator |
| `src/generation/diagram-generators/data-flow-generator.ts` | create | Data flow diagram generator |
| `src/generation/diagram-generators/gate-lifecycle-generator.ts` | create | Gate lifecycle state machine generator |
| `src/generation/diagram-generators/gate-roadmap-generator.ts` | create | Gate roadmap/sequence generator |
| `src/generation/diagram-generators/context-diagram-generator.ts` | create | Context boundary diagram generator |
| `src/generation/diagram-generators/index.ts` | create | Barrel export for all core generators |

---

## Implementation Notes

- Each generator's `generateContent()` provides a scaffold that the LLM fills with project-specific content via MCP. The generator produces a structurally valid diagram from the template; the LLM enriches it with contextual details.
- Gate lifecycle diagram is always Mermaid (stateDiagram is simple). Gate roadmap may be DOT for projects with many gates.
- Generators read templates via the existing `loadTemplate()` function from `src/generation/gate-template.ts` (or a shared template loader).

---

## Rollback

**If rejected or failed**: Delete the `src/generation/diagram-generators/` directory and its contents.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-13  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-13 | Initial version | Copilot |

---

## Completion Summary

**Status**: Complete  
**Tasks Completed**: 6/6  
**Files Modified**: 6

### Artifacts Created
- `src/generation/diagram-generators/system-overview-generator.ts` - System overview diagram generator (70 lines)
- `src/generation/diagram-generators/data-flow-generator.ts` - Data flow diagram generator (74 lines)
- `src/generation/diagram-generators/gate-lifecycle-generator.ts` - Gate lifecycle state machine generator (79 lines)
- `src/generation/diagram-generators/gate-roadmap-generator.ts` - Gate roadmap/sequence generator (91 lines)
- `src/generation/diagram-generators/context-diagram-generator.ts` - Context boundary diagram generator (79 lines)
- `src/generation/diagram-generators/index.ts` - Barrel export file (24 lines)

### Quality Metrics
- **Test Coverage**: N/A (No unit tests in scope for this proposal)
- **Type Safety**: 100% (All TypeScript strict mode checks passing)
- **Linting**: 0 errors (All files pass eslint)
- **Security**: 0 findings (No security vulnerabilities)

### Implementation Notes
1. All five core generators extend `DiagramGeneratorBase` and implement required abstract methods
2. Generators produce valid Mermaid diagram syntax that is then wrapped in markdown code fences by the base class
3. Complexity analysis is properly integrated (countNodes, countEdges, countNestingDepth overrides)
4. Template discovery is in place but not required to function - diagrams are generated even if templates are unavailable
5. Error handling logs but doesn't throw if templates cannot be loaded
6. All generators are exportable from the `diagram-generators/index.ts` barrel file
7. `CORE_GENERATORS` array provides list of all core diagram types for iteration in consuming code
