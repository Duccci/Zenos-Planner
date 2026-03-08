# Zeno's Planner

## Overview

Zeno's Planner is a lightweight, LLM-friendly project planning and orchestration tool that enhances human "vibe coding" by maintaining long-term project memory, reducing context size, and ensuring consistency from vision through implementation. Conceptually inspired by Zeno's dichotomy paradox, the tool generates iterative gates (milestones) that progressively approach project completion, with each gate requiring human approval and automated quality checks.

The tool bridges the gap between high-level project vision and detailed implementation by decomposing projects into: Gates → Architecture → Requirements → Subprojects → Proposals, with comprehensive dependency tracking and multi-repository support for large-scale solutions.

## Key Technical Decisions

### 1. Technology Stack

- **Choice**: TypeScript (strict mode), Node.js >= 24.0.0, SQLite (better-sqlite3), Mermaid + Graphviz (DOT/SVG), Commander.js, Zod, Vitest
- **Alternatives Considered**: JavaScript (no types), PostgreSQL (client-server), Draw.io (binary diagrams), Yargs (CLI), Joi (validation), Jest (testing)
- **Rationale**: Lightweight, LLM-friendly, cross-platform, rich ecosystem. TypeScript provides type safety without runtime overhead. SQLite requires no server setup. Mermaid supports simple diagrams with minimal blocks; Graphviz DOT/SVG covers complex diagrams with higher visual fidelity.
- **Trade-offs**: Gained simplicity and portability; lost some advanced database features and GUI diagram editing.

### 2. Iterative Gate Generation

- **Choice**: Gates generated through iterative decomposition inspired by Zeno's dichotomy paradox concept. Each gate represents concrete deliverables that move the project closer to completion. Progress is evaluated dynamically based on actual work completed rather than predetermined percentages.
- **Alternatives Considered**: Fixed percentage milestones, Fibonacci sequence progression, user-defined milestones, story point estimation
- **Rationale**: Natural decomposition that adapts to actual complexity, manageable chunks that emerge from project analysis, always making measurable progress. Zeno's paradox serves as a conceptual framework to help humans understand the approach, but percentages are not used in the tool's functionality.
- **Trade-offs**: Gained adaptive structure and ability to respond to discovered complexity; lost rigid predictability but gained realistic progress tracking.

### 2a. Two-Level Requirement Generation

- **Choice**: Requirements generated at two levels: (1) high-level project requirements during `zeno init`, and (2) gate-specific requirements when `zeno gates start` is called. Gate requirements can inherit from, reference, or decompose project requirements.
- **Alternatives Considered**: All requirements at init, requirements only at gate start, manual requirement definition
- **Rationale**: Project-level requirements capture cross-cutting concerns and constraints visible from the end state (e.g., "must support offline mode", "90% test coverage"). Gate-level requirements are specific, actionable items derived from project requirements and gate objectives. This separation enables requirement reuse across gates and supports rescoping without losing project-level constraints.
- **Trade-offs**: Gained requirement reuse and clearer separation of concerns; added complexity in tracking parent-child relationships between requirement levels.

### 3. Hash-Based References

- **Choice**: SHA-256 (first 16 chars) for content-addressable storage (e.g., `#a3f9c2d1` instead of `/long/path/to/file`)
- **Alternatives Considered**: Full file paths, UUIDs, sequential IDs, Git commit SHAs
- **Rationale**: Reduces LLM context size by 50%+, enables dependency tracking across repos, provides immutable references, content-based addressing prevents stale references
- **Trade-offs**: Gained context efficiency and immutability; lost human readability of references.

### 4. Minimalist Database Schema: Requirements + Repositories

- **Choice**: SQLite with exactly 2 core tables: `requirements` (hierarchical, supports spec-driven development) and `repositories` (multi-repo support for Gate 5)
- **Alternatives Considered**: Monolithic database (12+ tables), multiple databases, pure file-based storage
- **Rationale**: Lightweight MVP focused on core concerns. Project metadata lives in `project-overview.json` (version-controlled, human-readable). Gate metadata also in `project-overview.json`. Proposals stored as Markdown files in `zeno/proposals/`. State history tracked via Git commits. This eliminates scope creep while preserving queryability where it matters: requirement hierarchies and multi-repo support.
- **Unified Requirements Format**: Single `requirements` table with flexible content model supports both traditional requirements (functional/non-functional/constraints with acceptance criteria) and project specifications (OpenAPI, GraphQL, Protobuf). No separate tables for specs vs. requirements—same format, different content types.
- **Approval by Presence**: Requirements in database are implicitly approved. Changes only occur via gate refactors or proposal updates, tracked through Git history.
- **Trade-offs**: Gained simplicity and reduced maintenance burden; database validates schema on startup, ensuring consistency. Lost some query complexity but gained clarity in what matters: requirements relationships and repository boundaries.

