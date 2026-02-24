# Gate 06: Multi-Repo & Subproject Detection

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Updated**: 2026-02-23  
**Sequence**: 6 of 14  
**Hash**: #g06multirepo

## Overview

Implements multi-repository and subproject support for distributed systems. This gate leverages Zeno's existing MCP server — which already exposes project scanning, architecture, and gate data to LLMs — for boundary analysis and repository recommendations. No dedicated `read_project_structure` tool is needed; the LLM uses existing MCP capabilities to understand project structure.

Delivers repository declaration and CRUD in SQLite, cross-repo dependency tracking, interactive LLM-guided repository setup, CLI commands for managing repositories, and cross-project Zeno state synchronization. The `coupling-analyzer` agent (`agents/pipeline-agents/03-validation/coupling-analyzer.md`) handles coupling analysis as an LLM task rather than hardcoded metrics.

**Key scoping principle**: Proposals are always scoped to the current working repository. Gates can span multiple repositories, but multi-repo gates produce separate proposals per repo.

## Objectives

### Repository Declaration & Storage
- [ ] Create repositories table in SQLite database (name, path, type, url, metadata)
- [ ] Implement repository CRUD operations (insert, update, delete, query)
- [ ] Build repository hash registry (content-addressable references)
- [ ] Support repository metadata (type suggestions: main/service/library/tool, description)
- [ ] Repository type is an LLM suggestion, not a rigid classifier — e.g., if Zeno manages 5 subprojects with shared code, the LLM may suggest creating a `library` repo

### Interactive Repository Declaration
- [ ] Users declare repos interactively via LLM conversation (MCP or CLI)
- [ ] Support local git repo paths and remote URLs as input
- [ ] LLM validates paths/URLs and confirms with user before persisting
- [ ] `zeno repos add` accepts path or URL argument for non-interactive use
- [ ] No separate `read_project_structure` MCP tool — leverage existing scanning, architecture, and gate MCP tools already exposed to LLMs

### LLM-Driven Boundary Recommendation
- [ ] **Use Code Analyzer** (`src/analysis/ast-analyzer.ts`, Gate 02) to enumerate imports in candidate repositories
- [ ] **Use Dependency Analyzer** (`src/analysis/dependency-analyzer.ts`, Gate 02) to build per-repo dependency graphs
- [ ] **Use Metrics Calculator** (`src/analysis/metrics-calculator.ts`, Gate 02) to calculate afferent/efferent coupling for each module
- [ ] **Use MCP Project Scanning** (`project_list`, `project_show` from Gate 03) to expose project structure to LLM
- [ ] LLM analyzes metrics and structure to identify natural boundaries (via coupling-analyzer agent guidance)
- [ ] Leverage `coupling-analyzer` agent for boundary recommendations with rationale
- [ ] LLM suggests repository boundaries with rationale (suggestions, not enforced rules)
- [ ] Support human override of LLM-recommended boundaries
- [ ] No hardcoded coupling metrics calculator, domain boundary analyzer, or module size analyzer (Gate 2 metrics feed LLM, not hardcoded rules)

### Cross-Repository Dependency Tracking
- [ ] Implement cross-repository relationship tracking in SQLite
- [ ] Create repository dependency resolution queries
- [ ] **Use Dependency Graph utilities** (`src/generation/dependency-graph.ts`, Gate 04) to render cross-repo relationships
- [ ] Build dependency visualization (via architecture diagram system from Gate 05)
- [ ] **Use Circular Dependency Detection** logic from Gate 04 (DFS with transaction rollback) for repository graphs
- [ ] Circular dependency detection triggers on project initialization and rebase/rescope
- [ ] Dependencies determined via: explicit user declaration, **import/file reference analysis using AST + Dependency Analyzer from Gate 02** (with user confirmation — not every import is a team-owned repo)

### Repository Management Commands
- [ ] Implement `zeno repos list` command (display declared repositories)
- [ ] Implement `zeno repos deps` command (show cross-repo dependency graph)
- [ ] Implement `zeno repos add <path|url>` command (declare a new repository)
- [ ] Implement `zeno repos remove` command (remove a repository declaration)

### Cross-Project Zeno State Sync
- [ ] Store Zeno project references in each subproject's database (which other Zeno projects exist)
- [ ] Track gate completion status across subprojects
- [ ] When a gate is completed in one subproject, signal dependent subprojects
- [ ] Expose sync status via MCP tool for LLM-driven coordination
- [ ] Detailed git-level sync operations deferred to Gate 10

### Proposal-Repository Scoping
- [ ] Proposals are always scoped to the current working repository
- [ ] Gates can reference multiple repositories
- [ ] Multi-repo gates produce separate proposals per repo (one proposal per working repo)
- [ ] Track which repository each proposal targets

