# Zeno's Planner

## Overview
Zeno's Planner is a lightweight, LLM-friendly project planning and orchestration tool that enhances human "vibe coding" by maintaining long-term project memory, reducing context size, and ensuring consistency from vision through implementation. Conceptually inspired by Zeno's dichotomy paradox, the tool generates iterative gates (milestones) that progressively approach project completion, with each gate requiring human approval and automated quality checks.

The tool bridges the gap between high-level project vision and detailed implementation by decomposing projects into: Gates → Architecture → Requirements → Subprojects → Proposals, with comprehensive dependency tracking and multi-repository support for large-scale solutions.

## Key Technical Decisions

### 1. Technology Stack
- **Choice**: TypeScript (strict mode), Node.js >= 24.0.0, SQLite (better-sqlite3), Mermaid, Commander.js, Zod, Vitest
- **Alternatives Considered**: JavaScript (no types), PostgreSQL (client-server), Draw.io (binary diagrams), Yargs (CLI), Joi (validation), Jest (testing)
- **Rationale**: Lightweight, LLM-friendly, cross-platform, rich ecosystem. TypeScript provides type safety without runtime overhead. SQLite requires no server setup. Mermaid diagrams are text-based and version-controllable.
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

### 4. Hybrid Storage
- **Choice**: SQLite for requirements, gates, proposals, dependencies (queryable); Files for architecture diagrams, PRDs, proposals (human-readable)
- **Alternatives Considered**: Pure database (PostgreSQL), pure files (JSON/YAML), Git-based storage only
- **Rationale**: Best of both worlds - structured queries for complex relationships + version control for human artifacts. SQLite is serverless and portable. Architecture diagrams generated selectively based on target project needs rather than all-at-once.
- **Trade-offs**: Gained query performance and human readability; added complexity of maintaining two storage systems.

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

### 11. Subagent Orchestration via Cursor Workflows
- **Choice**: Zeno orchestrates work by creating subagents using Cursor's workflow capabilities, enabling parallel task execution and specialized agent delegation
- **Alternatives Considered**: Single-agent execution only, manual subagent creation, external orchestration tools
- **Rationale**: Large gates and complex requirements benefit from parallel execution across specialized subagents. Cursor workflows provide native integration for spawning focused agents that handle specific tasks (e.g., one agent for tests, another for implementation, another for documentation). This enables true parallelization of gate work while maintaining coordination through Zeno's state tracking. Subagents report back to the orchestrating agent through Zeno status updates and proposal validation.
- **Trade-offs**: Gained parallel execution and specialization; added complexity in coordination and state synchronization between orchestrator and subagents.

## Architecture Principles
1. **Lightweight**: No heavy frameworks, minimal dependencies. Keep the tool fast and portable.
2. **LLM-Driven Execution**: All Zeno operations are invoked by AI agents during workflow execution. The CLI serves as the interface through which LLMs call functions, not as a human-facing command line tool. Humans interact by providing prompts and approvals; LLMs execute the actual commands.
3. **Human-in-the-Loop**: Approval gates at key decision points. Human judgment validates AI decisions. Humans approve/reject; LLMs execute.
4. **Quality-First**: Automated checks before human review. Catch issues early, enforce standards consistently.
5. **File + Database Hybrid**: SQLite for queries, files for artifacts. Balance queryability with version control.
6. **AI-Contextual**: Generate AGENTS.md to guide AI assistants on artifact interpretation and project conventions.
7. **Hash-Based References**: Reduce LLM context size by 50%+ through content-addressable storage.

### LLM-Driven Execution Model

Zeno is designed for AI agents to invoke all operations during workflow execution. The "CLI commands" are functions that LLMs call, not commands humans type.

**Execution Flow:**
1. Human provides a prompt or instruction to the LLM
2. LLM reads Zeno artifacts (AGENTS.md, gate PRDs, proposals)
3. LLM invokes Zeno functions to query state, update status, and validate work
4. Human approves/rejects at designated approval gates
5. LLM continues execution based on human decision

**LLM-Invoked Functions:**

| Category | Function | Status Transition | When LLM Invokes |
|----------|----------|-------------------|------------------|
| Gates | `zeno gates start <id>` | pending -> in_progress | Starting work on a gate |
| Gates | `zeno gates complete <id>` | in_progress -> completed | All gate requirements tested |
| Requirements | `zeno req status <hash> implemented` | pending -> implemented | Code written for requirement |
| Requirements | `zeno req status <hash> tested` | implemented -> tested | Tests pass for requirement |
| Proposals | `zeno proposal start <hash>` | pending -> in_progress | Beginning implementation |
| Proposals | `zeno proposal validate <hash>` | (runs checks) | Before requesting approval |
| Proposals | `zeno proposal approve <hash>` | in_progress -> completed | Human approved (LLM records) |
| Proposals | `zeno proposal reject <hash>` | -> rejected | Human rejected (LLM records) |

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