### 4.1. Refined Scope Reduction: 4-Table Consensus Schema

- **Choice**: Keep `proposals` table for hash-based lookup efficiency; remove `gates` and `proposal_dependencies` tables. Final schema: `requirements`, `repositories`, `proposals`, `metrics_snapshots`.
- **Rationale for Keeping Proposals Table**: Frequent hash-based lookups in operational commands (`proposal start`, `proposal validate`, `proposal approve`) benefit from database indexing. Proposals outnumber gates significantly, making database indexing more valuable than file scanning.
- **Rationale for Removing Gates Table**: Gates data is already stored in `project-overview.json` (version-controlled, human-readable, single source of truth). Maintaining this data in both database and JSON creates duplication and divergence risk. Gates are accessed sequentially or by ID (not by hash), eliminating the performance benefit of database indexing.
- **Rationale for Removing proposal_dependencies Table**: Dependencies are implicit in proposal references (e.g., "requires: #hash"). Creating a separate table creates redundant storage. If dependency queries are required, parse proposal markdown files on-demand using helper functions.
- **Rationale for Keeping metrics_snapshots Table**: Provides lightweight historical baseline at gate completion for trend analysis and performance tracking without storing per-module detail.
- **Implementation**: Migration 005 documents schema consolidation. Code updated to ignore `gates` and `proposal_dependencies` tables; consuming code reads gates from `project-overview.json` and derives dependencies from proposal references.
- **Trade-offs**: Gained alignment with minimalist design principle; improved data consistency by eliminating duplication. Removed 2 tables while keeping the one providing operational value.

### 5. Gate Roadmap Diagram Purpose

- **Choice**: Gate roadmap diagram displays gates and their parallel relationships, showing project roadmap structure
- **Alternatives Considered**: Feature-level detail, flat sequential diagram, Gantt-style timeline
- **Rationale**: Focus on high-level gate structure and dependencies. Parallel gates indicate work that can proceed simultaneously. Detailed features belong in gate-specific PRDs, not the roadmap overview.
- **Trade-offs**: Gained clarity and reduced visual clutter; lost detailed feature visibility in single diagram (features documented elsewhere).

### 6. Quality Thresholds (Non-Configurable in MVP)

- **Choice**: Code Coverage: 90%, Security Vulnerabilities: 0, Linting Error Rate: <0.01%
- **Alternatives Considered**: Configurable thresholds per project, industry standard 80% coverage, warning-only mode
- **Rationale**: Enforce high quality, prevent technical debt accumulation, reduce LLM hallucinations by catching errors early. Fixed thresholds simplify MVP.
- **Trade-offs**: Gained consistency and quality enforcement; lost flexibility for different project types.

### 7. Multi-Repo Support

- **Choice**: Automatic detection based on coupling metrics (afferent/efferent), domain boundaries (bounded contexts), module size (LOC, complexity), confidence scoring (0.0-1.0)
- **Alternatives Considered**: Manual repo definition, monorepo-only, heuristics-based (directory structure)
- **Rationale**: Support large-scale projects, proper separation of concerns. Metrics-based approach is objective and repeatable. Confidence scoring allows human override.
- **Trade-offs**: Gained scalability and architectural guidance; added complexity in analysis phase.

### 8. Human-in-the-Loop

- **Choice**: Approval required at gate generation, repo boundaries, proposals, and gate completion
- **Alternatives Considered**: Fully automated (no approval), approval only at gate boundaries, approval per file change
- **Rationale**: Maintain control, catch issues early, learn and adapt. Balances automation with oversight. Prevents runaway LLM execution.
- **Trade-offs**: Gained safety and control; added manual intervention points that slow down workflow.

### 9. AGENTS.md Generation

- **Choice**: Automatically generate AGENTS.md files that provide AI agents with context on how to read project artifacts, specs, diagrams, and requirements
- **Alternatives Considered**: Manual documentation, README only, inline comments in artifacts
- **Rationale**: AI coding assistants need structured guidance on artifact conventions, file locations, and how to interpret project-specific formats. AGENTS.md serves as a "how to read this codebase" guide for LLMs, reducing context confusion and improving code generation quality.
- **Trade-offs**: Gained AI-friendly onboarding and reduced misinterpretation; added another file to maintain (though auto-generated).

### 10. Intelligent Architecture Diagram Selection

- **Choice**: Generate architecture diagrams selectively based on target project type, complexity, and gate requirements rather than generating all diagram types for every project
- **Alternatives Considered**: Generate all 10 diagram types for every project, manual diagram selection only, no diagrams
- **Rationale**: Different project types need different documentation (CLI tools don't need network diagrams, libraries don't need deployment diagrams). Reduces documentation overhead while ensuring critical diagrams are created. Core diagrams (system overview, data flow, context, gate roadmap, gate lifecycle) always generated. Gate-level diagrams (sequence, component, package) generated when complexity detected. Infrastructure diagrams (deployment, network) generated for deployment gates.
- **Trade-offs**: Gained focused documentation without clutter; added complexity to diagram generation logic requiring project type detection.

