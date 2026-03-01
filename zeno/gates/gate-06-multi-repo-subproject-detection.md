# Gate 06: Multi-Repo & Subproject Detection

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 6 of 12  
**Hash**: #g06multirepo

## Overview

Implements multi-repository and subproject detection for distributed systems. Combines Gate 02's static analysis engine (`CodeAnalyzer` — AST parsing, coupling metrics, dependency graph, LOC, import/export topology) with LLM-driven boundary analysis via the `architect-reviewer` subagent, giving the LLM structured, grounded codebase data to make well-informed boundary recommendations. Delivers repository CRUD in SQLite, cross-repo dependency tracking, a hybrid `detect` workflow (static analysis → LLM recommendation → human confirmation via `repos adjust`), and full `zeno repos` CLI commands including `add` and `remove` for manual declaration.

## Objectives

### Repository Declaration & Storage

- [ ] Create repositories table in SQLite database (name, path, type, metadata)
- [ ] Implement repository CRUD operations (insert, update, delete, query)
- [ ] Build repository hash registry (content-addressable references)
- [ ] Support repository metadata (type: main/service/library/tool, description)
- [ ] Support manual repository declaration (user declares repos via CLI or MCP)

### LLM-Driven Boundary Recommendation

- [ ] Invoke Gate 02 `CodeAnalyzer` to produce structured codebase data (coupling, dependency graph, LOC, file counts, import/export topology)
- [ ] Feed structured analysis output to `architect-reviewer` subagent (`awesome-claude-code-subagents/categories/04-quality-security/architect-reviewer.md`) for boundary recommendations
- [ ] LLM receives grounded metrics and suggests repository boundaries with rationale
- [ ] Support human confirmation or override of LLM-recommended boundaries via `repos adjust`
- [ ] No automated boundary persistence without human confirmation (LLM recommendations are advisory only)

### Cross-Repository Dependency Tracking

- [ ] Implement cross-repository relationship tracking in SQLite
- [ ] Create repository dependency resolution queries
- [ ] Build dependency visualization (via architecture diagram system from Gate 05)
- [ ] Detect circular dependencies between declared repositories

### Repository Management Commands

- [ ] Implement `zeno repos list` command (display declared repositories)
- [ ] Implement `zeno repos deps` command (show cross-repo dependency graph)
- [ ] Implement `zeno repos detect` command (run hybrid: CodeAnalyzer → architect-reviewer LLM → present recommendations)
- [ ] Implement `zeno repos adjust` command (apply or override LLM-recommended boundaries)
- [ ] Implement `zeno repos add` command (manually declare a repository)
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
- Manual repository declaration (`repos add`, `repos remove`)
- Hybrid detect workflow: Gate 02 `CodeAnalyzer` output → `architect-reviewer` subagent LLM recommendation → human confirmation
- Cross-repository dependency tracking
- Circular dependency detection
- `zeno repos` commands (list, deps, detect, adjust, add, remove)
- File-level conflict detection for concurrent proposals (foundation for Gate 07)
- Creating `architect-reviewer` agent configuration for coupling analysis use case
- Comprehensive test coverage (90% minimum)

**Out of Scope**:

