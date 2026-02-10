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

Implements multi-tier agent orchestration and parallel execution enabling Zeno to scale beyond single-agent constraints. Architecture layers complexity by tier: Zeno MCP Server (planning/state), Claude/Copilot API (large-context planning decisions), CrewAI (hierarchical agent teams with inter-agent communication via Python subprocess bridge), and Ollama models (local implementation workers). This gate delivers hierarchical agent team orchestration with role-based specialization, inter-agent communication for improved parallelization, intelligent task decomposition from proposal specs, dependency-based task sequencing, worktree-per-task isolation, orchestrator-level merge coordination, file-level conflict detection, and result consolidation. The layered architecture separates concerns: Zeno manages project state and gates, Claude handles complex planning analysis, CrewAI manages agent hierarchies and messaging, and Ollama handles focused implementation tasks.

**Four-Layer Orchestration Architecture**:
1. **Zeno MCP Server** (Planning/State): Gates, proposals, requirements, templates, artifact access, agent manifest
2. **Claude/Copilot API** (Planning Phase): Reads gate PRD via MCP, generates proposal specs, validates acceptance criteria
3. **CrewAI + Python Subprocess Bridge** (Agent Orchestration): Hierarchical agent teams, inter-agent communication, task coordination, role-based specialization from agent manifest
4. **Ollama Models** (Implementation Workers): Execute tasks on isolated worktrees, use local tools (file I/O, git, commands), report results

## Objectives

### Zeno MCP Server: Planning & State Management
- [ ] Expose existing gates/proposal tools for Claude access via MCP
- [ ] Add `read_gate_prd` tool to expose gate details for Claude analysis
- [ ] Add `read_requirements` tool to expose gate requirements for Claude context
- [ ] Add `read_project_overview` tool to expose system architecture for Claude decisions
- [ ] Document which MCP tools Claude uses during planning phase
- [ ] Implement proposal spec validation against gate requirements
- [ ] Create proposal spec JSON schema (task breakdown, dependencies, acceptance criteria)

### Claude/Copilot API: Planning Phase
- [ ] Implement planning orchestrator that calls Zeno MCP tools
- [ ] Design Claude system prompt guiding proposal spec generation
- [ ] Parse gate PRD via `read_gate_prd` MCP tool
- [ ] Parse requirements via `read_requirements` MCP tool
- [ ] Parse architecture via `read_project_overview` MCP tool
- [ ] Generate proposal specs as JSON (task list, dependencies, file assignments)
- [ ] Validate proposal specs against gate acceptance criteria
- [ ] Implement fallback for proposal generation errors

### CrewAI + Python Service: Agent Orchestration & Coordination
- [ ] Implement CrewAI Python service (subprocess runner)
- [ ] Load agent definitions from `agents/agent-manifest.json`
- [ ] Create agent-to-manifest mapping (backend, frontend, testing, security specializations)
- [ ] Build CrewAI crew config from proposal specs (roles, goals, tasks, dependencies)
- [ ] Implement task hierarchy in CrewAI (blocking relationships)
- [ ] Enable inter-agent communication (agents ask each other questions)
- [ ] Create CrewAI process selector (hierarchical for team coordination)
- [ ] Build result parsing from CrewAI crew output
- [ ] Implement error handling and timeout detection
- [ ] Create graceful shutdown protocol for Python service

### TypeScript-Python Bridge: Subprocess Communication
- [ ] Implement subprocess spawning for crew_service.py
- [ ] Build JSON serialization for proposal specs → Python
- [ ] Create result deserialization from Python JSON
- [ ] Implement process lifecycle management (startup, timeout, cleanup)
- [ ] Build error propagation from Python service to TypeScript
- [ ] Create health checks for Python service availability
- [ ] Implement retry logic for subprocess failures

