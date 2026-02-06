# Gate 10: Git Integration & Commit Automation

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 10 of 13  
**Hash**: #g10gitint

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements Git integration layer enabling approved proposals to be automatically committed with proper workflow coordination. This gate delivers git worktree management for isolated parallel development, pre-commit hooks for quality validation, structured commit message generation, gate release tagging, and rollback mechanisms for rejected proposals. Git worktrees enable multiple agents to work simultaneously on independent proposals without branch switching delays, while pre-commit hooks ensure quality checks run before code is committed. This gate transforms Zeno from a planning tool into an executable system where proposals automatically flow to git as atomic, properly-attributed commits.

## Objectives

### Git Worktree Management (Delivered via MCP Tools)
**MCP Tools Available**:
- `worktree_list` - List active/orphaned worktrees with disk usage
- `worktree_prune` - Remove expired worktrees (7-day default, configurable)
- `worktree_remove` - Manually delete specific worktree
- `worktree_merge` - Merge worktree branch to main with conflict detection

- [x] Implement `createWorktree(proposal_hash)` function (create isolated worktree for proposal)
- [x] Implement `removeWorktree(worktree_path)` function (cleanup worktree after approval)
- [x] Implement `listWorktrees()` function (show all active worktrees)
- [x] Implement `pruneExpiredWorktrees()` function (cleanup stale worktrees)
- [x] Create worktree path structure (`.local/worktrees/{hash}/`)
- [x] Implement worktree expiration policy (configurable, default 7 days)
- [x] Add worktree status tracking (active, pending_merge, orphaned)
- [x] Implement `zeno worktree` commands via MCP (list, prune, remove, merge)
- [ ] Create worktree conflict detection (prevent simultaneous edits on same files)

### Proposal Workflow with Worktrees (Delivered via Enhanced MCP Tools)
**Enhanced MCP Tools**:
- `proposal_start` (enhanced) - Create worktree on proposal start, return path to agent
- `proposal_approve` (enhanced) - Merge worktree branch on approval, auto-cleanup

- [x] Update `zeno proposal start <hash>` to create worktree and return path to agent
- [x] Store worktree path in proposal metadata
- [x] Update `zeno proposal approve <hash>` to merge worktree branch and cleanup
- [x] Implement merge logic (merge worktree branch to main, delete worktree branch)
- [ ] Handle merge conflicts (escalate to human, prevent auto-merge on conflict)

### Pre-Commit Hooks
- [ ] Implement pre-commit hook installer
- [ ] Create pre-commit hook script (runs quality checks before commit)
- [ ] Integrate validation checks into pre-commit (linting, type checking, coverage)
- [ ] Allow hook bypass for emergency situations (tracked in audit log)
- [ ] Update hooks to work in worktree context (inherit root project checks)

### Commit Message Generation
- [ ] Implement structured commit message generator
- [ ] Create commit message template (type(scope): subject + body)
- [ ] Include proposal hash in commit message (`feat(gate-05): Implement architeture diagrams (#g05archdiag)`)
- [ ] Support referencing issues/requirements in commit body
- [ ] Build commit message parser (extract proposal hash from message)

### Gate Release Tagging
- [ ] Implement gate completion tagging (e.g., `gate-05-architecture-diagram-generation`)
- [ ] Create version tagging strategy
- [ ] Implement `zeno gates complete` to create git tag
- [ ] Build tag naming convention (sortable, human-readable)
- [ ] Track gates in git history via tags

### Rollback Mechanism
- [ ] Implement rollback for rejected proposals (revert worktree branch changes)
- [ ] Create rollback audit trail (track what was reverted and why)
- [ ] Preserve learnings (rejected proposal still available in archive)
- [ ] Support partial rollback (revert some files, keep others)
- [ ] Implement rollback safety checks (prevent accidental data loss)

### Git Status Integration
- [ ] Build git status integration with Zeno status
- [ ] Show which proposals modify which files
- [ ] Track uncommitted changes per proposal
- [ ] Create clean/dirty status reporting
- [ ] Implement conflict detection (proposals modifying same files)

### Testing & Quality
- [ ] Write unit tests for worktree operations
- [ ] Write tests for merge logic and conflict handling
- [ ] Test pre-commit hook execution
- [ ] Test commit message generation and parsing
- [ ] Test gate release tagging
- [ ] Test rollback mechanism and audit trail
- [ ] Achieve 90% test coverage for git integration module

## Context

### What Was Completed Before This Gate

Gate 01-09 established:
- Core infrastructure and CLI framework
- Gate and requirement generation
- MCP server and proposal generation
- Automated validation framework
- Human approval workflow
- Multi-repo support

### What This Gate Enables

- **Gate 11 (Rescope & Replan)**: Git history enables rescope impact analysis
- **Gate 12 (Subagent Orchestration)**: Worktree management enables true parallel execution
- **Gate 13 (Documentation)**: Git history and tags provide project timeline
- **Production Release**: Approved proposals committed with proper attribution and tagging
- **Audit Compliance**: All changes tracked with structured commit messages