### Testing & Quality
- [ ] Write unit tests for repository CRUD operations
- [ ] Test cross-repo dependency queries
- [ ] Test circular dependency detection
- [ ] Test cross-project state sync logic
- [ ] Achieve 90% test coverage for multi-repo module

## Context

### What Was Completed Before This Gate

Gate 01-05 established:
- **Gate 01**: Core infrastructure, CLI framework, SQLite database with migration system
- **Gate 02**: Zeno engine with iterative gate generation, code analysis capabilities:
  - Code analyzer using AST parsing (`src/analysis/ast-analyzer.ts`)
  - Dependency graph generation from AST analysis (`src/analysis/dependency-analyzer.ts`)
  - Code metrics calculator for coupling/cohesion/complexity (`src/analysis/metrics-calculator.ts`)
  - Project-level requirement generation from end state analysis
  - Available MCP tools: `project_analyze`, `analyze_dependencies`, `calculate_metrics`
- **Gate 03**: MCP server with function registry exposing Zeno operations as invocable functions
  - Project scanning via existing MCP tools (`project_list`, `project_show`)
  - Architecture data queryable via MCP (`arch_show`, `arch_catalogue`)
- **Gate 04**: Requirements database with CRUD and dependency tracking
  - Dependency graph utilities with ASCII tree and Mermaid rendering (`src/generation/dependency-graph.ts`)
  - Hierarchical requirement queries (children, ancestors, by level)
  - Circular dependency detection via DFS with transaction rollback
  - Available MCP tools: `req_list`, `req_show`, `req_deps`
- **Gate 05**: Architecture diagram generation system
  - Complexity analyzer for threshold-based scoring (`src/generation/complexity-analyzer.ts`)
  - Gate change detector for structural analysis (`src/generation/gate-change-detector.ts`)
  - 10 diagram types (5 core + 5 conditional) enabling visual relationship mapping
  - Available MCP tools: `arch_generate`, `arch_show`, `arch_list`

### Analysis Features Available for Import/Coupling Analysis

Gate-06 leverages these specific analysis tools from earlier gates:

| Analysis Tool | Source | Purpose for Gate-06 |
|---|---|---|
| **Code Analyzer** (`ast-analyzer.ts`) | Gate 02 | Parse repository files to extract import statements |
| **Dependency Analyzer** (`dependency-analyzer.ts`) | Gate 02 | Build internal import graph within each repository |
| **Metrics Calculator** (`metrics-calculator.ts`) | Gate 02 | Calculate afferent/efferent coupling for boundary recommendations |
| **MCP Project Scanning** (`project_list`, `project_show`) | Gate 03 | Enumerate repository structure and file organization |
| **Requirements Dependency Graph** (`dependency-graph.ts`) | Gate 04 | Model cross-repo requirement dependencies and inheritance |
| **Gate Change Detector** (`gate-change-detector.ts`) | Gate 05 | Identify code changes that cross repository boundaries |
| **coupling-analyzer agent** | External | Guide LLM in interpreting metrics for boundary recommendations |

### What This Gate Enables

- **Gate 7 (Proposal Generation)**: Repository information scopes proposals to working repo; multi-repo gates split into per-repo proposals
- **Gate 10 (Git Integration)**: Multi-repo context enables subproject git syncing — pulling gate changes from completed subprojects into working directory
- **Gate 11 (Rescope)**: Cross-project state sync allows rescoping to account for changes in dependent subprojects

### Scope Boundaries

