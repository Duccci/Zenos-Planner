# Gate 07: Proposal Generation & Management

**Status**: pending
**Type**: feature
**Created**: 2026-02-04
**Sequence**: 7 of 14
**Hash**: #g07proposal

<!-- Status lifecycle:
  - pending: Gate generated at init, requirements not yet decomposed
  - in_progress: Gate started via `zeno gates start`, requirements generated
  - completed: All requirements tested, gate approved
  - archived: Gate completed and moved to archive with final artifacts
  - rejected: Gate will not be implemented (covers both review rejection and deliberate cancellation); user-provided reason required
  - deferred: Gate postponed to later implementation; user-provided reason required

  Non-implementation terminal statuses (rejected, deferred) require a reason.
  When setting either status, add **Reason**: <explanation> on a new line directly below the Status field.
-->

## Overview

The proposal generation and management infrastructure was largely bootstrapped before this gate started so that Zeno was usable during earlier gate work. The remaining deliverable is focused: compute parallel execution sets from the dependency graph already built by `calculateProposalDependencies()` using a standard topological sort, annotate each proposal with its `parallelSetIndex`, and surface those sets in `proposal list` and `proposal_action` MCP responses.

A secondary deliverable is formalising the proposal type taxonomy. Three orthogonal classification dimensions already exist in the codebase without a single consolidated definition: location type (`gate-tied | solitary`), test-driven phase (`RED | GREEN`), and the semantic content roles — drawing from two overlapping sets already in use (`test-suite | implementation | test-cleanup | solitary` in `test-first-validator.ts`; `feature | refactoring | testing | documentation` in the original spec). This gate reconciles both into a single unified set (`testing | feature | cleanup | documentation | solitary`) stored as an **array** (`roles: ProposalRole[]`), so a single proposal can carry multiple roles (e.g., `['solitary', 'testing', 'feature']`).

## Objectives

### Already Delivered (Pre-Gate)

- [x] Proposal template system (`src/generation/proposal-template.ts` — `loadProposalTemplate`, `renderProposalTemplate`)
- [x] Proposal scaffold generator reading gate PRD via `generateProposals()` (`src/core/proposal-generation.ts`)
- [x] RED / GREEN / implementation phase decomposition (`src/core/proposal-writer.ts`)
- [x] Objective and requirement extraction from gate PRD markdown (`src/core/proposal-parser.ts`)
- [x] Dependency structure calculation: RED → impl → GREEN (`calculateProposalDependencies()`)
- [x] Proposal storage on disk and DB sync (`src/storage/proposal-sync.ts`)
- [x] `proposal list`, `proposal show`, `proposal start`, `proposal generate`, `proposal validate`, `proposal approve`, `proposal reject`, `proposal cancel`, `proposal defer` — CLI and MCP fully operational
- [x] Requirements dual-source sync: `requirements.json` (version-controlled manifest) ↔ SQLite DB (`src/storage/requirements-sync.ts`)

### Remaining Work

- [ ] Extend `calculateProposalDependencies()` output with a topological sort pass: group proposals into parallel execution sets (`parallelSets: string[][]`) where each set contains proposals with no mutual dependencies
- [ ] Annotate each proposal with `parallelSetIndex` (0-indexed set membership) and persist via `syncProposalsFromDisk`
- [ ] Expose `parallelSets: string[][]` in `proposal list` output and `proposal_action` MCP response
- [ ] Add `roles: ProposalRole[]` field (values: `testing | feature | cleanup | documentation | solitary`; multi-value allowed) to `ProposalData`, `ProposalMetadata`, and proposal template; consolidate all three classification dimensions into a single source of truth in `src/core/types.ts`
- [ ] Test coverage for requirements dual-source sync edge cases (project-level requirements with no gate PRD source, solitary proposals, round-trip JSON ↔ DB fidelity)

## Context

### What Was Completed Before This Gate

Gates 01–06 established core infrastructure, including:

- Core infrastructure, CLI framework, SQLite database
- Gate generation with iterative decomposition
- MCP server and function registry
- Requirements database with hierarchical structure and dependency tracking
- Architecture diagram generation
- Multi-repository declaration and dependency tracking

