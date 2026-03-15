# Gate 10: Subagent Orchestration & Parallel Execution

> **DEFERRED** — This gate is deferred beyond MVP. The scope below is too large for a single
> gate and must be decomposed into multiple gates before implementation begins. Do not start
> this gate until gates 08-09 are complete and the decomposition is approved.

**Status**: deferred
**Type**: feature
**Created**: 2026-02-04
**Sequence**: 10 of 10
**Hash**: #g10subagent

<!-- Status lifecycle:
  - pending: Gate generated at init, requirements not yet decomposed
  - in_progress: Gate started via `zeno gates start`, requirements generated
  - completed: All requirements tested, gate approved
  - archived: Gate completed and moved to archive with final artifacts
  - rejected: Gate rejected during review
  - cancelled: Gate cancelled/dropped with optional reason
  - backlog: Gate deferred to later implementation
-->

## Decomposition Required

This gate is intentionally oversized and **must be broken into multiple gates** before work begins. Suggested decomposition:

1. **Gate 10a: MCP Exposure & Planning Orchestrator** — Expose gate PRD, requirements, and architecture via MCP read tools. Implement Claude/Copilot planning orchestrator for proposal spec generation.
2. **Gate 10b: CrewAI Python Service & ACP Bridge** — Build the CrewAI ACP server (`crew_acp_server.py`), agent manifest loading, task hierarchy builder, and TypeScript subprocess bridge.
3. **Gate 10c: Ollama Workers & Merge Coordination** — Integrate Ollama models as implementation workers, implement worktree-per-task isolation, merge ordering engine, and result consolidation.
4. **Gate 10d: Error Handling, Retry, & CLI** — Build retry policies, rollback manager, graceful degradation, `zeno gate <id> execute` command, and E2E orchestration tests.

The decomposition above is a starting point. The actual breakdown should be refined during planning.

## Overview

Implements multi-tier agent orchestration and parallel execution enabling Zeno to scale beyond single-agent constraints. Architecture layers complexity by tier: Zeno MCP Server (planning/state), Claude/Copilot API (large-context planning decisions), CrewAI (hierarchical agent teams with inter-agent communication via Python subprocess bridge), and Ollama models (local implementation workers). This gate delivers hierarchical agent team orchestration with role-based specialization, inter-agent communication for improved parallelization, intelligent task decomposition from proposal specs, dependency-based task sequencing, worktree-per-task isolation, orchestrator-level merge coordination, file-level conflict detection, and result consolidation.

**Four-Layer Orchestration Architecture**:

1. **Zeno MCP Server** (Planning/State): Gates, proposals, requirements, templates, artifact access, agent manifest
2. **Claude/Copilot API** (Planning Phase): Reads gate PRD via MCP, generates proposal specs, validates acceptance criteria
3. **CrewAI + Python Subprocess Bridge** (Agent Orchestration): Hierarchical agent teams, inter-agent communication, task coordination, role-based specialization from agent manifest
4. **Ollama Models** (Implementation Workers): Execute tasks on isolated worktrees, use local tools (file I/O, git, commands), report results

## Dependency: Flexible Workflow Configuration (Solitary Proposal #w26021401)