**In Scope**:
- SQLite repositories table and CRUD operations
- Interactive and CLI-based repository declaration (local paths, remote URLs)
- LLM-driven boundary recommendations via existing MCP capabilities
- Cross-repository dependency tracking (explicit + import-based with user confirmation)
- Circular dependency detection (triggered on init and rebase)
- `zeno repos` commands (list, deps, add, remove)
- Cross-project Zeno state references and gate completion signaling
- Proposal scoping: always current working repo; multi-repo gates produce per-repo proposals
- Leveraging existing `coupling-analyzer` agent for boundary analysis
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Hardcoded static analysis engine (coupling metrics, domain boundary analysis, module size analysis)
- Confidence scoring algorithms
- Repository scaffolding (package.json, tsconfig generation — not Zeno's job)
- Monorepo tooling integration (Turborepo, Nx)
- Git-level subproject sync operations (pulling/pushing gate changes — handled in Gate 10)
- Package publishing or distribution
- Cross-repo TypeScript path resolution
- File-level conflict detection between concurrent proposals (handled in Gate 10/13)

## Requirements

1. **Repository Declaration** — Users and LLMs can declare repository boundaries interactively or via CLI
2. **Cross-Repository Dependency Tracking** — All inter-repo dependencies visible, determined by explicit declaration and import analysis with user confirmation
3. **Proposal Scoping** — Proposals are always scoped to current working repo; multi-repo gates produce per-repo proposals
4. **LLM-Driven Analysis** — Boundary recommendations come from LLM analysis via existing MCP tools, not static metrics
5. **Cross-Project State Sync** — Zeno tracks gate completion across subprojects and signals dependencies

## Technical Decisions

### Analysis Feature Integration from Gates 1-3

**Code Analysis (`ast-analyzer.ts` from Gate 02)**
- **Purpose**: Parse each repository to extract module structure and imports
- **Usage in Gate-06**: Enumerate imports per file; build import map showing inter-module references
- **Example**: `astAnalyzer.parse(filePath)` returns ESTree AST; traverse to find all `ImportDeclaration` nodes
- **Gate-06 Responsibility**: Determine which imports are internal (team-owned) vs. external (third-party)

**Dependency Analysis (`dependency-analyzer.ts` from Gate 02)**
- **Purpose**: Build dependency graph from AST-parsed imports
- **Usage in Gate-06**: Per-repository analysis to identify internal dependencies
- **Example**: Feed parsed imports through `dependencyAnalyzer.buildGraph()` to get: `{ module: string, dependsOn: string[], dependents: string[] }`
- **Gate-06 Responsibility**: Aggregate per-repo graphs into cross-repo relationships

**Metrics Calculator (`metrics-calculator.ts` from Gate 02)**
- **Purpose**: Calculate code metrics (afferent, efferent coupling, complexity)
- **Usage in Gate-06**: Identify high-coupling modules that might belong in separate repositories
- **Example**: `metricsCalculator.calculateCoupling(dependencyGraph)` returns metrics informing boundary analysis
- **Gate-06 Responsibility**: Pass metrics to coupling-analyzer agent to recommend repo boundaries
- **Note**: Metrics inform LLM recommendations; final decision is LLM + user confirmation

**MCP Project Scanning (Gate 03)**
- **Purpose**: Enumerate project structure, file organization, module layout
- **Available in Gate-06**: `project_list`, `project_show` MCP tools expose repo metadata to LLM
- **Usage**: LLM uses these to understand codebase organization before boundaries are declared
- **Gate-06 Responsibility**: Ensure MCP tools are callable from within boundary analysis workflow

**Dependency Graph Utilities (`dependency-graph.ts` from Gate 04)**
- **Purpose**: Render dependency graphs as ASCII trees or Mermaid diagrams
- **Usage in Gate-06**: Visualize cross-repository dependencies for user review
- **Example**: `dependencyGraph.renderMermaid()` creates Mermaid diagram from repo dependency data
- **Gate-06 Responsibility**: Wire up cross-repo graph rendering into `zeno repos deps` command

**Circular Dependency Detection (from Gate 04)**
- **Purpose**: Detect cycles in dependency graphs using DFS
- **Usage in Gate-06**: Enforce acyclic repository dependency graph
- **Example**: `dependencyGraph.detectCycles()` returns cycle paths; abort repo declaration if cycle detected
- **Gate-06 Responsibility**: Integrate cycle detection into repo add/update operations with user notification

### 1. LLM-Driven Boundary Analysis via Existing MCP Tools
- **Choice**: LLMs use existing MCP tools (project scanning, architecture, gates) to analyze codebase and recommend boundaries; no dedicated `read_project_structure` tool needed
- **Alternatives Considered**: Dedicated MCP analysis tool, hardcoded metrics-based detection, heuristics-based (directory structure)
- **Rationale**: Zeno is an MCP server — all project scanning, architecture, and gate data is already exposed to the LLM. Adding another tool would be redundant. The `coupling-analyzer` agent provides structured guidance for the LLM's analysis. Code analysis from Gate 2 (AST parsing, metrics) feeds the LLM's understanding.
- **Trade-offs**: Gained simplicity (no new MCP tool); depends on LLM capability and existing tool coverage

### 2. Repository Storage in SQLite
- **Choice**: Repositories table in SQLite for queryability
- **Alternatives Considered**: JSON files, pure file-based tracking
- **Rationale**: SQLite enables efficient querying for dependency resolution. Consistent with existing requirements storage approach.

### 3. Proposal Scoping to Working Repository
- **Choice**: Proposals always target the current working repo; multi-repo gates split into per-repo proposals
- **Alternatives Considered**: Cross-repo proposals, monorepo-style single proposals
- **Rationale**: Keeps proposals atomic and testable within their repo context. Multi-repo coordination happens at the gate level, not the proposal level. Simplifies conflict detection and git operations.
- **Trade-offs**: Gained clarity in proposal ownership; requires gate-level orchestration for cross-repo work

### 4. Import-Based Dependency Detection with User Confirmation
- **Choice**: Analyze imports and file references to suggest dependencies, but prompt user for confirmation since not every import represents a team-owned repository
- **Alternatives Considered**: Fully automatic detection, manual-only declaration
- **Rationale**: Automatic detection catches obvious dependencies but may flag third-party packages as team repos. User confirmation prevents false positives.
- **Trade-offs**: Gained accuracy; adds interactive step

### 5. Repository Types as Suggestions
- **Choice**: Repository types (main/service/library/tool) are LLM-generated suggestions, not enforced categories
- **Alternatives Considered**: Rigid type system with different behavior per type, no types
- **Rationale**: The LLM recognizes patterns (e.g., 5 subprojects sharing common code → suggest a `library` repo) without needing hardcoded classifier logic. Types inform recommendations but don't gate behavior.
- **Trade-offs**: Gained flexibility; lost deterministic type-based rules (not needed for MVP)

## Implementation Steps

### Phase 1: Repository Storage & Basic CRUD
1. Add `repositories` table to SQLite schema (name, path, url, type, metadata, zeno_project_ref)
2. Implement repository CRUD operations (insert, update, delete, query)
3. Implement repository hash registry (content-addressable references)

### Phase 2: Interactive Repository Declaration
4. Build interactive repository declaration through LLM conversation (via MCP)
5. Support local git repo paths and remote URLs as input
6. Implement `zeno repos add <path|url>` CLI command for non-interactive use
7. LLM validates paths/URLs and confirms with user before persisting

### Phase 3: LLM-Driven Boundary Analysis (Leveraging Gate 2-3 Analysis Features)
8. **Use Code Analyzer** (`src/analysis/ast-analyzer.ts`) to enumerate imports in each repository
9. **Use Dependency Analyzer** (`src/analysis/dependency-analyzer.ts`) to build per-repository dependency graph
10. **Use Metrics Calculator** (`src/analysis/metrics-calculator.ts`) to calculate coupling metrics (afferent/efferent)
11. **Use MCP Project Scanning** (Gate 03 tools) to expose project structure to LLM
12. **Invoke coupling-analyzer agent** to guide LLM in recommending repository boundaries with rationale
13. Implement import/file reference analysis with user confirmation (not every import is a team-owned repo)
14. Propose repository boundaries with metrics-informed suggestions (not hardcoded rules)

### Phase 4: Cross-Repository Dependency Tracking
15. Implement cross-repository relationship tracking in SQLite
16. **Use Dependency Graph utilities** (`src/generation/dependency-graph.ts`) from Gate 04 for visualization
17. Create repository dependency resolution queries
18. **Use Circular dependency detection** logic from Gate 04 (DFS with transaction rollback)
19. Trigger circular dependency detection on project initialization and rebase/rescope

### Phase 5: Repository Management Commands & Syncing
20. Implement `zeno repos list` command (display declared repositories)
21. Implement `zeno repos deps` command (show cross-repo dependency graph)
22. Implement `zeno repos remove` command (remove a repository declaration)
23. Implement cross-project Zeno state sync (store references, track gate completion)
24. Expose sync status via MCP tool for LLM-driven coordination

### Phase 6: Proposal-Repository Scoping
25. Implement proposal-repository scoping logic (proposals scoped to current working repo)
26. Multi-repo gates produce separate proposals per repo
27. Track which repository each proposal targets

### Phase 7: Testing & Quality (Target 90% Coverage)
28. Write unit tests for repository CRUD operations
29. Write integration tests for import analysis using Gate 02 analysis tools
30. Write tests for cross-repo dependency queries and visualization
31. Write tests for circular dependency detection
32. Write tests for cross-project state sync logic
33. Achieve 90% test coverage for multi-repo module

## Gate Completion Criteria

- [ ] Repositories can be declared interactively (via LLM) or via `zeno repos add <path|url>`
- [ ] Repository CRUD operations work (create, read, update, delete)
- [ ] Cross-repo dependency graph generated from declared relationships and import analysis
- [ ] Circular dependencies detected and reported on init and rebase
- [ ] `zeno repos list` shows all declared repositories with metadata
- [ ] `zeno repos deps` displays dependency graph
- [ ] `zeno repos add/remove` manage repository declarations
- [ ] LLM can analyze project structure via existing MCP tools and recommend boundaries
- [ ] Proposals are scoped to current working repo
- [ ] Multi-repo gates produce separate proposals per repo
- [ ] Cross-project Zeno state references stored and queryable
- [ ] Gate completion in one subproject signals dependent subprojects
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for multi-repo module
- [ ] Zero lint errors, zero type errors