**Subagent Orchestration:**
- Orchestrating agent creates subagents via Cursor workflow capabilities for parallel execution
- Subagents receive focused tasks (specific requirements, proposals, or gate components)
- Subagents invoke Zeno functions independently to update status and validate work
- Orchestrating agent coordinates by querying Zeno state and consolidating subagent outputs
- Subagents report completion through proposal validation and requirement status updates
- Human approval gates remain centralized - orchestrating agent requests approval after consolidating subagent work

### Hash-Based Dependency Tracking Example

Zeno tracks dependencies across multiple repositories using content-addressable hash references. Each module, requirement, and proposal is assigned a SHA-256 hash (first 16 characters) that serves as a stable reference regardless of file paths or locations.

**Example Multi-Repo Scenario:**

```
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

This reduces context size by 50%+ while maintaining precise references. The Hash Registry resolves these references when needed for actual file operations.

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

### Internal Dependencies
- **zeno-engine** - Core gate generation algorithm for iterative decomposition
- **code-analyzer** - Deep codebase analysis (AST, dependencies, metrics)
- **gate-manager** - Gate lifecycle management and state tracking
- **requirement-generator** - Requirement decomposition from gates
- **mermaid-generator** - Architecture diagram generation with intelligent template selection
- **agents-generator** - AGENTS.md generation for AI context
- **repo-detector** - Multi-repository boundary detection
- **dependency-tracker** - Hash-based dependency tracking system
- **proposal-generator** - Change proposal generation
- **validation-engine** - Automated quality checks (coverage, security, linting)
- **replan-engine** - Rescope and gate regeneration logic
- **hash-registry** - Content-addressable storage system
- **git-integration** - Git hooks and commit automation
- **subagent-orchestrator** - Subagent creation and coordination via Cursor workflows for parallel task execution

### Infrastructure Requirements
- **SQLite 3.x** - Requirements database (no server required)
- **Git 2.x** - Version control integration
- **Node.js native modules** - For better-sqlite3 compilation
- **File system access** - Read/write for project artifacts
- **Terminal emulator** - ANSI color support recommended
- **LLM access** - User-provided (Cursor, Claude, GPT-4, etc.)

## User Stories

### Primary Users

**As a solo developer working on a large project**
- I want to describe my end goal and have Zeno generate a roadmap so that I don't get overwhelmed by scope
- I want automated quality checks before commits so that I maintain high code quality without manual verification
- I want to track dependencies across modules so that I avoid breaking changes
- I want to rescope my project mid-development so that I can adapt to changing requirements

**As a tech lead managing multiple repositories**
- I want automatic repository boundary detection so that I can maintain proper separation of concerns
- I want dependency graphs across repos so that I can visualize system architecture
- I want hash-based references so that my LLM can navigate large codebases efficiently
- I want gate-based releases so that I can coordinate deployments across services

**As an AI coding assistant (LLM)**
- I want to invoke Zeno functions during workflow execution so that I can manage gates, requirements, and proposals programmatically
- I want structured requirements with hashes so that I can reference specific items without full file paths
- I want dependency information so that I can avoid conflicts when generating code
- I want clear acceptance criteria so that I know when my implementation is complete
- I want automated validation so that I can iterate quickly without human intervention for every change
- I want an AGENTS.md file that explains how to read project artifacts so that I can understand the codebase structure and documentation conventions
- I want to update entity statuses (gates, requirements, proposals) as I progress through implementation so that project state remains accurate
- I want to create subagents using Cursor workflows so that I can parallelize work across multiple independent requirements or complex gate components
- I want to coordinate subagent execution through Zeno state tracking so that parallel work remains synchronized and conflicts are avoided

**As a project stakeholder**
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

### Gate 1: Core Infrastructure
- [ ] Set up TypeScript project with strict mode
- [ ] Implement CLI framework with Commander
- [ ] Design and create SQLite schema with migrations
- [ ] Implement file system utilities (read/write/ensure directories)
- [ ] Create hash utilities (SHA-256, short hash, content-addressable)
- [ ] Implement basic configuration management (zeno/.zeno/config.json)
- [ ] Set up git integration utilities (simple-git wrapper)
- [ ] Create project structure scaffolding
- [ ] Implement logging and error handling
- [ ] Write unit tests for utilities

### Gate 2: Zeno Engine & Gate Generation
- [ ] Implement iterative gate generation algorithm (decompose until end state reached)
- [ ] Generate project-level requirements during init (cross-cutting concerns from end state)
- [ ] Create gate template system with optional sections
- [ ] Build LLM integration layer (command-based, no API keys)
- [ ] Implement code analyzer for existing codebases (AST parsing)
- [ ] Create dependency graph generator for existing code
- [ ] Build code metrics calculator (coupling, cohesion, complexity)
- [ ] Implement `zeno init` command with interactive prompts
- [ ] Implement `zeno analyze` command for deep codebase analysis
- [ ] Implement `zeno gates list` command
- [ ] Implement `zeno gates show <gate-id>` command
- [ ] Implement `zeno gates start <gate-id>` command (generates gate-specific requirements, sets status to in_progress)
- [ ] Implement `zeno gates complete <gate-id>` command (sets status to completed, creates git tag)
- [ ] Create gate confidence scoring system
- [ ] Generate initial AGENTS.md for tool usage
- [ ] Write integration tests for gate generation

### Gate 3: Requirements & Database Layer
- [ ] Implement gate-specific requirement generation (decompose project requirements + gate objectives)
- [ ] Create requirement decomposition algorithm (gate → requirements tree)
- [ ] Support requirement inheritance from project-level and other gates
- [ ] Support requirement transfer between gates (for rescope scenarios)
- [ ] Build SQLite CRUD operations with better-sqlite3
- [ ] Implement hash registry for content-addressable storage
- [ ] Create dependency tracking system with confidence scores
- [ ] Implement `zeno req list` command with filtering (--gate, --project flags)
- [ ] Implement `zeno req show <hash>` command
- [ ] Implement `zeno req deps <hash>` command for dependency visualization
- [ ] Implement `zeno req status <hash> <status>` command (sets status: pending/implemented/tested)
- [ ] Build PRD generator from template
- [ ] Create requirement validation rules
- [ ] Write tests for requirement generation and storage

### Gate 4: Architecture & Mermaid Generation
- [ ] Implement Mermaid diagram generator base class
- [ ] Create system architecture diagram generator (always generated)
- [ ] Create data flow diagram generator (always generated)
- [ ] Create gate lifecycle diagram generator (always generated)
- [ ] Create gate roadmap diagram generator (always generated)
- [ ] Create context diagram generator (always generated)
- [ ] Create sequence diagram generator (generated when complex workflows detected)
- [ ] Create component diagram generator (generated when complex modules detected)
- [ ] Create package diagram generator (generated when code organization needs documentation)
- [ ] Create deployment diagram generator (generated for deployment gates)
- [ ] Create network diagram generator (generated when network complexity detected)
- [ ] Implement diagram selection logic based on project type and gate requirements
- [ ] Build dependency graph visualizer (repos and modules)
- [ ] Implement `zeno arch generate` command with smart template selection
- [ ] Implement `zeno arch show <type>` command
- [ ] Create architecture artifact storage
- [ ] Add architecture versioning (per gate)
- [ ] Write tests for diagram generation

### Gate 5: Multi-Repo & Subproject Detection
- [ ] Implement repository boundary detection algorithm
- [ ] Create coupling metrics calculator
- [ ] Build domain boundary analyzer
- [ ] Implement module size analyzer
- [ ] Create repo scaffolding system (package.json, tsconfig, etc.)
- [ ] Build dependency graph across repos
- [ ] Implement `zeno repos list` command
- [ ] Implement `zeno repos deps` command with visualization
- [ ] Create repo confidence scoring
- [ ] Add repo split approval workflow
- [ ] Implement cross-repo dependency tracking
- [ ] Write tests for repo detection

### Gate 6: Proposal Generation & Management
- [ ] Create proposal template system
- [ ] Implement proposal generator from requirements
- [ ] Build change notice format (expands on spec-driven development concepts)
- [ ] Implement `zeno proposal list` command with filtering
- [ ] Implement `zeno proposal show <hash>` command
- [ ] Implement `zeno proposal start <hash>` command (sets status to in_progress)
- [ ] Create proposal storage and versioning
- [ ] Build proposal-to-code mapping
- [ ] Implement proposal dependency tracking
- [ ] Add proposal status management
- [ ] Write tests for proposal generation

### Gate 7: Automated Validation & Quality Gates
- [ ] Implement linting check integration (ESLint)
- [ ] Implement type checking integration (TypeScript compiler API)
- [ ] Implement test runner integration (Vitest)
- [ ] Implement code coverage checker (c8, threshold: 90%)
- [ ] Implement security vulnerability scanner (threshold: 0)
- [ ] Calculate linting error rate (threshold: 0.01%)
- [ ] Implement dependency conflict detector
- [ ] Build automated check orchestrator
- [ ] Implement `zeno proposal validate <hash>` command
- [ ] Create validation report generator
- [ ] Add validation result storage
- [ ] Write tests for all validators

### Gate 8: Human Approval & Rejection Workflow
- [ ] Implement human approval prompt system
- [ ] Create approval status tracking
- [ ] Build rejection feedback collection
- [ ] Implement replan engine for rejected proposals
- [ ] Create replan with context (error messages, feedback)
- [ ] Implement `zeno proposal approve <hash>` command
- [ ] Implement `zeno proposal reject <hash>` command
- [ ] Build approval audit trail
- [ ] Add approval notifications
- [ ] Write tests for approval workflow

### Gate 9: Git Integration & Commit Automation
- [ ] Implement pre-commit hook installer
- [ ] Create commit message generator (structured format)
- [ ] Build auto-commit on proposal approval
- [ ] Implement gate release tagging
- [ ] Create branch management for proposals
- [ ] Add rollback mechanism for rejected proposals
- [ ] Implement commit validation (check pending approvals)
- [ ] Build git status integration with Zeno status
- [ ] Write tests for git operations

### Gate 10: Rescope & Replan Engine
- [ ] Implement rescope detection (end state change)
- [ ] Create rescope gate generator (documents the change)
- [ ] Build future gate regeneration from current position
- [ ] Implement gate deletion for obsolete future gates
- [ ] Create rescope approval workflow
- [ ] Implement `zeno rescope` command
- [ ] Build rescope impact analysis
- [ ] Add rescope history tracking
- [ ] Write tests for rescope logic

### Gate 11: Dashboard & Visualization
- [ ] Implement `zeno status` command (project overview)
- [ ] Create `zeno dashboard` TUI with ink or blessed
- [ ] Build gate progress visualization
- [ ] Create requirement tree visualization
- [ ] Implement proposal status board
- [ ] Add dependency graph viewer
- [ ] Create interactive navigation
- [ ] Build real-time status updates
- [ ] Write tests for dashboard

### Gate 12: Documentation & Polish
- [ ] Write comprehensive README with examples
- [ ] Create CLI command reference documentation
- [ ] Write architecture documentation
- [ ] Polish and finalize AGENTS.md (tool usage guide with complete examples)
- [ ] Create tutorial for greenfield projects
- [ ] Create tutorial for existing codebases
- [ ] Build example projects (small, medium, large)
- [ ] Create troubleshooting guide
- [ ] Write contribution guidelines
- [ ] Add inline code documentation
- [ ] Create video walkthrough (optional)

_Gates are ordered sequentially. Each gate represents an actionable milestone that feeds into more detailed gate-level PRDs._

## Open Questions

### Technical Decisions
- [ ] Should we support multiple LLM providers simultaneously (e.g., Claude for architecture, GPT-4 for code)?
- [ ] How should we handle very large codebases (>1M LOC) during initial analysis?
- [ ] Should we implement incremental analysis or always full re-analysis?
- [ ] What's the strategy for handling non-TypeScript/JavaScript codebases?
- [ ] Should we support custom quality gate thresholds per project?
- [ ] How do we handle monorepo tools (Turborepo, Nx) in repo detection?
- [ ] Should we implement a plugin system for custom analyzers?
- [ ] How does Zeno expand beyond traditional spec systems for comprehensive project management?

### Product Decisions
- [ ] Should gates be editable after generation, or regenerate-only?
- [ ] How verbose should progress reporting be (minimal, normal, verbose modes)?
- [ ] Should we support team collaboration (multiple users approving)?
- [ ] What's the UX for long-running operations?
- [ ] Should we implement a web UI in addition to CLI/TUI?
- [ ] How do we handle projects with mixed languages/frameworks?
- [ ] Should we support exporting to project management tools (Jira, Linear)?
- [ ] What's the onboarding experience for new users?

### Blockers & Dependencies
- [ ] Need to validate better-sqlite3 works on all target platforms (Windows, Mac, Linux)
- [ ] Need to confirm LLM command execution works in Cursor terminal
- [ ] Need to test AST parsing performance on large codebases
- [ ] Need to validate Mermaid diagram size limits
- [ ] Need to confirm git hook compatibility across git versions
- [ ] Need to test SQLite performance with 10k+ requirements
- [ ] Need to validate cross-repo dependency tracking at scale
- [ ] Need to confirm no API keys required for all LLM integrations

### Concerns
- [ ] **LLM-generated timelines are inherently inaccurate**: LLMs cannot reliably estimate implementation time. Zeno addresses this by providing actionable milestones (gates) rather than timeline-based planning. Progress is measured by gate completion, not elapsed time.

## Risk Mitigation

### Technical Risks
1. **AST parsing performance on large codebases**
   - Impact: High
   - Probability: Medium
   - Mitigation: Implement incremental analysis (only parse changed files), cache AST results, use parallel processing across multiple cores
   - Fallback: Provide option to skip analysis entirely or analyze only specific directories

2. **SQLite scalability with 10k+ requirements**
   - Impact: Medium
   - Probability: Low
   - Mitigation: Optimize queries with proper indexes, benchmark early with large datasets, use prepared statements, implement query result caching
   - Fallback: Suggest project splitting into multiple Zeno projects, consider sharding by gate

3. **LLM hallucinations in gate generation**
   - Impact: High
   - Probability: Medium
   - Mitigation: Human approval required for all gates, implement confidence scoring for auto-detected boundaries, provide validation against end state
   - Fallback: Allow manual gate editing and regeneration, provide gate templates for common patterns

### Process Risks
1. **Scope creep**
   - Impact: Medium
   - Probability: High
   - Mitigation: Strict adherence to MVP scope document, defer all non-essential features to v2.0, regular scope review
   - Fallback: Cut non-essential features from MVP, push to future releases

2. **Timeline delays**
   - Impact: Medium
   - Probability: Medium
   - Mitigation: Focus on gate completion rather than time-based milestones, prioritize ruthlessly using MoSCoW method, track progress by gates completed
   - Fallback: Cut "Could have" features, extend scope with stakeholder approval, reduce scope of later gates

## Success Criteria

### Technical Metrics
- Successfully analyze an existing codebase of 100k+ LOC in under 5 minutes
- Maintain code coverage at 90%+ across all modules
- Zero security vulnerabilities in dependencies and production code
- Linting error rate below 0.01% (1 error per 10,000 lines)
- All tests passing with TypeScript strict mode enabled
- Rescope operation completes in under 30 seconds for typical projects

### Functional Metrics
- Generate meaningful gates with 80%+ user approval rate (measured via feedback)
- Automated checks catch 95%+ of issues before human review
- Dependency tracking prevents 100% of file conflicts in multi-repo scenarios
- PRD generation produces actionable documents 90%+ of the time
- Architecture diagrams accurately represent system design (validated by users)
- Hash-based references reduce LLM context size by 50%+ compared to full paths
- Gate completion time reduced by 30%+ compared to unstructured development

### User Experience Metrics
- Clear error messages for all failure cases (user comprehension validated)
- Responsive CLI with commands completing in <2 seconds
- Intuitive command structure (measured by time to first successful operation)
- Comprehensive help text and documentation
- Smooth onboarding experience (new user to first gate in <10 minutes)
- User reports improved project clarity and reduced scope creep (survey feedback)

## Requirements Database
SQLite database path for detailed requirements and specifications:
- Database: `zeno/.zeno/requirements.db`
- Query: `SELECT * FROM requirements WHERE project_id = '[project_id]'`
- Schema: See "Schema" section above for complete table definitions
- Indexes: Optimized for hash lookups, gate filtering, dependency traversal
- Migrations: Versioned schema migrations in `src/storage/migrations/`

## Architecture
Architecture documentation with embedded Mermaid diagrams generated based on target project needs:

**Core Diagrams (Generated for All Projects)**:
- System Overview: `zeno/architecture/system-overview.md` - Component relationships and module structure
- Data Flow: `zeno/architecture/data-flow.md` - End-to-end data processing paths
- Gate Roadmap Diagram: `zeno/architecture/gate-roadmap.md` - Gate roadmap with parallel relationships
- Gate Lifecycle: `zeno/architecture/gate-lifecycle.md` - State machine for gate workflow
- Context Diagram: `zeno/architecture/context.md` - System boundary and external dependencies

**Gate-Level Diagrams (Generated When Needed)**:
- Sequence Diagram: `zeno/architecture/sequence-[use-case].md` - Temporal interactions for complex workflows
- Component Diagram: `zeno/architecture/component-[name].md` - Detailed module structure for complex components
- Package Diagram: `zeno/architecture/packages.md` - Code organization and module dependencies

**Infrastructure Diagrams (Generated for Deployment Gates)**:
- Deployment Diagram: `zeno/architecture/deployment.md` - Runtime infrastructure and deployment architecture
- Network Diagram: `zeno/architecture/network.md` - Network topology and communication patterns (when applicable)

**Note**: Zeno intelligently selects which diagrams to generate based on:
- Target project type (CLI tool, web app, microservices, library)
- Gate requirements (feature gates vs. deployment gates)
- Complexity indicators (number of modules, external dependencies, infrastructure needs)
- User preferences (can request specific diagram types)

Each architecture document includes the diagram source, description, and related documentation. Edit the `.md` files directly to update diagrams and documentation together.

## Data Models

### Data Models

#### User
```
id: TEXT (UUID, primary key)
git_email: TEXT (unique, not null, from git config user.email)
git_name: TEXT (from git config user.name)
created_at: TIMESTAMP
last_seen_at: TIMESTAMP
```
**Rationale**: Normalizes user identity for StateHistory audit trails and Proposal approvals. Derived automatically from git configuration; no manual user management required. Single source of truth prevents inconsistencies like "alice@example.com" vs "Alice".

#### Project
```
id: TEXT (UUID, primary key)
name: TEXT (not null)
description: TEXT
start_state: TEXT (JSON, existing codebase analysis)
end_state: TEXT (not null, natural language goal)
current_gate_id: TEXT (foreign key to gates)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```
**Rationale**: Exactly one per Zeno-managed workspace. Stores session state (`current_gate_id`) and expensive-to-compute `start_state` analysis. Serves as the foreign key anchor for gates and repositories.

#### Gate
```
id: TEXT (UUID, primary key)
project_id: TEXT (foreign key, not null)
sequence: INTEGER (not null, 1-based)
name: TEXT (not null)
description: TEXT
status: ENUM('pending', 'in_progress', 'completed', 'rejected')
type: ENUM('feature', 'quality', 'rescope')
completion_description: TEXT (description of work completed at this gate)
proposal_hashes: JSON (array of proposal hash references, populated after proposal generation)
depends_on: JSON (array of gate IDs this gate depends on, enables parallel gate execution)
hash: TEXT (unique, SHA-256 first 16 chars)
created_at: TIMESTAMP
completed_at: TIMESTAMP
```
**Rationale**: Primary organizational unit for progress tracking. Sequential ordering via `sequence` with explicit dependency modeling via `depends_on` for parallel execution scenarios. `proposal_hashes` references proposals generated later in the workflow (not available at gate creation time).

**Note**: Quality thresholds are non-configurable in MVP (90% coverage, 0 security vulnerabilities, <0.01% lint error rate). These are enforced as constants, not stored per-gate.

#### Requirement
```
id: TEXT (UUID, primary key)
gate_id: TEXT (foreign key, nullable - null for project-level requirements)
parent_id: TEXT (foreign key, nullable, self-reference for hierarchical decomposition)
project_requirement_id: TEXT (foreign key, nullable, reference to parent project-level requirement)
type: ENUM('functional', 'non_functional', 'constraint')
priority: ENUM('must', 'should', 'could', 'wont')
level: ENUM('project', 'gate')
source: ENUM('generated', 'inherited', 'transferred')
description: TEXT (not null)
acceptance_criteria: TEXT
hash: TEXT (unique, content-addressable)
status: ENUM('pending', 'implemented', 'tested')
source_gate_id: TEXT (foreign key, nullable - original gate if transferred)
created_at: TIMESTAMP
```
**Rationale**: High volume (potentially hundreds per project). Self-referential `parent_id` creates tree structures within a gate. `project_requirement_id` links gate requirements to their parent project-level requirement. Hash-based lookups (`zeno req show #hash`) require indexed access. Primary driver for SQLite over flat files.

