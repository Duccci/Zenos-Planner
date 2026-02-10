# Gate 05: Architecture & Diagram Generation

**Status**: in_progress
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
- [ ] Implement Mermaid diagram generator base class (simple diagrams, below complexity threshold)
- [ ] Implement DOT diagram generator base class (complex diagrams, above complexity threshold)
- [ ] Integrate Graphviz `dot` CLI for rendering DOT to inline SVG (host-installed dependency)
- [ ] Implement Graphviz availability check with warning fallback to Mermaid-only mode
- [ ] Implement `zeno setup graphviz` helper command (prints platform-specific install instructions)
- [ ] Create diagram selection logic using configurable complexity thresholds (nodes + edges count, nesting depth multiplier)
- [ ] Build dependency graph visualizer using appropriate renderer (Mermaid for modules, DOT for large systems)
- [ ] Implement inline SVG embedding in markdown with `<details>` collapse for large diagrams

### Architecture Commands & Integration
- [ ] Implement `zeno arch generate` command (invokes LLM-driven generation via MCP template exposure)
- [ ] Implement `zeno arch show <type>` command (display specific diagram from generated artifacts)
- [ ] Implement architecture metadata scanner (parses `zeno/architecture/` folder to build runtime index)
- [ ] Build architecture artifact storage conventions (organize diagrams in `zeno/architecture/`)
- [ ] Implement gate structure change detection (triggers architecture review notification when gates change)

### Intelligent Diagram Selection
- [ ] Implement project type detection (LLM/user-driven via MCP, informed by gate PRDs and codebase analysis)
- [ ] Create diagram selection matrix (project type -> required diagrams)
- [ ] Build gate complexity analyzer (configurable thresholds: element count, nesting depth, depth penalty)
- [ ] Implement infrastructure detection (identifies infrastructure-focused gates)
- [ ] Support user/LLM preference overrides (allow explicit diagram type requests via MCP tools)

### Gate Template Integration
- [ ] Add `## Architecture Diagrams` section to gate PRD template
- [ ] Define per-gate diagram entries with: name, type, order, and inter-diagram dependencies
- [ ] Integrate diagram metadata into gate generation algorithm (produced alongside requirements)
- [ ] Support parallelization hints in diagram metadata (independent diagrams can be generated concurrently)
- [ ] Enable subagent-ready diagram task decomposition (Gate 12 prerequisite)

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
- Mermaid diagram generation for simple diagrams (below configurable complexity threshold)
- Graphviz DOT diagram generation for complex models (above threshold) with inline SVG embedding
- Graphviz as host-installed dependency with graceful fallback and setup helper
- Five core diagrams: system overview, data flow, gate lifecycle, gate roadmap, context
- Gate-level diagrams: sequence, component, package (conditional, per-gate complexity-based)
- Infrastructure diagrams: deployment, network (conditional, infrastructure-focused gates)
- LLM-driven content generation via MCP template exposure (strict format, flexible content)
- Configurable complexity thresholds (element count, nesting depth, depth penalty)
- Architecture metadata via runtime folder scanning of `zeno/architecture/`
- Gate PRD template integration with diagram metadata (name, type, order, dependencies)
- Gate structure change detection triggering architecture review
- `zeno arch generate` command invoking LLM-driven generation
- `zeno arch show <type>` command for diagram retrieval
- `zeno setup graphviz` helper command
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Bundling or packaging Graphviz binaries (licensing constraint; host-installed only)
- Interactive diagram editing (diagrams are LLM-generated, not hand-editable in UI)
- Custom diagram types or plugins (limited to predefined diagram types)
- Real-time diagram updates during development (diagrams generated on demand or at gate events)
- Diagram animation or interactivity (static diagrams for documentation)
- Metrics calculation or analysis (diagrams focus on structure, not metrics)
- Application-level version tracking for diagrams (Git commit history is the version store)
- Persistent metadata database for architecture artifacts (runtime folder scanning only)

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

### 4. LLM-Driven Content Generation via MCP Templates
- **Choice**: Templates define strict structural format; LLM generates flexible diagram content through MCP tool interactions
- **Alternatives Considered**: Rule-based template interpolation, fully manual authoring, pure LLM generation without templates
- **Rationale**: Architecture diagrams require contextual understanding of project structure that rule-based generation cannot capture. Templates (exposed via MCP) give the LLM the structural contract (diagram type, sections, format), while the LLM fills in project-specific content (nodes, relationships, labels) based on gate PRDs, requirements, and codebase analysis. This mirrors the existing pattern where `system-overview.md` was authored from its template with project-specific content.
- **Trade-offs**: Gained semantic richness and adaptability; diagram quality depends on LLM capability; requires MCP template exposure infrastructure (already built in Gate 03)

