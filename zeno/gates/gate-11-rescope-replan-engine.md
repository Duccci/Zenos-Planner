# Gate 11: Rescope & Replan Engine

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 11 of 13  
**Hash**: #g11rescope

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements rescope and replan capabilities enabling projects to adapt to changing requirements mid-development. This gate detects end-state changes, generates rescope gates documenting scope transitions, regenerates future gates from current position, manages gate deletion for obsolete future gates, and provides rescope approval workflows. Rescope support addresses a critical real-world need: projects inevitably discover complexity that requires scope adjustment. Rather than forcing projects to continue on invalid roadmaps, Zeno enables controlled rescoping with clear documentation, impact analysis, and human approval, preserving project momentum while maintaining clarity about changed scope.

## Objectives

### Rescope Detection & Documentation
Note: Rescope planning benefits from isolated worktrees (Gate 10) to evaluate scope changes without disrupting ongoing work

- [ ] Implement rescope detection (compare current end state to original PROJECT_PRD.md)
- [ ] Implement rescope worktree (isolated planning environment via Gate 10 worktree tools)
- [ ] Create rescope gate generator (documents the scope change with rationale)
- [ ] Build rescope impact analysis (which gates affected, which requirements added/removed)
- [ ] Generate rescope summary document (before state, after state, reason, impact)
- [ ] Implement rescope history tracking (maintain log of all scope changes)

### Future Gate Regeneration (With Worktree Awareness)
Gates may now run in parallel (per gate-roadmap); regeneration must preserve parallel dependencies

- [ ] Implement future gate regeneration from current position (after rescope gate)
- [ ] Update gate regeneration to respect parallel gate dependencies
- [ ] Build gate deletion logic (remove obsolete future gates)
- [ ] Create gate re-sequencing (renumber gates after rescope, preserve parallel structure)
- [ ] Support partial regeneration (regenerate only affected gates)
- [ ] Implement gate preservation (keep completed gates unchanged)

### Requirement Transfer & Reattribution
- [ ] Implement requirement transfer between gates (for scope changes)
- [ ] Build requirement reattribution logic (reassign requirements to new gates)
- [ ] Create requirement status preservation (keep implemented/tested status through rescope)
- [ ] Support requirement archival (mark requirements as obsolete if removed)
- [ ] Implement requirement dependency update (adjust dependencies after transfer)

### Rescope Approval Workflow
- [ ] Implement rescope approval gate (requires human approval before regenerating future gates)
- [ ] Create rescope proposal system (detailed documentation of changes)
- [ ] Build impact assessment (stakeholder can understand scope change implications)
- [ ] Support rescope rejection (allow stakeholders to push back on scope changes)
- [ ] Implement rescope history audit trail

### Rescope Commands
- [ ] Implement `zeno rescope` command (detect scope changes and initiate rescope workflow)
- [ ] Build rescope status reporting (`zeno status` shows rescope state)
- [ ] Create rescope approval interface (presentation of rescope proposal)
- [ ] Implement rescope confirmation (final check before applying changes)

### Architecture Updates for Rescope
- [ ] Update gate roadmap diagram for new gate sequence post-rescope
- [ ] Regenerate architecture diagrams (dependencies may have changed)
- [ ] Update AGENTS.md if rescope affects project conventions
- [ ] Create rescope-specific documentation

### Integration with Replan Engine
- [ ] Link rescope with replan (rescope can trigger replan of affected proposals)
- [ ] Support proposal re-evaluation post-rescope (proposals may no longer be valid)
- [ ] Implement proposal archival if requirements removed (mark as obsolete)
- [ ] Create replan briefing for affected proposals

### Testing & Quality
- [ ] Write unit tests for rescope detection
- [ ] Write tests for gate regeneration logic
- [ ] Test requirement transfer and reattribution
- [ ] Test rescope impact analysis
- [ ] Test rescope approval workflow
- [ ] Achieve 90% test coverage for rescope module

## Context

### What Was Completed Before This Gate

Gate 01-10 established:
- Full planning, proposal, validation, and execution workflow
- Git integration with worktree-based parallel execution
- All core Zeno capabilities for project execution

### What This Gate Enables

- **Gate 12 (Dashboard)**: Rescope status displayed in project dashboard
- **Gate 13 (Subagent Orchestration)**: Rescope may trigger re-orchestration of work
- **Late-stage adaptability**: Projects can rescope with full confidence in impact analysis and approval
- **Continuous learning**: Rescope enables projects to improve scope understanding iteratively