**Level Values**:
- `project`: High-level requirement generated during `zeno init`, may span multiple gates
- `gate`: Specific requirement generated during `zeno gates start`, belongs to one gate

**Source Values**:
- `generated`: Created fresh during init (project) or gates start (gate)
- `inherited`: Derived from a project-level requirement
- `transferred`: Moved from another gate (e.g., during rescope)

**Status Values**:
- `pending`: Initial state, awaiting implementation
- `implemented`: Code written for this requirement
- `tested`: Tests pass for this requirement

#### Artifact
```
id: TEXT (UUID, primary key)
gate_id: TEXT (foreign key, not null)
type: ENUM('prd', 'architecture', 'proposal', 'test', 'agents')
name: TEXT (not null)
path: TEXT (relative to project root, file location)
hash: TEXT (unique, content hash for change detection)
content: TEXT (short descriptor/summary, not file contents)
metadata: JSON (type-specific metadata)
created_at: TIMESTAMP
```
**Rationale**: Maps logical artifacts to physical file paths. `path` is the file system location; `content` is a brief description for quick reference without reading the file. Content hashing enables stale detection.

**Semantics**:
- `path`: Always populated. Relative path to the artifact file.
- `content`: Optional summary/descriptor (e.g., "System architecture showing 7 layers"). NOT the file contents.
- `hash`: SHA-256 of actual file contents for change detection.