### 11. Hybrid Diagram Rendering: Mermaid for Simple Diagrams, Prerendered DOT/SVG for Complex Models

- **Choice**: Use Mermaid for simple diagrams with minimal blocks (low visual density). Use prerendered DOT diagrams rendered to SVG using Graphviz for complex architecture diagrams to improve rendering quality, reduce context bloat, and handle complex models more effectively.
- **Alternatives Considered**: Mermaid for all diagrams, DOT/PNG for all diagrams, Draw.io, manually created PNG images, D3.js visualization
- **Rationale**: Mermaid excels at simple diagrams and remains text-based (version-controllable), but struggles with complex models containing many elements, nested relationships, and fine-grained styling. Prerendered DOT SVG images provide superior rendering quality, better visual hierarchy for complex systems, and reduce markdown context when models exceed 5 elements. SVG is vector-based, scalable, web-native, and typically smaller than PNG. DOT (Graphviz) is a stable, standardized language with excellent support for complex directed graphs.
- **Impact**: Complex architectural diagrams (system-overview, data-flow, component diagrams, deployment models, network diagrams) will be generated as DOT files, rendered to SVG artifacts using Graphviz, and embedded as images in markdown. Simpler diagrams (gate-roadmap, lifecycle, basic context diagrams) remain as Mermaid for text-based maintainability.
- **Trade-offs**: Gained superior rendering quality and complexity handling; lost text-based editability for complex diagrams. Added Graphviz system dependency. Prerendered SVG requires regeneration when source changes, but automation handles this. SVG files are embedded images and not directly editable in markdown, but source DOT files remain version-controlled.

### 12. Subagent Orchestration via Cursor Workflows with Four-Stage Delegation

> **POST-MVP** — This decision describes the long-term vision. Subagent orchestration is deferred beyond MVP (Gates 05-12). See Gate 13 for tracking.

**Choice**: Zeno orchestrates work through four-stage agent delegation with specialized agents in both planning and implementation:

1. **Planning Agents** (specialized decomposition): Expert Tier and PhD Tier agents selected from `agents/expert-agents/` submodule based on gate type and required expertise
2. **Local Agent** (interactive orchestration): Coordinates specialized planning agents, finalizes dispatch plan, allocates worktrees
3. **Background Agents** (parallel implementation): Domain-specialized agents from `agents/expert-agents/` and `agents/pipeline-agents/` develop on isolated git worktrees
4. **Cloud Agent** (code review): Create PR, add review comments, validate quality gates

**Delegation Flow**:

```text
Planning Agents (Specialized Gate Analysis)
    ↓ Hand off planning insights (MCP: agent_delegate)
Local Agent (Orchestration & Coordination)
    ↓ Dispatch plan with agent assignments & worktree paths
Background Agents (Implementation on Worktrees, Domain-Specialized)
    ↓ /delegate to cloud agent for review
Cloud Agent (Code Review & PR Management)
    ↓ Human approval
Merge Orchestration & Worktree Cleanup
```

**How It Works**:

- **Planning Phase (Specialized)**:
  - Expert Tier agents read gate PRD and requirements, decompose into proposals
  - PhD Tier agents (from `agents/expert-agents/`) analyze system impact, cross-gate dependencies, architectural constraints
  - Domain-specialist agents selected from `agents/expert-agents/{category}/` based on gate focus area
  - Planning agents update requirement status and report back to Local Agent with insights
- **Orchestration Phase**: Local agent synthesizes planning insights, identifies parallelizable work, creates final dispatch plan with agent assignments
- **Implementation Phase**: Specialized background agents selected from `agents/expert-agents/` and `agents/pipeline-agents/06-09-implementation/` based on proposal domain
- **Review Phase**: Cloud agent reviews, validates quality gates, auto-approves on pass or requests fixes
- **Merge Phase**: Orchestrator coordinates merges with conflict detection/resolution; auto-cleanup deletes worktrees

**Agent Specialization Tiers** (see `agents/TIER-CLASSIFICATION.md` for complete agent list):

- **Focused Tier** (~500 tokens): Limited scope, specific validators for bounded tasks (testing, coverage analysis, linting checks) — **Implementation Phase**
- **Expert Tier** (~1500 tokens): Domain depth, cross-module coordination, specialized knowledge areas (from `agents/expert-agents/` submodule categories) — **Planning & Implementation Phases**
- **PhD Tier** (~3000 tokens): Novel problems, architectural decisions, complex integrations, system-wide analysis (from `agents/expert-agents/` highest-tier experts) — **Planning Phase**

**Planning Phase Agent Selection**:

- Agent assignments determined dynamically from `agents/agent-manifest.json` by querying for:
  - Tier: Expert or PhD (based on gate complexity)
  - Category: Match gate focus area (e.g., `development-architecture`, `data-intelligence`, `security-compliance`)
  - Role: `auditor` (architect-reviewer patterns) or `executor` (design/decomposition)
- Lead agents selected via Agent Selector (from `pipeline-agents/00-orchestration/agent-selector.md`)
- Supporting agents selected from Expert Tier matching gate category
- All agent selections recorded in `.zeno/config.json` planning.agents array with manifest references

**Gate-to-Agent Mapping Example** (Validation Gate - Quality Focused):

- Planning: Expert Tier agent from `agents/expert-agents/quality-assurance/` or similar
- Implementation: Focused Tier agents for testing, coverage analysis, compliance checking
- Worktrees: 1 per validation batch (quality checks run on all proposals via MCP: `proposal_validate`)
- Parallelization: All quality checks run in parallel

**Gate-to-Agent Mapping Example** (Complex API/Integration Gate):

- Planning: PhD Tier agent from `agents/expert-agents/api-standards/` or `communication-protocols/`, Expert Tier system architect
- Implementation: Expert Tier agents from backend/architecture categories, Focused Tier test validators
- Worktrees: 3-4 per proposal (one per independent component)
- Parallelization: Core logic, integration, tests developed in parallel with dependency-based sequencing

**MCP Tools Available**:

- **Planning Phase**: No MCP tools required (specialized planning agents work synchronously, report decomposition insights)
- `proposal_start`: Create worktree for proposal (MCP: `proposal_start`)
- `proposal_approve`: Approve + merge worktree (MCP: `proposal_approve`)
- `agent_delegate`: Hand-off to another agent with context (planning agents → local agent, background agents → cloud agent) (MCP: `agent_delegate`)
- `worktree_list`: List active worktrees (MCP: `worktree_list`)
- `worktree_prune`: Remove expired worktrees (MCP: `worktree_prune`)
- `worktree_remove`: Manually delete worktree (MCP: `worktree_remove`)
- `worktree_merge`: Merge branch with conflict handling (MCP: `worktree_merge`)

**Alternative**: Single-agent execution only, local-only planning (no specialized planning agents), manual subagent creation, external orchestration tools
**Rationale**: Specialized agents reduce context size and improve quality at both planning and implementation levels. Planning phase specialization ensures architectural soundness, requirement decomposition accuracy, and optimal parallelization identification (agents selected dynamically from `agents/` submodule based on task requirements). Implementation specialization improves code quality through domain focus. Cursor workflows provide native integration for spawning agents. VS Code delegation preserves conversation history across hand-offs, enabling seamless context transfer. Git worktrees eliminate branch switching overhead, reduce merge conflicts, and enable true parallel work. Orchestrator coordinates merges, preventing serialization points.
**Trade-offs**: Gained 40-60% time reduction on gate completion through parallelization, improved architectural and code quality through dual-phase specialization, reduced context bloat, and better requirement accuracy; added complexity in planning phase coordination and multi-tier agent management. Mitigation: planning agents work synchronously and report to Local Agent (no async complexity), specialized agents selected dynamically from `agents/` submodule capabilities.

### 13. Git Worktrees for Isolated Parallel Agent Development

**Choice**: Use `git worktree` to create isolated working directories for independent proposals and gates, eliminating branch switching overhead and enabling 4+ agents to work simultaneously without interference.

**How It Works**:

- Each proposal/gate gets dedicated worktree with independent branch: `feature/{gate_id}-{proposal_hash}`
- Worktrees stored in `.local/worktrees/{proposal-hash}/` (transient, not version-controlled)
- Orchestrator creates worktrees on-demand and manages merge ordering to prevent conflicts
- Agents develop code, write tests, validate in isolated worktree without affecting peers
- When ready: Agent invokes `zeno proposal validate` in worktree context
- On approval: Orchestrator merges worktree branch to main and auto-cleanup

**Storage Structure**:

```text
.local/
  worktrees/
    {proposal-hash-1}/
      .git → symlink to main repo .git database
      src/
      tests/
      (isolated full working directory)
    {proposal-hash-2}/
      .git → symlink to main repo .git database
      (another independent working directory)
```

**Lifecycle**:

1. **Create** (`zeno proposal start <hash>`, MCP: `proposal_start`): Create worktree, return path to agent
2. **Develop** (Agent): Work in isolated directory, no branch switching
3. **Validate** (Agent): Run `zeno proposal validate` in worktree; returns quality check results
4. **Approve** (Human): Review consolidated PRs from all proposals
5. **Merge** (Orchestrator, MCP: `worktree_merge`): `zeno proposal approve` triggers merge, orchestrator handles rebase/conflict resolution
6. **Cleanup** (Auto, MCP: `worktree_prune`, `worktree_remove`): Delete worktree after merge; if approval rejected, mark worktree for cleanup but preserve for rework

