# Gate 04: Requirements & Database Layer

**Status**: pending  
**Type**: feature  
**Created**: 2026-01-31  
**Sequence**: 4 of 13  
**Hash**: #g04reqdb01

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements the requirements database and CRUD layer that powers Zeno's project management capabilities. Delivers gate-specific requirement generation (decomposing project requirements and gate objectives), SQLite CRUD operations with transaction support, hash registry for content-addressable storage, dependency tracking with confidence scores, and CLI commands for querying and managing requirements. This gate transitions Zeno from gate generation to requirement management, enabling proposal generation and comprehensive dependency tracking.

## Objectives

- [ ] Implement gate-specific requirement generation (decompose project requirements + gate objectives into actionable items)
- [ ] Create requirement decomposition algorithm (gate → requirements tree with parent-child relationships)
- [ ] Build SQLite CRUD operations with better-sqlite3 and transaction support
- [ ] Implement hash registry for content-addressable storage of requirements and entities
- [ ] Create dependency tracking system with parent-child relationships and confidence scores
- [ ] Expose requirement functions via MCP tools backed by function-registry (req_list, req_show, req_deps, req_transfer)
- [ ] Implement requirement decomposition with parent-child relationship validation
- [ ] Implement requirement transfer logic for rescope support (via MCP req_transfer tool)
- [ ] Create requirement validation rules and constraint checks
- [ ] Implement requirement validation workflow (via MCP validation tools)
- [ ] Build PRD generator from template for requirement artifacts
- [ ] Create database cleanup utilities for stale database files
- [ ] Validate database state and integrity checks
- [ ] Achieve 90% test coverage for database and requirement management modules

## Context

### What Was Completed Before This Gate

Gate 01 (Core Infrastructure), Gate 02 (Zeno Engine), and Gate 03 (MCP Server & LLM Tool Integration) established the foundational system:

- TypeScript project with strict mode, ESLint, Prettier, and Vitest
- CLI framework using Commander.js with extensible command structure
- SQLite database with complete schema (gates, requirements, proposals tables and relationships)
- File system utilities, hashing (SHA-256), configuration, logging, git integration
- Iterative gate generation algorithm and `zeno init` command
- Code analysis capabilities and dependency graph generation
- Gate management commands (`zeno gates list/show/start/complete`)
- Project-level requirements generated during initialization
- AGENTS.md generation for AI context
- **MCP server with stdio transport** exposing all Zeno functions as typed tools
- **Function registry** centralizing all Zeno operations (Gate 03)
- **Template loader infrastructure** enabling LLM access to templates (Gate 03 solitary proposal)
- **CLI refactored as thin wrapper** delegating to MCP-backed function registry (Gate 03)
- VS Code integration with MCP tool discovery in Chat view and agent mode support

### What This Gate Enables

- **Gate 5 (Architecture & Diagram Generation)**: Requires dependency graphs and requirement data available via `req_list`, `req_deps` MCP tools
- **Gate 6 (Multi-Repo & Subproject Detection)**: Requires requirement queries via MCP tools for cross-repository dependency tracking
- **Gate 7 (Proposal Generation & Management)**: Requires requirement storage and retrieval via MCP tools for proposal decomposition
- **Gate 11 (Rescope & Replan Engine)**: Requires requirement transfer via `req_transfer` MCP tool for rescoping
- **All subsequent gates**: Depend on requirement management MCP tools for tracking implementation progress
- **LLM-driven workflows** (via Gate 03): Requirements accessible via MCP tools for LLM-orchestrated proposal generation and implementation

### Scope Boundaries

**In Scope**:
- Requirements table implementation (hierarchical, no status field, unified format for specs and traditional requirements)
- Gate-specific requirement generation algorithm (decompose project requirements + gate objectives)
- Requirement inheritance system (requirements can reference/depend on other requirements via parent_id)
- Requirement transfer between gates (for rescope scenarios)
- SQLite CRUD operations with transactional support (insert, update, delete, query) for requirements table only
- Hash implementation for requirement references (content-addressable storage)
- Requirement decomposition with confidence scoring (0.0-1.0) for parent-child relationships
- MCP tool implementations exposed via function-registry: `req_list`, `req_show`, `req_deps`, `req_transfer`
- Requirement validation rules (no orphaned dependencies, valid parent-child relationships)
- PRD generation from templates for requirement artifacts
- Comprehensive test coverage for all requirement operations (90% minimum)
- Database migration system for future schema changes
- Database file cleanup and management (removing stale `.zeno/requirements.db` files)
- Database schema definition and documentation for creation
- Validation of current database state and integrity checks
- Integration with MCP function-registry for LLM-accessible requirement operations