#### Dependency
```
id: TEXT (UUID, primary key)
source_hash: TEXT (not null, indexed)
source_entity_type: ENUM('gate', 'requirement', 'proposal', 'artifact', 'repository')
target_hash: TEXT (not null, indexed)
target_entity_type: ENUM('gate', 'requirement', 'proposal', 'artifact', 'repository')
type: ENUM('requires', 'blocks', 'relates_to')
description: TEXT
confidence_score: REAL (0.0-1.0, for auto-detected deps)
created_at: TIMESTAMP
UNIQUE(source_hash, target_hash, type)
```
**Rationale**: Many-to-many relationships between any hashable entities. Entity type fields enable validation that dependencies are semantically valid (e.g., requirement depending on requirement, not proposal depending on gate incorrectly).

**Deletion Behavior**: When an entity is deleted, the system must reevaluate and rescope dependent entities. Dependencies exist to prevent capability loss; orphan dependencies trigger mandatory review.

#### Repository
```
id: TEXT (UUID, primary key)
project_id: TEXT (foreign key, not null)
name: TEXT (not null)
path: TEXT (relative to workspace root, not null)
type: ENUM('main', 'service', 'library', 'tool')
hash: TEXT (unique, repo identifier)
metadata: JSON (language, framework, size metrics)
created_at: TIMESTAMP
```
**Rationale**: Multi-repo project boundary tracking. Paths are always relative to workspace root to enable different developers to work on the same project without path collisions.