**Conflict Detection and Prevention**:

- Orchestrator pre-analyzes proposal dependency graph to identify which proposals modify same files
- Conflict detection: If parallel proposals affect same files, serialize (enforce sequential merge order)
- Conflict resolution: Smart rebase strategy for dependent proposals; human intervention if complex merges
- Worktree pruning: `zeno worktree prune` removes orphaned worktrees; periodic auto-pruning prevents disk bloat

**MCP Tools Implemented**:

- `worktree_list`: List active/orphaned worktrees with disk usage tracking
- `worktree_prune`: Remove expired or orphaned worktrees with optional dry-run
- `worktree_remove`: Manually delete specific worktree with force option
- `worktree_merge`: Merge worktree branch to main with conflict detection
- `proposal_start` (enhanced): Create worktree on proposal start
- `proposal_approve` (enhanced): Merge worktree branch on approval

**Integration Points**:

- Gate 5 (Multi-Repo): Worktrees support multi-repo scenarios (one worktree per repo + proposal)
- Gate 9 (Git Integration): Worktree creation/deletion, merge automation, conflict detection
- Gate 10 (Git Integration): Worktree creation/deletion, merge automation, conflict detection
- Post-MVP (Subagent Orchestration): Allocate worktrees per independent proposal/gate; orchestrator manages lifecycle

**Impact**:

- Reduces gate completion time by 40-60% through parallelization (agents no longer wait for peer merges)
- Eliminates branch switching overhead (~5-10s per switch per agent)
- Prevents serialization points: all independent proposals work in parallel
- Improves code quality: each agent has full isolated build/test environment

**Alternatives Considered**: Single shared worktree with branch switching, separate clones (disk intensive), monolithic agent execution (sequential only)
**Rationale**: Git worktrees provide isolated filesystem state while maintaining single `.git` database, enabling minimal disk overhead. Each proposal/gate gets dedicated worktree with its own branch. Orchestrator creates/manages worktrees and coordinates merge ordering to prevent conflicts. Auto-cleanup prevents orphaned worktrees.
**Trade-offs**: Gained true parallelization and isolated development; added disk space overhead (partial clones per worktree), added complexity to orchestrator merge coordination, requires robust cleanup strategy. Mitigation: auto-cleanup on approval, periodic pruning, disk space monitoring, `zeno worktree` commands for manual management.

## Architecture Principles

1. **Lightweight**: No heavy frameworks, minimal dependencies. Keep the tool fast and portable.
2. **LLM-Driven Execution**: All Zeno operations are invoked by AI agents during workflow execution. The CLI serves as the interface through which LLMs call functions, not as a human-facing command line tool. Humans interact by providing prompts and approvals; LLMs execute the actual commands.
3. **Human-in-the-Loop**: Approval gates at key decision points. Human judgment validates AI decisions. Humans approve/reject; LLMs execute.
4. **Quality-First**: Automated checks before human review. Catch issues early, enforce standards consistently.
5. **Minimalist Storage**: Database only for requirements and repositories (queryable hierarchy + multi-repo support). Project metadata in `project-overview.json`, proposals as Markdown files, state history in Git. No scope creep—database tracks what matters.
6. **AI-Contextual**: Generate AGENTS.md to guide AI assistants on artifact interpretation and project conventions.
7. **Hash-Based References**: Reduce LLM context size by 50%+ through content-addressable storage.
8. **Parallel-First**: Use git worktrees to enable 4+ independent agents to work simultaneously on non-dependent proposals and gates. Orchestrator manages merge ordering and conflict resolution.

### LLM-Driven Execution Model

Zeno is designed for AI agents to invoke all operations during workflow execution. The "CLI commands" are functions that LLMs call, not commands humans type.

**Execution Flow:**

1. Human provides a prompt or instruction to the LLM
2. LLM reads Zeno artifacts (AGENTS.md, gate PRDs, proposals)
3. LLM invokes Zeno functions to query state, update status, and validate work
4. Human approves/rejects at designated approval gates
5. LLM continues execution based on human decision

**LLM-Invoked Functions:**

| Category     | Function                             | Status Transition        | When LLM Invokes             |
| ------------ | ------------------------------------ | ------------------------ | ---------------------------- |
| Gates        | `zeno gates start <id>`              | validated -> in_progress | Starting work on a gate      |
| Gates        | `zeno gates complete <id>`           | in_progress -> completed | All gate requirements tested |
| Requirements | `zeno req status <hash> implemented` | pending -> implemented   | Code written for requirement |
| Requirements | `zeno req status <hash> tested`      | implemented -> tested    | Tests pass for requirement   |
| Proposals    | `zeno proposal start <hash>`         | validated -> in_progress | Beginning implementation     |
| Proposals    | `zeno proposal validate <hash>`      | (runs checks)            | Before requesting approval   |
| Proposals    | `zeno proposal approve <hash>`       | in_progress -> completed | Human approved (LLM records) |
| Proposals    | `zeno proposal reject <hash>`        | -> rejected              | Human rejected (LLM records) |