### Ollama Models: Implementation Workers
- [ ] Implement Ollama model initialization with Anthropic API compatibility endpoint
- [ ] Create task spec formatter (convert orchestrator task to model prompt)
- [ ] Implement local execution tool definitions (read_file, write_file, run_command, git_commit)
- [ ] Build model tool-calling loop (handle Ollama tool_calls until task complete)
- [ ] Implement task result reporting (status, diffs, test results back to orchestrator)
- [ ] Create model context preservation per task (isolated context per agent, no cross-agent leakage)
- [ ] Implement timeout handling (detect hung agents, escalate)
- [ ] Create error formatting with context (preserve failure traces for debugging)

### Dependency Graph Analysis for Parallelization
- [ ] Build dependency graph analyzer (from LangGraph task graph)
- [ ] Implement parallelization detection algorithm (find independent tasks)
- [ ] Create critical path analysis (identify bottleneck tasks)
- [ ] Build task prioritization (prioritize blocking tasks first)
- [ ] Implement dynamic replanning on task completion

### Worktree Management & Coordination (Using Gate 10 MCP Tools)
**Leverages Existing MCP Tools**:
- `worktree_list`, `worktree_prune`, `worktree_remove`, `worktree_merge` (from Gate 10)
- `proposal_start` - Creates worktree per task
- `proposal_approve` - Merges worktree, triggers cleanup

- [ ] Create per-task worktree allocation (one per Ollama agent)
- [ ] Implement worktree path tracking in orchestrator state
- [ ] Build worktree isolation verification (file access validation)
- [ ] Implement worktree cleanup after task completion
- [ ] Create audit trail for worktree lifecycle

### Orchestrator Merge Coordination (Using Gate 10 MCP Tools)
**Orchestrator Responsibilities**:
- Determine merge ordering from dependency graph
- Invoke `worktree_merge` MCP tool per task
- Handle merge conflicts (escalate to human)
- Cleanup worktrees after merge

- [ ] Create merge ordering engine (non-dependent tasks in parallel, dependent sequential)
- [ ] Implement rebase strategy (rebase dependent tasks on parent merge)
- [ ] Build conflict detection for file overlaps
- [ ] Create merge coordination protocol (prevent race conditions)
- [ ] Implement rollback on critical merge failures

### Conflict Detection & Resolution
- [ ] Build file-level conflict detection (parse proposal specs for file overlaps)
- [ ] Implement dependency-based sequencing (from dependency graph)
- [ ] Create conflict resolution strategy (serialize conflicting tasks)
- [ ] Implement merge conflict handling (escalate file conflicts to human)
- [ ] Build conflict prevention (inform agents of file restrictions)

### Task Result Consolidation
- [ ] Implement result collection from Ollama agents
- [ ] Build result validation (ensure output meets quality standards)
- [ ] Create integration protocol (merge task results via worktree_merge)
- [ ] Implement partial failure handling (continue on agent failure)
- [ ] Build rollback on critical failure (revert all task work)

### Orchestrator Execution & Monitoring
- [ ] Implement orchestrator main loop (manage task lifecycle)
- [ ] Build task assignment logic (route tasks to available Ollama agents)
- [ ] Create progress monitoring (track task completion %)
- [ ] Implement timeout detection (stuck tasks escalation)
- [ ] Build health checks (detect dead agents, mark unavailable)

### Error Handling & Retry
- [ ] Implement error context preservation (capture failure traces)
- [ ] Build automatic retry logic (retry transient failures)
- [ ] Create fallback to serial execution (if parallelization fails)
- [ ] Implement maximum retry limit (prevent infinite loops)
- [ ] Build escalation to human on persistent failures

### Commands & Integration
- [ ] Implement `zeno gate <id> execute` command with orchestrator
- [ ] Build orchestrator status reporting (`zeno orchestrator status`)
- [ ] Implement orchestrator shutdown protocol
- [ ] Create Ollama health check command
- [ ] Build task assignment visibility (`zeno orchestrator tasks`)

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

### Architecture Overview

