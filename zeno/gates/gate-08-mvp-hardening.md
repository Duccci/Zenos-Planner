---
zeno:
  id: gate-08
  name: MVP Hardening
  sequence: 8
  type: feature
  status: pending
  hash: g08harden
  created_at: '2026-03-14'
  depends_on: []
  phases:
    - MVP
---

# Gate 08: MVP Hardening

> Consolidates remaining delta work from original gates 08-11. Core validation (11 validators),
> approval (approve/reject/transitions), git (commit/tag/push), and replan (full engine + CLI)
> are already implemented. This gate delivers the gaps: shell-based validation runner, audit trail,
> git worktrees, requirement transfer, and E2E integration tests across all four subsystems.

**Status**: pending
**Type**: feature
**Phases**: MVP
**Created**: 2026-03-14
**Sequence**: 8 of 10
**Hash**: #g08harden

<!-- Status lifecycle:
  - pending: Gate generated at init, requirements not yet decomposed
  - in_progress: Gate started via `zeno gates start`, requirements generated
  - completed: All requirements tested, gate approved
  - archived: Gate completed and moved to archive with final artifacts
  - rejected: Gate rejected during review
  - cancelled: Gate cancelled/dropped with optional reason
  - backlog: Gate deferred to later implementation
-->

## Overview

Four subsystems — validation, approval, git integration, and rescope/replan — were substantially implemented during gates 1-7. This gate closes the remaining gaps across all four and delivers comprehensive E2E tests proving they work together as a production-ready pipeline.

**Subsystem status and remaining work:**

| Subsystem | Implemented (gates 1-7) | Remaining (this gate) |
|-----------|------------------------|-----------------------|
| **Validation** | 11 validators, conflict detector, quality thresholds, MCP `proposal_action:validate` | Shell-based tool runner (ESLint, tsc, Vitest, c8, npm audit), structured validation reports |
| **Approval** | approve/reject commands, state transitions, apply-phase validator, rejection feedback | SQLite audit trail, rejection category taxonomy |
| **Git Integration** | commit, tag, push, syncWithGit, getGitUserInfo, getGitStatus, worktree schemas | WorktreeManager (create/merge/remove/list/prune), structured commit messages, gate release tagging |
| **Rescope/Replan** | replanGates(), CLI with --from/--prd-changed/--dry-run, MCP gates_action:regenerate | Requirement transfer between gates, rescope history tracking, orphan detection |

## Objectives

### Validation Runner

- [ ] Implement ShellValidationRunner: spawn ESLint, tsc, Vitest, c8, npm audit as child processes and parse output
- [ ] Add structured validation reports (JSON + human-readable) aggregating all check results
- [ ] Wire shell runner into existing `proposal_action:validate` pipeline

### Approval Audit Trail

- [ ] Implement SQLite `approval_events` table for approval decisions (approver, timestamp, action, reason)
- [ ] Add rejection category taxonomy (quality, requirement-mismatch, scope-creep, incomplete, other)
- [ ] Expose rejection feedback via MCP for LLM iteration context

### Git Worktrees

- [ ] Implement WorktreeManager: create, remove, list, prune, merge using `simple-git` worktree APIs
- [ ] Integrate worktrees into proposal lifecycle: create on start, merge on approve, cleanup on completion
- [ ] Implement structured commit message generator using `commitFormat` from `.zeno/config.json`
- [ ] Implement gate release tagging on `gates_action:complete`
- [ ] Expose worktree operations via MCP tools and `zeno worktree` CLI commands

### Rescope Hardening

- [ ] Implement requirement transfer: `zeno req transfer <hash> <gate-id>` moves requirements between gates
- [ ] Implement rescope history tracking: SQLite `rescope_events` table with before/after snapshots
- [ ] Handle mid-gate rescope safety (warn + `--force` for in-progress gates)

### Integration Tests

- [ ] E2E test: full validation pipeline (all 11 validators + shell runner)
- [ ] E2E test: approve → complete and reject → rework → revalidate cycles
- [ ] E2E test: proposal start → worktree create → merge → cleanup
- [ ] E2E test: replan → gates regenerated → requirements transferred → history recorded

## Context

### What Was Completed Before This Gate

See subsystem status table in Overview. Key files:

- **Validators**: `src/mcp/validators/` (11 files), `src/core/conflict-detector.ts`, `src/mcp/tools/validation-tools.ts`
- **Approval**: `src/integration/proposals-registry.ts` (approve/reject), `src/core/completions.ts`, `src/core/transitions.ts`
- **Git**: `src/utils/git.ts` (commit/tag/push/sync), `src/mcp/schemas/worktree-schemas.ts` (schemas only), `src/core/archive-execution.ts`
- **Replan**: `src/core/gate-generator.ts` (replanGates), `src/cli/commands/gates.ts` (replan CLI), MCP gates_action:regenerate

