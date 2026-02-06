# Gate 13: Subagent Orchestration & Parallel Execution

**Status**: pending  
**Type**: feature  
**Created**: 2026-02-04  
**Sequence**: 13 of 13  
**Hash**: #g13subagent

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Implements subagent orchestration and parallel execution enabling multiple AI agents to work simultaneously during planning, implementation, and review through four-stage delegation (Specialized Planning Agents → Local Orchestrator → Background Agents on isolated worktrees → Cloud Agent code review). This gate delivers four-stage delegation flow with context preservation, specialized planning agents for requirement decomposition and architectural analysis, dependency graph analysis for parallelization identification, per-subagent specialization matching, per-subagent worktree allocation, orchestrator merge coordination with smart rebase, conflict detection and prevention, subagent status tracking, and result consolidation. Subagent orchestration with dual-phase specialization transforms Zeno from a single-agent tool into a multi-agent planning-and-implementation platform, improving both planning quality and code output while enabling gate completion to scale with agent count rather than serial gate time. Large gates decompose into parallel work items automatically with architecture validated upfront and implementation quality optimized through agent specialization.

**Four-Stage Delegation Flow**:
1. **Planning Agents** (Specialized decomposition): Domain experts analyze gate architecture and requirements
2. **Local Agent** (Orchestration): Coordinates planning insights, creates dispatch plan, assigns specialized background agents
3. **Background Agents** (Implementation): Domain-specialized agents develop on isolated worktrees in parallel
4. **Cloud Agent** (Code Review): Create PR, validate quality gates, auto-approve if pass

## Objectives

### Planning Phase Leadership with Specialized Agents
- [ ] Implement specialized planning agent selection (query `agents/agent-manifest.json` by tier/category/role via Planning Agent Selection Matrix in `zeno/AGENTS.md`)
- [ ] Build planning agent orchestration (invoke `pipeline-agents/00-orchestration/agent-selector.md` for scoring and ranking candidates from manifest)
- [ ] Create architectural constraint analysis (PhD Tier agent from manifest identifies dependencies, validates approach)
- [ ] Implement domain-specialist planning assignment (query manifest for agents matching gate category, record selections in `.zeno/config.json` planning.agents)
- [ ] Build requirement decomposition with specialist insights (proposals generated with architectural guidance from multi-tier agents selected via manifest)
- [ ] Create agent-assignment capability matrix (maps gate type → manifest queries with tier/category/role filters; see `zeno/AGENTS.md` row structure)
- [ ] Implement planning-to-local-agent hand-off protocol (preserve decomposition insights, document agent selections with manifest references in `.zeno/config.json`)

### Three-Stage Delegation Architecture
**MCP Tool Available**:
- `agent_delegate` - Hand-off to another agent with full context preservation

- [x] Implement local agent orchestration (synthesize planning insights, create dispatch plan)
- [x] Implement background agent execution on isolated worktrees
- [x] Implement cloud agent code review and PR management
- [x] Implement context preservation across hand-offs (full conversation history)
- [x] Build agent specialization routing (Focused → Expert → PhD agents by expertise domain)

### Dependency Graph Analysis for Parallelization
- [ ] Build dependency graph analyzer (identify which proposals can run in parallel)
- [ ] Implement parallelization detection algorithm (find independent work)
- [ ] Create critical path analysis (identify bottleneck proposals)
- [ ] Build work item prioritization (prioritize blocking work)
- [ ] Implement dynamic replanning (adjust parallelization based on completion)

### Worktree Management & Coordination (Delivered via Gate 10 MCP Tools)
**Integrated MCP Tools**:
- `worktree_list`, `worktree_prune`, `worktree_remove`, `worktree_merge` (from Gate 10)
- `proposal_start` (enhanced) - Creates worktree per agent
- `proposal_approve` (enhanced) - Merges worktree, auto-cleanup

- [x] Create per-subagent worktree allocation strategy (`.local/worktrees/{hash}/`)
- [x] Implement worktree creation and path tracking
- [x] Build worktree isolation (each agent gets dedicated working directory)
- [x] Implement worktree cleanup coordination (signal cleanup after approval)
- [x] Create robust cleanup after rejected proposals (remove worktrees, audit trail)