```
User Request
    ↓
Zeno MCP Server (Planning/State Management)
├─ gates_action, proposal_action, requirements
├─ read_gate_prd, read_requirements, read_project_overview
├─ read_agent_manifest (query agents by role/category)
└─ Manages project gates, proposals, state, agents
    ↓
Claude/Copilot API (Planning Phase)
├─ Reads gate PRD via Zeno MCP tools
├─ Analyzes requirements and architecture
├─ Generates proposal specs with task decomposition
└─ Validates against acceptance criteria
    ↓
TypeScript Orchestrator
├─ Generates CrewAI config from proposal spec
├─ Maps gate type → agent roles from manifest
├─ Spawns Python subprocess (crew_service.py)
└─ Collects results from Python service
    ↓
CrewAI Python Service (Subprocess)
├─ Loads agents from agents/agent-manifest.json
├─ Creates hierarchical crew with inter-agent communication
├─ Routes tasks by agent roles/specialization
├─ Manages task dependencies and blocking
├─ Enables agents to ask each other questions
└─ Returns structured results
    ↓
Ollama Models (Implementation Workers - Inside CrewAI)
├─ local mistral:7b, codestral:22b, qwen:coder
├─ Tool-calling for each task within crew
├─ Inter-agent coordination via CrewAI messaging
└─ Report: task results, blockers, questions
    ↓
TypeScript Orchestrator → Zeno MCP Server
├─ Parse CrewAI results
├─ Invoke worktree_merge via Gate 10 MCP
├─ Collect diffs and test results
└─ Finalize via proposal_action/gates_action
```

### What Was Completed Before This Gate

Gate 01-12 established:
- Full planning, execution, validation, approval, git integration, rescope, monitoring workflow
- individual agent capabilities (gates, proposals, validation)
- Dashboard for visibility

### What This Gate Enables

- **Parallel Execution at Scale** - Multiple Ollama agents work concurrently, completion time reduced 40-60% vs. serial
- **Cost Efficiency** - Expensive Claude API only for planning, cheap local Ollama for implementation
- **Agent Elasticity** - More Ollama agents = faster completion (scales linearly up to task count)
- **Intelligent Decomposition** - Claude's reasoning produces task graphs optimized for parallelization
- **Production Readiness** - Zeno scales from single-gate projects to enterprise multi-proposal gates

### Scope Boundaries

**In Scope**:
- Zeno MCP exposure of gate/requirements/architecture for Claude analysis
- Claude API planning orchestrator (proposal spec generation)
- LangGraph/CrewAI/Mastra integration and task graph management
- Ollama model initialization and local tool-calling integration
- Dependency graph analysis for parallelization
- Worktree allocation per task (using Gate 10 MCP tools)
- Orchestrator-level merge coordination
- File-level conflict detection and serialization
- Task status tracking and progress monitoring
- Result consolidation and validation
- Error handling, retry logic, and graceful degradation
- `zeno gate <id> execute` command with parallelization
- Comprehensive test coverage (90% minimum)

**Out of Scope**:
- Agent auto-scaling or resource allocation
- Network-distributed agent execution (local only via Ollama)
- Custom orchestration framework (use open-source)
- Agent licensing or cost management
- Cross-project orchestration (single project scope)
- Advanced observability/tracing (logging only)

## Requirements

This gate addresses scalability and efficiency requirements from project initialization:

1. **Multi-Agent Planning & Execution** - Claude (planning) + Ollama agents (implementation) work in parallel
2. **Intelligent Task Decomposition** - Claude generates task graphs optimal for parallelization
3. **Safe Merge Coordination** - Orchestrator ensures merges don't conflict, uses Gate 10 MCP tools
4. **Automatic Parallelization** - Dependency analysis identifies independent work without manual planning
5. **Cost-Efficient Scaling** - Expensive Claude API for planning, cheap local Ollama for execution
6. **Graceful Degradation** - Partial failures don't block gate, continue with remaining tasks
7. **Scale Linearly** - Completion time scales inversely with agent count (O(1/n))

## Technical Decisions

