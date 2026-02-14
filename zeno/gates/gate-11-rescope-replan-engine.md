# Gate 11: Rescope & Replan Engine

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 11 of 12  
**Hash**: #g11rescope

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements rescope and replan capabilities enabling projects to adapt to changing requirements mid-development. When a user modifies PROJECT_PRD.md (the single source of truth), `zeno rescope` detects the change, creates an immutable rescope gate documenting the transition, regenerates future gates from the current position, transfers requirements to new gates, and requires human approval before applying changes. No isolated worktrees or automatic diagram regeneration—rescope operates on the main working tree and focuses on gate/requirement management.

## Objectives

### Rescope Detection & Documentation

- [ ] Implement rescope detection (diff current PROJECT_PRD.md against stored end-state snapshot)
- [ ] Create rescope gate generator (type: `rescope`, documents before/after state and rationale)
- [ ] Build rescope impact analysis (which future gates affected, which requirements added/removed/moved)
- [ ] Implement rescope history log in SQLite (timestamp, summary, affected gates, approval status)

### Future Gate Regeneration

- [ ] Implement future gate regeneration from current position (preserve completed gates)
- [ ] Build gate deletion logic (remove obsolete future gates, clean orphaned references)
- [ ] Create gate re-sequencing (renumber gates after rescope)
- [ ] Support partial regeneration (regenerate only affected gates, preserve unaffected)

### Requirement Transfer & Reattribution

- [ ] Implement requirement transfer between gates (`zeno req transfer <hash> <gate-id>`)
- [ ] Build requirement reattribution logic (reassign requirements to new gates)
- [ ] Create requirement status preservation (keep implemented/tested status through transfer)
- [ ] Support requirement archival (mark requirements as obsolete with `won't` priority)

### Rescope Approval Workflow

- [ ] Implement rescope approval (human must approve before future gates regenerated)
- [ ] Present rescope impact summary via MCP tool (`rescope_review`)
- [ ] Support rescope rejection (revert to pre-rescope state, preserve feedback)

### Rescope Commands & MCP Tools

- [ ] Implement `zeno rescope` CLI command (detect changes, present impact, request approval)
- [ ] Expose `rescope_detect` MCP tool (returns diff of end-state changes)
- [ ] Expose `rescope_apply` MCP tool (apply approved rescope, regenerate gates)
- [ ] Expose `rescope_history` MCP tool (query rescope log)

### Testing & Quality

- [ ] Write unit tests for rescope detection (end-state diff logic)
- [ ] Write tests for gate regeneration and re-sequencing
- [ ] Test requirement transfer and status preservation
- [ ] Test rescope approval/rejection workflow
- [ ] Achieve 90% test coverage for rescope module

## Context

### What Was Completed Before This Gate

Gates 01-10 established:
- Full planning, proposal, validation, and execution workflow
- Git integration with worktree-based parallel execution
- All core Zeno capabilities for project execution

### What This Gate Enables

- **Gate 12 (Status & Reporting)**: Rescope state surfaced in `zeno status` MCP tool
- **Late-stage adaptability**: Projects can rescope with full confidence in impact analysis and approval

### Scope Boundaries

**In Scope**:
- Rescope detection (PROJECT_PRD.md end-state change)
- Rescope gate generation (immutable documentation of scope change)
- Future gate regeneration from current position
- Gate deletion and re-sequencing
- Requirement transfer and reattribution
- Rescope approval workflow
- `zeno rescope` CLI command + MCP tools
- Rescope history tracking in SQLite
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Isolated rescope worktree (operates on main working tree)
- Automatic architecture diagram regeneration (LLM can regenerate diagrams independently via Gate 05 tools)
- Automatic AGENTS.md updates (manual or LLM-driven)
- Automatic scope optimization (humans decide scope)
- Version branching (single timeline)
- Timeline re-estimation

## Requirements

1. **Mid-Project Scope Adjustment** - Projects can rescope when requirements change
2. **Clear Impact Analysis** - Humans understand what changes when scope is adjusted
3. **Proper Documentation** - Rescope creates audit trail with before/after state
4. **Dependency Management** - Requirements properly transferred and reattributed post-rescope
5. **Approval & Control** - Humans approve all scope changes before they take effect

## Technical Decisions

### 1. Rescope Detection Strategy
- **Choice**: Diff current PROJECT_PRD.md end-state section against stored snapshot in SQLite
- **Rationale**: PROJECT_PRD.md is single source of truth. Snapshot comparison is deterministic and simple.
- **Trade-offs**: Requires human to modify PRD explicitly (not implicit detection)

### 2. Rescope Gate Strategy
- **Choice**: Create immutable rescope gate (type: `rescope`) documenting scope change
- **Rationale**: Preserves history and creates visible audit trail in gate sequence.
- **Trade-offs**: Adds a gate to sequence, but provides clear documentation

### 3. Future Gate Regeneration
- **Choice**: Regenerate only future gates from current position (preserve completed gates)
- **Rationale**: Respects completed work. Only adjusts future scope.

## Architecture & Dependencies

### Core Components
- `RescopeDetector` - Diffs PROJECT_PRD.md end-state against stored snapshot
- `RescopeGateGenerator` - Creates immutable rescope gate with impact summary
- `FutureGateRegenerator` - Regenerates future gates, deletes obsolete ones, re-sequences
- `RequirementTransferManager` - Moves/archives requirements between gates

### MCP Tools
- `rescope_detect` - Returns end-state diff and affected gates list
- `rescope_apply` - Applies approved rescope (generates rescope gate, regenerates future gates)
- `rescope_review` - Presents impact summary for human review
- `rescope_history` - Queries rescope log from SQLite

## Implementation Steps

1. Implement end-state snapshot storage in SQLite (captured at `zeno init` and after each rescope)
2. Build rescope detection (diff current PRD against snapshot)
3. Create impact analysis (identify affected gates and requirements)
4. Implement rescope gate generator
5. Build future gate regeneration and re-sequencing
6. Implement requirement transfer and archival
7. Create rescope approval workflow
8. Implement `zeno rescope` CLI command
9. Expose MCP tools
10. Write comprehensive tests

## Gate Completion Criteria

- [ ] Rescope detection correctly identifies PROJECT_PRD.md end-state changes
- [ ] Rescope gate generated with before/after state and impact summary
- [ ] Impact analysis correctly identifies affected gates and requirements
- [ ] Future gates regenerated properly post-rescope (completed gates preserved)
- [ ] Gate re-sequencing updates all references
- [ ] Obsolete gates deleted cleanly (no orphaned references)
- [ ] Requirements transferred and reattributed correctly with status preserved
- [ ] `zeno rescope` CLI command detects changes and initiates approval workflow
- [ ] MCP tools (`rescope_detect`, `rescope_apply`, `rescope_review`, `rescope_history`) functional
- [ ] Rescope history tracked in SQLite with audit trail
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for rescope module
- [ ] Zero lint errors, zero type errors