**Path Normalization**: All paths stored as relative. Absolute paths are converted at insertion time using the workspace root as reference.

#### RequirementRepository
```
id: TEXT (UUID, primary key)
requirement_id: TEXT (foreign key to requirements, not null)
repository_id: TEXT (foreign key to repositories, not null)
impact_type: ENUM('creates', 'modifies', 'depends_on')
created_at: TIMESTAMP
UNIQUE(requirement_id, repository_id, impact_type)
```
**Rationale**: Junction table mapping requirements to repositories for multi-repo projects. Answers "which requirements affect the auth-service repository?" and enables cross-repository impact analysis.

#### Proposal
```
id: TEXT (UUID, primary key)
gate_id: TEXT (foreign key, not null)
requirement_id: TEXT (foreign key, nullable)
title: TEXT (not null)
status: ENUM('pending', 'in_progress', 'completed', 'rejected')
check_results: JSON (detailed automated check results)
human_feedback: TEXT
approved_by: TEXT (foreign key to users, nullable)
hash: TEXT (unique, proposal content hash)
created_at: TIMESTAMP
approved_at: TIMESTAMP
implemented_at: TIMESTAMP
```
**Rationale**: Single status field tracks proposal lifecycle. `requirement_id` is optional because requirement verification primarily occurs at the gate level; proposals may address gate-level concerns without mapping to specific requirements.