Additionally, the following Gate 7 work was completed early so that Zeno was usable during gate development (see **Already Delivered** in Objectives):

- Full proposal template, generation scaffold, RED/GREEN decomposition, dependency calculation, disk storage, and all proposal CLI/MCP commands

### What This Gate Enables

- **Gate 8 (Automated Validation)**: Validation rules applied to generated proposals; `parallelSetIndex` drives validation ordering
- **Gate 9 (Human Approval)**: Proposals presented to humans for approval/rejection; parallel sets guide review batching
- **Gate 10 (Git Integration)**: Proposals drive git commits and branch creation; parallel sets drive branch scheduling

### Scope Boundaries

**In Scope**:

- `parallelSetIndex` annotation on each proposal (computed via topological sort on `calculateProposalDependencies()` output; no external agent invocation); exposed in `proposal list` CLI output and `proposal_action` MCP response
- `roles: ProposalRole[]` field (values: `testing | feature | cleanup | documentation | solitary`; multi-value) added to `ProposalData`, `ProposalMetadata`, and the proposal template
- Consolidated type taxonomy documentation in `src/core/types.ts` covering all three dimensions: location type, phase, and roles
- Requirements dual-source sync test coverage (edge cases: project-level requirements, solitary proposals, round-trip fidelity)

**Out of Scope**:

- Spec format parsing (OpenAPI, GraphQL, Protobuf) — specs are requirements in the database
- Proposal versioning beyond Git history
- Proposal-to-code file mapping
- Proposal approval workflow — already stubbed; full workflow is Gate 9
- Web UI for proposal management
- Building a new `ProposalDependencyGraph` class — `calculateProposalDependencies()` in `proposal-writer.ts` combined with the existing `dependency-graph.ts` is sufficient

## Requirements

### Project Requirements (Attributed to This Gate)

Project-level requirements were defined during `zeno init` at project inception. This section lists those that are attributed to this gate. Query all project requirements via `zeno req list --project`.

| Hash | Name | Type | Priority | How This Gate Addresses It |
| ---- | ---- | ---- | -------- | -------------------------- |

_No project-level requirements have been attributed to this gate yet. Requirements will be populated when the gate is started._

### Gate-Specific Requirements

Gate-specific requirements are generated when `zeno gates start <gate-id>` is called. These decompose project requirements and gate objectives into actionable items. Stored in `.zeno/registry.db` and queried via `zeno req list --gate <id>`.

**Status**: Requirements will be generated when gate is started.

After gate start, view detailed requirement information via: `zeno req show <hash>`

### Inherited/Transferred Requirements

No inherited or transferred requirements at this time.

### Requirement-to-Task Breakdown

Individual tasks are created during proposal generation (`/zeno-proposal`), not during gate generation. Each requirement may spawn multiple proposals (tasks) that implement it.

---

## Proposals

**Status**: 5 proposals generated. All pending — implementation not yet started.

| Title | Hash | Status | Notes |
|-------|------|--------|-------|
| RED — Gate 07 Test Suite | #a7d4f2e8 | pending | Write all failing tests first |
| Parallel Sets Computation & `parallelSetIndex` Annotation | #b1c9e3f5 | pending | Extends `calculateProposalDependencies()`; DB migration; frontmatter + sync |
| `ProposalRole` Type Taxonomy | #c6d0a2b4 | pending | Consolidates 3 classification dimensions; updates `ProposalMetadata`, `ProposalData`, template |
| Surface `parallelSets` in `proposal list` and `proposal_action` MCP Response | #e8f3c1d7 | pending | Updates Zod schemas and `proposals-registry.ts` |
| GREEN — Test Verification & Gate 07 Quality Pass | #f5a2b3e6 | pending | Wires impls to RED tests; coverage gaps; migration idempotency |

### Parallel Set Dependency Graph

```
RED (#a7d4f2e8)
  ├─→ Parallel Sets (#b1c9e3f5)  ──┐
  ├─→ ProposalRole (#c6d0a2b4)   ──┼─→ GREEN (#f5a2b3e6)
  └─→ MCP Surface (#e8f3c1d7)   ──┘
```

