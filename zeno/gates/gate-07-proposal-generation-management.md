# Gate 07: Proposal Generation & Management

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 7 of 13  
**Hash**: #g07proposal

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements proposal generation and management system that decomposes gate-specific requirements into actionable implementation proposals. This gate produces standardized proposal documents from requirement decomposition, builds change notice format supporting spec-driven development (OpenAPI, GraphQL, Protobuf), establishes proposal dependency tracking, implements proposal-to-code mapping, and provides CLI commands for querying and managing proposals. Proposal documents serve as the handoff point between planning (gates/requirements) and execution (agent implementation, git commits), enabling clear understanding of what needs to be implemented and why.

## Objectives

### Proposal Generation & Templates
- [ ] Create proposal template system (markdown structure, sections, formatting)
- [ ] Implement proposal generator from gate requirements
- [ ] Build requirement decomposition into implementation tasks
- [ ] Support multiple proposal types (feature, refactoring, testing, documentation)
- [ ] Generate proposal title and description from requirements
- [ ] Create acceptance criteria extraction from requirements
- [ ] Build implementation steps from requirement decomposition

### Change Notice Format (Spec-Driven Development)
- [ ] Implement change notice format for spec updates (OpenAPI, GraphQL, Protobuf)
- [ ] Support API specification changes (endpoint additions, schema changes)
- [ ] Support GraphQL schema changes (query, mutation, subscription updates)
- [ ] Support Protocol Buffer message/service changes
- [ ] Build before/after diff representation for specs
- [ ] Implement spec versioning and changelog generation

### Proposal Storage & Versioning
- [ ] Implement proposal storage system (markdown files in `zeno/proposals/gate-XX/`)
- [ ] Create proposal versioning (track proposal evolution as gate requirements change)
- [ ] Build proposal-to-requirement mapping (know which requirements each proposal addresses)
- [ ] Implement proposal status tracking (pending, in_progress, completed, rejected)
- [ ] Create proposal archival system (completed proposals moved to `zeno/proposals/archive/`)
- [ ] Build immutable proposal references (hash-based archival)

### Proposal Dependency Tracking
- [ ] Implement proposal dependency analysis (which proposals depend on others)
- [ ] Create dependency graph for all proposals in a gate
- [ ] Identify proposals that can run in parallel
- [ ] Build dependency-based proposal sequencing
- [ ] Implement circular dependency detection
- [ ] Support cross-gate proposal dependencies

### Proposal Management Commands
- [ ] Implement `zeno proposal list` command with filtering (--gate, --status flags)
- [ ] Implement `zeno proposal show <hash>` command (display proposal details)
- [ ] Implement `zeno proposal start <hash>` command (set status to in_progress)
- [ ] Create proposal storage and persistence
- [ ] Build proposal metadata (creation date, author, status, hash)

### Proposal-to-Code Mapping
- [ ] Create mapping between proposals and code changes
- [ ] Track which files each proposal modifies
- [ ] Build proposal-to-git commit association
- [ ] Implement file-to-proposal reverse lookup
- [ ] Create impact analysis (which parts of system changed by each proposal)

### Testing & Quality
- [ ] Write unit tests for proposal generation
- [ ] Write tests for spec-driven change notices
- [ ] Test proposal dependency graph generation
- [ ] Test proposal storage and retrieval
- [ ] Test proposal status transitions
- [ ] Achieve 90% test coverage for proposal module

## Context

### What Was Completed Before This Gate

Gate 01-06 established:
- Core infrastructure, CLI framework, SQLite database
- Gate generation with iterative decomposition
- MCP server and function registry
- Requirements database with hierarchical structure and dependency tracking
- Architecture diagram generation with intelligent selection
- Multi-repository detection with cross-repo dependency tracking

### What This Gate Enables

- **Gate 8 (Automated Validation)**: Validation rules applied to generated proposals
- **Gate 9 (Human Approval)**: Proposals presented to humans for approval/rejection
- **Gate 10 (Git Integration)**: Proposals drive git commits and branch creation
- **Gate 12 (Subagent Orchestration)**: Proposals distributed to subagents for parallel execution
- **LLM-driven workflows**: `/zeno-proposal` prompt workflow uses proposal generation
- **Agent implementation**: Generated proposals guide agent code implementation

### Scope Boundaries