### Orchestrator Merge Coordination (Using Gate 10 MCP Tools)
**Orchestrator Uses**:
- `worktree_merge` - Coordinate merge ordering and rebase
- `proposal_approve` (enhanced) - Merge signal + worktree cleanup

- [x] Create orchestrator-level worktree management
- [x] Implement merge ordering logic (merge non-dependent proposals in parallel)
- [x] Build rebase strategy for dependent proposals (rebase on parent proposal merge)
- [ ] Implement conflict detection for concurrent modifications
- [ ] Create merge coordination protocol (prevent race conditions)

### Conflict Detection & Resolution
- [ ] Build file-level conflict detection (which proposals touch same files)
- [ ] Implement dependency-based sequencing (prevent parallel work on dependent code)
- [ ] Create conflict resolution strategy (serialize conflicting proposals)
- [ ] Implement escalation to human on merge conflicts (require human intervention)
- [ ] Build conflict prevention (inform agents which files are off-limits)

### Subagent Result Consolidation
- [ ] Implement result collection from subagents (gather completed proposals)
- [ ] Build result validation (ensure subagent output meets quality standards)
- [ ] Create integration protocol (merge subagent work into main branch)
- [ ] Implement partial failure handling (some agents succeed, some fail)
- [ ] Build rollback on critical failure (revert all subagent work if critical issue)

### Subagent Execution & Monitoring
- [ ] Implement subagent execution loop (receive tasks, execute, report results)
- [ ] Build progress monitoring (track subagent completion %)
- [ ] Create timeout handling (detect stuck agents, escalate)
- [ ] Implement error recovery (retry failed proposals with context)
- [ ] Build health checks (detect failed agents, restart)

### Subagent Error Handling & Retry
- [ ] Implement error context preservation (why did agent fail)
- [ ] Build automatic retry logic (retry transient failures)
- [ ] Create fallback to serial execution (if parallelization fails)
- [ ] Implement maximum retry limit (prevent infinite loops)
- [ ] Build escalation to human on persistent failures

### Commands & Integration
- [ ] Implement `zeno gate <id> execute` command (orchestrate gate execution with subagents)
- [ ] Create subagent creation protocol (how to spin up new agents)
- [ ] Build orchestrator status reporting (show subagent progress)
- [ ] Implement orchestrator-to-subagent messaging protocol
- [ ] Create orchestrator shutdown (graceful cleanup on project completion)

### Testing & Quality
- [ ] Write unit tests for dependency graph analysis
- [ ] Write tests for parallelization detection
- [ ] Write tests for worktree coordination
- [ ] Test merge ordering and conflict detection
- [ ] Test subagent creation and status tracking
- [ ] Test result consolidation and validation
- [ ] Write integration tests with multiple simulated subagents
- [ ] Achieve 90% test coverage for orchestration module

## Context

### What Was Completed Before This Gate

Gate 01-12 established:
- Full planning, execution, validation, approval, git integration, rescope, and monitoring workflow
- All individual agent capabilities (gates, proposals, validation)
- Dashboard for visibility

### What This Gate Enables

- **Parallel Execution at Scale** - Large gates decompose into parallel work, completion time reduced 40-60%
- **Agent Elasticity** - More agents = faster completion (linear scaling up to proposal count)
- **Orchestrated Coordination** - Complex multi-proposal gates automatically managed
- **Production Readiness** - Zeno becomes viable for real-world large-scale projects

### Scope Boundaries

**In Scope**:
- Subagent creation via Cursor workflows
- Dependency graph analysis for parallelization
- Worktree allocation per subagent
- Orchestrator worktree coordination and merge ordering
- File-level conflict detection
- Subagent status tracking and monitoring
- Result consolidation and validation
- Error handling and retry logic
- `zeno gate <id> execute` command
- Integration with existing proposal workflow
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Network-based agent execution (local only, via Cursor)
- Agent resource allocation/load balancing
- Agent auto-scaling based on demand
- Distributed tracing or observability
- Agent licensing or cost management
- Agent failure recovery beyond simple retry
- Cross-project orchestration (single project scope)

## Requirements

This gate addresses scalability and efficiency requirements from project initialization:

1. **Parallel Proposal Execution** - Independent proposals execute simultaneously via subagents
2. **Safe Merge Coordination** - Orchestrator ensures merges don't conflict or corrupt state
3. **Automatic Parallelization** - Dependency analysis identifies parallel work without human input
4. **Graceful Degradation** - Partial failures don't block entire gate
5. **Scale Linearly** - Completion time scales inversely with agent count (up to proposal count)

## Technical Decisions

### 1. Subagent Orchestration via Cursor Workflows
- **Choice**: Create subagents using Cursor's workflow capabilities
- **Alternatives Considered**: Direct spawning processes, shell script orchestration, external orchestration platform
- **Rationale**: Cursor workflows provide native integration for creating focused agents. Simplifies coordination, maintains control.
- **Trade-offs**: Gained ecosystem integration; requires Cursor (part of project setup)

### 2. Worktree-Based Isolation
- **Choice**: Each subagent gets dedicated worktree, merged by orchestrator
- **Alternatives Considered**: Shared worktree with locking, branch-per-agent, containerized execution
- **Rationale**: Worktrees provide isolated filesystem without cloning overhead. Simple merge model (no complex locking).
- **Trade-offs**: Gained simplicity and parallelization; slight disk overhead for worktrees

### 3. Merge Ordering Strategy
- **Choice**: Merge non-dependent proposals in parallel, rebase dependent proposals on parent merges
- **Alternatives Considered**: All merges sequential, squash everything and remerge, optimistic merging with resolution
- **Rationale**: Maximizes parallelization while respecting dependencies. Rebase ensures clean history.
- **Trade-offs**: Gained parallelization; added complexity in merge coordination

### 4. Conflict Detection & Resolution
- **Choice**: Pre-check for file overlaps before allowing parallel execution, serialize conflicting proposals
- **Alternatives Considered**: Optimistic parallel execution with conflict resolution, manual user arbitration
- **Rationale**: Prevents merge conflicts proactively. Agents can understand dependency chains.
- **Trade-offs**: Gained safety; limits parallelization to non-overlapping changes

## Architecture & Dependencies

### Orchestration Engine
- `SubagentOrchestrator` - Main orchestration coordinator
- `DependencyGraphAnalyzer` - Identifies parallelizable work
- `WorkItemDecomposer` - Breaks gate into parallel tasks
- `ParallelizationPlanner` - Plans parallelization strategy

### Worktree Coordination
- `WorktreeCoordinator` - Manages per-subagent worktrees
- `MergeOrderingEngine` - Determines merge sequence
- `ConflictDetector` - Identifies file overlaps

### Subagent Management
- `SubagentFactory` - Creates subagents via Cursor workflows
- `SubagentStatusTracker` - Tracks execution progress
- `SubagentHealthMonitor` - Detects failures, triggers recovery

### Result Integration
- `ResultValidator` - Validates subagent output
- `ResultConsolidator` - Merges subagent results
- `RollbackManager` - Handles partial failures

## Implementation Steps

1. Design orchestration protocol and messages
2. Implement dependency graph analysis for parallelization
3. Create work item decomposer
4. Implement subagent factory (Cursor workflow creation)
5. Build worktree coordination and merge ordering
6. Create conflict detection
7. Implement subagent status tracking
8. Build result consolidation and validation
9. Implement error handling and retry logic
10. Write comprehensive integration tests

## Gate Completion Criteria

- [ ] Dependency graph correctly identifies parallelizable proposals
- [ ] Parallelization detection algorithm produces meaningful results
- [ ] Subagents created via Cursor workflows and execute tasks
- [ ] Each subagent gets dedicated worktree with proper isolation
- [ ] Merge ordering logic correctly sequences merges (parallel non-dependent, sequential dependent)
- [ ] File-level conflict detection prevents parallel modification of same files
- [ ] Orchestrator merges subagent results correctly
- [ ] Result validation ensures quality standards met
- [ ] Error handling retries on transient failures
- [ ] `zeno gate <id> execute` orchestrates parallelized execution
- [ ] Status tracking shows subagent progress
- [ ] Partial failure handled gracefully (some agents fail, gate continues)
- [ ] Rollback on critical failure reverts all subagent work
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for orchestration module
- [ ] Zero lint errors, zero type errors
- [ ] Performance acceptable with many subagents (4+ concurrent agents)
- [ ] Documentation updated for subagent orchestration workflow