Proposals P02, P03, and P04 are in parallel set 1 and can be implemented concurrently after P01 RED is complete.

After gate start, view detailed proposal information via: `zeno proposal show <hash>`

### Proposal Status

| Proposal | Hash | Status | Notes |
| -------- | ---- | ------ | ----- |

_No proposals have been generated yet. Proposals are created when the gate is started._

### Proposal Dependency Graph

_Dependency graph will be populated after proposals are generated._

### High-Level Delta (Gate Completion Summary)

_To be populated on gate completion._

**Key Deliverables**:

- `parallelSetIndex` annotation on proposals; exposed in `proposal list` and `proposal_action` MCP response
- `ProposalRole[]` type taxonomy consolidated in `src/core/types.ts`
- Requirements dual-source sync test coverage (edge cases)

**Quality Metrics**: Coverage [X]%, Security [Y] issues, Lint <[Z]%

---

## Architecture Diagrams

| Name                              | Type               | Order | Status    |
| --------------------------------- | ------------------ | ----- | --------- |
| System Overview                   | system-overview    | 1     | pending   |
| Data Flow Diagram                 | data-flow          | 2     | pending   |
| Gate Lifecycle State Machine      | gate-lifecycle     | 3     | pending   |
| Gate Roadmap                      | gate-roadmap       | 4     | pending   |
| System Context Diagram            | context            | 5     | pending   |

---

## Technical Decisions for This Gate

### 1. Markdown-Based Proposal Storage

- **Choice**: Store proposals as markdown files within gate proposal directories; completion metadata and status remain in place; DB is a queryable projection rebuilt from `proposal-sync.ts`
- **Alternatives Considered**: Proposals in SQLite, YAML format
- **Rationale**: Markdown is human-readable, version-controllable, integrates with Git
- **Impact**: Storage at `zeno/proposals/gate-XX/` (gate-tied) and `zeno/proposals/solitary/`; sync handled by `src/storage/proposal-sync.ts` (replaces the specced `proposal-storage.ts` name)
- **Trade-offs**: Gained readability and git integration; metadata split between markdown files and SQLite

### 2. Proposal Type Taxonomy (Three Dimensions)

- **Choice**: Formalise three orthogonal classification dimensions in `src/core/types.ts`:
  - **Location type**: `gate-tied | solitary` — where the proposal lives on disk
  - **Phase**: `RED | GREEN` — test-driven phase markers; `undefined` for pure implementation proposals
  - **Roles** (new — array): unified set reconciling two overlapping taxonomies already in the codebase:
    - `testing` — proposal writes or refines test files (maps to `test-suite` in `test-first-validator.ts`)
    - `feature` — proposal implements new functionality (maps to `implementation` / original `feature`)
    - `cleanup` — proposal cleans up tests after implementation (maps to `test-cleanup`)
    - `documentation` — proposal adds or updates documentation only
    - `solitary` — proposal is self-contained with no gate dependency; must include test files
    - A proposal may carry **multiple roles** (e.g., `['solitary', 'testing', 'feature']`); represented as `ProposalRole[]`
- **Alternatives Considered**: Single-value role enum; keeping both taxonomies separately; collapsing phase into role
- **Rationale**: Both taxonomies were independently created and are now in use in different parts of the codebase. A merged array-based field subsumes both without breaking either, allows a proposal to express that it simultaneously sets up tests (`testing`) and adds a feature (`feature`), and unblocks downstream tools (Gate 8 validation, Gate 9 approval templates) that branch on proposal intent. `refactoring` from the original spec is dropped — it is covered by `feature` + `cleanup` in combination.
- **Impact**: `ProposalData`, `ProposalMetadata`, and the proposal template gain a `roles: ProposalRole[]` field; `proposal list` output shows roles; existing proposals default to `['feature']`; `test-first-validator.ts` updated to validate against `ProposalRole` constants instead of ad-hoc strings
- **Trade-offs**: Minor schema widening (array vs scalar); no breaking changes to existing CLI/MCP surfaces