**Status Values**:
- `pending`: Awaiting automated checks or human approval
- `in_progress`: Implementation underway
- `completed`: Approved and implemented
- `rejected`: Human rejected the proposal

#### HashRegistry
```
hash: TEXT (primary key, SHA-256 first 16 chars)
entity_type: ENUM('gate', 'requirement', 'proposal', 'artifact', 'repository', 'user')
entity_id: TEXT (UUID of actual entity)
content_preview: TEXT (first 200 chars for quick reference)
created_at: TIMESTAMP
```
**Rationale**: Central lookup table for O(1) hash resolution. When user references `#a3f9c2d1`, the system queries this table to determine entity type and ID, then retrieves the full entity. Prevents O(n) table scans across all entity tables.

#### StateHistory
```
id: TEXT (UUID, primary key)
entity_type: ENUM('project', 'gate', 'requirement', 'proposal', 'artifact', 'repository')
entity_id: TEXT (not null)
field_name: TEXT (not null)
old_value: TEXT (nullable, JSON-encoded for complex types)
new_value: TEXT (nullable, JSON-encoded for complex types)
changed_by: TEXT (foreign key to users, nullable for system changes)
change_source: ENUM('system', 'human', 'rescope', 'validation')
changed_at: TIMESTAMP (not null)
reason: TEXT (optional explanation)
```
**Rationale**: Audit trail for all entity state changes. Enables answering "what did this requirement look like before the rescope?" and debugging proposal rejections. `changed_by` references User table; null indicates system-initiated change.