**Human-Only Actions:**

- Provide initial project description and end state
- Review and approve/reject gate generation
- Review and approve/reject proposals
- Confirm gate completion
- Provide feedback on rejections

**LLM Responsibilities:**

- Invoke all Zeno functions to manage workflow state
- Update entity statuses as work progresses
- Run validation before requesting human approval
- Handle replan on rejection with error context
- Create subagents using Cursor workflows for parallel task execution when gates contain multiple independent requirements or complex work items
- Coordinate subagent execution by delegating specific requirements or proposals to specialized agents
- Monitor subagent progress through Zeno status queries and consolidate results

**Subagent Orchestration with Git Worktrees:**

- Orchestrating agent analyzes proposal dependency graph to identify parallel work items
- Creates isolated git worktree for each independent proposal/gate (stored in `.local/worktrees/{hash}/`)
- Dispatches subagents with worktree path; each agent works in isolation without branch switching
- Subagents invoke Zeno functions independently to update status and validate work within their worktree
- Orchestrating agent coordinates merge ordering: non-dependent proposals merge in parallel, dependent proposals wait then rebase
- Conflict detection prevents parallel work on same files; orchestrator serializes conflicting proposals
- Subagents report completion through proposal validation and requirement status updates
- Human approval gates remain centralized - orchestrating agent requests approval after consolidating subagent work
- Worktrees auto-cleanup after merge; periodic pruning removes orphaned worktrees

### Hash-Based Dependency Tracking Example

Zeno tracks dependencies across multiple repositories using content-addressable hash references. Each module, requirement, and proposal is assigned a SHA-256 hash (first 16 characters) that serves as a stable reference regardless of file paths or locations.

**Example Multi-Repo Scenario:**

```text
Main Application Repo
├── AuthModule (#a3f9c2d1) → requires CoreLib (#b7e4d8f2)
├── APIModule (#c8d4e1f5) → requires CoreLib (#b7e4d8f2)
└── UIModule (#f2a7b3c9) → requires TypesLib (#c9a1e5b3)

Shared Library Repo
├── CoreLib (#b7e4d8f2) → requires UtilsLib (#d3f8c4a2)
├── UtilsLib (#d3f8c4a2)
└── TypesLib (#c9a1e5b3)

Service Repo A
└── UserService (#e5b9d7f1) → uses CoreLib (#b7e4d8f2)

Service Repo B
└── PaymentService (#f9c3a8d4) → uses CoreLib (#b7e4d8f2)
```

**How It Works:**

1. **Hash Registry**: Maps hashes to entities (modules, requirements, proposals)
2. **Dependency Graph**: Tracks relationships between hashes
3. **Conflict Detector**: Identifies when multiple proposals modify the same dependencies

**LLM Context Usage:**

Instead of: "Requirement at /path/to/long/repo/name/src/modules/auth/requirements.md depends on /path/to/another/repo/lib/core/index.ts"

Use: "Requirement #a3f9c2d1 depends on #b7e4d8f2"

This reduces context size by 50%+ while maintaining precise references. Requirements and repositories are queryable directly in the database by hash.

## Storage Architecture

### Database Schema (SQLite, 4 Core Tables - Minimalist Design)

**Final Schema (Post-Scope-Reduction Decision 4.1):**

| Table                 | Purpose                                                           | Fields                                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **requirements**      | Hierarchical requirements and project specifications              | `id`, `parent_id`, `type` (functional/non_functional/constraint), `priority`, `description`, `acceptance_criteria`, `hash`, `created_at`                                                                  |
| **repositories**      | Multi-repository support for distributed systems                  | `id`, `name`, `path`, `type` (main/service/library/tool), `hash`, `metadata`, `created_at`                                                                                                                |
| **proposals**         | Proposal metadata with hash-based lookup (operational efficiency) | `id`, `gate_id`, `title`, `status`, `hash`, `created_at`, `updated_at`, `approved_at`                                                                                                                     |
| **metrics_snapshots** | Lightweight aggregate metrics at gate archive time                | `gate_id`, `file_count`, `total_loc`, `code_lines`, `blank_lines`, `comment_lines`, `avg_instability`, `high_coupling_count`, `max_complexity`, `graph_nodes`, `graph_edges`, `cycle_count`, `created_at` |

**NOT IN DATABASE (File-Based, Version-Controlled per Technical Decision 4):**

- **gates**: Stored in `project-overview.json` (single source of truth for project state)
- **proposal_dependencies**: Derived from proposal references, no separate source of truth (per minimalist principle)