### 1. Layered Architecture: Zeno MCP → Claude → Agent Framework → Ollama
- **Choice**: Separate concerns by tier: Zeno (state), Claude (planning), agent framework (coordination), Ollama (execution)
- **Alternatives Considered**: Single monolithic agent, MCP-all-the-way, cloud-only LLMs
- **Rationale**: Cleanest separation: expensive LLMs for complex planning decisions, local cheap models for implementation. Zeno maintains source of truth. Agent framework provides proven coordination patterns.
- **Trade-offs**: Gained modularity, cost efficiency, leverages open-source frameworks; added integration complexity

### 2. Claude/Copilot for Planning Phase
- **Choice**: Use Claude API for proposal spec generation from gate PRDs
- **Alternatives Considered**: Ollama for planning (quality risk), pure heuristic decomposition (misses insights)
- **Rationale**: Claude's large context window and reasoning excel at complex decomposition. Cost amortized per gate (not per task).
- **Trade-offs**: Gained planning quality; slight cost overhead (~$0.20-0.50/gate)

### 3. CrewAI for Hierarchical Agent Teams
- **Choice**: Use CrewAI for hierarchical agent orchestration with inter-agent communication
- **Alternatives Considered**: LangGraph (simpler but no agent hierarchy), custom orchestrator (build complexity)
- **Rationale**: CrewAI's agent roles, team hierarchies, and inter-agent messaging map perfectly to your agent-manifest.json structure. Agents can ask each other questions to improve parallelization. Built-in task dependencies and blocking relationships.
- **Trade-offs**: Gained agent communication and team dynamics; Python dependency requires subprocess bridge

### 3a. Python Subprocess Bridge for CrewAI
- **Choice**: Run CrewAI in Python subprocess, communicate via JSON stdin/stdout
- **Alternatives Considered**: REST service (unnecessary overhead), direct Python integration (complex FFI)
- **Rationale**: Simple, clean separation. Python process startup cost is negligible vs. task execution time. No external services needed.
- **Trade-offs**: Gained simplicity; slight startup overhead (~500ms) amortized across multi-minute tasks

### 4. Ollama with Anthropic API Compatibility for Implementation
- **Choice**: Local Ollama models (1-8B) via Anthropic API endpoint, tool-calling enabled
- **Alternatives Considered**: Cloud models (cost), single monolithic model (parallelization limits)
- **Rationale**: Ollama provides cheap local execution with native tool support. Anthropic compatibility means Claude SDK reusable.
- **Trade-offs**: Gained cost efficiency and local execution; lower model quality than cloud (acceptable for code generation)

### 5. Worktree-Based Isolation per Task
- **Choice**: Each Ollama agent gets dedicated worktree, orchestrator merges via MCP
- **Alternatives Considered**: Shared worktree with locking, branch-per-agent, containerized
- **Rationale**: Worktrees provide simple, fast isolation without cloning overhead. Gate 10 MCP tools already handle merges.
- **Trade-offs**: Gained simplicity; slight disk overhead for worktrees

### 6. Dependency-Based Parallelization
- **Choice**: Merge non-dependent tasks in parallel, rebase dependent tasks on parent merges
- **Alternatives Considered**: All sequential, optimistic concurrent with conflict resolution
- **Rationale**: Maximizes parallelization while respecting dependencies. Dependency graph drives ordering.
- **Trade-offs**: Gained parallelization; added complexity in merge coordination

## Architecture & Dependencies

### Zeno Integration Layer
- Expose existing MCP tools: `gates_action`, `proposal_action`
- New MCP tools: `read_gate_prd`, `read_requirements`, `read_project_overview`
- `ProposalSpecValidator` - Validates Claude-generated proposal specs

### Claude Planning Layer
- `ClaudePlanningOrchestrator` - Calls Zeno MCP tools, orchestrates Claude API
- Claude system prompts for proposal spec generation
- Proposal spec schema validation

