# Gate 05: Architecture & Diagram Generation

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 5 of 13  
**Hash**: #g05archdiag

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements architecture diagram generation with intelligent template selection based on project complexity and type. This gate produces visual representations of system design using Mermaid for simple diagrams (≤5 elements) and prerendered Graphviz DOT diagrams for complex models (>5 elements, deeper nesting, infrastructure components). Delivers core diagrams (system overview, data flow, gate lifecycle, gate roadmap, context) always generated for all projects, plus optional gate-level (sequence, component, package) and infrastructure-level (deployment, network) diagrams generated when complexity metrics indicate they are needed. This gate transforms Zeno's textual gate PRDs into visual system understanding, enabling stakeholders and LLMs to grasp architecture without lengthy documentation review.

## Objectives

### Core Architecture Diagrams (Always Generated)
- [ ] Implement system overview diagram generator (component relationships, module structure)
- [ ] Implement data flow diagram generator (end-to-end data processing paths)
- [ ] Implement gate lifecycle diagram generator (state machine for gate workflow)
- [ ] Implement gate roadmap diagram generator (gate sequence and parallel relationships)
- [ ] Implement context diagram generator (system boundary, external dependencies)

### Conditional Gate-Level Diagrams (Generated When Complexity Detected)
- [ ] Implement sequence diagram generator (temporal interactions for complex workflows)
- [ ] Implement component diagram generator (detailed module structure for complex components)
- [ ] Implement package diagram generator (code organization and module dependencies)
- [ ] Implement complexity detection algorithm (identifies when to generate gate-level diagrams)

### Conditional Infrastructure Diagrams (Generated for Deployment/Infrastructure Gates)
- [ ] Implement deployment diagram generator (runtime infrastructure, deployment topology)
- [ ] Implement network diagram generator (network topology, communication patterns)
- [ ] Implement infrastructure detection (identifies deployment gates needing infrastructure diagrams)

### Hybrid Rendering System (Mermaid + Graphviz DOT)
- [ ] Implement Mermaid diagram generator base class (simple diagrams, ≤5 elements)
- [ ] Implement DOT diagram generator base class (complex diagrams, >5 elements)
- [ ] Integrate Graphviz for rendering DOT diagrams to SVG format
- [ ] Create diagram selection logic: use Mermaid for simple (≤5 elements), DOT for complex (>5 elements)
- [ ] Build dependency graph visualizer using appropriate renderer (Mermaid for modules, DOT for large systems)
- [ ] Implement SVG embedding for complex diagrams (avoid context bloat)

### Architecture Commands & Integration
- [ ] Implement `zeno arch generate` command (generates all applicable diagrams based on project type and gates)
- [ ] Implement `zeno arch show <type>` command (display specific diagram from generated artifacts)
- [ ] Implement diagram versioning (track diagrams per gate for historical reference)
- [ ] Build architecture artifact storage system (organize diagrams in `zeno/architecture/`)
- [ ] Create architecture metadata index (maps diagram types to files and gate dependencies)

### Intelligent Diagram Selection
- [ ] Implement project type detection (CLI tool, web app, library, microservices, etc.)
- [ ] Create diagram selection matrix (project type → required diagrams)
- [ ] Build gate complexity analyzer (determines if gate-level diagrams needed)
- [ ] Implement infrastructure detection (identifies infrastructure-focused gates)
- [ ] Support user preference overrides (allow explicit diagram type requests)

### Testing & Quality
- [ ] Write unit tests for all diagram generators (template rendering, mermaid syntax validation)
- [ ] Write integration tests for diagram generation pipeline
- [ ] Test Graphviz SVG rendering (valid SVG output, proper formatting)
- [ ] Validate all diagram types can be embedded in markdown
- [ ] Test diagram selection logic across project types
- [ ] Achieve 90% test coverage for diagram generation module

## Context

### What Was Completed Before This Gate

Gate 01-04 established:
- TypeScript project with strict mode, ESLint, Prettier, Vitest
- CLI framework using Commander.js with extensible commands
- Zeno engine with iterative gate generation and project initialization
- MCP server exposing all Zeno functions as typed tools (Gate 03)
- Function registry centralizing all operations (Gate 03)
- Template loader infrastructure enabling dynamic template access (Gate 03 solitary)
- Requirements database with CRUD operations and dependency tracking (Gate 04)
- Gate-specific requirement generation algorithm (Gate 04)
- Hash registry for content-addressable storage (Gate 04)

### What This Gate Enables

- **Gate 6 (Multi-Repo & Subproject Detection)**: Uses architecture diagrams to visualize cross-repo dependencies
- **Gate 7 (Proposal Generation)**: Architecture context helps decompose proposals from requirements
- **Gate 9 (Git Integration)**: Architecture diagrams can be committed with proposals for context
- **Gate 12 (Subagent Orchestration)**: Architectural clarity supports parallel work item identification
- **Gate 13 (Documentation)**: Architecture diagrams form core of system documentation
- **LLM-driven workflows**: Visual diagrams help LLMs understand system structure for proposal generation

### Scope Boundaries

**In Scope**:
- Mermaid diagram generation for simple diagrams (≤5 elements)
- Graphviz DOT diagram generation for complex models (>5 elements)
- SVG rendering and embedding for DOT diagrams
- Five core diagrams: system overview, data flow, gate lifecycle, gate roadmap, context
- Gate-level diagrams: sequence, component, package (conditional, complexity-based)
- Infrastructure diagrams: deployment, network (conditional, infrastructure-focused gates)
- Intelligent diagram selection based on project type and complexity
- Architecture metadata indexing and versioning
- `zeno arch generate` command with automatic template selection
- `zeno arch show <type>` command for diagram retrieval
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Interactive diagram editing (diagrams are generated, not hand-editable in UI)
- Web-based diagram visualization (embedded in markdown, viewable in text editors/GitHub)
- Custom diagram types or plugins (limited to predefined diagram types)
- Real-time diagram updates during development (diagrams generated at gate completion)
- Diagram animation or interactivity (static diagrams for documentation)
- Metrics calculation or analysis (diagrams focus on structure, not metrics)
- Diagram comparison or diffing (historical tracking via Git, not tool-native)