### 5. Graphviz as Host-Installed System Dependency
- **Choice**: Graphviz must be installed on the host system; Zeno does not bundle or package it
- **Alternatives Considered**: Bundle Graphviz binaries, use WASM port, npm package with embedded binaries
- **Rationale**: Graphviz licensing (EPL/CPL) prevents redistribution within Zeno's package. Host installation keeps Zeno's dependency footprint clean and respects licensing boundaries.
- **Behavior**:
  - `zeno arch generate` checks for `dot` CLI availability at invocation time
  - If Graphviz is not installed, emit a warning and fall back to Mermaid-only rendering for all diagrams
  - Provide a `zeno setup graphviz` helper command that prints platform-specific install instructions
  - README documents Graphviz as an optional dependency with install instructions per platform
- **Trade-offs**: Gained licensing compliance and smaller package; requires users to install Graphviz separately for complex diagram rendering

### 6. Configurable Complexity Thresholds
- **Choice**: Element count = nodes + edges; nesting depth is a separate multiplier; thresholds are configurable
- **Definition of "element"**: `count = nodes + edges`. A graph with 3 nodes and 3 edges = 6 elements (exceeds default threshold)
- **Nesting depth factor**: Nesting depth > 2 levels reduces the effective threshold (deeply nested graphs render poorly in Mermaid even with fewer elements). Effective threshold = `configured_threshold - (nesting_depth - 2) * depth_penalty`
- **Default configuration** (overridable in `zeno.config.ts` or project settings):
  - `complexity.elementThreshold`: 5 (default Mermaid/DOT boundary)
  - `complexity.depthPenalty`: 1 (elements subtracted per nesting level beyond 2)
  - `complexity.maxMermaidDepth`: 3 (force DOT rendering above this nesting depth regardless of element count)
- **Rationale**: Different projects have different complexity profiles. A microservices project with shallow graphs needs different thresholds than a deeply nested monolith. Configurability prevents false rendering choices.
- **Trade-offs**: Gained precision in rendering selection; added configuration surface area

### 7. Git-Based Diagram Versioning
- **Choice**: Rely on Git commit history for versioning; no application-level version tracking
- **Alternatives Considered**: SemVer per diagram, content-hash snapshots, database version table
- **Rationale**: Diagrams are markdown files in `zeno/architecture/` already under Git version control. Adding application-level versioning duplicates what Git provides natively. `git log -- zeno/architecture/system-overview.md` gives full history. Architecture metadata tracks current state (which diagrams exist, their types, associated gates) but not version history.
- **Trade-offs**: Gained simplicity; version queries require Git CLI access rather than database lookup

### 8. Inline SVG Rendering for Complex Diagrams
- **Choice**: Graphviz DOT diagrams render to inline SVG embedded directly in markdown files
- **Alternatives Considered**: External `.svg` files with image links, base64 data URIs, PNG images
- **Rationale**: Inline SVG renders natively in both GitHub markdown preview and VSCode markdown preview without external file references. This keeps diagrams self-contained within their markdown artifact, avoids broken image links, and supports text search within diagram labels.
- **Context bloat mitigation**: For diagrams exceeding a configurable size threshold, SVG is placed in a `<details>` collapse block with a summary description, keeping the markdown scannable while preserving the full diagram inline.
- **Trade-offs**: Gained universal rendering support (GitHub + VSCode); larger markdown files for complex diagrams (mitigated by collapse blocks)

### 9. LLM-Driven Diagram Authoring (Not Direct File Writes)
- **Choice**: Diagram generation is LLM-driven through MCP tool interactions, not programmatic file writes
- **Workflow**:
  1. MCP exposes architecture templates as resources (already built in Gate 03)
  2. LLM reads template + project context (gates, requirements, existing architecture)
  3. LLM generates diagram content following template structure
  4. LLM writes diagram file through MCP file tools or CLI
  5. Zeno metadata parser scans `zeno/architecture/` to update the architecture index
- **Regeneration triggers**:
  - `zeno arch generate` CLI command invokes LLM-driven generation for all applicable diagrams
  - Gate structure changes (new gates, reordering, rescoping) trigger architecture review notification
  - LLM/user can regenerate individual diagrams on demand via MCP tools
- **Existing diagram handling**: LLM receives existing diagrams as context when regenerating, enabling incremental updates rather than blind overwrites. The LLM decides whether changes are needed based on current project state vs. diagram content.
- **Trade-offs**: Gained semantic understanding and contextual accuracy; generation requires LLM availability; non-deterministic output (mitigated by template structure enforcement)