### CrewAI Python Service Layer
- `CrewFactory` - Builds CrewAI crews from proposal specs
- `AgentManifestLoader` - Loads agents from agents/agent-manifest.json
- `AgentRoleMapper` - Maps gate type → agent roles needed
- `TaskHierarchyBuilder` - Creates CrewAI tasks with blocking relationships
- `CrewConfigBuilder` - Generates CrewAI config JSON from proposal spec
- CrewAI native: `Agent`, `Task`, `Crew`, `Process.hierarchical`

### TypeScript Orchestration Layer
- `CrewServiceBridge` - Spawns and communicates with Python service
- `ProposalSpecToCrew` - Converts proposal spec to CrewAI config
- `CrewResultParser` - Parses CrewAI output
- `SubprocessLifecycleManager` - Handles Python process startup/shutdown
- `ConflictDetector` - Identifies file-level conflicts from spec
- `MergeOrderingEngine` - Determines merge sequence from dependencies

### Ollama Execution Layer
- `OllamaClient` - Anthropic API compatibility endpoint
- `LocalToolExecutor` - Handles tool calls (read_file, write_file, run_command, git_commit)
- `TaskSpecFormatter` - Converts orchestrator tasks to model prompts
- `ResultReporter` - Reports task results back to orchestrator

### Integration with Gate 10 MCP Tools
- `worktree_list`, `worktree_prune`, `worktree_remove`, `worktree_merge`
- Orchestrator invokes during task execution and merging

### Error Handling & Recovery
- `RetryPolicy` - Configures retry logic per task
- `ErrorContextCapture` - Preserves failure traces
- `RollbackManager` - Reverts failed tasks

## Implementation Steps

### Phase 1: Zeno MCP Exposure
1. Add `read_gate_prd` MCP tool
2. Add `read_requirements` MCP tool
3. Add `read_project_overview` MCP tool
4. Design proposal spec JSON schema
5. Create schema validator

### Phase 2: Claude Planning Orchestrator
6. Implement `ClaudePlanningOrchestrator` class
7. Create Claude system prompt for spec generation
8. Implement gate PRD → proposal spec pipeline
9. Add proposal spec validation
10. Test with sample gates

### Phase 3: CrewAI Python Service (New)
11. Create `crew_service.py` python subprocess runner
12. Implement `CrewFactory` to build CrewAI crews
13. Implement `AgentManifestLoader` to load agents/agent-manifest.json
14. Build `AgentRoleMapper` (gate type → agent roles)
15. Implement `TaskHierarchyBuilder` (tasks with dependencies)
16. Build JSON input/output serialization for subprocess communication
17. Implement error handling and process lifecycle
18. Test crew creation and execution with mock tasks

### Phase 4: TypeScript-Python Bridge
19. Implement `CrewServiceBridge` subprocess spawner
20. Build proposal spec → CrewAI config converter
21. Implement result parsing from Python JSON
22. Create process lifecycle management (startup, timeout, cleanup)
23. Build error propagation from Python to TypeScript

### Phase 5: Ollama Integration (Inside CrewAI)
24. Configure Ollama Anthropic API endpoint
25. Set up CrewAI to use Ollama models (via API endpoint)
26. Create local tool definitions for CrewAI tasks
27. Implement tool-calling within CrewAI workflows

### Phase 6: Orchestrator Core
28. Implement orchestrator main loop (proposal → crew config → run → merge)
29. Build conflict detector (file-level overlaps in proposal spec)
30. Implement merge ordering engine (non-dependent tasks in parallel)
31. Create worktree allocation per CrewAI task
32. Build result consolidation from CrewAI output

### Phase 7: Coordination & Merging
33. Integrate Gate 10 MCP tools (worktree_merge, etc.)
34. Implement merge coordination protocol
35. Build rollback mechanism
36. Create partial failure handling (some tasks fail, others continue)

### Phase 8: Error Handling & Resilience
37. Implement retry policy for subprocess failures
38. Build error context capture from Python service
39. Create timeout detection for CrewAI execution
40. Implement health checks (Python service availability)

### Phase 9: Commands & Visibility
41. Implement `zeno gate <id> execute` command
42. Create `zeno orchestrator status` command
43. Build progress monitoring (track task completion)
44. Implement detailed logging of inter-agent communication

