# Gate 05: Architecture & Diagram Generation

**Status**: in_progress
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 5 of 12  
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

### Additional Diagram Types (LLM-Driven Selection via MCP)

- [ ] Implement sequence diagram generator (temporal interactions for complex workflows)
- [ ] Implement component diagram generator (detailed module structure for complex components)
- [ ] Implement package diagram generator (code organization and module dependencies)
- [ ] Implement deployment diagram generator (runtime infrastructure, deployment topology)
- [ ] Implement network diagram generator (network topology, communication patterns)
- [ ] LLM selects which additional diagrams are needed per-gate via MCP tools (no algorithmic auto-detection)

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
- [ ] Implement `zeno arch show <type>` command (retrieves specific diagram from `zeno/architecture/`)
- [ ] Implement gate structure change detection (notifies LLM via MCP when gates change, triggering architecture review)

### Diagram Selection (LLM-Driven via MCP)

- [ ] Expose diagram type catalogue via MCP tool (available types, descriptions, when useful)
- [ ] LLM selects diagrams based on gate PRD context and project structure
- [ ] Support explicit diagram type requests from user or LLM via MCP tools
- [ ] No algorithmic complexity detection — LLMs determine need based on context

### Gate Template Integration

- [ ] Add `## Architecture Diagrams` section to gate PRD template
- [ ] Define per-gate diagram entries with: name, type, and order
- [ ] Integrate diagram metadata into gate generation flow (produced alongside requirements)

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
- **Gate 10 (Git Integration)**: Architecture diagrams committed with proposals for context
- **LLM-driven workflows**: Visual diagrams help LLMs understand system structure for proposal generation

### Scope Boundaries

**In Scope**:

- Mermaid diagram generation for simple diagrams (below configurable complexity threshold)
- Graphviz DOT diagram generation for complex models (above threshold) with inline SVG embedding
- Graphviz as host-installed dependency with graceful fallback and setup helper
- Five core diagrams: system overview, data flow, gate lifecycle, gate roadmap, context
- Additional diagrams: sequence, component, package, deployment, network (LLM-selected per-gate via MCP)
- LLM-driven content generation via MCP template exposure (strict format, flexible content)
- LLM-driven diagram selection via MCP (no algorithmic complexity detection)
- Gate PRD template integration with diagram metadata (name, type, order, dependencies)
- Gate structure change detection triggering architecture review (LLM-driven propagation)
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

### 2. LLM-Driven Diagram Selection

- **Choice**: LLM selects which additional diagrams to generate based on gate PRD context, project structure, and user input via MCP tools
- **Alternatives Considered**: Algorithmic complexity detection, generate all 10 types for every project, user manual selection only
- **Rationale**: LLMs understand project context better than threshold-based algorithms. MCP tool exposure lets the LLM assess what diagrams are valuable. Keeps Zeno lightweight — no static analysis engine for diagram selection.
- **Trade-offs**: Gained simplicity and context-aware selection; depends on LLM quality for selection decisions

### 3. Core vs. Additional Diagrams

- **Choice**: 5 core diagrams (always generated), 5 additional types (LLM-selected per-gate)
- **Alternatives Considered**: All 10 types always, minimal set only, fully manual
- **Rationale**: Core diagrams provide baseline understanding. Additional diagrams generated when LLM determines they add value for a given gate.

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

### 6. Git-Based Diagram Versioning

- **Choice**: Rely on Git commit history for versioning; no application-level version tracking
- **Alternatives Considered**: SemVer per diagram, content-hash snapshots, database version table
- **Rationale**: Diagrams are markdown files in `zeno/architecture/` already under Git version control. Adding application-level versioning duplicates what Git provides natively. `git log -- zeno/architecture/system-overview.md` gives full history.
- **Trade-offs**: Gained simplicity; version queries require Git CLI access rather than database lookup

### 7. Inline SVG Rendering for Complex Diagrams

- **Choice**: Graphviz DOT diagrams render to inline SVG embedded directly in markdown files
- **Alternatives Considered**: External `.svg` files with image links, base64 data URIs, PNG images
- **Rationale**: Inline SVG renders natively in both GitHub markdown preview and VSCode markdown preview without external file references. This keeps diagrams self-contained within their markdown artifact, avoids broken image links, and supports text search within diagram labels.
- **Context bloat mitigation**: For diagrams exceeding a configurable size threshold, SVG is placed in a `<details>` collapse block with a summary description, keeping the markdown scannable while preserving the full diagram inline.
- **Trade-offs**: Gained universal rendering support (GitHub + VSCode); larger markdown files for complex diagrams (mitigated by collapse blocks)

### 8. LLM-Driven Diagram Authoring (Not Direct File Writes)

- **Choice**: Diagram generation is LLM-driven through MCP tool interactions, not programmatic file writes
- **Workflow**:
  1. MCP exposes architecture templates as resources (already built in Gate 03)
     n 2. LLM reads template + project context (gates, requirements, existing architecture)
  2. LLM generates diagram content following template structure
  3. LLM writes diagram file through MCP file tools or CLI
- **Regeneration triggers**:
  - `zeno arch generate` CLI command invokes LLM-driven generation for all applicable diagrams
  - Gate structure changes (new gates, reordering, rescoping) trigger architecture review notification
  - LLM/user can regenerate individual diagrams on demand via MCP tools
- **Existing diagram handling**: LLM receives existing diagrams as context when regenerating, enabling incremental updates rather than blind overwrites. The LLM decides whether changes are needed based on current project state vs. diagram content.
- **Trade-offs**: Gained semantic understanding and contextual accuracy; generation requires LLM availability; non-deterministic output (mitigated by template structure enforcement)