Gate 10 depends on the **Flexible Workflow Configuration System** (solitary proposal #w26021401) which provides:

- **Agent-Orchestrated Workflow Mode**: `workflowMode: 'agent-orchestrated'` with auto-approval rules and parallel execution config
- **Strict Validation (Non-Negotiable)**: Always-on strict validation (TypeScript strict: 0 errors, coverage: ≥90%, security: 0 CVEs, linting: <0.01%, all tests passing) — validates against LLM hallucinations
- **Approval Rules**: Configuration-driven approval strategy for orchestrated mode (auto-approve by agent for 'must' priority)
- **Worktree Decision Logic**: `shouldCreateWorktree()` function enabling parallel worktree allocation
- **State Machine Consistency**: Standard proposal state machine (pending → validate → approval → in_progress → completed)

## Objectives

- [ ] Expose Zeno MCP tools for Claude planning access (read_gate_prd, read_requirements, read_project_overview)
- [ ] Implement Claude/Copilot planning orchestrator for proposal spec generation
- [ ] Implement CrewAI Python service with ACP bridge for agent orchestration
- [ ] Integrate Ollama models as implementation workers with tool-calling
- [ ] Build dependency graph analysis for parallelization detection
- [ ] Implement worktree-per-task isolation using Gate 08 worktree manager
- [ ] Implement orchestrator-level merge coordination and conflict detection
- [ ] Build result consolidation, error handling, and retry logic
- [ ] Implement configurable model delegation (Claude, Copilot, Ollama, custom endpoints)
- [ ] Implement `zeno gate <id> execute` and orchestrator status commands

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
├─ Spawns Python subprocess (crew_acp_server.py)
└─ Collects results from Python service
    ↓
CrewAI Python Service (ACP Server)
├─ Loads agents from agents/agent-manifest.json
├─ Creates hierarchical crew with inter-agent communication
├─ Routes tasks by agent roles/specialization
├─ Manages task dependencies and blocking
├─ Enables agents to ask each other questions
└─ Returns structured results via ACP protocol
    ↓
Ollama Models (Implementation Workers - Inside CrewAI)
├─ local mistral:7b, codestral:22b, qwen:coder
├─ Tool-calling for each task within crew
├─ Inter-agent coordination via CrewAI messaging
└─ Report: task results, blockers, questions
    ↓
TypeScript Orchestrator → Zeno MCP Server
├─ Parse CrewAI results
├─ Invoke worktree merge via Gate 08 MCP tools
├─ Collect diffs and test results
└─ Finalize via proposal_action/gates_action
```

### What Was Completed Before This Gate

**MVP (Gates 01-09)**:

- Full planning, execution, validation, approval, git integration (with worktrees), rescope workflow
- Individual agent capabilities (gates, proposals, validation)
- Documentation polish
- Shell validation runner, approval audit trail, worktree manager, rescope hardening

**Prerequisite (Solitary Proposal #w26021401)**:

- Flexible Workflow Configuration System: provides configuration-driven workflow modes, approval rules, strict validation, worktree decision logic, and proposal state machine

### What This Gate Enables

- **Parallel Execution at Scale**: Multiple Ollama agents work concurrently, completion time reduced 40-60% vs. serial
- **Cost Efficiency**: Expensive Claude API only for planning, cheap local Ollama for implementation
- **Agent Elasticity**: More Ollama agents = faster completion (scales linearly up to task count)
- **Intelligent Decomposition**: Claude's reasoning produces task graphs optimized for parallelization

### Scope Boundaries

**In Scope**:

- Zeno MCP exposure of gate/requirements/architecture for Claude analysis
- Claude API planning orchestrator (proposal spec generation)
- CrewAI integration via ACP server and task graph management
- Ollama model initialization and local tool-calling integration
- Configurable model delegation via `/delegate` command
- Tier-based model routing (PhD→Opus, Expert→Sonnet, Focused→Ollama)
- Dependency graph analysis for parallelization
- Worktree allocation per task (using Gate 08 worktree manager)
- Orchestrator-level merge coordination
- File-level conflict detection and serialization
- Task status tracking and progress monitoring
- Result consolidation and validation
- Error handling, retry logic, and graceful degradation
- `zeno gate <id> execute` command
- Comprehensive test coverage (90% minimum)

**Out of Scope**:

- Agent auto-scaling or resource allocation
- Network-distributed agent execution (local only via Ollama)
- Custom orchestration framework (use open-source)
- Agent licensing or cost management
- Cross-project orchestration (single project scope)
- Advanced observability/tracing (logging only)

---

## Requirements

### Project Requirements (Attributed to This Gate)

| Hash    | Name                              | Type         | Priority | How This Gate Addresses It                                            |
| ------- | --------------------------------- | ------------ | -------- | --------------------------------------------------------------------- |
| #[hash] | Multi-Agent Planning & Execution  | functional   | must     | Claude (planning) + Ollama agents (implementation) work in parallel   |
| #[hash] | Intelligent Task Decomposition    | functional   | must     | Claude generates task graphs optimal for parallelization              |
| #[hash] | Safe Merge Coordination           | functional   | must     | Orchestrator ensures merges don't conflict via worktree MCP tools     |
| #[hash] | Automatic Parallelization         | functional   | must     | Dependency analysis identifies independent work                       |
| #[hash] | Cost-Efficient Scaling            | non_functional | should | Expensive Claude for planning, cheap local Ollama for execution       |
| #[hash] | Graceful Degradation              | non_functional | should | Partial failures don't block gate; continue with remaining tasks      |

### Gate-Specific Requirements

**Status**: Requirements will be generated when gate is started (after decomposition into sub-gates).

### Inherited/Transferred Requirements

No inherited or transferred requirements at this time.

---

## Proposals

**Status**: Proposals will be generated after this gate is decomposed into sub-gates and started.

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

### 1. Layered Architecture: Zeno MCP → Claude → CrewAI → Ollama

- **Choice**: Separate concerns by tier: Zeno (state), Claude (planning), CrewAI (coordination), Ollama (execution)
- **Alternatives Considered**: Single monolithic agent, MCP-all-the-way, cloud-only LLMs
- **Rationale**: Expensive LLMs for complex planning, local cheap models for implementation. Zeno maintains source of truth.
- **Impact**: Each tier has clear responsibility; integration complexity at tier boundaries
- **Trade-offs**: Gained modularity, cost efficiency; added integration complexity

### 2. CrewAI Exposed via ACP Server

- **Choice**: Wrap CrewAI behind ACP-compliant server using same JSON-RPC 2.0 / stdio transport as Gate 7's `TaskDistributorIntegration`
- **Alternatives Considered**: Direct subprocess bridge (no ACP framing), REST service, custom IPC
- **Rationale**: Gate 7 already establishes `ai.invocationMode: 'acp'` dispatch path. Adding `ai.cli: 'crewai'` requires no changes to dispatch logic. Standard lifecycle (session management, structured message parts) for free.
- **Impact**: `ZenoConfigSchema` gains `ai.crewai` sub-object; `crew_acp_server.py` added to `agents/`

### 3. Python Subprocess Bridge for CrewAI

- **Choice**: Run CrewAI in Python subprocess, communicate via NDJSON over stdio (ACP framing)
- **Alternatives Considered**: REST service (unnecessary overhead), direct Python integration (complex FFI)
- **Rationale**: Simple, clean separation. Python startup cost negligible vs. task execution time.
- **Impact**: JSON serialization boundary between TypeScript and Python

### 4. Ollama with Anthropic API Compatibility

- **Choice**: Local Ollama models (1-8B) via Anthropic API endpoint, tool-calling enabled
- **Alternatives Considered**: Cloud models (cost), single monolithic model (parallelization limits)
- **Rationale**: Cheap local execution with native tool support. Anthropic compatibility means Claude SDK reusable.
- **Impact**: Model quality lower than cloud (acceptable for focused code generation tasks)

### 5. Worktree-Based Isolation per Task

- **Choice**: Each Ollama agent gets dedicated worktree, orchestrator merges via MCP
- **Alternatives Considered**: Shared worktree with locking, branch-per-agent
- **Rationale**: Worktrees provide simple, fast isolation without cloning overhead. Gate 08 worktree tools handle merges.
- **Impact**: Disk overhead proportional to parallel agent count

### 6. Configuration-Driven Orchestration

- **Choice**: Orchestrator inherits approval rules, validation strategy, state machine, and worktree logic from workflow configuration
- **Alternatives Considered**: Custom orchestration logic, hardcoded approval rules
- **Rationale**: Workflow config provides standardized, reusable infrastructure for all modes.
- **Impact**: Requires workflow config prerequisite

## Architecture Updates

### Components Modified or Created

- **Zeno Integration Layer**
  - `ProposalSpecValidator` (`src/orchestration/proposal-spec-validator.ts`)
  - New MCP tools: `read_gate_prd`, `read_requirements`, `read_project_overview`

- **Claude Planning Layer**
  - `ClaudePlanningOrchestrator` (`src/orchestration/claude-planning-orchestrator.ts`)
  - Claude system prompts for proposal spec generation

- **CrewAI Python Service Layer**
  - `crew_acp_server.py` (`agents/crew_acp_server.py`) — ACP shim over stdio
  - `CrewFactory` (`agents/crew_service.py`) — Builds CrewAI crews from proposal specs
  - `AgentManifestLoader` — Loads agents from `agents/agent-manifest.json`
  - `TaskHierarchyBuilder` — Creates CrewAI tasks with blocking relationships

- **TypeScript Orchestration Layer**
  - `CrewServiceBridge` (`src/orchestration/crew-service-bridge.ts`) — Spawns ACP server
  - `MergeOrderingEngine` (`src/orchestration/merge-ordering-engine.ts`)
  - `ConflictDetector` (`src/orchestration/conflict-detector.ts`)

- **Ollama Execution Layer**
  - `OllamaClient` (`src/orchestration/ollama-client.ts`)
  - `LocalToolExecutor` (`src/orchestration/local-tool-executor.ts`)

- **Error Handling & Recovery**
  - `RetryPolicy` (`src/orchestration/retry-policy.ts`)
  - `RollbackManager` (`src/orchestration/rollback-manager.ts`)

### Diagram Updates

- System Overview: Add orchestration layer with four-tier architecture
- Data Flow: Add orchestration flow (Zeno → Claude → CrewAI → Ollama → merge)
- Component: Add orchestration components and Python bridge

### Integration Points

- **Gate 08 MCP Tools**: Worktree operations for per-task isolation
- **Proposal System**: Proposal start creates worktree; approve merges and cleans up
- **Validation System**: Strict validation on every agent task output
- **Agent Manifest**: Agents loaded from `agents/agent-manifest.json`
- **Workflow Configuration**: Approval rules, validation strategy from `.zeno/config.json`

## Gate-Specific Quality Considerations

### Security Considerations

- Python subprocess must not execute arbitrary code from agent output
- Ollama tool-calling must be sandboxed to project directory
- Git operations must not expose credentials or tokens
- Model endpoints must use HTTPS for remote connections

### Performance Requirements

- Worktree creation: <3 seconds per agent
- Python subprocess startup: <1 second
- 4+ parallel agents should execute without degradation
- Merge coordination: <10 seconds per task

## Dependencies

### External Dependencies (New or Updated)

- **crewai** (Python) — Hierarchical agent orchestration
- **@agentclientprotocol/sdk** (existing, from Gate 7) — ACP client transport
- **ollama** (local install) — Local model execution
- **@anthropic-ai/sdk** (existing) — Claude API for planning phase

### Internal Dependencies

- **Depends on Gate(s)**: Gate 08: MVP Hardening (worktree manager, validation, approval), Gate 09: Documentation
- **Blocks Gate(s)**: None (terminal deferred gate)
- **Requires Modules**: Gate storage, proposal storage, validation orchestrator, worktree manager
- **Requires Prerequisite**: Solitary Proposal #w26021401 (Flexible Workflow Configuration System)

### Infrastructure Dependencies

- Python 3.10+ for CrewAI subprocess
- Ollama installed and running for local model execution
- Agent manifest file at `agents/agent-manifest.json`

## Implementation Steps

> These steps are high-level. Detailed implementation steps will be defined per sub-gate
> after this gate is decomposed.

1. **Implement Zeno MCP Exposure** — `read_gate_prd`, `read_requirements`, `read_project_overview` MCP tools
2. **Implement Claude Planning Orchestrator** — Proposal spec generation from gate PRDs
3. **Build CrewAI Python Service and ACP Bridge** — Agent manifest loading, crew creation, subprocess bridge
4. **Integrate Ollama and Orchestrator Core** — Model initialization, task execution, worktree allocation
5. **Build Coordination & Error Handling** — Merge ordering, retry logic, rollback, partial failure handling
6. **Build CLI Commands** — `zeno gate <id> execute`, `zeno orchestrator status`
7. **E2E Integration Tests** — Full orchestration flow with mock CrewAI and mock Ollama

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation | Contingency |
|------|--------|-------------|------------|-------------|
| CrewAI integration complexity | High | Medium | Start simple; test bridge early | Fall back to direct Ollama without CrewAI |
| Ollama model quality | Medium | Medium | Use larger models for complex tasks; strict validation | Route complex tasks to Claude as fallback |
| Merge conflicts from parallel agents | High | Medium | Pre-check file overlaps; serialize conflicts | Escalate to human for manual resolution |
| Python subprocess reliability | Medium | Low | Health checks, timeouts, graceful shutdown | Retry with fresh subprocess; serial fallback |

## Gate Completion Criteria

- [ ] Claude planning orchestrator generates proposal specs from gate PRDs
- [ ] CrewAI ACP server starts and communicates via stdio
- [ ] Ollama models connect and execute tasks with tool-calling
- [ ] Non-dependent tasks execute in parallel
- [ ] Worktrees merged successfully via Gate 08 worktree tools
- [ ] File overlap detection identifies conflicting tasks
- [ ] Subprocess failures caught and retried
- [ ] `zeno gate <id> execute` orchestrates full execution flow
- [ ] All tests passing with TypeScript strict mode
- [ ] Test coverage ≥90% for orchestration module
- [ ] Zero lint errors, zero type errors

## Notes

### Implementation Notes

- This gate must be decomposed into 3-4 sub-gates before work begins
- Suggested decomposition in the "Decomposition Required" section above is a starting point
- The ACP bridge pattern from Gate 7 (`TaskDistributorIntegration`) should be reused
- Worktree schemas already defined in `src/mcp/schemas/worktree-schemas.ts`
- Originated from old gate 13, renumbered to gate 10

### Proposal Summary

[To be populated after decomposition and implementation.]

---

**Document Version**: 2.0.0
**Last Updated**: 2026-03-14
**Versioning**: SemVer; bump on any change (minimum: PATCH).
**Owner**: Zeno
**Reviewers**: Zeno

### Change Log

| Version | Date       | Summary                                                                | Author |
| ------- | ---------- | ---------------------------------------------------------------------- | ------ |
| 1.0.0   | 2026-02-04 | Initial version (as gate 13)                                           | Zeno   |
| 1.1.0   | 2026-02-27 | Aligned with gate-prd-template.md                                      | Zeno   |
| 2.0.0   | 2026-03-14 | Renumbered to gate 10; marked deferred; flagged for decomposition      | Zeno   |

**Related Documents**:

- Project PRD: `zeno/overview/PROJECT_PRD.md`
- Previous Gate: `zeno/gates/gate-09-documentation-polish.md`
- Architecture: `zeno/architecture/`
