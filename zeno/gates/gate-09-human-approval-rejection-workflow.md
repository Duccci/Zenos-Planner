# Gate 09: Human Approval & Rejection Workflow

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 9 of 12  
**Hash**: #g09approval

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements human approval workflow for reviewing, approving, or rejecting validated proposals. This gate delivers approve/reject commands with feedback capture, approval status tracking, rejection feedback that feeds context back to LLMs for iteration, and basic audit trail. Human approval gates are quality checkpoints where humans make final go/no-go decisions before code is merged.

## Objectives

### Approval & Rejection Commands
- [ ] Implement `zeno proposal approve <hash>` command (record human approval)
- [ ] Implement `zeno proposal reject <hash>` command (record rejection with feedback)
- [ ] Create proposal summary display (key details, changes, files affected)
- [ ] Show proposal dependencies (what this proposal depends on)
- [ ] Support approval notes for audit trail

### Approval Status Tracking
- [ ] Implement approval status field (pending, approved, rejected)
- [ ] Track approval metadata (approver, timestamp, notes)
- [ ] Create approval audit trail (log all decisions with context)

### Rejection Feedback
- [ ] Implement rejection feedback capture (free-form text describing what to fix)
- [ ] Create predefined rejection categories (quality issues, requirement mismatch, scope creep)
- [ ] Store feedback with rejected proposal for LLM consumption
- [ ] Feed rejection context back to LLM via MCP tool (enables iteration without human re-review)

### Gate-Level Approval
- [ ] Support gate-level approval (`zeno gates complete` requires all proposals approved)
- [ ] Support partial gate state (some proposals approved, others pending/rejected)

### Testing & Quality
- [ ] Write unit tests for approval workflow
- [ ] Write tests for rejection feedback capture
- [ ] Test approval status tracking and audit trail
- [ ] Achieve 90% test coverage for approval module

## Context

### What Was Completed Before This Gate

Gate 01-08 established:
- Core infrastructure and CLI framework
- Gate and requirement generation
- MCP server and proposal generation
- Automated validation framework

### What This Gate Enables

- **Gate 10 (Git Integration)**: Only approved proposals committed to git
- **Iterative improvement**: LLMs iterate on rejected proposals using feedback context

### Scope Boundaries

**In Scope**:
- `zeno proposal approve` and `zeno proposal reject` commands
- Approval status tracking (pending, approved, rejected)
- Rejection feedback capture with categories
- Approval audit trail with metadata
- Rejection context fed back to LLM via MCP
- Gate-level approval enforcement
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Multiple reviewer/multi-level approval
- Cloud agent auto-approval
- Managed replan engine with iteration counters (LLM handles replanning using rejection context — no Zeno-managed subsystem)
- Approval notifications/email integration
- Role-based access control
- Web UI for approval
- Integration with external approval systems

## Requirements

1. **Human Decision Authority** — Humans approve all proposals before code merge
2. **Structured Feedback** — Rejections include feedback enabling LLM iteration
3. **Audit Trail** — All approval decisions tracked with context
4. **Simple Workflow** — Approve or reject with feedback; no managed replan subsystem

## Technical Decisions

### 1. Rejection Feedback as LLM Context
- **Choice**: Store rejection feedback and expose via MCP tool; LLM uses it for iteration autonomously
- **Alternatives Considered**: Managed replan engine with iteration limits, automatic retry loops
- **Rationale**: LLMs can iterate on rejection feedback without a managed subsystem. Zeno stores the feedback; the LLM (or orchestrator, post-MVP) decides what to do with it. Keeps Gate 09 focused on the approval workflow, not execution control.
- **Trade-offs**: Gained simplicity; no automatic retry management (acceptable for MVP — LLM handles iteration)

### 2. Single Reviewer MVP
- **Choice**: Single reviewer approval
- **Rationale**: Simplifies workflow for solo developer or small team.

## Implementation Steps

1. Implement approval status tracking
2. Implement `zeno proposal approve` and `zeno proposal reject` commands
3. Build rejection feedback capture (categories + free-form)
4. Create approval audit trail
5. Expose rejection context via MCP tool
6. Implement gate-level approval enforcement
7. Write comprehensive tests

## Gate Completion Criteria

- [ ] `zeno proposal approve <hash>` records approval with metadata
- [ ] `zeno proposal reject <hash>` records rejection with feedback
- [ ] Approval status correctly transitions (pending → approved/rejected)
- [ ] Approval metadata stored (approver, timestamp, notes)
- [ ] Audit trail tracks all approval decisions
- [ ] Rejection feedback categories available (quality, requirement mismatch, scope)
- [ ] Rejection context accessible via MCP for LLM consumption
- [ ] Gate-level approval enforced (all proposals must be approved for gate completion)
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for approval module
- [ ] Zero lint errors, zero type errors