### Indexes
```sql
-- Hash-based lookups (primary access pattern)
CREATE UNIQUE INDEX idx_hash_registry_hash ON hash_registry(hash);

-- Gate queries
CREATE INDEX idx_gates_project ON gates(project_id);
CREATE INDEX idx_gates_status ON gates(status);
CREATE INDEX idx_gates_hash ON gates(hash);

-- Requirement queries
CREATE INDEX idx_requirements_gate ON requirements(gate_id);
CREATE INDEX idx_requirements_hash ON requirements(hash);
CREATE INDEX idx_requirements_parent ON requirements(parent_id);
CREATE INDEX idx_requirements_project_req ON requirements(project_requirement_id);
CREATE INDEX idx_requirements_status ON requirements(status);
CREATE INDEX idx_requirements_level ON requirements(level);
CREATE INDEX idx_requirements_source ON requirements(source);

-- Note: Unified status vocabulary across entities
-- Gates: pending, in_progress, completed, rejected
-- Requirements: pending, implemented, tested
-- Proposals: pending, in_progress, completed, rejected

-- Dependency graph traversal
CREATE INDEX idx_dependencies_source ON dependencies(source_hash);
CREATE INDEX idx_dependencies_target ON dependencies(target_hash);
CREATE INDEX idx_dependencies_source_type ON dependencies(source_entity_type);
CREATE INDEX idx_dependencies_target_type ON dependencies(target_entity_type);

-- Proposal queries
CREATE INDEX idx_proposals_gate ON proposals(gate_id);
CREATE INDEX idx_proposals_requirement ON proposals(requirement_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_hash ON proposals(hash);

-- Artifact queries
CREATE INDEX idx_artifacts_gate ON artifacts(gate_id);
CREATE INDEX idx_artifacts_hash ON artifacts(hash);
CREATE INDEX idx_artifacts_type ON artifacts(type);

-- Repository queries
CREATE INDEX idx_repositories_project ON repositories(project_id);
CREATE INDEX idx_repositories_hash ON repositories(hash);

-- RequirementRepository junction
CREATE INDEX idx_req_repo_requirement ON requirement_repository(requirement_id);
CREATE INDEX idx_req_repo_repository ON requirement_repository(repository_id);

-- StateHistory audit queries
CREATE INDEX idx_state_history_entity ON state_history(entity_type, entity_id);
CREATE INDEX idx_state_history_changed_at ON state_history(changed_at);
CREATE INDEX idx_state_history_changed_by ON state_history(changed_by);

-- User lookups
CREATE UNIQUE INDEX idx_users_git_email ON users(git_email);
```