### 3. Proposal Dependency Structure (Reuse Over Duplication)

- **Choice**: Reuse `calculateProposalDependencies()` in `src/core/proposal-writer.ts` and the existing `DependencyGraph` utilities in `src/generation/dependency-graph.ts`; do not create a separate `ProposalDependencyGraph` class
- **Alternatives Considered**: New `ProposalDependencyGraph` class as originally specced
- **Rationale**: `calculateProposalDependencies()` already encodes the RED → impl → GREEN structure and returns typed dependency edges. `dependency-graph.ts` provides cycle detection and Mermaid rendering. Building a third abstraction would duplicate this without adding capability.
- **Impact**: `TaskDistributorIntegration` receives the output of `calculateProposalDependencies()` as its input graph; no new graph-building code required
- **Trade-offs**: Gained simplicity; any future proposal graph extensions land in `proposal-writer.ts`

### 4. Topological Sort for Parallel Set Computation

- **Choice**: Compute `parallelSets: string[][]` directly from `calculateProposalDependencies()` output using a standard Kahn's algorithm topological sort. Proposals with no mutual dependencies within the same topological level form a parallel set.
- **Alternatives Considered**: Invoke `task-distributor` agent via Copilot ACP or Claude CLI to classify the graph; static set assignment
- **Rationale**: Topological sort is an O(V+E) deterministic algorithm that already has all the inputs it needs from `calculateProposalDependencies()`. The dependency graph structure (`RED → impl → GREEN`) already encodes the correct execution ordering. Introducing a subprocess agent invocation would add external runtime dependencies (Copilot CLI or Claude CLI installed and accessible), two distinct invocation protocol paths (ACP JSON-RPC over stdio vs. `claude -p`), a new `ai` config section, and failure modes — all for a computation a local algorithm handles correctly every time.
- **Impact**: `calculateProposalDependencies()` (or a thin wrapper in `proposal-generation.ts`) runs the topological sort and produces `parallelSets`; `ProposalGenerateOutput` gains a `parallelSets` field; proposals annotated with `parallelSetIndex` before disk sync
- **Trade-offs**: Gained simplicity, determinism, zero external dependencies; lost nothing — the agent call added no capability over the algorithm

### 5. Requirements Dual-Source Sync

- **Choice**: `requirements.json` is the version-controlled source of truth; SQLite is a queryable projection. Two sources feed it: (a) `requirements.json` manifest via `syncRequirementsFromDisk()`, and (b) gate PRD markdown via `extractRequirements()` in `proposal-parser.ts` (used only during `generateProposals()` to seed the proposal scaffold, not to write requirements to the DB)
- **Alternatives Considered**: DB as sole source; PRD extraction writing back to DB as RFC 2119 requirement records
- **Rationale**: Gate PRD extraction is a read-only heuristic used to populate proposal scaffolds, not a requirement authoring step. Requirements are authored by the LLM via `reg_action:create` and persisted to both DB and `requirements.json`. Keeping these paths separate prevents accidental overwriting of curated requirements with heuristic extractions.
- **Impact**: No new requirement-write pathway is added in this gate; the existing sync behaviour is sufficient. Test coverage for edge cases (project-level requirements with no gate PRD, solitary-proposal requirements after archival) is the deliverable.
- **Trade-offs**: Gained clarity; RFC 2119 keyword validation is not a Gate 7 deliverable — that belongs in Gate 8 validation rules

## Architecture Updates

### Components Modified or Created

- **ProposalData / ProposalMetadata** (`src/generation/proposal-template.ts`, `src/core/proposal-writer.ts`)
  - Purpose: Add `roles: ProposalRole[]` field (values: `testing | feature | cleanup | documentation | solitary`; multi-value)
  - Changes: Extend existing interfaces; default `['feature']` for existing proposals
  - Interfaces: No breaking change — `roles` is optional with default

- **ProposalTypeDefinitions** (`src/core/types.ts`)
  - Purpose: Single source of truth for all three proposal classification dimensions
  - Changes: Export `ProposalLocationType`, `ProposalPhase`, and `ProposalRole = 'testing' | 'feature' | 'cleanup' | 'documentation' | 'solitary'` type aliases; consolidate from their current scattered definitions (inline literals in `proposal-writer.ts`; ad-hoc strings in `proposals-registry.ts` and `test-first-validator.ts`)