## Requirements

This gate addresses core documentation requirements from project initialization:

1. **Visual System Understanding** - Architecture diagrams enable stakeholders to understand system design without lengthy text review
2. **Automatic Diagram Generation** - All applicable diagrams generated automatically from project metadata (no manual diagram creation)
3. **LLM-Accessible Architecture** - Diagrams support proposal generation by providing architectural context
4. **Smart Diagram Selection** - Project type and complexity determine which diagrams are generated
5. **Scalable Visualization** - Mermaid for simple models, Graphviz DOT for complex systems

## Technical Decisions

### 1. Hybrid Rendering: Mermaid + Graphviz DOT
- **Choice**: Mermaid for simple diagrams (≤5 elements), Graphviz DOT for complex models (>5 elements)
- **Alternatives Considered**: Mermaid only, PlantUML, custom rendering, manual PNG images
- **Rationale**: 
  - Mermaid excels at simple diagrams, remains text-based (version-controllable), integrates with markdown
  - Graphviz DOT provides superior rendering for complex models with many elements, nested relationships, and fine-grained styling
  - SVG output is vector-based, web-native, and typically smaller than PNG
  - DOT is a stable, standardized language with excellent support for directed graphs
  - Hybrid approach balances maintainability (text-based Mermaid) with rendering quality (prerendered DOT)
- **Trade-offs**: Gained rendering quality for complex diagrams; added Graphviz system dependency; prerendered SVG requires regeneration on source changes, but automation handles this

### 2. Intelligent Diagram Selection
- **Choice**: Auto-select diagrams based on project type, gate type, and complexity metrics
- **Alternatives Considered**: Generate all 10 diagram types for every project, user manual selection only, hardcoded per-project selection
- **Rationale**: Different projects need different diagrams (CLI tools don't need network diagrams, libraries don't need deployment diagrams). Auto-selection reduces clutter while ensuring critical diagrams exist.
- **Trade-offs**: Gained focused documentation; added complexity to selection logic

### 3. Core vs. Optional Diagrams
- **Choice**: 5 core diagrams (always generated), 3 gate-level (conditional), 2 infrastructure-level (conditional)
- **Alternatives Considered**: All 10 types always, minimal set only, fully manual
- **Rationale**: Core diagrams provide baseline understanding. Optional diagrams generated when metrics indicate need (complexity, infrastructure focus).
- **Trade-offs**: Gained clarity and reduced documentation bloat; requires complexity detection algorithm

## Architecture & Dependencies

### Diagram Generators
- `SystemOverviewGenerator` → `zeno/architecture/system-overview.md`
- `DataFlowGenerator` → `zeno/architecture/data-flow.md`
- `GateLifecycleGenerator` → `zeno/architecture/gate-lifecycle.md`
- `GateRoadmapGenerator` → `zeno/architecture/gate-roadmap.md`
- `ContextDiagramGenerator` → `zeno/architecture/context.md`
- `SequenceDiagramGenerator` → `zeno/architecture/sequence-[usecase].md` (conditional)
- `ComponentDiagramGenerator` → `zeno/architecture/component-[name].md` (conditional)
- `PackageDiagramGenerator` → `zeno/architecture/packages.md` (conditional)
- `DeploymentDiagramGenerator` → `zeno/architecture/deployment.md` (conditional)
- `NetworkDiagramGenerator` → `zeno/architecture/network.md` (conditional)

### Rendering Backends
- `MermaidRenderer` - Text-based Mermaid syntax generation (no external tool needed, markdown-native)
- `GraphvizRenderer` - DOT syntax generation + `graphviz` CLI invocation for SVG rendering

### Supporting Services
- `DiagramSelector` - Determines which diagrams to generate (project type, complexity metrics)
- `ComplexityAnalyzer` - Detects when gate-level and infrastructure diagrams needed
- `ArchitectureMetadata` - Index of generated diagrams with versioning info

## Implementation Steps

1. Create diagram generator base classes (`MermaidDiagramGenerator`, `DotDiagramGenerator`)
2. Implement core diagram generators (5 types)
3. Implement conditional diagram generators (5 types)
4. Build diagram selection logic with complexity detection
5. Implement `zeno arch generate` command
6. Implement `zeno arch show` command
7. Create architecture metadata indexing system
8. Write comprehensive tests (generators, rendering, selection logic)
9. Integrate with gate generation workflow
10. Validate Graphviz SVG output and markdown embedding

## Gate Completion Criteria

- [ ] All 5 core diagrams generated correctly for sample projects (system-overview, data-flow, gate-lifecycle, gate-roadmap, context)
- [ ] Mermaid diagrams render correctly in markdown (syntax validation)
- [ ] Graphviz DOT diagrams render to valid SVG with `graphviz` CLI
- [ ] Diagram selection logic correctly identifies project type and complexity
- [ ] Gate-level and infrastructure diagrams generated only when metrics trigger them
- [ ] `zeno arch generate` produces all applicable diagrams for test projects
- [ ] `zeno arch show <type>` retrieves and displays diagrams correctly
- [ ] Diagram versioning tracks changes per gate
- [ ] Test coverage ≥90% for diagram generation and selection modules
- [ ] All tests passing with TypeScript strict mode
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for diagram types and selection logic