### 10. Architecture Metadata via Folder Scanning
- **Choice**: Architecture metadata index is derived by scanning `zeno/architecture/` at runtime, not stored in a separate database
- **Alternatives Considered**: SQLite metadata table, JSON manifest file, hardcoded registry
- **Rationale**: Diagrams are the source of truth. Scanning the folder ensures metadata always reflects actual state without synchronization bugs. Metadata extraction parses frontmatter/headers from each markdown file to build the index (diagram type, associated gate, generated date, status).
- **Index structure** (runtime, not persisted):
  - Diagram type (system-overview, data-flow, sequence, etc.)
  - Associated gate hash (if gate-specific)
  - File path within `zeno/architecture/`
  - Last modified timestamp (from filesystem)
- **Trade-offs**: Gained simplicity and single source of truth; slightly slower than cached lookup (negligible for typical project sizes)

### 11. Gate-Level Diagrams Scoped Per-Gate with Proposal Metadata
- **Choice**: Conditional diagrams (sequence, component, package) are generated per-gate when that gate's complexity triggers them. Diagram names, ordering, and dependencies are defined in the gate template during gate generation.
- **Gate template integration**:
  - Each gate PRD includes an `## Architecture Diagrams` section listing which diagrams apply to that gate
  - Diagram entries specify: name, type, order, and dependency on other diagrams
  - This metadata enables parallelization (independent diagrams generated concurrently) and supports subagent tasking in Gate 12
- **Naming convention**: `[type]-[gate-hash]-[descriptor].md` (e.g., `sequence-g05archdiag-generation-pipeline.md`)
- **Rationale**: Gate-scoped diagrams keep architectural documentation aligned with implementation scope. Embedding diagram metadata in gate templates means the gate generation algorithm (already built) naturally produces the diagram plan alongside requirements.
- **Trade-offs**: Gained parallelization support and subagent readiness; gate template becomes slightly more complex

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

1. Create diagram generator base classes (`MermaidDiagramGenerator`, `DotDiagramGenerator`) with configurable complexity thresholds
2. Implement Graphviz availability detection with warning fallback and `zeno setup graphviz` helper
3. Implement core diagram generators (5 types) using LLM-driven content generation via MCP templates
4. Implement conditional diagram generators (5 types) with per-gate scoping
5. Build diagram selection logic with configurable complexity thresholds (nodes + edges, nesting depth)
6. Add `## Architecture Diagrams` section to gate PRD template with ordering and dependency metadata
7. Implement `zeno arch generate` command (LLM-driven via MCP)
8. Implement `zeno arch show` command
9. Build architecture metadata scanner (runtime folder parsing of `zeno/architecture/`)
10. Implement gate structure change detection for architecture review triggers
11. Implement inline SVG embedding with `<details>` collapse for large diagrams
12. Write comprehensive tests (generators, rendering, selection logic, metadata scanning)
13. Validate inline SVG rendering in GitHub and VSCode markdown preview

## Gate Completion Criteria

- [ ] All 5 core diagrams generated correctly for sample projects (system-overview, data-flow, gate-lifecycle, gate-roadmap, context)
- [ ] Mermaid diagrams render correctly in markdown (syntax validation)
- [ ] Graphviz DOT diagrams render to valid inline SVG via host `dot` CLI
- [ ] Graceful fallback to Mermaid-only when Graphviz is not installed (warning emitted)
- [ ] `zeno setup graphviz` prints correct platform-specific install instructions
- [ ] Diagram selection logic correctly applies configurable complexity thresholds (nodes + edges, nesting depth)
- [ ] Gate-level diagrams generated per-gate when complexity triggers them, with correct naming convention
- [ ] Infrastructure diagrams generated only for infrastructure-focused gates
- [ ] Gate PRD template includes `## Architecture Diagrams` section with diagram metadata (name, type, order, dependencies)
- [ ] `zeno arch generate` invokes LLM-driven generation through MCP template exposure
- [ ] `zeno arch show <type>` retrieves and displays diagrams correctly
- [ ] Architecture metadata scanner correctly indexes `zeno/architecture/` folder contents
- [ ] Gate structure changes trigger architecture review notification
- [ ] Inline SVG renders correctly in both GitHub and VSCode markdown preview
- [ ] Large SVG diagrams wrapped in `<details>` collapse blocks
- [ ] Test coverage >=90% for diagram generation and selection modules
- [ ] All tests passing with TypeScript strict mode
- [ ] Zero lint errors, zero type errors
