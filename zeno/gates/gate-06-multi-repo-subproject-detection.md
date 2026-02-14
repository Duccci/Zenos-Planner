# Gate 06: Multi-Repo & Subproject Detection

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 6 of 12  
**Hash**: #g06multirepo

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements multi-repository and subproject support for distributed systems. Rather than building a static analysis engine, this gate leverages Zeno's MCP server to expose project structure to LLMs, which perform boundary analysis and recommend repository separation. Delivers repository declaration and CRUD in SQLite, cross-repo dependency tracking, LLM-driven boundary recommendation via MCP tools, and CLI commands for managing repositories. The coupling-analyzer agent (`agents/pipeline-agents/03-validation/coupling-analyzer.md`) handles coupling analysis as an LLM task rather than hardcoded metrics.

## Objectives

### Repository Declaration & Storage
- [ ] Create repositories table in SQLite database (name, path, type, metadata)
- [ ] Implement repository CRUD operations (insert, update, delete, query)
- [ ] Build repository hash registry (content-addressable references)
- [ ] Support repository metadata (type: main/service/library/tool, description)
- [ ] Support manual repository declaration (user declares repos via CLI or MCP)

### LLM-Driven Boundary Recommendation
- [ ] Expose project structure via MCP tool (`read_project_structure`) for LLM analysis
- [ ] Leverage `coupling-analyzer` agent for boundary recommendations
- [ ] LLM analyzes codebase via MCP and suggests repository boundaries with rationale
- [ ] Support human override of LLM-recommended boundaries
- [ ] No hardcoded coupling metrics calculator, domain boundary analyzer, or module size analyzer

### Cross-Repository Dependency Tracking
- [ ] Implement cross-repository relationship tracking in SQLite
- [ ] Create repository dependency resolution queries
- [ ] Build dependency visualization (via architecture diagram system from Gate 05)
- [ ] Detect circular dependencies between declared repositories

### Repository Management Commands
- [ ] Implement `zeno repos list` command (display declared repositories)
- [ ] Implement `zeno repos deps` command (show cross-repo dependency graph)
- [ ] Implement `zeno repos add` command (declare a new repository)
- [ ] Implement `zeno repos remove` command (remove a repository declaration)

### Integration with Proposals
- [ ] Track which repositories each proposal modifies
- [ ] Identify file conflicts between concurrent proposals across repos
- [ ] Support proposal-to-repository mapping for conflict detection

### Testing & Quality
- [ ] Write unit tests for repository CRUD operations
- [ ] Test cross-repo dependency queries
- [ ] Test conflict detection logic
- [ ] Achieve 90% test coverage for multi-repo module

## Context

### What Was Completed Before This Gate

Gate 01-05 established:
- Core infrastructure, CLI framework, SQLite database
- Zeno engine with iterative gate generation
- MCP server with function registry
- Requirements database with CRUD and dependency tracking
- Architecture diagram generation

### What This Gate Enables

- **Gate 7 (Proposal Generation)**: Repository information helps decompose proposals and assign to repos
- **Gate 10 (Git Integration)**: Multi-repo context enables conflict detection during parallel execution

### Scope Boundaries

**In Scope**:
- SQLite repositories table and CRUD operations
- Manual and LLM-recommended repository declaration
- Cross-repository dependency tracking
- Circular dependency detection
- `zeno repos` commands (list, deps, add, remove)
- File-level conflict detection for concurrent proposals
- Leveraging existing `coupling-analyzer` agent for boundary analysis
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Hardcoded static analysis engine (coupling metrics, domain boundary analysis, module size analysis)
- Confidence scoring algorithms
- Repository scaffolding (package.json, tsconfig generation — not Zeno's job)
- Monorepo tooling integration (Turborepo, Nx)
- Git repository operations (handled in Gate 10)
- Package publishing or distribution
- Cross-repo TypeScript path resolution

## Requirements

1. **Repository Declaration** — Users and LLMs can declare repository boundaries
2. **Cross-Repository Dependency Tracking** — All inter-repo dependencies visible for conflict detection
3. **Conflict Prevention** — Prevents concurrent proposals from modifying same files across repos
4. **LLM-Driven Analysis** — Boundary recommendations come from LLM analysis via MCP, not static metrics

## Technical Decisions

### 1. LLM-Driven Boundary Analysis via MCP
- **Choice**: Expose project structure via MCP tools; LLMs (with agent scripts like `coupling-analyzer`) analyze and recommend boundaries
- **Alternatives Considered**: Hardcoded metrics-based detection (afferent/efferent coupling, domain boundaries, module size), heuristics-based (directory structure)
- **Rationale**: LLMs understand project context, domain boundaries, and architectural intent better than threshold-based static analysis. Keeps Zeno lightweight — no metrics engine. Leverages existing agent infrastructure.
- **Trade-offs**: Gained simplicity and context-awareness; depends on LLM capability for analysis quality

### 2. Repository Storage in SQLite
- **Choice**: Repositories table in SQLite for queryability
- **Alternatives Considered**: JSON files, pure file-based tracking
- **Rationale**: SQLite enables efficient querying for dependency resolution and conflict detection. Consistent with existing requirements storage approach.

## Implementation Steps

1. Add repositories table to SQLite schema
2. Implement repository CRUD operations
3. Expose project structure via MCP tool for LLM analysis
4. Implement cross-repo dependency tracking queries
5. Implement `zeno repos` commands (list, deps, add, remove)
6. Implement file conflict detection for concurrent proposals
7. Write comprehensive tests

## Gate Completion Criteria

- [ ] Repositories can be declared, queried, updated, and deleted
- [ ] Cross-repo dependency graph generated from declared relationships
- [ ] Circular dependencies correctly detected and reported
- [ ] `zeno repos list` shows all declared repositories with metadata
- [ ] `zeno repos deps` displays dependency graph
- [ ] `zeno repos add/remove` manage repository declarations
- [ ] LLM can analyze project structure via MCP and recommend boundaries
- [ ] File conflict detection prevents concurrent proposals from overlapping
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for multi-repo module
- [ ] Zero lint errors, zero type errors