### 9. Gate-Level Diagrams Scoped Per-Gate with Proposal Metadata

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

## Implementation Steps

<!--
  Test-First Gate Pattern applied to Gate 05.
  Proposals 01-03 were completed before the pattern was established (no role).
  Proposal 04 = test-suite (RED): failing acceptance tests for P05-08 written before implementation.
  Proposals 05-08 are implementation proposals (no role field — predates pattern).
  Proposal 09 = test-cleanup (GREEN): writes tests for P01-03 and refines P04 RED tests to pass.
  Sequence: P01-03 (done) → P04 (RED) → P05-08 (impl) → P09 (GREEN)
-->

1. Create diagram generator base classes (`MermaidDiagramGenerator`, `DotDiagramGenerator`) with configurable complexity thresholds
2. Implement Graphviz availability detection with warning fallback and `zeno setup graphviz` helper
3. Implement core diagram generators (5 types) using LLM-driven content generation via MCP templates
4. **Approve P04 test-suite (RED)** — write failing tests for P05-08 modules before implementation
5. Implement conditional diagram generators (5 types) with per-gate scoping
6. Build diagram selection logic with configurable complexity thresholds (nodes + edges, nesting depth)
7. Add `## Architecture Diagrams` section to gate PRD template with ordering and dependency metadata
8. Implement `zeno arch generate` command (LLM-driven via MCP)
9. Implement `zeno arch show` command
10. Implement gate structure change detection for architecture review triggers (LLM-driven notification)
11. Implement inline SVG embedding with `<details>` collapse for large diagrams
12. Validate inline SVG rendering in GitHub and VSCode markdown preview
13. **Approve P09 test-cleanup (GREEN)** — write tests for P01-03 and refine P04 RED tests to all pass

## Gate Completion Criteria

- [ ] All 5 core diagrams generated correctly for sample projects (system-overview, data-flow, gate-lifecycle, gate-roadmap, context)
- [ ] Mermaid diagrams render correctly in markdown (syntax validation)
- [ ] Graphviz DOT diagrams render to valid inline SVG via host `dot` CLI
- [ ] Graceful fallback to Mermaid-only when Graphviz is not installed (warning emitted)
- [ ] `zeno setup graphviz` prints correct platform-specific install instructions
- [ ] LLM-driven diagram selection works via MCP tools (no algorithmic complexity detection)
- [ ] Additional diagrams generated per-gate when LLM selects them, with correct naming convention
- [ ] Gate PRD template includes `## Architecture Diagrams` section with diagram metadata (name, type, order)
- [ ] `zeno arch generate` invokes LLM-driven generation through MCP template exposure
- [ ] `zeno arch show <type>` retrieves and displays diagrams correctly
- [ ] Gate structure changes trigger architecture review notification to LLM
- [ ] Inline SVG renders correctly in both GitHub and VSCode markdown preview
- [ ] Large SVG diagrams wrapped in `<details>` collapse blocks
- [ ] Test coverage >=90% for diagram generation, rendering, and selection modules
- [ ] All tests passing with TypeScript strict mode
- [ ] Zero lint errors, zero type errors

## Proposals

**Status**: Proposals generated, pending implementation.

[View detailed proposal information via: `zeno proposal show <hash>`]

### Proposal Status

| #   | Proposal                                      | Hash             | Status    | Role         | Notes                                                                  |
| --- | --------------------------------------------- | ---------------- | --------- | ------------ | ---------------------------------------------------------------------- |
| 01  | Complexity Analyzer & Configuration           | #p05g01complxcf0 | completed | —            | Foundational - no dependencies                                         |
| 02  | Rendering Base Classes & Graphviz Integration | #p05g02rendbase0 | completed | —            | Requires #p05g01complxcf0                                              |
| 03  | Core Diagram Generators                       | #p05g03corediag0 | completed | —            | Requires #p05g02rendbase0                                              |
| 04  | Gate 05 Test Suite (RED)                      | #p05g08testsuite | pending   | test-suite   | RED phase: failing tests for P05-08, requires P01-03                   |
| 05  | Conditional Diagram Generators                | #p05g04conddiag0 | pending   | —            | Requires #p05g02rendbase0, #p05g01complxcf0                            |
| 06  | Diagram Selection Logic & Integration         | #p05g05diagselec | pending   | —            | Requires #p05g01complxcf0, #p05g03corediag0, #p05g04conddiag0          |
| 07  | Gate Template Integration                     | #p05g06gatetmpl0 | pending   | —            | Requires #p05g05diagselec                                              |
| 08  | CLI Commands & Function Registry Integration  | #p05g07cliregint | pending   | —            | Requires #p05g02rendbase0..#p05g06gatetmpl0                            |
| 09  | Test Cleanup (GREEN)                          | #p05g09testclean | pending   | test-cleanup | GREEN phase: tests for P01-03 + refine P04 tests, requires all P01-P08 |

### Proposal Dependency Graph

```mermaid
graph LR
    p01["01 Complexity Analyzer ✅"] --> p02
    p01 --> p04
    p01 --> p05
    p01 --> p06
    p02["02 Rendering Base Classes ✅"] --> p03
    p02 --> p05
    p02 --> p08
    p03["03 Core Diagram Generators ✅"] --> p04
    p03 --> p06
    p01 --> p04
    p02 --> p04
    p03 --> p04
    p04["04 Test Suite 🔴 RED"] --> p09
    p05["05 Conditional Diagram Generators"] --> p06
    p06["06 Diagram Selection Logic"] --> p07
    p06 --> p08
    p07["07 Gate Template Integration"] --> p08
    p05 --> p08
    p03 --> p08
    p08["08 CLI Commands & Registry"] --> p09
    p09["09 Test Cleanup 🟢 GREEN"]
```