**Out of Scope**:
- Architecture diagram generation (deferred to Gate 5)
- Multi-repo support and repositories table (deferred to Gate 6)
- Proposal generation from requirements (deferred to Gate 7)
- Automated validation and quality checks (deferred to Gate 8)
- Human approval workflow (deferred to Gate 9)
- MCP server implementation (completed in Gate 03)
- CLI commands (now thin wrappers via Gate 03's function-registry pattern)
- Prompt workflows (defined in `.github/prompts/`, not generated by this gate)

## Requirements

### Project Requirements (Attributed to This Gate)

Project-level requirements were primarily defined during `zeno init` at project inception. Requirements may be updated or added during rebaseline/rescope operations, but init is the primary source. This section lists those that are attributed to this gate.

**Note**: Currently no project-level requirements exist in the database. Gate 4 will establish the requirements management system that stores and tracks these once they are generated during project initialization or added during rescope operations.

| Hash | Name | Type | Priority | How This Gate Addresses It |
|------|------|------|----------|---------------------------|
| #p04reqmgmt | Requirements Management System | functional | must | Implements complete requirement storage, retrieval, and lifecycle management |
| #p04deptrack | Dependency Tracking | functional | must | Creates hash-based dependency tracking with confidence scores |
| #p04decomp | Requirement Decomposition | functional | must | Implements algorithm to decompose gate objectives into actionable requirements |

### Gate-Specific Requirements

Gate-specific requirements are generated when `zeno gates start <gate-id>` is called. These decompose project requirements and gate objectives into actionable items. After gate start, view detailed requirement information via: `zeno req show <hash>`

**Status**: Pending gate start - will be generated when `zeno gates start gate-04` is invoked.

### Inherited/Transferred Requirements

No requirements are transferred from other gates. Gate 4 begins the requirement management system from scratch, implementing infrastructure to support future requirement transfers during rescope operations.

### Requirement-to-Task Breakdown

Individual tasks are created during proposal generation (`/zeno-proposal`), not during gate generation. Each requirement will spawn multiple proposals (tasks) that implement it. These are tracked in `.zeno/requirements.db` and accessed via `zeno proposal list --requirement <hash>`.

---

## Proposals

**Status**: Proposals will be generated when gate is started.

After gate start, view detailed proposal information via: `zeno proposal show <hash>`

---

## Technical Decisions for This Gate

### Decision 1: Minimalist Database Schema (2 Core Tables)
- **Choice**: Gate 4 establishes the final database schema: `requirements` table only (for hierarchical requirements supporting spec-driven development), with `repositories` table deferred to Gate 6 (multi-repo support)
- **Design Rationale**: Project metadata (gates, sequences, completion status) stored in `project-overview.json` (version-controlled, human-readable). Proposals stored as Markdown files (`zeno/proposals/gate-XX/<name>.md`). State history tracked via Git commits. This eliminates scope creep while preserving queryability where it matters: requirement hierarchies for spec-driven development.
- **Requirements Table Schema**: `id`, `parent_id`, `type` (functional/non_functional/constraint), `priority`, `level` (project/gate), `source` (generated/inherited/transferred), `title`, `description`, `acceptance_criteria`, `hash`, `created_at`, `updated_at`
- **No Status Field**: Requirements in database are implicitly approved. Changes only occur via gate refactors or proposal commits, tracked through Git history.
- **Unified Format**: Single requirements table supports both traditional requirements and project specifications (OpenAPI, GraphQL, Protobuf, etc.)—same structure, different content.
- **Impact**: Drastically simplifies database maintenance and reduces scope creep. Database focuses on queryable hierarchical data only.
- **Trade-offs**: Gained simplicity, reduced maintenance burden, eliminated 10+ unused tables; lost some query flexibility but gained clarity about what database actually manages.

### Decision 2: SQLite CRUD Operations with Transaction Support
- **Choice**: Use better-sqlite3 for synchronous, transactional SQLite operations with prepared statements
- **Alternatives Considered**: Async SQLite (sqlite3 npm package), TypeORM with SQLite, manual SQL string building
- **Rationale**: Synchronous operations simplify error handling and state management in Zeno's CLI context. Prepared statements prevent SQL injection. Transactions ensure data consistency across multiple requirement updates. better-sqlite3 offers native bindings with excellent performance.
- **Impact**: All database operations are blocking, simplifying state synchronization. Enables atomic requirement updates.
- **Trade-offs**: Gained transactional safety and simplicity; lost async/concurrent database operations (acceptable for CLI tool with single active user).

### Decision 3: Hash-Based Requirement References (Content-Addressable)
- **Choice**: Implement SHA-256 (first 16 characters) hash for all requirements enabling content-addressable storage and cross-requirement referencing
- **Alternatives Considered**: Full file paths, sequential UUIDs, git commit SHAs
- **Rationale**: Reduces LLM context by 50%+ through stable, compact references. Enables specification tracking across proposals. Content-based addressing prevents stale references even when files move.
- **Impact**: All requirements, proposals reference hashes instead of paths. Enables precise tracing of specifications through implementation.
- **Trade-offs**: Gained context efficiency and immutability; lost human readability but improved LLM usability.

### Decision 4: Requirement Decomposition Algorithm (Gate → Requirements Tree)
- **Choice**: Hierarchical decomposition: project requirements → gate-level requirements → proposal-level tasks
- **Alternatives Considered**: Flat requirement list, task-first decomposition, goal-driven breakdown
- **Rationale**: Hierarchical structure maps to natural project structure (project → gate → proposal). Parent-child relationships enable impact analysis and rescoping. Clearer responsibility assignment.
- **Impact**: Enables requirement transfer, dependency tracking, and impact analysis. Supports rescope scenarios.
- **Trade-offs**: Gained structural clarity; added complexity in maintaining parent-child relationships.

### Decision 5: Confidence Scoring for Dependencies (0.0-1.0)
- **Choice**: Optional confidence score for each parent-child relationship indicating certainty of decomposition
- **Alternatives Considered**: Binary dependency (exists/not exists), weighted dependencies with arbitrary weights, no scoring
- **Rationale**: Real-world requirement decompositions often have uncertain relationships. Confidence scores enable prioritization (high-confidence deps first) and risk assessment. Used in proposal validation and rescope impact analysis.
- **Impact**: Supports intelligent proposal ordering and risk identification. Enables flexible replan on rejection.
- **Trade-offs**: Gained nuanced dependency modeling; added complexity in computing with confidence scores.

### Decision 6: MCP-First Architecture - Function Registry Exposure
- **Choice**: All requirement operations implemented as functions in function-registry (from Gate 03), exposed as MCP tools as primary interface, with CLI as thin wrapper
- **Alternatives Considered**: CLI-first implementation with MCP as overlay, duplicate implementations
- **Rationale**: Gate 03 established MCP as the primary execution interface for LLM-driven workflows. Gate 4 functions (req_list, req_show, req_deps, req_transfer) must be MCP tools to enable LLM-orchestrated proposal generation and rescoping. Function-registry pattern prevents duplication between CLI and MCP.
- **Architecture Pattern**: 
  - Requirement operations defined in `src/generation/requirement-*.ts` modules
  - Each operation registered in function-registry with Zod schema
  - MCP server wraps function-registry functions as typed tools
  - CLI commands delegate to function-registry (thin wrapper pattern from Gate 03)
  - LLMs invoke via MCP: `req_list()`, `req_show()`, `req_deps()`, `req_transfer()`
- **Impact**: Gate 4 requirements immediately available for LLM-driven workflows without additional CLI-to-MCP translation layer. Supports Gate 03's `/zeno-proposal` and `/zeno-apply` workflows.
- **Trade-offs**: Gained unified execution path and LLM accessibility; added dependency on function-registry (but established in Gate 03 as required prerequisite)

## Architecture Updates

### Database Schema Finalization

Gate 4 finalizes the minimalist database schema:

**Core Tables**:
- **requirements** - Hierarchical requirements supporting both traditional requirements and spec-driven development
  - Columns: `id`, `parent_id`, `type` (functional/non_functional/constraint), `priority` (must/should/could/wont), `level` (project/gate), `source` (generated/inherited/transferred), `title`, `description`, `acceptance_criteria`, `hash` (unique, SHA-256), `created_at`, `updated_at`
  - Relationships: Self-referential via `parent_id` for hierarchical structure
  - No `status` field: Presence in database = approved; changes tracked via Git commits

**Deferred Tables**:
- **repositories** - Deferred to Gate 6 (multi-repo support). When Gate 6 implements repository boundary detection, this table will be created and populated.

**Removed Tables** (consolidated into files/Git):
- `gates` → Stored in `project-overview.json` (completedGates, currentGateInfo, upcomingGates)
- `projects` → Stored in `project-overview.json` (projectName, endState, etc.)
- `proposals` → Stored as Markdown files (`zeno/proposals/gate-XX/<name>.md`, archived as `zeno/proposals/archive/<hash>.md`)
- `state_history` → Tracked via Git commit history with structured messages
- `users`, `artifacts`, `hash_registry`, `requirement_repository`, `migrations` → Removed (unused or scope creep)

**Storage Architecture**:
| Location | Content | Rationale |
|----------|---------|-----------|
| Database (`requirements`) | Hierarchical requirements with parent-child relationships | Queryable structure for decomposition and impact analysis |
| `project-overview.json` | Project metadata, gates, completion tracking | Single source of truth for project state, version-controlled |
| `zeno/proposals/` | Proposal Markdown files | Human-readable change documentation, versioned in Git |
| `zeno/architecture/` | Architecture diagrams | Design documentation (Mermaid/DOT/SVG) |
| Git history | State changes, approvals, implementations | Immutable audit trail via commits and tags |

### Components Modified or Created

- **requirement-generator.ts** (`src/generation/requirement-generator.ts`)
  - Purpose: Implements gate-specific requirement generation by decomposing project requirements and gate objectives
  - Changes: New module, creates requirement decomposition algorithm
  - Interfaces: `generateRequirementsForGate(gateId: string): Requirement[]`, `decomposeRequirement(req: Requirement): Requirement[]`

- **requirement-storage.ts** (`src/generation/requirement-storage.ts`)
  - Purpose: Handles requirement persistence and CRUD operations to SQLite (requirements table only)
  - Changes: New module, implements database access layer
  - Interfaces: `createRequirement()`, `updateRequirement()`, `deleteRequirement()`, `queryRequirements()`

- **database.ts** (`src/storage/database.ts`)
  - Purpose: SQLite connection management and transaction support
  - Changes: Extended with CRUD methods and transaction wrappers
  - Interfaces: `executeTransaction(callback)`, `executeQuery()`, `executePreparedStatement()`
  - Updated REQUIRED_TABLES to include only `requirements` (and `repositories` when Gate 6 begins)

- **hash.ts** (`src/utils/hash.ts`)
  - Purpose: Hash implementation for content-addressable requirement storage
  - Changes: Extended with requirement hashing
  - Interfaces: `generateHash(content)`, `generateRequirementHash(req)`

### Architecture Diagrams Updates

- **System Overview** (`zeno/architecture/system-overview.md`)
  - Update: Storage layer simplified to SQLite (requirements only) + Files + Git
  - Add: Requirements storage layer connecting to database

- **Data Flow** (`zeno/architecture/data-flow.md`)
  - Update: Storage operations section shows requirements in DB, proposals in files, project metadata in JSON
  - Add: Gate → Requirements decomposition flow
  - Add: Requirement query and retrieval paths

- **Gate Roadmap** (`zeno/architecture/gate-roadmap.md`)
  - Update: Show Gate 4 position and dependencies on Gates 1-3
  - Show: Gate 4 enables Gates 5-13

### Integration Points

- **Gate Generator (Gate 02)**: Gate 04 requirements are generated based on completed Gate 02 gates. Gate 2's output feeds into requirement generation.
- **CLI Framework (Gate 01)**: `zeno req` commands registered with Commander.js CLI framework from Gate 1
- **Database Schema (Gate 01)**: Uses only the requirements table from schema created during Gate 1; other tables removed or deferred
- **MCP Server & Function Registry (Gate 03)**: All requirement operations (req_list, req_show, req_deps, req_transfer) exposed via function-registry and MCP tools as primary interface; CLI delegates to MCP layer
- **Template Loader (Gate 03 solitary)**: Can access requirement-related templates via getTemplate() for PRD generation

## Gate-Specific Quality Considerations

- **Database Integrity**: All CRUD operations wrapped in transactions. Foreign key constraints enforced. No orphaned requirement references.
- **Requirement Validation**: Circular dependencies detected and prevented. Requirement lifecycle (implementation/testing) is recorded via proposal approvals and gate archival; the database remains the ASoT for requirement content and hierarchy.
- **Test Coverage**: 90% coverage minimum across all requirement generation and storage modules.
- **Dependency Tracking**: All requirement-to-requirement dependencies tracked with confidence scores. Dependency cycles detected.

## Dependencies

### External Dependencies (New or Updated)

- **better-sqlite3** (latest) - Synchronous SQLite bindings with prepared statements and transaction support. Chosen over async variants for simplicity in CLI context.

### Internal Dependencies

- **Depends on Gates**: Gate 01 (Core Infrastructure), Gate 02 (Zeno Engine), and **Gate 03 (MCP Server & LLM Tool Integration)**
  - Gate 01 provides: TypeScript setup, CLI framework (Commander.js), SQLite database schema, utilities (hashing, config, logging, git integration)
  - Gate 02 provides: Gate generation engine, project initialization, code analysis capabilities
  - **Gate 03 provides**: Function-registry infrastructure, MCP server, template loader functions (required prerequisite for exposing requirement operations as MCP tools)
- **Blocks Gates**: Gate 05, 06, 07, 11, and all subsequent gates depend on requirement management capabilities (both CLI and MCP interfaces)
- **MCP Integration**: All requirement functions must be registered in function-registry with Zod schemas and exposed as MCP tools by Gate 03's MCP server wrapper
- **Requires Modules**: #a2e9fc12 (database schema), #c4d1f8e7 (git integration), #e5b3a091 (hashing utilities)

### Infrastructure Dependencies

- SQLite database with requirements, gates, proposals, and relationships tables (schema created in Gate 01)
- Prepared statement support in database connection layer
- Transaction support in database layer

---

## Implementation Steps

1. **Design requirement decomposition algorithm**
   - Define hierarchical structure (project requirement → gate requirement → proposal-level task)
   - Implement parent-child relationship tracking with depth limits
   - Create requirement attribute schema (name, type, priority, status, hash, parent_id, gate_id)
   - Define requirement status lifecycle (pending → implemented → tested)

2. **Implement SQLite CRUD operations**
   - Add create, read, update, delete methods to `requirement-storage.ts`
   - Implement prepared statements for all queries to prevent SQL injection
   - Add transaction support with rollback capability in database layer
   - Enforce foreign key constraints for referential integrity   - Add a **cleanup/migration plan** to be executed as part of Gate 04 that includes:
     - Removing the `status` column from the `requirements` table and migrating existing database instances
     - Reconciling and implementing the `hash_registry` table and archival cleanup utilities
     - An idempotent migration script and integration tests to verify upgrade paths
     - Documentation and a manual checklist for repository maintainers to follow during gate completion
3. **Build hash registry system**
   - Implement SHA-256 hashing with first 16 characters as hash identifier
   - Create registry mapping hashes to entity IDs and types
   - Add version tracking for hash collisions (versioned hashes like #hash_v2)
   - Implement lookup and conflict detection with migration path for collisions

4. **Create requirement generation for Gate 4**
   - Implement decomposition of project requirements into gate-specific requirements
   - Generate requirements from gate objectives and scope boundaries
   - Link requirements to parent project requirements for traceability
   - Implement requirement transfer capability with status preservation

5. **Implement CLI commands**
   - `zeno req list [--gate <id>] [--project <id>] [--status <status>]` - List requirements with multi-flag filtering
   - `zeno req show <hash>` - Display requirement with full details and dependency tree
   - `zeno req deps <hash>` - Visualize dependency graph (ASCII tree or JSON export)
   - `zeno req status <hash> <status>` - Update requirement status with validation
   - `zeno req transfer <hash> <gate-id>` - Move requirement to another gate for rescope

6. **Write comprehensive tests**
   - Unit tests for decomposition algorithm (tree structure, parent-child relationships)
   - Unit tests for all CRUD operations (create, read, update, delete with edge cases)
   - Integration tests for requirement lifecycle (creation → deletion)
   - Tests for dependency tracking (cycles, confidence scores, circular detection)
   - Tests for status transition validation (allowed transitions only)
   - Achieve 90% code coverage minimum across requirement generation and storage modules

---

## Known Issues & Limitations

### Current Limitations

- **Single project scope**: This implementation supports one project at a time. Multi-project support deferred to Gate 12+ (Workspace Expansion).
- **No concurrent requirement modifications**: Requirements are locked during updates to prevent race conditions. This is acceptable for single-user CLI tool.
- **Linear dependency tracking**: Only tracks direct parent-child dependencies. Graph analysis (transitive closure) deferred to future enhancement.

### Technical Debt

- Hash registry collision resolution uses versioning (#hash_v2). Long-term plan: migrate to 32-character hashes if collision rate exceeds 0.1%.
- Requirement decomposition is manual (LLM-driven). Automated pattern-based decomposition planned for Gate 12+.

### Future Improvements

- Dependency visualization with graph databases (Neo4j) - deferred to Gate 12+
- Requirement templates and patterns library - deferred to future enhancement
- Requirement impact analysis and reachability analysis - deferred to Gate 11 (Rescope Engine)
- Web UI for requirement browsing - out of scope for CLI-first MVP

---

## Risks & Mitigation

### Technical Risks

1. **Database Lock Contention**
   - **Impact**: Medium
   - **Probability**: Low
   - **Mitigation**: Use transaction isolation levels to minimize lock duration. Lock requirements only during write operations, not reads.
   - **Contingency**: If contention occurs, implement connection pooling in Gate 12+ (Workspace Expansion).

2. **Hash Collision in Registry**
   - **Impact**: High (incorrect requirement lookups)
   - **Probability**: Very Low (SHA-256 first 16 chars collision rate ~1 in 2^64)
   - **Mitigation**: Implement collision detection in hash registry with versioning scheme (#hash_v2, #hash_v3). Monitor collision rate.
   - **Contingency**: If collision rate exceeds 0.1%, extend hash to 32 characters or migrate to UUID-based registry.

3. **Circular Dependency Detection Failure**
   - **Impact**: High (infinite loops in dependency resolution)
   - **Probability**: Low
   - **Mitigation**: Implement cycle detection algorithm (DFS-based) with depth limit. Test extensively with edge cases.
   - **Contingency**: If cycles slip through, detect at query time and return error instead of infinite loop.

### Process Risks

1. **Requirement Transfer Complexity During Rescope**
   - **Impact**: High (rescope operations fail)
   - **Probability**: Medium (complex operation across multiple gates)
   - **Mitigation**: Implement comprehensive tests for requirement transfer. Document transfer scenarios (prerequisites, state management, rollback).
   - **Contingency**: If transfer fails mid-operation, provide rollback mechanism. Lock affected requirements until resolution.

2. **Decomposition Algorithm Produces Too Many Requirements**
   - **Impact**: Medium (overwhelming requirement list, LLM context overflow)
   - **Probability**: Medium
   - **Mitigation**: Implement configurable depth limit for decomposition (default: 3 levels). Aggregate similar requirements. Implement filtering in `zeno req list`.
   - **Contingency**: If limit is exceeded, defer child requirements to later gates (Gate X decomposition).

---

## Gate Completion Criteria

- [ ] All project requirements stored in SQLite with complete metadata (name, type, priority, hash)
- [ ] Hash registry operational with collision detection and versioning
- [ ] Decomposition algorithm produces coherent requirement trees (no orphans, proper parent-child relationships)
- [ ] All CRUD operations functional with transaction support and rollback
- [ ] All CLI commands implemented and tested (`req list`, `req show`, `req deps`, `req status`, `req transfer`)
- [ ] 90% test coverage achieved for requirement generation and storage modules
- [ ] No circular dependencies detected in requirement graph validation
- [ ] All requirements have valid initial status (pending/implemented/tested)
- [ ] Integration tests pass for complete requirement workflow (create → update → transfer → query)
- [ ] Database schema supports requirement transfers across gates with state preservation
- [ ] Architecture diagrams (System Overview, Data Flow) updated to include requirement layer
- [ ] Stakeholder approval obtained for requirement management system design

---

## Notes

### Implementation Notes

- **LLM Context**: Gate-specific requirements will be generated via LLM-driven decomposition. Prompt the LLM to decompose project requirements into actionable gate requirements.
- **Parent-Child Tracking**: Maintain `parent_requirement_id` and `gate_id` foreign keys for each requirement. This enables requirement transfer and impact analysis.

- **Confidence Scores**: Default confidence to 1.0 for requirements generated from project requirements. Use 0.7-0.9 for uncertain dependencies discovered during analysis.

### Lessons Learned

(To be filled during/after implementation)

### Next Gate Preview

**Gate 05 (Architecture & Diagram Generation)** builds on Gate 4's requirement database to generate system architecture diagrams (Mermaid). Will visualize component relationships, data flow, and gate dependencies using requirements data as input. Requires querying requirement dependency graphs to understand system architecture.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-31  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Gate Owner**: [git.user.name]  
**Reviewers**: [git.user.name]

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-01-31 | Initial version - Gate 4 PRD generation (rebaselined from former Gate 3) | [git.user.name] |

**Related Documents**:
- Project PRD: `zeno/PROJECT_PRD.md`
- Previous Gate: `zeno/gates/gate-03-mcp-server.md`
- Next Gate: `zeno/gates/gate-05-architecture-diagrams.md`
- Architecture: `zeno/architecture/`
