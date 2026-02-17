# Gate 07: Proposal Generation & Management

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 7 of 12  
**Hash**: #g07proposal

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements proposal generation and management system that decomposes gate-specific requirements into actionable implementation proposals. Proposals are standardized markdown documents generated from requirement decomposition. Design decisions and specification changes made during a proposal are recorded as requirement updates in the SQLite database following RFC 2119 keyword conventions (MUST, SHOULD, MAY, etc.). Proposals serve as the handoff between planning (gates/requirements) and execution (implementation, git commits).

## Objectives

### Proposal Generation & Templates
- [ ] Create proposal template system (markdown structure, sections, formatting)
- [ ] Implement proposal generator from gate requirements
- [ ] Build requirement decomposition into implementation tasks
- [ ] Support multiple proposal types (feature, refactoring, testing, documentation)
- [ ] Generate proposal title and description from requirements
- [ ] Create acceptance criteria extraction from requirements
- [ ] Build implementation steps from requirement decomposition

### Specification Changes as Requirement Updates
- [ ] Record design decisions during proposal/gate as requirement updates in SQLite
- [ ] Follow RFC 2119 keyword conventions (MUST, SHOULD, MAY, MUST NOT, etc.) for requirement language
- [ ] Track spec changes as requirement status transitions (spec additions = new requirements, spec changes = requirement updates)
- [ ] No separate spec format parsing — specifications live as structured requirements in the database

### Proposal Storage
- [ ] Implement proposal storage system (markdown files in `zeno/proposals/gate-XX/`)
- [ ] Build proposal-to-requirement mapping (know which requirements each proposal addresses)
- [ ] Implement proposal status tracking (pending, in_progress, completed, rejected)
- [ ] Ensure completed proposals remain in gate proposal directories with immutable hash references
- [ ] Integrate completed proposal summaries into gate archival artifacts on gate completion

### Proposal Dependency Tracking
- [ ] Implement proposal dependency analysis (which proposals depend on others)
- [ ] Identify proposals that can run in parallel
- [ ] Build dependency-based proposal sequencing
- [ ] Implement circular dependency detection

### Proposal Management Commands
- [ ] Implement `zeno proposal list` command with filtering (--gate, --status flags)
- [ ] Implement `zeno proposal show <hash>` command (display proposal details)
- [ ] Implement `zeno proposal start <hash>` command (set status to in_progress)
- [ ] Build proposal metadata (creation date, author, status, hash)

### Testing & Quality
- [ ] Write unit tests for proposal generation
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
- Architecture diagram generation
- Multi-repository declaration and dependency tracking

### What This Gate Enables

- **Gate 8 (Automated Validation)**: Validation rules applied to generated proposals
- **Gate 9 (Human Approval)**: Proposals presented to humans for approval/rejection
- **Gate 10 (Git Integration)**: Proposals drive git commits and branch creation

### Scope Boundaries

**In Scope**:
- Proposal template system with markdown structure
- Proposal generation from gate requirements
- Specification changes recorded as RFC 2119-compliant requirement updates in SQLite
- Proposal storage in `zeno/proposals/gate-XX/`
- Proposal-to-requirement mapping
- Proposal dependency analysis and sequencing
- `zeno proposal list`, `zeno proposal show`, `zeno proposal start` commands
- Proposal status tracking (pending, in_progress, completed, rejected)
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Spec format parsing (OpenAPI, GraphQL, Protobuf) — specs are requirements in the database
- Proposal versioning beyond Git history
- Proposal-to-code file mapping
- Proposal approval workflow (handled in Gate 9)
- Proposal implementation (agent responsibility)
- Web UI for proposal management

## Requirements

1. **Clear Implementation Tasks** — Each proposal clearly specifies what needs to be implemented
2. **Requirement Traceability** — Each proposal traceable back to originating requirement(s)
3. **Dependency Understanding** — Proposal dependencies visible for proper sequencing
4. **RFC 2119 Specifications** — Design decisions recorded as structured requirements using RFC 2119 keywords
5. **Proposal Immutability** — Completed proposals retain hash-based references and are integrated into gate archives

## Technical Decisions

### 1. Markdown-Based Proposal Storage
- **Choice**: Store proposals as markdown files within gate proposal directories and keep completion metadata in place
- **Alternatives Considered**: Proposals in SQLite, YAML format
- **Rationale**: Markdown is human-readable, version-controllable, integrates with Git.

### 2. Specifications as Requirements (RFC 2119)
- **Choice**: Record spec changes as requirement updates in SQLite using RFC 2119 keyword conventions
- **Alternatives Considered**: Separate spec-driven change notice format (OpenAPI, GraphQL, Protobuf parsing)
- **Rationale**: Specs are requirements. Treating them as structured database entries with RFC 2119 language avoids building parsers for multiple spec formats. Keeps Zeno lightweight. The LLM writes the requirements with proper RFC keywords; Zeno stores and tracks them.
- **Trade-offs**: Gained simplicity; lost format-specific spec awareness (acceptable — LLMs handle format interpretation)

### 3. Proposal Dependency Tracking
- **Choice**: Build dependency graph from proposal-requirement mappings and explicit cross-proposal dependencies
- **Rationale**: Enables parallelization detection and proper sequencing.

### 4. Gate-Centric Historical Retention
### 4. Gate-Centric Historical Archival
- **Choice**: Gate artifacts are the sole long-term archive target; proposals are completed in place and summarized in gate archives
- **Rationale**: Proposals are execution-scoped working artifacts, while gates are milestone records. Gate-centric archival removes duplicate storage and preserves milestone-level traceability.
- **Requirements Tracking**: Proposal completion updates requirement progress; gate completion finalizes tested state and archival integration.
- **Hash References**: Proposal hashes remain stable for dependency tracking, while gate archive artifacts provide long-term reference.
- **Context Reduction**: Single archival surface (gates) reduces lifecycle complexity and avoids parallel archive hierarchies.

## Implementation Steps

1. Design proposal template structure
2. Implement proposal generator from requirements
3. Build requirement decomposition algorithm
4. Create proposal storage system (markdown + metadata)
5. Build proposal dependency graph analyzer
6. Implement `zeno proposal` commands (list, show, start)
7. Implement RFC 2119 requirement recording for spec changes
8. Write comprehensive tests

## Gate Completion Criteria

- [ ] Proposal templates generate valid markdown with proper sections
- [ ] Proposals created from requirements capture all essential implementation details
- [ ] Proposal-to-requirement mapping covers all gate requirements
- [ ] Proposal dependency graph correctly identifies parallel and sequential work
- [ ] `zeno proposal list` displays all proposals with filtering by gate/status
- [ ] `zeno proposal show` retrieves and formats proposal details correctly
- [ ] Design decisions recorded as RFC 2119 requirement updates in SQLite
- [ ] Proposal status transitions (pending → in_progress) work correctly
- [ ] Proposals stored and retrieved from markdown files with full metadata
- [ ] Gate completion integrates completed proposal summaries into gate archival artifacts
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for proposal module
- [ ] Zero lint errors, zero type errors