**Key Design Decisions:**

- No `status` field on requirements—presence in database = approved
- Unified requirements format for traditional requirements and specs (OpenAPI, GraphQL, Protobuf, etc.)
- Proposals table justified by frequent hash-based lookups in operational commands (`start`, `validate`, `approve`)
- Gates remain in `project-overview.json` to preserve version-controlled, human-readable single source of truth
- Dependencies are implicit in proposal references; no separate tracking table needed
- `metrics_snapshots` provides lightweight historical baseline at gate completion (useful for trend analysis)

### File Storage

| Location                           | Content                                            | Format          | Rationale                                                    |
| ---------------------------------- | -------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| `project-overview.json`            | Project metadata, gates, completion status         | JSON            | Single source of truth for project state, version-controlled |
| `.zeno/gates/gate-XX-name.md`      | Gate PRDs, objectives, requirements breakdown      | Markdown        | Human-readable gate specifications                           |
| `zeno/proposals/gate-XX/<name>.md` | Implementation proposals                           | Markdown        | Human-readable change documentation                          |
| `zeno/gates/archive/<gate-id>.md`  | Completed gates with integrated proposal summaries | Markdown        | Long-term historical record with gate-level traceability     |
| `zeno/architecture/*.md`           | Architecture diagrams and design docs              | Mermaid/DOT/SVG | Visual system design and relationships                       |
| `.zeno/config.json`                | Configuration settings                             | JSON            | Project-specific configuration                               |

### State History & Audit Trail

**Method**: Git commit history + structured commit messages

- Proposal approval/rejection: Tracked via Git commits with proposal hash in message
- Requirement implementation: Tracked via proposal commit and requirement hash reference
- Architecture changes: Committed with rationale in message
- Gate completion: Tracked via Git tag (e.g., `gate-03-requirements-database-layer`)

**Advantages**:

- Version control provides immutable audit trail
- Human-readable diffs show what changed and why
- No separate audit table to maintain
- Works across distributed teams

## Project Dependencies

### External Dependencies

- **Node.js >= 24.0.0** - Runtime environment
- **better-sqlite3** - SQLite database operations (native bindings)
- **commander** - CLI framework for command parsing
- **inquirer/prompts** - Interactive terminal prompts
- **chalk** - Terminal color output
- **ora** - Terminal spinners and progress indicators
- **zod** - Runtime schema validation
- **typescript** - Type-safe development
- **@typescript-eslint** - Linting and code quality
- **vitest** - Testing framework
- **simple-git** - Git operations wrapper
- **glob** - File pattern matching
- **js-yaml** - YAML parsing for configuration
- **@babel/parser** - JavaScript/TypeScript AST parsing
- **@babel/traverse** - AST traversal for code analysis
- **typescript-compiler-api** - TypeScript AST analysis
- **dependency-cruiser** - Dependency graph generation
- **c8** - Code coverage reporting
- **eslint** - Linting engine
- **prettier** - Code formatting
- **graphviz** - DOT diagram rendering to PNG/SVG for complex architecture models\n- **git** - Worktree management for isolated parallel development

### Internal Dependencies

- **zeno-engine** - Core gate generation algorithm for iterative decomposition
- **code-analyzer** - Deep codebase analysis (AST, dependencies, metrics)
- **gate-manager** - Gate lifecycle management and state tracking
- **requirement-generator** - Requirement decomposition from gates
- **diagram-generator** - Hybrid architecture diagram generation (Mermaid for simple, DOT for complex)
- **mermaid-generator** - Mermaid diagram generation for ≤5 element models
- **dot-generator** - DOT diagram generation and rendering for >5 element models
- **agents-generator** - AGENTS.md generation for AI context
- **repo-detector** - Multi-repository boundary detection
- **dependency-tracker** - Hash-based dependency tracking system
- **proposal-generator** - Change proposal generation
- **validation-engine** - Automated quality checks (coverage, security, linting)
- **replan-engine** - Rescope and gate regeneration logic
- **hash-registry** - Content-addressable storage system
- **git-integration** - Git hooks, commit automation, and worktree management
- **worktree-orchestrator** - Git worktree lifecycle (create, merge, cleanup) and conflict detection
- **subagent-orchestrator** - Subagent creation and coordination via Cursor workflows with worktree-based parallelization (post-MVP)

### Infrastructure Requirements

- **SQLite 3.x** - Requirements database (no server required)
- **Git 2.x** - Version control integration
- **Node.js native modules** - For better-sqlite3 compilation
- **File system access** - Read/write for project artifacts
- **Terminal emulator** - ANSI color support recommended
- **LLM access** - User-provided (Cursor, Claude, GPT-4, etc.)

## User Stories

### Primary Users

#### As a solo developer working on a large project