- **generateProposals** (`src/core/proposal-generation.ts`)
  - Purpose: Compute parallel execution sets after `calculateProposalDependencies()` returns
  - Changes: Add topological sort pass (Kahn’s algorithm) over the dependency edge list; produce `parallelSets: string[][]`; annotate each proposal with `parallelSetIndex` before returning; add `parallelSets` to `ProposalGenerateOutput`

- **proposal_action list handler** (`src/mcp/tools/proposal-tools.ts`, `src/integration/proposals-registry.ts`)
  - Purpose: Surface `parallelSets` and `parallelSetIndex` in list responses
  - Changes: Add fields to list output schema and handler

### Diagram Updates

- System Overview: `zeno/architecture/system-overview.md` — update proposal module to reflect parallel set annotation
- Data Flow: `zeno/architecture/data-flow.md` — add topological sort step in proposal generation flow

## Gate-Specific Quality Considerations

### Security Considerations

- Proposal file paths must be sanitized to prevent directory traversal
- No external subprocess invocations in this gate; parallel set computation is pure in-process logic

## Dependencies

### External Dependencies (New or Updated)

No new external dependencies required.

### Internal Dependencies

- **Depends on Gate(s)**: Gate 06: Multi-Repo — subproject context for proposal generation
- **Blocks Gate(s)**: Gate 08: Automated Validation, Gate 09: Human Approval, Gate 10: Git Integration
- **Requires Modules**: Requirements database, Function Registry, Gate storage system

### Infrastructure Dependencies

- Proposal directory structure `zeno/proposals/gate-XX/` must be created on gate start

## Implementation Steps

1. **Define Acceptance Tests**
   - Write tests for parallel set computation: given a set of dependency edges from `calculateProposalDependencies()`, assert `parallelSets` shape (correct groupings, no mutual deps within a set)
   - Write tests for `parallelSetIndex` annotation: assert each proposal is stamped with the correct 0-indexed set membership and persisted via `syncProposalsFromDisk`
   - Write tests for requirements dual-source sync edge cases (project-level, solitary post-archival, round-trip fidelity)
   - Write tests for `roles` field: default value (`['feature']`), template rendering, list output

2. **Consolidate Proposal Type Taxonomy**
   - Export `ProposalLocationType`, `ProposalPhase`, `ProposalRole` from `src/core/types.ts`
   - Add `roles: ProposalRole[]` (default `['feature']`) to `ProposalData` in `proposal-template.ts` and `ProposalMetadata` in `proposal-writer.ts`
   - Update proposal template to render roles in the frontmatter metadata block

3. **Implement Parallel Set Computation**
   - In `src/core/proposal-generation.ts`, add a topological sort (Kahn’s algorithm) over the dependency edge list returned by `calculateProposalDependencies()`
   - Group proposals by topological level into `parallelSets: string[][]`; annotate each proposal with `parallelSetIndex`
   - Persist updated metadata via `syncProposalsFromDisk`

4. **Expose in CLI and MCP**
   - `zeno proposal list` output: add `parallelSet` column
   - `proposal_action:list` MCP response: add `parallelSets` and `parallelSetIndex` to the output schema

5. **Requirements Sync Test Coverage**
   - Cover `writeRequirementsManifest` and `syncRequirementsFromDisk` round-trip with project-level (no gateId), gate-level, and solitary-proposal requirements
   - Verify `INSERT OR IGNORE` semantics: existing DB rows not overwritten by stale manifest

## Known Issues & Limitations

### Current Limitations

- No spec format parsing (OpenAPI, GraphQL, Protobuf) — specs are requirements in the database
- No proposal versioning beyond Git history

### Technical Debt

- `src/storage/proposal-sync.ts` performs disk → DB sync but lacks coverage for solitary post-archival and project-level requirements; covered in this gate
- Proposal type classification is scattered across `proposal-template.ts`, `proposal-writer.ts`, `archive-schemas.ts`, and `artifact-locator.ts`; consolidated in this gate via `src/core/types.ts`