**In Scope**:
- Proposal template system with markdown structure and sections
- Proposal generation from gate requirements (decompose requirements into tasks)
- Change notice format for spec-driven development (OpenAPI, GraphQL, Protobuf)
- Proposal storage in `zeno/proposals/gate-XX/` and `zeno/proposals/archive/`
- Proposal versioning and evolution tracking
- Proposal-to-requirement mapping (track coverage)
- Proposal dependency analysis and sequencing
- `zeno proposal list`, `zeno proposal show`, `zeno proposal start` commands
- Proposal status tracking (pending, in_progress, completed, rejected)
- Proposal metadata (creation date, author, hash)
- Proposal-to-code mapping and file tracking
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Proposal approval workflow (handled in Gate 9)
- Proposal implementation (agent responsibility, not tool responsibility)
- Automated code generation from proposals (beyond mapping to requirements)
- Proposal editing after creation (proposals immutable after generation)
- Web UI for proposal management (CLI-focused)
- Proposal export to external tools (Jira, Linear, etc.)

## Requirements

This gate addresses requirement decomposition and planning requirements from project initialization:

1. **Clear Implementation Tasks** - Each proposal clearly specifies what needs to be implemented
2. **Requirement Traceability** - Each proposal traceable back to originating requirement(s)
3. **Dependency Understanding** - Proposal dependencies visible for proper sequencing and parallelization
4. **Spec-Driven Development** - Support for API/schema changes tracked in proposals
5. **Proposal Immutability** - Completed proposals archived with hash-based references for audit trail

## Technical Decisions

### 1. Markdown-Based Proposal Storage
- **Choice**: Store proposals as markdown files in `zeno/proposals/gate-XX/` and archive to `zeno/proposals/archive/`
- **Alternatives Considered**: Proposals in SQLite table, YAML format, custom binary format
- **Rationale**: Markdown is human-readable, version-controllable, and integrates with Git. Easy for humans to review and for tools to parse.
- **Trade-offs**: Gained readability and version control; lost query efficiency (mitigated by metadata in database)

### 2. Proposal Dependency Tracking
- **Choice**: Build dependency graph from proposal-requirement mappings and explicit cross-proposal dependencies
- **Alternatives Considered**: Implicit dependencies from requirement chains, manual dependency definition
- **Rationale**: Explicit tracking ensures accuracy. Enables parallelization detection and proper sequencing.
- **Trade-offs**: Gained clarity and automation; added complexity in dependency resolution

### 3. Spec-Driven Change Notices
- **Choice**: Support OpenAPI, GraphQL, Protobuf as first-class change types in proposals
- **Alternatives Considered**: Treat specs as requirements only, separate spec workflow
- **Rationale**: Specs are primary artifacts in many projects. Including them in proposals ensures API changes are properly tracked and versioned.
- **Trade-offs**: Gained spec coverage; added parsing complexity for different spec formats

## Architecture & Dependencies

### Proposal Generation
- `ProposalGenerator` - Creates proposals from gate requirements
- `ProposalTemplate` - Markdown template structure
- `ChangeNoticeGenerator` - Generates spec-driven change notices (OpenAPI, GraphQL, Protobuf)
- `RequirementDecomposer` - Breaks requirements into implementation tasks

### Proposal Storage
- `ProposalStorage` - Persists proposals to markdown files
- `ProposalRegistry` - Tracks all proposals with metadata
- `ProposalVersioning` - Manages proposal evolution

### Dependency Management
- `ProposalDependencyGraph` - Maps proposal dependencies
- `ParallelizationAnalyzer` - Identifies proposals that can run in parallel
- `ProposalSequencer` - Orders proposals for execution

## Implementation Steps

1. Design proposal template structure (sections, metadata, formatting)
2. Implement proposal generator from requirements
3. Build requirement decomposition algorithm
4. Implement change notice format for specs (OpenAPI, GraphQL, Protobuf)
5. Create proposal storage system (markdown + metadata)
6. Implement proposal versioning
7. Build proposal dependency graph analyzer
8. Implement `zeno proposal` commands (list, show, start)
9. Create proposal-to-code mapping
10. Write comprehensive tests

## Gate Completion Criteria

- [ ] Proposal templates generate valid markdown with proper sections and formatting
- [ ] Proposals created from requirements capture all essential implementation details
- [ ] Proposal-to-requirement mapping covers all gate requirements
- [ ] Proposal dependency graph correctly identifies parallel and sequential work
- [ ] Circular dependencies in proposal graph detected and reported
- [ ] `zeno proposal list` displays all proposals with filtering by gate/status
- [ ] `zeno proposal show` retrieves and formats proposal details correctly
- [ ] Change notices correctly represent spec changes (OpenAPI, GraphQL, Protobuf)
- [ ] Proposal status transitions (pending → in_progress) work correctly
- [ ] Proposals stored and retrieved from markdown files with full metadata
- [ ] Proposal archival correctly moves completed proposals with hash-based references
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for proposal module
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for proposal workflow and change notices