- Automated boundary persistence without human confirmation (no threshold-based auto-classify)
- Confidence scoring algorithms
- Repository scaffolding (package.json, tsconfig generation — not Zeno's job)
- Monorepo tooling integration (Turborepo, Nx)
- Git repository operations (handled in Gate 10)
- Package publishing or distribution
- Cross-repo TypeScript path resolution

## Requirements

<!-- Requirements-First Workflow:
  1. Project-level requirements: PRIMARILY defined during `zeno init` at project inception (BEFORE gates).
     These are high-level, cross-cutting requirements derived from the end state.
  2. Gate generation (`/zeno-gate`): Attributes existing project-level requirements to gates.
     Requirements are PRIMARILY mapped and attributed here, not created.
     During rebaseline/rescope: Requirements may be updated or added as part of rescoping.
  3. Gate start (`zeno gates start`): Generates gate-specific requirements that decompose
     project requirements and gate objectives into actionable items.
  4. Proposal generation (`/zeno-proposal`): Breaks requirements down into individual tasks.

  Workflow: Requirements (init - PRIMARY) → Gates (attribute, may update/add during rescope) → Gate Requirements (decompose) → Tasks (proposals)
-->

### Project Requirements (Attributed to This Gate)

[Project-level requirements were defined during `zeno init` at project inception. This section lists those that are attributed to this gate. Query all project requirements via `zeno req list --project`.]

|Hash|Name|Type|Priority|How This Gate Addresses It|
|-|-|-|-|-|
|#4bc74e36854c4221|SQLite database stores requirements and repositories with no server dependency|constraint|must|Adds `repositories` and `repo_dependencies` tables; implements RepositoryRegistry CRUD|
|#9b4ecdb42908c10f|Use content-addressable SHA-256 hashes (16 chars) for all entity references|constraint|must|Repository hash registry — each declared repo gets a 16-char SHA-256 hash reference|
|#9c5150bf8e008175|Track dependencies between requirements using content-addressed hashes|functional|must|Cross-repo dependency tracking and circular dependency detection in SQLite|
|#10a621a3715172ae|Expose all operations as MCP tools for LLM invocation|functional|must|`repos_action` MCP tool handler with detect, list, deps, adjust, add, remove sub-actions|
|#cb19655eee60ab38|Provide CLI interface for all Zeno operations via Commander.js|functional|must|`zeno repos` CLI subcommands: list, deps, detect, adjust, add, remove|

### Gate-Specific Requirements

[Gate-specific requirements are generated when `zeno gates start <gate-id>` is called. These decompose project requirements and gate objectives into actionable items. Stored in `.zeno/registry.db` and queried via `zeno req list --gate <id>`.]

**Status**: Requirements will be generated when gate is started.

[After gate start, view detailed requirement information via: `zeno req show <hash>`]

### Inherited/Transferred Requirements

[Requirements transferred from other gates or shared across gates.]

|Hash|Title|Source Gate|Relationship|Consumed By|
|-|-|-|-|-|
|#ac3ffa69e28bfed4|Create SQLite database with complete schema and migration system|gate-01|depends-on|Gate-06 adds `repositories` and `repo_dependencies` tables via schema migration|
|#ebc7a086e26b111c|Create code analyzer using AST parsing for existing codebase analysis|gate-02|depends-on|`detect` workflow invokes `CodeAnalyzer` to produce structured codebase data|
|#66db8316e02beb71|Implement code metrics calculator for coupling, cohesion, and complexity|gate-02|depends-on|Coupling / dependency metrics are serialized and fed to `architect-reviewer`|

### Requirement-to-Task Breakdown

[Individual tasks are created during proposal generation (`/zeno-proposal`), not during gate generation. Each requirement may spawn multiple proposals (tasks) that implement it.]

---

## Proposals

**Status**: Proposals will be generated when gate is started.

[After gate start, view detailed proposal information via: `zeno proposal show <hash>`]

### Proposal Status

| Proposal        | Hash    | Status  | Notes            |
| --------------- | ------- | ------- | ---------------- |
| [proposal-name] | #[hash] | pending | [Optional notes] |

### Proposal Dependency Graph

<!-- Generated by /zeno-proposal when proposals are created. Shows requires relationships between proposals. -->

**Status**: Proposals will be generated when gate is started.

[After gate start, view detailed proposal information via: `zeno proposal show <hash>`]

### High-Level Delta (Gate Completion Summary)

Multi-repo and subproject detection capability delivered. Repositories can be declared, queried, and cross-referenced, with LLM-driven boundary recommendations via MCP and file-level conflict prevention for concurrent proposals.

**Key Deliverables**:

- SQLite repository storage with CRUD operations and hash references
- `zeno repos` CLI commands (list, deps, detect, adjust, add, remove)
- Hybrid `detect` workflow: `CodeAnalyzer` metrics → `architect-reviewer` LLM recommendation → human confirmation
- Cross-repository dependency tracking with circular dependency detection
- File-level conflict detection for concurrent proposals (foundation for Gate 07)

**Quality Metrics**: Coverage [X]%, Security 0 issues, Lint <0.01%

---

## Architecture Diagrams

| Name                              | Type               | Order | Status    |
| --------------------------------- | ------------------ | ----- | --------- |
| System Overview                   | system-overview    | 1     | pending   |
| Data Flow Diagram                 | data-flow          | 2     | pending   |
| Gate Lifecycle State Machine      | gate-lifecycle     | 3     | pending   |
| Gate Roadmap                      | gate-roadmap       | 4     | pending   |
| System Context Diagram            | context            | 5     | pending   |
| Component Diagram (Multi-Repo)    | component          | 6     | pending   |
| Dependency Graph (Cross-Repo)     | package            | 7     | pending   |

---

## Technical Decisions for This Gate

### 1. Hybrid Boundary Analysis: Gate 02 Static Analysis + LLM Recommendation

- **Choice**: Gate 02's `CodeAnalyzer` produces structured codebase data (coupling metrics via `calculateCoupling`, dependency graph, file counts, LOC, import/export topology). This structured output is serialized and fed to the `architect-reviewer` subagent (`awesome-claude-code-subagents/categories/04-quality-security/architect-reviewer.md`) which recommends repository boundaries with rationale. Human confirms or overrides via `repos adjust` before any boundary is persisted to SQLite.
- **Alternatives Considered**: (a) Pure LLM analysis against raw source — hallucination risk, excessive token overhead; (b) Hardcoded threshold-based auto-classification — no domain context, no human confirmation
- **Rationale**: Gate 02 already built the analysis engine (`src/analysis/`); Gate 06 consumes it as structured LLM input. The `architect-reviewer` subagent specializes in coupling assessment, cohesion evaluation, component boundaries, and dependency management — directly aligned with this task. Boundaries remain advisory-only until human-confirmed.
- **Trade-offs**: Gained recommendation quality and grounding via real metrics; LLM still required for boundary decisions; `detect` requires active MCP/agent connection

### 2. Repository Storage in SQLite

- **Choice**: Repositories table in SQLite for queryability
- **Alternatives Considered**: JSON files, pure file-based tracking
- **Rationale**: SQLite enables efficient querying for dependency resolution and conflict detection. Consistent with existing requirements storage approach.

## Architecture Updates

### Components Modified or Created

- **repositories table** (`src/storage/schema.ts`)
  - Purpose: Persistent storage for declared repositories and their metadata
  - Changes: New table with columns: id, hash, name, path, type, description, metadata, created_at
  - Interfaces: insert/update/delete/query via storage module

- **RepositoryRegistry** (`src/registry/repository-registry.ts`)
  - Purpose: Hash-addressable CRUD for repository entities
  - Changes: New module mirroring GateRegistry/RequirementRegistry patterns
  - Interfaces: `declare()`, `remove()`, `list()`, `getByHash()`, `getDependencies()`

- **repos_detect workflow** (within `src/mcp/tools/repository-tools.ts` / `src/cli/commands/repos.ts`)
  - Purpose: Orchestrates hybrid boundary detection: invokes `CodeAnalyzer` → serializes structured metrics → invokes `architect-reviewer` subagent → returns recommendations for human review
  - Changes: Implement `detect` action handler that calls `src/analysis/code-analyzer.ts`, formats output, and delegates to subagent
  - Interfaces: Returns `ReposDetectOutput` with `detected[]` boundaries, `changes` diff, and `summary` from LLM rationale

- **ConflictDetector** (`src/core/conflict-detector.ts`)
  - Purpose: Detects overlapping file sets between concurrent proposals across repositories
  - Changes: New module, queries proposals-to-files mapping
  - Interfaces: `detectConflicts(proposalHash: string): ConflictReport`

- **repos CLI commands** (`src/cli/commands/repos.ts`)
  - Purpose: User-facing `zeno repos` subcommands
  - Changes: Implement all repo subcommands (stubs exist from prior scaffold)
  - Interfaces: `list`, `deps`, `detect`, `adjust`, `add`, `remove` subcommands

### Diagram Updates Required

- System Overview: `zeno/architecture/system-overview.md` — add repositories layer to component diagram
- Data Flow: `zeno/architecture/data-flow.md` — add cross-repo dependency resolution flow
- Gate Roadmap: `zeno/architecture/gate-roadmap.md` — updated with Gate 06 position

### Integration Points

- **MCP Function Registry** (`src/mcp/index.ts`): `repos_action` handler scaffold exists; implement `detect` subagent invocation
- **CLI Router** (`src/cli/index.ts`): `repos` command module scaffold exists; implement all subcommands
- **SQLite Schema** (`src/storage/schema.ts`): Add `repositories` and `repo_dependencies` tables
- **Proposal System** (`src/core/proposals.ts`): Integrate ConflictDetector during proposal creation

## Gate-Specific Quality Considerations

### Security Considerations

- Repository `path` fields must be validated to prevent path traversal (resolve to absolute paths, reject `..` sequences)
- `CodeAnalyzer` output passed to `architect-reviewer` subagent must not include raw file contents — only structured metrics (file counts, LOC, coupling scores, import graph) to avoid leaking sensitive data
- SQLite queries must use parameterized statements to prevent injection

### Performance Requirements

- `zeno repos list` must return results in <100ms for up to 50 declared repositories
- Cross-repo dependency graph queries must complete in <500ms for up to 200 nodes
- File conflict detection must complete in <200ms for 10 concurrent proposals

## Dependencies

### External Dependencies (New or Updated)

- No new npm packages required; leverages existing `better-sqlite3`, `commander`, and MCP infrastructure.

### Internal Dependencies

- **Depends on Gate(s)**: Gate 01 (Core Infrastructure & SQLite schema), Gate 03 (MCP Server), Gate 04 (Requirements Database)
- **Blocks Gate(s)**: Gate 07 (Proposal Generation — needs repo-to-proposal mapping), Gate 10 (Git Integration — needs multi-repo context)
- **Requires Modules**: Storage module (`src/storage/`), MCP function registry (`src/mcp/`), CLI router (`src/cli/`)

### Infrastructure Dependencies

- No new environment variables or external services required.
- SQLite schema migration: adds `repositories` and `repo_dependencies` tables.

## Implementation Steps

1. Add `repositories` and `repo_dependencies` tables to SQLite schema
2. Implement `RepositoryRegistry` with CRUD operations (mirroring `GateRegistry`/`RequirementRegistry` patterns)
3. Implement `detect` workflow: serialize `CodeAnalyzer` output → invoke `architect-reviewer` subagent → return structured recommendations
4. Implement cross-repo dependency tracking queries with circular dependency detection
5. Implement `zeno repos` commands: `list`, `deps`, `detect`, `adjust`, `add`, `remove`
6. Implement `ConflictDetector` for concurrent proposal file-set overlap detection (foundation for Gate 07)
7. Write comprehensive tests (unit tests for CRUD, dependency queries, conflict detection; integration tests for CLI commands and MCP `repos_action` tool)

## Known Issues & Limitations

### Current Limitations

- LLM boundary recommendations require an active MCP connection; offline analysis is not supported in this gate.
- Repository paths are stored as-is; symlink resolution is not handled in MVP.
- Conflict detection operates on declared file sets from proposals, not on actual filesystem state.

### Technical Debt

- Repository type enum (`main/service/library/tool`) may need extension for monorepo workspaces — deferred to Gate 10.
- `CodeAnalyzer` output size grows with codebase; filtering/summarization of metrics passed to LLM may be needed for very large codebases — deferred to a future gate.

### Future Improvements

- Confidence scoring for LLM boundary recommendations — deferred to post-MVP.
- Automatic re-recommendation when project structure changes significantly — deferred to Gate 10.
- Monorepo tooling integration (Turborepo, Nx) — explicitly out of scope for this project.

## Risks & Mitigation

### Technical Risks

1. **LLM Boundary Quality**
   - **Impact**: Medium
   - **Probability**: Low-Medium
   - **Mitigation**: Feed `CodeAnalyzer` structured metrics (coupling scores, dependency counts, LOC, import graph) rather than raw source — grounded inputs significantly improve recommendation quality; use `architect-reviewer` subagent which specializes in coupling assessment and component boundaries
   - **Contingency**: Allow full manual override via `zeno repos add/remove/adjust`; LLM recommendations are advisory only

2. **SQLite Schema Migration**
   - **Impact**: Low
   - **Probability**: Low
   - **Mitigation**: Add migration script for existing databases; test migration against existing test fixtures
   - **Contingency**: Rebuild schema from scratch if migration fails (no production data at this stage)

### Process Risks

1. **Scope Creep into Auto-Classification (Boundary Persistence Without Human Confirmation)**
   - **Impact**: High
   - **Probability**: Low
   - **Mitigation**: `detect` workflow only returns recommendations; boundaries are persisted only via `repos adjust` or `repos add` with explicit human action
   - **Contingency**: Reject PRs that auto-persist boundaries from LLM output; enforce human-confirmation gate in code review

## Gate Completion Criteria

- [ ] Repositories can be declared, queried, updated, and deleted
- [ ] Cross-repo dependency graph generated from declared relationships
- [ ] Circular dependencies correctly detected and reported
- [ ] `zeno repos list` shows all declared repositories with metadata
- [ ] `zeno repos deps` displays dependency graph
- [ ] `zeno repos detect` runs `CodeAnalyzer` → invokes `architect-reviewer` subagent → returns boundary recommendations
- [ ] `zeno repos adjust` persists human-confirmed boundary changes
- [ ] `zeno repos add/remove` manage manual repository declarations
- [ ] LLM can analyze project structure via MCP and recommend boundaries
- [ ] File conflict detection prevents concurrent proposals from overlapping
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for multi-repo module
- [ ] Zero lint errors, zero type errors

## Notes

### Implementation Notes

- Follow the existing `GateRegistry` and `RequirementRegistry` patterns when implementing `RepositoryRegistry` to maintain consistency.
- The `detect` workflow serializes `CodeAnalyzer`'s `AnalysisResult` to a stable JSON schema before passing to the `architect-reviewer` subagent; field names should be documented so the agent prompt can reference them deterministically.
- The `architect-reviewer` subagent is located at `awesome-claude-code-subagents/categories/04-quality-security/architect-reviewer.md` (uses `opus` model, tools: Read/Write/Edit/Bash/Glob/Grep). The subagent's coupling assessment, component boundaries, and dependency management capabilities make it directly applicable to this task.
- Conflict detection should be integrated as a non-blocking check that warns rather than hard-blocks proposal creation; hard enforcement can be added in Gate 07.
- Scaffold for `repos_action` MCP tool, schemas, and CLI stub commands already exists and needs implementation (not creation from scratch).

### Proposal Summary

[Populated during proposal archival. Contains 1-2 sentence summaries of completed proposals as they are cleaned up.]

| Proposal Hash | Summary                                           |
| ------------- | ------------------------------------------------- |
| #[hash]       | [1-2 sentence summary of proposal work completed] |

### Next Gate Preview

Gate 07 (Proposal Generation) will build on the repository and dependency foundation established here, generating structured implementation proposals scoped to specific repositories and leveraging conflict detection to safely parallelize work.

---

**Document Version**: 1.1.0  
**Last Updated**: 2026-02-27  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Owner**: zeno  
**Reviewers**: zeno

### Change Log

| Version | Date       | Summary                               | Author |
| ------- | ---------- | ------------------------------------- | ------ |
| 1.0.0   | 2026-02-04 | Initial version                       | zeno   |
| 1.1.0   | 2026-02-27 | Added missing template sections       | zeno   |
| 1.2.0   | 2026-02-28 | Hybrid detect approach; scope fix     | zeno   |
| 1.3.0   | 2026-02-28 | Populate req hashes; inherited reqs   | zeno   |

**Related Documents**:

- Project PRD: `zeno/PROJECT_PRD.md`
- Previous Gate: `zeno/gates/gate-05-architecture-diagrams.md`
- Next Gate: `zeno/gates/gate-07-proposal-generation.md`
- Architecture: `zeno/architecture/`