### What This Gate Enables

- **Gate 09 (Documentation)**: MVP must be hardened before docs polish
- **Gate 10 (Subagent Orchestration)**: Worktrees enable parallel agent execution; validation/approval pipeline is prerequisite

### Scope Boundaries

**In Scope**:

- Shell-based validation runner (spawn + parse project tools)
- Structured validation reports
- SQLite audit trail for approval decisions
- Rejection category taxonomy
- Git worktree lifecycle (create, merge, remove, list, prune)
- Worktree expiration policy (configurable TTL, default 7 days)
- Structured commit messages with proposal hash references
- Gate release tagging
- MCP tools for worktrees and worktree CLI commands
- Requirement transfer between gates
- Rescope history tracking (SQLite table)
- Mid-gate rescope safety
- E2E integration tests for all four subsystems
- Test coverage ≥90% for all new code

**Out of Scope**:

- Dashboard or status visualization (removed — scope creep)
- Pre-commit hook installation (user's project manages hooks)
- GitHub/GitLab API integration (git-native only)
- Release notes generation, version bumps, changelog
- Automatic conflict resolution during replan
- Rollback to previous gate plan
- Rebase merge strategy (merge-only for MVP)

---

## Requirements

### Project Requirements (Attributed to This Gate)

| Hash    | Name                          | Type         | Priority | How This Gate Addresses It                                    |
| ------- | ----------------------------- | ------------ | -------- | ------------------------------------------------------------- |
| #[hash] | Shell-Based Quality Checks    | functional   | must     | ShellValidationRunner invokes ESLint, tsc, Vitest, npm audit  |
| #[hash] | Approval Audit Trail          | functional   | must     | SQLite table logs all approval decisions with context          |
| #[hash] | Isolated Parallel Development | functional   | must     | Worktrees enable isolated proposal implementation              |
| #[hash] | Atomic Commits                | functional   | must     | Structured commit messages with proposal hash references       |
| #[hash] | Requirement Traceability      | functional   | must     | Transfer preserves parent-child relationships during replan    |
| #[hash] | Rescope Audit                 | functional   | should   | History log tracks all replan events with before/after snapshots |

### Gate-Specific Requirements

**Status**: Requirements will be generated when gate is started.

### Inherited/Transferred Requirements

No inherited or transferred requirements at this time.

### Requirement-to-Task Breakdown

Individual tasks are created during proposal generation.

---

## Proposals

**Status**: Proposals will be generated when gate is started.

### Proposal Status

| Proposal        | Hash    | Status  | Notes            |
| --------------- | ------- | ------- | ---------------- |
| [proposal-name] | #[hash] | pending | [Optional notes] |

### Proposal Dependency Graph

```mermaid
graph LR
    P1["01 Shell Validation Runner"]
    P2["02 Approval Audit Trail"]
    P3["03 Worktree Manager"] --> P1
    P4["04 Commit Messages & Tagging"] --> P3
    P5["05 Rescope Hardening"]
    P6["06 E2E Integration Tests"] --> P1
    P6 --> P2
    P6 --> P4
    P6 --> P5
```

### High-Level Delta (Gate Completion Summary)

[To be populated on gate completion.]

---

## Architecture Diagrams

| Name                         | Type            | Order | Status  |
| ---------------------------- | --------------- | ----- | ------- |
| System Overview              | system-overview | 1     | pending |
| Data Flow Diagram            | data-flow       | 2     | pending |
| Gate Lifecycle State Machine | gate-lifecycle  | 3     | pending |
| Gate Roadmap                 | gate-roadmap    | 4     | pending |
| System Context Diagram       | context         | 5     | pending |
| Component Diagram            | component       | 6     | pending |

---

## Technical Decisions for This Gate

### 1. Shell Validation Runner with Configurable Timeouts

- **Choice**: Spawn ESLint, tsc, Vitest, c8, npm audit as child processes with configurable per-tool timeout (default 30s)
- **Alternatives Considered**: Import tools programmatically, use lint-staged integration
- **Rationale**: Shell spawning works with any tool version and any project tool configuration. No tight coupling to specific tool APIs.
- **Impact**: Works with any Node.js project; requires tools to be installed in target project
- **Trade-offs**: Gained universality; added process spawn overhead (~200ms per tool)

### 2. SQLite for Audit Trail and Rescope History

- **Choice**: Two new SQLite tables in `registry.db`: `approval_events` and `rescope_events`
- **Alternatives Considered**: File-based logs, git-based history only
- **Rationale**: SQLite provides queryable, transactional history. File-based is harder to query. Git captures file changes but not semantic intent.
- **Impact**: Queryable audit trail for both approval decisions and replan events
- **Trade-offs**: Gained queryability; slightly increased schema complexity

### 3. Git Worktree Strategy

- **Choice**: One worktree per proposal at `.local/worktrees/{proposal-hash}/`, merge on approval, cleanup after merge
- **Alternatives Considered**: Branch switching per proposal, full clones per proposal
- **Rationale**: Worktrees provide isolated filesystem without branch switching delays. Enables true parallelization. `.local/` keeps worktrees out of version control.
- **Impact**: Each proposal gets dedicated filesystem; merge coordination required
- **Trade-offs**: Gained parallel execution; added disk space overhead and merge coordination complexity

### 4. Merge-Only Strategy for MVP

- **Choice**: Always merge (no rebase) when combining worktree branches
- **Alternatives Considered**: Configurable merge vs. rebase, always rebase
- **Rationale**: Merge preserves full commit history and is safer. Rebase can be added post-MVP.
- **Impact**: Merge commits visible in history
- **Trade-offs**: Gained safety and simplicity; slightly noisier git history

### 5. Requirement Transfer as Explicit Command

- **Choice**: `zeno req transfer <hash> <gate-id>` moves a requirement to a different gate, updating all references
- **Alternatives Considered**: Automatic redistribution during replan, copy-on-transfer
- **Rationale**: Explicit transfer gives the user control. Automatic redistribution risks misplacement.
- **Impact**: Requirements can move between gates without losing history or dependency links
- **Trade-offs**: Gained flexibility; requires manual intervention during large replan operations

### 6. Mid-Gate Rescope Safety

- **Choice**: Warn and require `--force` flag when replan affects an in-progress gate; preserve existing proposals and worktrees
- **Alternatives Considered**: Automatically abort in-progress work, silently modify gate
- **Rationale**: In-progress gates may have active worktrees and proposals. Silent modification risks losing work.
- **Impact**: Safety-first approach for in-progress gates
- **Trade-offs**: Gained safety; requires user confirmation for mid-gate replan

## Architecture Updates

### Components Modified or Created

- **ShellValidationRunner** (`src/core/shell-validation-runner.ts`)
  - Purpose: Spawn and parse ESLint, tsc, Vitest, c8, npm audit
  - Changes: New component
  - Interfaces: `runAll(projectDir): ValidationReport`, `runTool(tool, projectDir): ToolResult`

- **ValidationReporter** (`src/core/validation-reporter.ts`)
  - Purpose: Aggregate check results into structured JSON + human-readable reports
  - Changes: New component

- **ApprovalAuditTrail** (`src/core/approval-audit-trail.ts`)
  - Purpose: Record and query approval decisions in SQLite
  - Changes: New component
  - Interfaces: `record(event): void`, `list(proposalHash?): AuditEvent[]`

- **WorktreeManager** (`src/git/worktree-manager.ts`)
  - Purpose: Create, remove, list, prune, merge worktrees
  - Changes: New component
  - Interfaces: `create(proposalHash): WorktreePath`, `remove(path)`, `list(): WorktreeInfo[]`, `prune(): PruneResult`, `merge(path): MergeResult`

- **CommitMessageGenerator** (`src/git/commit-message-generator.ts`)
  - Purpose: Create structured commit messages using `commitFormat` from `.zeno/config.json`
  - Changes: New component

- **RequirementTransferService** (`src/core/requirement-transfer.ts`)
  - Purpose: Move requirements between gates, update all references
  - Changes: New component

- **RescopeHistoryTracker** (`src/core/rescope-history.ts`)
  - Purpose: Log replan events with before/after snapshots
  - Changes: New component

- **proposals-registry.ts** — Modified: integrate worktree creation into `proposal_start`, merge into `proposal_approve`, audit trail recording
- **gates-registry.ts** — Modified: integrate release tagging into `gates_complete`
- **gate-generator.ts** — Modified: add orphan detection, mid-gate safety, snapshot integration

### Diagram Updates

- System Overview: Add git integration layer with worktree manager
- Data Flow: Add worktree lifecycle and merge flow, validation runner flow
- Component: Add git layer components and audit trail

### Integration Points

- **Proposal lifecycle**: validate → approve → commit (shell runner feeds into approval, approval feeds into git)
- **Worktree lifecycle**: start → create worktree; approve → merge worktree; reject → optional cleanup
- **Gate lifecycle**: complete → create release tag
- **Replan**: trigger → snapshot → regenerate → transfer orphans → record history
- **MCP Server**: Worktree operations + rescope history exposed as MCP tools
- **Config**: `commitFormat` from `.zeno/config.json` drives commit message structure

## Gate-Specific Quality Considerations

### Security Considerations

- Shell runner must not execute arbitrary commands — tool list is hardcoded (ESLint, tsc, Vitest, c8, npm audit)
- Worktree paths must be validated to prevent directory traversal
- Commit messages must not interpolate unsanitized proposal content
- Git operations must not expose credentials or tokens in output
- Requirement transfer must validate target gate exists and is not completed

### Performance Requirements

- Shell validation runner: complete all 5 tools within 2 minutes for typical projects
- Worktree creation: <5 seconds
- Merge operations: <10 seconds for typical proposals
- Requirement transfer: <1 second
- `worktree list`: handle 100+ worktrees without timeout

## Dependencies

### External Dependencies (New or Updated)

- **simple-git** (existing) — Worktree operations via `git worktree add/remove/list`

### Internal Dependencies

- **Depends on Gate(s)**: Gates 01-07 (all completed)
- **Blocks Gate(s)**: Gate 09 (Documentation), Gate 10 (Subagent Orchestration)
- **Requires Modules**: Proposal storage, conflict detector, git utilities, proposals-registry, gates-registry, gate-generator, requirement registry

### Infrastructure Dependencies

- Git 2.x+ (worktree support)
- `.local/worktrees/` directory for worktree storage (auto-created)
- Existing `registry.db` SQLite database (new tables added via migration)

## Implementation Steps

1. **Define Acceptance Tests**
   - Tests for shell validation runner (mock child_process)
   - Tests for audit trail recording and querying
   - Tests for worktree CRUD operations (mock simple-git)
   - Tests for commit message generation and gate tagging
   - Tests for requirement transfer and rescope history

2. **Implement Shell Validation Runner**
   - ShellValidationRunner: spawn ESLint, tsc, Vitest, c8, npm audit
   - Parse stdout/stderr into structured ToolResult objects
   - ValidationReporter: aggregate into JSON + human-readable report
   - Wire into existing `proposal_action:validate` pipeline

3. **Implement Approval Audit Trail**
   - Create `approval_events` table migration
   - ApprovalAuditTrail: record/query approval decisions
   - Add rejection categories to rejection feedback
   - Expose via MCP for LLM context

4. **Implement WorktreeManager & Commit Generator**
   - WorktreeManager: create, remove, list, prune, merge
   - Integrate into proposal lifecycle (start/approve/reject)
   - CommitMessageGenerator: parse `commitFormat` from config
   - Gate release tagging on completion
   - MCP tools + CLI commands for worktree operations

5. **Implement Rescope Hardening**
   - RequirementTransferService: move requirements between gates
   - RescopeHistoryTracker: record replan events with snapshots
   - Mid-gate rescope safety (warn + --force)
   - Orphan detection after gate removal

6. **E2E Integration Tests**
   - Full validation pipeline test
   - Approve/reject lifecycle test
   - Worktree lifecycle test (start → create → merge → cleanup)
   - Replan lifecycle test (trigger → regenerate → transfer → history)

## Gate Completion Criteria

- [ ] Shell validation runner invokes all 5 tools and produces structured reports
- [ ] Approval audit trail records all decisions with approver, timestamp, and reason
- [ ] Rejection categories present and exposed via MCP
- [ ] Worktree creation, removal, listing, pruning, and merging all work correctly
- [ ] Proposal start creates worktree; proposal approve merges and cleans up
- [ ] Structured commit messages include proposal hashes per commitFormat config
- [ ] Gate completion creates annotated release tag
- [ ] Requirement transfer moves requirements between gates preserving references
- [ ] Rescope history records all replan events with before/after snapshots
- [ ] Mid-gate rescope warns user and requires --force for in-progress gates
- [ ] MCP tools and CLI commands for worktree operations work correctly
- [ ] E2E tests cover all four subsystems end-to-end
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for all new code
- [ ] Zero lint errors, zero type errors

## Notes

### Implementation Notes

- This gate consolidates remaining delta work from original gates 08-11
- Most of the infrastructure is already built — this gate fills gaps and proves it works E2E
- Worktree implementation is the largest single piece of new code
- Shell validation runner and audit trail are straightforward additions
- Rescope hardening builds on the fully implemented replan engine

### Next Gate Preview

Gate 09 (Documentation & Polish) cleans up README, CLI/MCP references, and AGENTS.md.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-14
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: Zeno
**Reviewers**: Zeno

### Change Log

| Version | Date       | Summary                                                         | Author |
| ------- | ---------- | --------------------------------------------------------------- | ------ |
| 1.0.0   | 2026-03-14 | Consolidated from original gates 08-11; scoped to remaining delta | Zeno   |

**Related Documents**:

- Project PRD: `zeno/overview/PROJECT_PRD.md`
- Previous Gate: `zeno/gates/archive/` (gates 01-07)
- Next Gate: `zeno/gates/gate-09-documentation-polish.md`
- Architecture: `zeno/architecture/`