- I want to describe my end goal and have Zeno generate a roadmap so that I don't get overwhelmed by scope
- I want automated quality checks before commits so that I maintain high code quality without manual verification
- I want to track dependencies across modules so that I avoid breaking changes
- I want to rescope my project mid-development so that I can adapt to changing requirements

#### As a tech lead managing multiple repositories

- I want automatic repository boundary detection so that I can maintain proper separation of concerns
- I want dependency graphs across repos so that I can visualize system architecture
- I want hash-based references so that my LLM can navigate large codebases efficiently
- I want gate-based releases so that I can coordinate deployments across services

#### As an AI coding assistant (LLM)

- I want to invoke Zeno functions during workflow execution so that I can manage gates, requirements, and proposals programmatically
- I want structured requirements with hashes so that I can reference specific items without full file paths
- I want dependency information so that I can avoid conflicts when generating code
- I want clear acceptance criteria so that I know when my implementation is complete
- I want automated validation so that I can iterate quickly without human intervention for every change
- I want an AGENTS.md file that explains how to read project artifacts so that I can understand the codebase structure and documentation conventions
- I want to update entity statuses (gates, requirements, proposals) as I progress through implementation so that project state remains accurate
- I want to create subagents using Cursor workflows so that I can parallelize work across multiple independent requirements or complex gate components
- I want to coordinate subagent execution through Zeno state tracking so that parallel work remains synchronized and conflicts are avoided
- **I want isolated git worktrees for each independent proposal so that I can work without branch switching delays and merge conflicts**
- **I want the orchestrator to manage merge ordering and conflict detection so that I can focus on implementation while safety is automated**

#### As a project stakeholder

- I want visual architecture diagrams so that I can understand system design
- I want gate-based progress tracking so that I can see project status at a glance
- I want human approval gates so that I maintain control over major decisions
- I want PRDs for each gate so that I can review planned features before implementation

### Edge Cases & Secondary Scenarios

- **Existing codebase with poor architecture**: Code analyzer detects issues, generates refactoring gates before feature gates
- **Mid-project scope change**: Rescope engine regenerates future gates from current position, inserts rescope gate for documentation
- **LLM hallucination in generated code**: Automated checks fail, proposal rejected, replan triggered with error context
- **Dependency conflict across repos**: Hash-based tracking detects conflict, blocks proposal, suggests resolution
- **Gate rejection after partial implementation**: Rollback mechanism reverts changes, preserves learnings in rejected proposal
- **Multiple developers working on same gate**: Dependency tracking prevents file conflicts, serializes proposals
- **Very large monorepo**: Repo detector suggests split, generates migration plan as separate gate
- **Security vulnerability introduced**: Security checks (threshold: 0 vulnerabilities) block commit, require fix
- **Code coverage drops below 90%**: Coverage check fails, proposal rejected, test generation suggested
- **Circular dependencies detected**: Dependency graph analysis flags issue, suggests architectural refactoring

## Timeline (Order of Operations)

### Archived Gates (Completed)

Gates 1-4 have been completed and archived. These foundational gates established:

- Gate 1: Core Infrastructure (TypeScript, CLI, SQLite, utilities)
- Gate 2: Zeno Engine & Gate Generation (gate generation algorithm, requirements, analysis, LLM integration)
- Gate 3: Requirements & Database Layer (requirement storage, SQLite CRUD, hash registry)
- Gate 4: Architecture & Mermaid Generation (diagram generation base)

MPC Server integration (formerly Gate 2.5) is now part of ongoing Gates 5-12 implementation.

### Active MVP Gates (07-14)

### Gate 07: Gate 07: Proposal Generation & Management

[ ] Implementation in progress...

### Gate 08: Gate 08: Automated Validation & Quality Gates

[ ] Implementation in progress...

### Gate 09: Gate 09: Human Approval & Rejection Workflow

[ ] Implementation in progress...

### Gate 10: Gate 10: Git Integration & Commit Automation

[ ] Implementation in progress...

### Gate 11: Gate 11: Rescope & Replan Engine

[ ] Implementation in progress...

### Gate 12: Gate 12: Dashboard & Visualization

[ ] Implementation in progress...

### Gate 13: Gate 13: Subagent Orchestration & Parallel Execution

[ ] Implementation in progress...

### Gate 14: Gate 14: Documentation & Polish

[ ] Implementation in progress...

### Archived Gates (Completed)

Gates 1-4 have been completed and archived. These foundational gates established:

- Gate 01: Gate 01: Core Infrastructure
- Gate 02: Gate 02: Zeno Engine & Gate Generation
- Gate 03: Gate 03: MCP Server & LLM Tool Integration
- Gate 04: Gate 04: Requirements & Database Layer
- Gate 05: Gate 05: Architecture & Diagram Generation
- Gate 06: Gate 06: Multi-Repo & Subproject Detection
