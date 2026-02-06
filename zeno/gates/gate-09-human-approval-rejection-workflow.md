# Gate 09: Human Approval & Rejection Workflow

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 9 of 13  
**Hash**: #g09approval

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements human approval workflow that enables humans to review, approve, or reject validated proposals. With the three-stage delegation system (Gate 13), human approval now receives consolidated PRs from cloud agents with automated code review comments. This gate delivers approval prompt systems for reviewing consolidated proposals and auto-approved PRs, rejection feedback collection for learning and iteration, approval status tracking for audit compliance, and replan engine integration for handling rejections. Human approval gates serve as quality checkpoints where humans make final go/no-go decisions on cloud agent recommendations, ensuring AI-generated code meets expectations before merging. Rejections with contextual feedback enable LLMs to iterate and improve without requiring human re-review for minor issues.

**Integration with Three-Stage Delegation**: Cloud agents auto-approve PRs that pass quality gates (90% coverage, 0 vulnerabilities, <0.01% linting). Human approval confirms auto-approvals or reviews cloud agent suggestions for failing proposals.

## Objectives

### Approval Prompt System
**Cloud Agent Integration** (Gate 13): Cloud agents now auto-approve PRs that pass quality gates and add code review comments

- [x] Integrated with cloud agent PR review (PR auto-approved if quality gates pass)
- [ ] Implement human approval prompts (review consolidated PRs and cloud agent recommendations)
- [ ] Create proposal summary display (key details, changes, files affected, cloud agent review comments)
- [ ] Display cloud agent code review comments alongside PR (helps humans assess quality)
- [ ] Show proposal dependencies (what this proposal depends on)
- [ ] Display affected files and change scope
- [ ] Create consolidated PR approval/rejection interface (handle multiple parallel PRs from cloud agent)

