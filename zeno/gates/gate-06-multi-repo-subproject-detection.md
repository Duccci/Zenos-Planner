# Gate 06: Multi-Repo & Subproject Detection

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 6 of 13  
**Hash**: #g06multirepo

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements automatic repository boundary detection and multi-repository support for distributed systems. This gate analyzes codebases to identify logical repository boundaries based on coupling metrics (afferent/efferent), domain boundaries (bounded contexts), and module size (LOC, complexity). Delivers repository boundary detection algorithm with confidence scoring, dependency graph generation across repositories, cross-repo dependency tracking, repository scaffolding system (package.json, tsconfig, etc.), and CLI commands for querying repository structure. Enables large-scale projects to decompose into properly separated services, libraries, and tools with clear boundaries and minimal cross-repo conflicts during parallel proposal execution.

## Objectives

### Repository Boundary Detection
- [ ] Implement repository boundary detection algorithm based on coupling metrics
- [ ] Create coupling metrics calculator (afferent coupling, efferent coupling, instability)
- [ ] Build domain boundary analyzer (identify bounded contexts and cohesive modules)
- [ ] Implement module size analyzer (LOC, cyclomatic complexity, dependencies)
- [ ] Create confidence scoring system (0.0-1.0) for detected boundaries
- [ ] Support manual boundary override (allow users to adjust detected boundaries)
- [ ] Build repository validation rules (no circular dependencies between repos)

### Repository Storage & CRUD
- [ ] Create repositories table in SQLite database (name, path, type, metadata)
- [ ] Implement repository CRUD operations (insert, update, delete, query)
- [ ] Build repository hash registry (content-addressable references)
- [ ] Implement cross-repository relationship tracking
- [ ] Create repository dependency resolution queries
- [ ] Support repository metadata (type: main/service/library/tool, description)

### Repository Scaffolding
- [ ] Create scaffolding templates (package.json, tsconfig.json, eslint config, vitest config)
- [ ] Build repo initialization system (generate scaffolding for new repos)
- [ ] Support TypeScript-based project scaffolding (web apps, CLI tools, libraries)
- [ ] Implement configuration inheritance from root project

### Dependency Tracking Across Repos
- [ ] Build cross-repository dependency graph generator
- [ ] Implement import tracking across repository boundaries
- [ ] Create dependency conflict detection (circular dependencies, version conflicts)
- [ ] Build dependency visualization for multi-repo systems
- [ ] Implement package.json dependency scanning
- [ ] Create TypeScript path resolution across repos (tsconfig "paths")

### Repository Management Commands
- [ ] Implement `zeno repos list` command (display detected repositories with confidence scores)
- [ ] Implement `zeno repos deps` command (show cross-repo dependency graph)
- [ ] Implement `zeno repos detect` command (re-run boundary detection algorithm)
- [ ] Implement `zeno repos adjust` command (manually modify detected boundaries)
- [ ] Create repository status reporting (LOC per repo, dependency counts)

### Integration with Proposal Execution
- [ ] Track which repositories each proposal modifies
- [ ] Identify file conflicts between concurrent proposals (prevent parallel work on same files across repos)
- [ ] Support proposal-to-repository mapping for conflict detection
- [ ] Enable dependency-based proposal sequencing (can't run proposal B until B's dependencies from proposal A merge)

### Testing & Quality
- [ ] Write unit tests for coupling metrics calculation
- [ ] Write tests for boundary detection algorithm
- [ ] Test repository CRUD operations and queries
- [ ] Test cross-repo dependency graph generation
- [ ] Test conflict detection logic
- [ ] Achieve 90% test coverage for multi-repo module

## Context

### What Was Completed Before This Gate

Gate 01-05 established:
- Core infrastructure, CLI framework, SQLite database
- Zeno engine with iterative gate generation
- MCP server with function registry
- Requirements database layer with CRUD and dependency tracking
- Architecture diagram generation with intelligent selection

### What This Gate Enables

- **Gate 7 (Proposal Generation)**: Repository information helps decompose proposals and assign to repos
- **Gate 9 (Git Integration)**: Multi-repo context enables conflict detection during parallel execution
- **Gate 12 (Subagent Orchestration)**: Repository dependencies help identify which proposals can run in parallel
- **Gate 13 (Documentation)**: Repository structure is documented and visualized
- **LLM-driven workflows**: LLMs understand repository structure for cross-repo proposal generation

### Scope Boundaries