### Relationships
- User: Standalone identity table derived from git config
- Project -> Gates: one-to-many (project has multiple gates)
- Gate -> Gate: many-to-many via `depends_on` (parallel gate dependencies)
- Gate -> Requirements: one-to-many (gate decomposes into requirements)
- Requirement -> Requirements: one-to-many (parent-child hierarchy)
- Requirement -> Repositories: many-to-many via RequirementRepository (multi-repo impact)
- Gate -> Artifacts: one-to-many (gate produces multiple artifacts)
- Gate -> Proposals: one-to-many (gate contains multiple proposals)
- Requirement -> Proposals: one-to-many (requirement implemented via proposals, optional)
- Proposal -> User: many-to-one (approved_by reference)
- Dependency: many-to-many via hash references with entity type validation
- Project -> Repositories: one-to-many (project spans multiple repos)
- HashRegistry: central lookup table for all hashed entities
- StateHistory -> User: many-to-one (changed_by reference for audit trail)
- StateHistory: append-only audit log for all entity changes

### API Contracts (if applicable)
```
Command: zeno init
Input: Interactive prompts (name, end state, codebase path)
Output: {
  projectId: string,
  gates: Gate[],
  initialArchitecture: string (Mermaid),
  message: string
}

Command: zeno gates start <gate-id>
Input: { gateId: string }
Output: {
  architecture: string[] (Mermaid diagrams),
  requirements: Requirement[],
  repos: Repository[],
  proposals: Proposal[],
  status: string
}

Command: zeno proposal validate <hash>
Input: { proposalHash: string }
Output: {
  passed: boolean,
  checks: {
    coverage: { passed: boolean, value: number, threshold: 90 },
    security: { passed: boolean, vulnerabilities: number, threshold: 0 },
    linting: { passed: boolean, errorRate: number, threshold: 0.0001 },
    typeCheck: { passed: boolean, errors: string[] },
    tests: { passed: boolean, results: TestResult[] },
    dependencies: { passed: boolean, conflicts: Conflict[] }
  }
}

Command: zeno show <hash>
Input: { hash: string }
Output: {
  type: string,
  entity: Gate | Requirement | Proposal | Artifact,
  dependencies: Dependency[],
  content: string
}
```

## Out of Scope

### Explicitly NOT Included in MVP
- Web UI or graphical interface (CLI/TUI only)
- Real-time collaboration features (single-user focused)
- Cloud synchronization or hosted service
- Integration with project management tools (Jira, Linear, GitHub Projects) - stretch goal
- Support for non-git version control systems
- Built-in LLM API integration (user provides LLM via Cursor/Claude/etc.)
- Automatic code generation (LLM does this, Zeno orchestrates)
- Database migrations for production databases (only for requirements.db)
- Team permission and role management
- Billing or licensing system
- Mobile app or mobile-optimized interface

### Features Deferred to Future Iterations
- Plugin system for custom analyzers and validators
- Export to project management tools
- Web dashboard for visualization
- Team collaboration features
- Advanced analytics and reporting
- Machine learning for improved gate generation
- Integration with cloud IDEs beyond Cursor
- Support for non-JavaScript/TypeScript languages (Python, Rust, Go)
- Automated dependency updates
- Performance benchmarking integration
- A/B testing framework integration
- Deployment automation
- Infrastructure as code generation
- Performance profiling and optimization recommendations
- Automated refactoring suggestions
- Code review automation
- CI/CD pipeline generation (may add in future)
- Docker/container orchestration

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-04  
**Owner**: Zeno's Planner Development Team