## Risks & Mitigation

### Technical Risks

1. **Circular Dependency Detection**
   - **Impact**: Medium
   - **Probability**: Low
   - **Mitigation**: `validateDependencyGraph()` in `src/generation/dependency-graph.ts` already detects cycles; called before the topological sort pass
   - **Contingency**: Flag cycles for human review rather than blocking generation

### Process Risks

1. **Proposal Scope Creep**
   - **Impact**: Medium
   - **Probability**: Medium
   - **Mitigation**: Clear scope boundaries per proposal; requirement traceability ensures proposals stay on target
   - **Contingency**: Split oversized proposals into smaller units

## Gate Completion Criteria

- [ ] All must-have requirements implemented and tested
- [ ] All should-have requirements implemented or explicitly deferred
- [ ] All proposals completed and approved
- [ ] All acceptance criteria met
- [ ] Architecture diagrams updated
- [ ] Gate-specific quality considerations addressed
- [ ] Stakeholder approval obtained
- [ ] `ProposalLocationType`, `ProposalPhase`, `ProposalRole` exported from `src/core/types.ts`
- [ ] `roles` field present in `ProposalData`, `ProposalMetadata`, and rendered in proposal template
- [ ] `ai` config section present in `ZenoConfigSchema` with `cli` enum (`copilot | claude`, default `copilot`; `cursor` excluded), optional `model`, and `invocationMode` enum (`acp | cli`, default `acp`); `cli = 'copilot'` + `invocationMode = 'cli'` coerces to `acp` with warning
- [ ] `TaskDistributorIntegration` `acp` mode: spawns `copilot [--model] --acp --stdio`, sends prompt over stdin, parses NDJSON response; `cli` mode (`claude` only): spawns `claude -p` with piped stdio; `parallelSets[][]` returned and stored in both paths
- [ ] Each proposal annotated with `parallelSetIndex`; visible in `zeno proposal list` output and `proposal_action:list` MCP response
- [ ] `generateProposals()` output includes `parallelSets` field
- [ ] Fallback to topological sort when agent response is malformed; test coverage for fallback path
- [ ] Requirements sync round-trip tests pass (project-level, gate-level, solitary post-archival)
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for all new and modified modules
- [ ] Zero lint errors, zero type errors

## Notes

### Implementation Notes

- `TaskDistributorIntegration` should be a thin, stateless module; all state is in the proposal markdown files and the DB via `proposal-sync.ts`
- Existing proposals written before this gate lands should be backfilled with `roles: ['feature']` by the sync layer — add a migration note in `proposal-sync.ts`

### Proposal Summary

_Populated during proposal archival. Contains 1-2 sentence summaries of completed proposals, preserving a record of work completed in this gate._

| Proposal Hash | Summary |
| ------------- | ------- |

### Next Gate Preview

Gate 08 (Automated Validation & Quality Gates) will implement automated validation that enforces quality gates before human approval, including a validation orchestrator, agent-driven quality assessment, and shared conflict detection. The `parallelSetIndex` produced by this gate drives validation batching order in Gate 08.

---

**Document Version**: 2.0.0
**Last Updated**: 2026-02-28
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: Zeno
**Reviewers**: Zeno

### Change Log

| Version | Date       | Summary                                                          | Author |
| ------- | ---------- | ---------------------------------------------------------------- | ------ |
| 1.0.0   | 2026-02-04 | Initial version                                                  | Zeno   |
| 1.1.0   | 2026-02-27 | Aligned with gate-prd-template.md                                | Zeno   |
| 1.2.0   | 2026-02-28 | Integrate task-distributor agent for parallel proposal execution | Zeno   |

**Related Documents**:

- Project PRD: `zeno/PROJECT_PRD.md`
- Previous Gate: `zeno/gates/gate-06-multi-repo-subproject-detection.md`
- Next Gate: `zeno/gates/gate-08-automated-validation-quality-gates.md`
- Architecture: `zeno/architecture/`