### Approval Status Tracking
- [ ] Implement approval status field (pending, approved, rejected)
- [ ] Track approval metadata (approver name, timestamp, notes)
- [ ] Create approval audit trail (log all approval decisions with context)
- [ ] Support multiple approval levels (optional: require multiple reviewers)
- [ ] Implement approval caching (already-approved proposals don't need re-approval)

### Rejection Feedback Collection
- [ ] Implement rejection feedback prompts (ask human why proposal was rejected)
- [ ] Create predefined rejection categories (quality issues, requirement mismatch, scope creep, etc.)
- [ ] Support custom rejection notes (free-form feedback)
- [ ] Capture specific issues from validation failures
- [ ] Store feedback with rejected proposal for replan engine

### Replan Engine Integration
- [ ] Implement replan on rejection with context (error messages, validation failures, human feedback)
- [ ] Create replan briefing document (summarizes why proposal was rejected, what to fix)
- [ ] Enable LLM iteration on rejected proposals without human re-review (except final approval)
- [ ] Track replan history (how many times proposal has been replanned)
- [ ] Implement maximum replan limit (e.g., 3 attempts) to avoid infinite loops

### Approval Commands
- [ ] Implement `zeno proposal approve <hash>` command (record human approval)
- [ ] Implement `zeno proposal reject <hash>` command (record rejection with feedback)
- [ ] Support approval notes for audit trail
- [ ] Enable approval from human operator or LLM recording human decision
- [ ] Create approval workflow status messages

### Approval Workflow Integration
- [ ] Link approval to proposal status (proposal requires approval before next stage)
- [ ] Create approval checklists (human review guidelines)
- [ ] Implement gate-level approval (optional: approve entire gate at once)
- [ ] Support partial approvals (some proposals approved, others rejected)
- [ ] Create approval notifications for stakeholders

### LLM Integration for Replan
- [ ] Enable LLM replan on rejection (LLM invokes replan engine)
- [ ] Provide LLM with rejection context (feedback, validation failures)
- [ ] Support multiple replan attempts (configurable limit)
- [ ] Track replan iterations in proposal metadata
- [ ] Implement replan completion signal (proposal ready for re-approval)

### Testing & Quality
- [ ] Write unit tests for approval workflow
- [ ] Write tests for rejection feedback collection
- [ ] Test replan engine with rejection context
- [ ] Test approval status tracking and audit trail
- [ ] Achieve 90% test coverage for approval module

## Context

### What Was Completed Before This Gate

Gate 01-08 established:
- Core infrastructure and CLI framework
- Gate and requirement generation
- MCP server and proposal generation
- Automated validation framework
- Multi-repo support and architecture diagrams

### What This Gate Enables

- **Gate 10 (Git Integration)**: Only approved proposals committed to git
- **Gate 12 (Subagent Orchestration)**: Approval status determines release to agents
- **LLM-driven workflows**: `/zeno-apply` workflow uses approval for proposal acceptance
- **Iterative improvement**: LLMs iterate on rejected proposals until human approval
- **Quality assurance**: Human judgment validates automated systems before code merge

### Scope Boundaries

**In Scope**:
- Human approval prompts and interactive decision interface
- Approval status tracking (pending, approved, rejected)
- Rejection feedback collection with categorized reasons
- Approval audit trail with metadata (approver, timestamp, notes)
- Replan engine integration with rejection context
- LLM-invocable replan on rejection
- Maximum replan limit (configurable, e.g., 3 attempts)
- `zeno proposal approve` and `zeno proposal reject` commands
- Approval workflow integration with proposal status
- Replan iteration tracking
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Multiple reviewer/multi-level approval (single reviewer MVP)
- Approval delegation or role-based access control
- Approval notifications/email integration
- Approval scheduling or time-based workflows
- Approval templates for common patterns
- Web UI for approval process (CLI-focused)
- Integration with external approval systems (Jira, Linear)
- Approval SLA/response time tracking

## Requirements

This gate addresses human control and feedback requirements from project initialization:

1. **Human Decision Authority** - Humans approve all proposals before code merge
2. **Quality Assurance Gate** - Proposals validated before approval, reducing reviewer burden
3. **Structured Feedback** - Rejections include specific feedback enabling LLM iteration
4. **Fast Iteration Loop** - Rejected proposals can be replanned without human re-review (until final approval)
5. **Audit Compliance** - All approval decisions tracked with context for compliance

## Technical Decisions

### 1. Replan on Rejection Strategy
- **Choice**: LLMs automatically replan on rejection using context (feedback, validation failures), re-submit for approval
- **Alternatives Considered**: Manual human iteration, require human feedback before replan, fully automated without human loop
- **Rationale**: Enables fast iteration while maintaining human authority. Most rejections are fixable by LLMs without human input (e.g., test coverage, linting).
- **Trade-offs**: Gained iteration speed; limited scope to issues LLMs can understand and fix (major architectural issues may still need human guidance)

### 2. Single Reviewer MVP
- **Choice**: Single reviewer approval (no multi-level approval in MVP)
- **Alternatives Considered**: Multi-level approval, consensus voting
- **Rationale**: Simplifies workflow for solo developer or small team. Easy to extend later.
- **Trade-offs**: Gained simplicity; may need extension for large teams

### 3. Approval Metadata Tracking
- **Choice**: Store approver, timestamp, notes, feedback with each approval/rejection decision
- **Alternatives Considered**: Minimal tracking (approval yes/no only), external audit system
- **Rationale**: Enables audit trail and learning from rejections. Supports compliance.
- **Trade-offs**: Gained traceability; slight storage overhead

## Architecture & Dependencies

### Approval System
- `ApprovalPrompt` - Human-facing approval interface
- `ApprovalDecision` - Captures approval/rejection decision and metadata
- `ApprovalAuditTrail` - Logs all approval decisions

### Rejection Handling
- `RejectionFeedback` - Captures human feedback on rejection
- `ReplanEngine` - Coordinates LLM replan on rejection
- `RejectionContext` - Bundles validation failures and human feedback

### Integration
- `ProposalApprovalWorkflow` - Connects proposal status to approval

## Implementation Steps

1. Design approval prompt interface and display
2. Implement approval status tracking
3. Build rejection feedback collection system
4. Create approval audit trail logging
5. Integrate replan engine with rejection context
6. Implement `zeno proposal approve/reject` commands
7. Build approval workflow integration
8. Support LLM replan invocation
9. Implement replan iteration tracking and limits
10. Write comprehensive tests

## Gate Completion Criteria

- [ ] Approval prompts clearly present proposals for human review with all relevant context
- [ ] Validation results displayed alongside proposal (helps assess quality)
- [ ] Approval status correctly transitions (pending → approved/rejected)
- [ ] Approval metadata stored (approver, timestamp, notes)
- [ ] Audit trail tracks all approval decisions
- [ ] `zeno proposal approve <hash>` records approval correctly
- [ ] `zeno proposal reject <hash>` records rejection with feedback
- [ ] Rejection feedback categories (quality, requirement mismatch, scope) available
- [ ] Replan engine triggered on rejection with full context
- [ ] LLM can invoke replan and iterate on rejected proposals
- [ ] Replan iteration limit enforced (max 3 attempts by default)
- [ ] Replan history tracked in proposal metadata
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for approval module
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for approval workflow and replan process