### Scope Boundaries

**In Scope**:
- Rescope detection (PROJECT_PRD.md end state change)
- Rescope gate generation (documents the change)
- Future gate regeneration from current position
- Gate deletion and re-sequencing
- Requirement transfer and reattribution
- Rescope approval workflow
- `zeno rescope` command
- Rescope impact analysis
- Rescope history tracking
- Integration with replan engine
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Automatic scope optimization (humans decide scope, tool doesn't recommend)
- Version branching (not supported - single timeline)
- Partial gate acceptance (entire gate approved or rejected)
- Timeline re-estimation (focuses on achievability, not time)
- Stakeholder notification (humans handle communication)

## Requirements

This gate addresses adaptability and learning requirements from project initialization:

1. **Mid-Project Scope Adjustment** - Projects can rescope when requirements change
2. **Clear Impact Analysis** - Stakeholders understand what changes when scope is adjusted
3. **Proper Documentation** - Rescope creates audit trail with before/after state
4. **Dependency Management** - Requirements and proposals properly updated post-rescope
5. **Approval & Control** - Humans approve all scope changes before they take effect

## Technical Decisions

### 1. Rescope Detection Strategy
- **Choice**: Compare current end state in PROJECT_PRD.md to original end state
- **Alternatives Considered**: Requirement-driven detection, manual rescope initiation, incremental tracking
- **Rationale**: PROJECT_PRD.md is single source of truth. Change there signals rescope need. Simple to detect, easy to verify.
- **Trade-offs**: Gained clarity; requires human to modify PRD explicitly (not implicit)

### 2. Rescope Gate Strategy
- **Choice**: Create immutable rescope gate documenting scope change (type: rescope)
- **Alternatives Considered**: Update existing gates in-place, separate rescope metadata, archive old roadmap
- **Rationale**: Immutable gate preserves history and creates audit trail. Makes rescope explicit and visible in roadmap.
- **Trade-offs**: Gained transparency; adds gate to sequence

### 3. Future Gate Regeneration
- **Choice**: Regenerate future gates from current position (don't rewind past completed gates)
- **Alternatives Considered**: Regenerate all gates, keep old gates unchanged
- **Rationale**: Respects completed work. Only adjusts future scope.
- **Trade-offs**: Gained efficiency; may require partial re-planning of later gates

## Architecture & Dependencies

### Rescope Detection & Documentation
- `RescopeDetector` - Identifies end state changes
- `RescopeGateGenerator` - Creates rescope gate documenting change
- `ImpactAnalyzer` - Analyzes affected gates and requirements

### Gate Regeneration
- `FutureGateRegenerator` - Regenerates gates post-rescope
- `GateSequencer` - Re-sequences gates after deletions

### Requirement Management
- `RequirementTransferManager` - Moves requirements between gates
- `RequirementReattributor` - Re-assigns requirements to new gates

### Rescope Workflow
- `RescopeApprovalWorkflow` - Handles rescope approval

## Implementation Steps

1. Implement rescope detection (compare PROJECT_PRD.md)
2. Build rescope gate generator
3. Create impact analysis
4. Implement future gate regeneration
5. Build gate deletion and re-sequencing
6. Implement requirement transfer
7. Create rescope approval workflow
8. Implement `zeno rescope` command
9. Build rescope history tracking
10. Write comprehensive tests

## Gate Completion Criteria

- [ ] Rescope detection correctly identifies PROJECT_PRD.md end state changes
- [ ] Rescope gate generated with proper documentation and impact summary
- [ ] Impact analysis correctly identifies affected gates and requirements
- [ ] Future gates regenerated properly post-rescope
- [ ] Gate re-sequencing updates all references (dependencies, roadmap, etc.)
- [ ] Obsolete gates deleted cleanly (no orphaned references)
- [ ] Requirements transferred and reattributed correctly
- [ ] Requirement status preserved through transfer
- [ ] Requirement dependencies updated for new gate locations
- [ ] `zeno rescope` command detects and initiates rescope workflow
- [ ] Rescope approval workflow presents clear impact to stakeholders
- [ ] Rescope history tracked with audit trail
- [ ] Affected proposals flagged for re-evaluation
- [ ] Architecture diagrams updated post-rescope
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for rescope module
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for rescope workflow and impact analysis