### Scope Boundaries

**In Scope**:
- Git worktree creation, management, and cleanup
- Worktree expiration policy and auto-cleanup
- Conflict detection between concurrent proposals
- Proposal status integration with worktree (create on start, cleanup on approve)
- Pre-commit hooks for quality validation
- Structured commit message generation
- Gate release tagging
- Rollback mechanism for rejected proposals
- `zeno worktree` commands (list, prune, remove)
- Git status integration with Zeno state
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Git branch strategy beyond worktree-based approach
- Rebase vs. merge strategy (configurable, not enforced)
- Squash commit automation (manual user choice)
- GitHub/GitLab integration (git-native only)
- Release notes generation
- Version bump automation (semantic versioning)
- Changelog management
- Git server authentication (user's git credentials)
- Continuous integration/deployment

## Requirements

This gate addresses execution and persistence requirements from project initialization:

1. **Isolated Parallel Development** - Worktrees enable agents to work on independent proposals without interference
2. **Atomic Commits** - Approved proposals committed as single, properly-attributed commits
3. **Quality Before Commit** - Pre-commit hooks ensure quality gates met before code enters repo
4. **Audit Trail** - Structured commit messages enable tracing changes back to proposals and requirements
5. **Rollback Safety** - Rejected proposals can be safely reverted with full audit trail

## Technical Decisions

### 1. Git Worktree Strategy
- **Choice**: Create isolated worktree per proposal, merge on approval, cleanup after merge
- **Alternatives Considered**: Branch switching per proposal, single shared worktree, full clones per proposal
- **Rationale**: Worktrees provide isolated filesystem without branch switching delays. Eliminates 5-10 second overhead per switch. Enables true parallelization.
- **Trade-offs**: Gained parallel execution; added disk space overhead (partial clones), added complexity in merge coordination, requires robust cleanup to avoid orphaned worktrees

### 2. Conflict Detection Strategy
- [ ] **Choice**: Pre-check for file overlaps before allowing parallel execution, serialize conflicting proposals
- **Alternatives Considered**: Optimistic parallel execution with conflict resolution, manual user arbitration
- **Rationale**: Prevents merge conflicts proactively. LLMs can understand dependency chains and sequence proposals correctly.
- **Trade-offs**: Gained safety; slightly limited parallelization when proposals touch same files

### 3. Worktree Expiration
- **Choice**: Configurable expiration policy (e.g., 24 hours), auto-cleanup of expired worktrees
- **Alternatives Considered**: Manual cleanup only, never expire
- **Rationale**: Prevents disk space exhaustion from orphaned worktrees. Auto-cleanup removes operational burden.
- **Trade-offs**: Gained automation; may delete in-progress work if expiration too aggressive (mitigated by configurable policy)

## Architecture & Dependencies

### Worktree Management
- `WorktreeManager` - Create, remove, list, prune worktrees
- `WorktreeStatusTracker` - Track worktree lifecycle and expiration
- `ConflictDetector` - Identify file overlaps between proposals

### Git Operations
- `GitCommitter` - Handles commit creation with proper messages
- `MergeCoordinator` - Manages merge ordering and conflict resolution
- `CommitMessageGenerator` - Creates structured commit messages

### Hooks & Integration
- `PreCommitHookManager` - Installs and manages pre-commit hooks
- `GitStatusIntegration` - Syncs git status with Zeno state

## Implementation Steps

1. Implement worktree creation and management utilities
2. Build worktree status tracking and expiration
3. Create conflict detection for concurrent proposals
4. Update proposal workflow to use worktrees
5. Implement pre-commit hook installer and executor
6. Build structured commit message generator
7. Create gate release tagging
8. Implement rollback mechanism
9. Build git status integration
10. Write comprehensive tests

## Gate Completion Criteria

- [ ] Worktree creation creates isolated directory with proper branch setup
- [ ] `zeno proposal start` creates worktree and returns path to agent
- [ ] `zeno proposal approve` merges worktree branch and cleans up
- [ ] Conflict detection prevents concurrent proposals from modifying same files
- [ ] Merge conflicts detected and escalated (not auto-resolved)
- [ ] Pre-commit hooks execute quality checks before commit
- [ ] Commit messages include proposal hash and structured format
- [ ] Gate release tags created correctly on gate completion
- [ ] Rollback reverts proposal changes while preserving proposal archive
- [ ] Worktree expiration policy works (cleanup after configured time)
- [ ] `zeno worktree list` shows all active worktrees
- [ ] `zeno worktree prune` cleans up expired/dead worktrees
- [ ] Git status integration shows which proposals modify which files
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for git integration module
- [ ] Zero lint errors, zero type errors
- [ ] Documentation updated for worktree workflow and commit conventions