**In Scope**:
- Repository boundary detection algorithm (coupling metrics, domain analysis, module size)
- Confidence scoring (0.0-1.0) for detected boundaries
- SQLite repositories table and CRUD operations
- Cross-repository dependency tracking and graph generation
- Circular dependency detection
- Repository scaffolding system (package.json, tsconfig, eslint, vitest templates)
- `zeno repos list`, `zeno repos deps`, `zeno repos detect`, `zeno repos adjust` commands
- File-level conflict detection for concurrent proposals
- Repository validation and constraint checks
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Creating actual repositories on filesystem (scaffolding only generates templates, user decides implementation)
- Monorepo tooling integration (Turborepo, Nx) - out of scope for MVP
- Git repository operations (handled in Gate 9)
- Package publishing or distribution
- Version management or semantic versioning
- Workspace configuration (handled by individual repos via scaffolding)
- Cross-repo refactoring tools (code moves between repos)

## Requirements

This gate addresses architectural separation requirements from project initialization:

1. **Automatic Repository Boundary Detection** - System automatically identifies proper repo boundaries based on coupling and cohesion metrics
2. **Cross-Repository Dependency Tracking** - All inter-repo dependencies visible for conflict detection and proper sequencing
3. **Conflict Prevention in Parallel Execution** - Prevents concurrent proposals from modifying same files across repos
4. **Repository Scaffolding** - New repos can be created with standard project structure
5. **Large-Scale Project Support** - Multi-repo systems properly managed with clear boundaries

## Technical Decisions

### 1. Metrics-Based Boundary Detection
- **Choice**: Automatic detection using coupling (afferent/efferent), domain boundaries, and module size metrics with confidence scoring
- **Alternatives Considered**: Manual repo definition, heuristics-based (directory structure), monorepo-only, user-driven splitting
- **Rationale**: Metrics-based approach is objective, repeatable, and scales. Confidence scoring allows human override when needed.
- **Trade-offs**: Gained objectivity and scalability; added complexity in metrics calculation

### 2. Hybrid Storage: Repositories in SQLite + Project Metadata
- **Choice**: Repositories table in SQLite for queryability, metadata in `project-overview.json` for human readability
- **Alternatives Considered**: Separate JSON files per repo, monolithic database, pure file-based tracking
- **Rationale**: SQLite enables efficient querying for dependency resolution and conflict detection. JSON metadata provides version-controlled human reference.
- **Trade-offs**: Gained queryability and efficiency; added slight complexity in keeping both sources in sync

### 3. Conflict Detection Strategy
- **Choice**: Track files modified by each proposal, prevent parallel execution of proposals modifying overlapping files
- **Alternatives Considered**: Optimistic merging with conflict resolution, serialized proposal execution, merge conflict automation
- **Rationale**: Prevents merge conflicts proactively. LLMs can understand dependency chain and sequence proposals correctly.
- **Trade-offs**: Gained safety and clarity; limited parallelization to non-overlapping changes

## Architecture & Dependencies

### Repository Detection
- `CouplingMetricsCalculator` - Calculates afferent/efferent coupling, instability
- `DomainBoundaryAnalyzer` - Identifies domain-driven design boundaries
- `ModuleSizeAnalyzer` - Analyzes LOC, complexity, dependencies per module
- `BoundaryDetector` - Synthesizes metrics into repository boundaries with confidence scores
- `ConflictDetector` - Identifies file overlaps between concurrent proposals

### Repository Storage
- `RepositoryDatabase` - CRUD operations on repositories table
- `RepositoryHashRegistry` - Content-addressable references for repositories

### Dependency Tracking
- `CrossRepoDependencyGraph` - Maps imports/dependencies across repository boundaries
- `PackageJsonScanner` - Identifies package dependencies and versions
- `TypeScriptPathResolver` - Resolves tsconfig "paths" across repos
- `CircularDependencyDetector` - Finds cycles in repo dependency graph

## Implementation Steps

1. Implement coupling metrics calculator
2. Build domain boundary analyzer
3. Implement module size analyzer
4. Create boundary detection algorithm with confidence scoring
5. Add repositories table to SQLite schema
6. Implement repository CRUD operations
7. Build cross-repo dependency graph generator
8. Implement file conflict detection
9. Create repository scaffolding templates
10. Implement `zeno repos` commands (list, deps, detect, adjust)
11. Write comprehensive tests
12. Integrate with proposal execution

## Gate Completion Criteria

- [ ] Boundary detection algorithm produces meaningful results on sample codebases
- [ ] Confidence scoring correctly reflects boundary quality (0.0-1.0 scale)
- [ ] Cross-repo dependency graph generated correctly from import analysis
- [ ] Circular dependencies correctly detected and reported
- [ ] `zeno repos list` shows all detected repositories with metadata and confidence scores
- [ ] `zeno repos deps` displays dependency graph accurately
- [ ] `zeno repos detect` re-runs analysis and updates results
- [ ] `zeno repos adjust` allows manual boundary modifications
- [ ] File conflict detection prevents concurrent proposals from overlapping changes
- [ ] Repository scaffolding generates valid package.json, tsconfig.json, config files
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for multi-repo module
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for repository detection and multi-repo workflow