### Phase 10: Testing
45. Write unit tests for crew config generation
46. Test agent manifest loading and role mapping
47. Test subprocess communication (JSON serialization)
48. Write integration tests with mock CrewAI
49. Test conflict detection and merge ordering
50. Achieve 90% coverage

## Gate Completion Criteria

### Zeno MCP Exposure
- [ ] `read_gate_prd` tool implemented and returns valid gate PRD JSON
- [ ] `read_requirements` tool returns gate requirements with acceptance criteria
- [ ] `read_project_overview` tool returns system architecture for Claude context
- [ ] `read_agent_manifest` tool loads agents/agent-manifest.json correctly

### Claude Planning Orchestrator
- [ ] ClaudePlanningOrchestrator calls Zeno MCP tools to read context
- [ ] Proposal specs generated from gate PRDs with task decomposition
- [ ] Task decomposition includes dependencies, file assignments, acceptance criteria
- [ ] Proposal specs validate against gate acceptance criteria

### CrewAI Agent Orchestration
- [ ] Agent manifest loads successfully (agents/agent-manifest.json)
- [ ] Role mapping works correctly (gate type → agent roles from manifest)
- [ ] CrewAI crew configs generate with proper agent assignments
- [ ] Hierarchical process creates dependency relationships (blocking tasks)
- [ ] Inter-agent communication executes (agents ask questions, challenge assumptions)

### Python Subprocess Bridge
- [ ] crew_service.py starts and listens to stdin/stdout
- [ ] JSON serialization/deserialization works bidirectionally
- [ ] Process lifecycle management (startup, timeout, cleanup) is robust
- [ ] Error messages propagate from Python to TypeScript with full context
- [ ] Results include agent findings and task metadata

### Ollama Integration & Tool Calling
- [ ] Ollama models connect via Anthropic API compatibility endpoint
- [ ] CrewAI agents call local tools (read_file, write_file, run_command, git_commit)
- [ ] Tool-calling within agent execution handles responses correctly
- [ ] Task results formatted and reported back to orchestrator

### Orchestrator Execution & Parallelization
- [ ] Non-dependent tasks execute in parallel via CrewAI concurrent agents
- [ ] Dependent tasks execute sequentially as ordered by hierarchy
- [ ] Merge ordering prevents merge conflicts (no same-file edits)
- [ ] Worktrees merged successfully via Gate 10 MCP tools
- [ ] Progress monitoring tracks task completion and timing
- [ ] Status reporting shows active tasks and completion times

### Conflict Detection & Resolution
- [ ] File overlap detection identifies tasks editing same files
- [ ] Conflicting tasks serialized correctly (non-dependent conflicts run sequentially)
- [ ] Merge conflicts escalated to human for review (not auto-overwritten)
- [ ] Prevention: agents informed of file restrictions before CrewAI execution

### Error Handling & Resilience
- [ ] Subprocess failures caught and retried (configurable retry policy)
- [ ] Error context captured with full context (agent, task, error details)
- [ ] Timeout detection identifies hung CrewAI agents
- [ ] Partial failures don't block gate (continue with remaining tasks)
- [ ] Rollback on critical failure reverts all task work
- [ ] Max retry limit prevents infinite loops

### Commands & Visibility
- [ ] `zeno gate <id> execute` orchestrates CrewAI execution flow
- [ ] `zeno orchestrator status` shows current CrewAI task assignments
- [ ] `zeno orchestrator tasks` lists pending and in-progress tasks with agent assignments
- [ ] Detailed logs show CrewAI agent assignments, inter-agent communication, task completions, timings

### Quality Standards
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for orchestration module
- [ ] Zero lint errors (ESLint)
- [ ] Zero type errors (TypeScript strict)
- [ ] CrewAI integration tests with mock Ollama
- [ ] Performance acceptable: 4+ parallel agents without degradation
- [ ] Documentation updated for orchestration workflow
- [ ] Error messages are clear and actionable
