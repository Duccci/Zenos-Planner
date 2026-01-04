# Zeno's Planner

## Overview
Zeno's Planner is a lightweight, LLM-friendly project planning and orchestration tool that enhances human "vibe coding" by maintaining long-term project memory, reducing context size, and ensuring consistency from vision through implementation. Based on Zeno's dichotomy paradox, the tool generates iterative gates (milestones) that asymptotically approach project completion, with each gate requiring human approval and automated quality checks.

The tool bridges the gap between high-level project vision and detailed implementation by decomposing projects into: Gates → Architecture → Requirements → Subprojects → Proposals, with comprehensive dependency tracking and multi-repository support for large-scale solutions.

## Project Dependencies

### External Dependencies
- **Node.js >= 20.19.0** - Runtime environment
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
- **zeno-engine** - Core gate generation algorithm using Zeno's paradox
- **code-analyzer** - Deep codebase analysis (AST, dependencies, metrics)
- **gate-manager** - Gate lifecycle management and state tracking
- **requirement-generator** - Requirement decomposition from gates
- **mermaid-generator** - Architecture diagram generation
- **repo-detector** - Multi-repository boundary detection
- **dependency-tracker** - Hash-based dependency tracking system
- **proposal-generator** - Change proposal generation
- **validation-engine** - Automated quality checks (coverage, security, linting)
- **replan-engine** - Rescope and gate regeneration logic
- **hash-registry** - Content-addressable storage system
- **git-integration** - Git hooks and commit automation

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
- I want structured requirements with hashes so that I can reference specific items without full file paths
- I want dependency information so that I can avoid conflicts when generating code
- I want clear acceptance criteria so that I know when my implementation is complete
- I want automated validation so that I can iterate quickly without human intervention for every change

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

## Schema _(optional)_

### Data Models

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

#### Gate
```
id: TEXT (UUID, primary key)
project_id: TEXT (foreign key, not null)
sequence: INTEGER (not null, 1-based)
name: TEXT (not null)
description: TEXT
status: ENUM('pending', 'in_progress', 'completed', 'rejected')
type: ENUM('feature', 'quality', 'rescope')
progress_percentage: REAL (Zeno's paradox calculation)
features: JSON (array of feature objects)
quality_gates: JSON (coverage, security, linting thresholds)
hash: TEXT (unique, SHA-256 first 16 chars)
created_at: TIMESTAMP
completed_at: TIMESTAMP
```

#### Requirement
```
id: TEXT (UUID, primary key)
gate_id: TEXT (foreign key, not null)
parent_id: TEXT (foreign key, nullable, self-reference)
type: ENUM('functional', 'non_functional', 'constraint')
priority: ENUM('must', 'should', 'could', 'wont')
description: TEXT (not null)
acceptance_criteria: TEXT
hash: TEXT (unique, content-addressable)
status: ENUM('draft', 'approved', 'implemented', 'tested')
created_at: TIMESTAMP
```

#### Artifact
```
id: TEXT (UUID, primary key)
gate_id: TEXT (foreign key, not null)
type: ENUM('prd', 'architecture', 'proposal', 'test')
name: TEXT (not null)
path: TEXT (relative to project root)
hash: TEXT (unique, content hash)
content: TEXT (for small artifacts, nullable)
metadata: JSON (type-specific metadata)
created_at: TIMESTAMP
```

#### Dependency
```
id: TEXT (UUID, primary key)
source_hash: TEXT (not null, indexed)
target_hash: TEXT (not null, indexed)
type: ENUM('requires', 'blocks', 'relates_to')
description: TEXT
confidence_score: REAL (0.0-1.0, for auto-detected deps)
created_at: TIMESTAMP
UNIQUE(source_hash, target_hash, type)
```

#### Repository
```
id: TEXT (UUID, primary key)
project_id: TEXT (foreign key, not null)
name: TEXT (not null)
path: TEXT (absolute or relative)
type: ENUM('main', 'service', 'library', 'tool')
hash: TEXT (unique, repo identifier)
metadata: JSON (language, framework, size metrics)
created_at: TIMESTAMP
```

#### Proposal
```
id: TEXT (UUID, primary key)
gate_id: TEXT (foreign key, not null)
requirement_id: TEXT (foreign key, nullable)
title: TEXT (not null)
status: ENUM('draft', 'pending_check', 'pending_approval', 'approved', 'rejected', 'implemented')
automated_check_status: ENUM('pending', 'passed', 'failed')
automated_check_results: JSON (detailed check results)
human_approval_status: ENUM('pending', 'approved', 'rejected')
human_feedback: TEXT
approved_by: TEXT (user identifier)
hash: TEXT (unique, proposal content hash)
created_at: TIMESTAMP
approved_at: TIMESTAMP
implemented_at: TIMESTAMP
```

#### HashRegistry
```
hash: TEXT (primary key, SHA-256 first 16 chars)
type: TEXT (entity type: gate, requirement, proposal, etc.)
entity_id: TEXT (UUID of actual entity)
content_preview: TEXT (first 200 chars for quick reference)
created_at: TIMESTAMP
```

### Relationships
- Project → Gates: one-to-many (project has multiple gates)
- Gate → Requirements: one-to-many (gate decomposes into requirements)
- Requirement → Requirements: one-to-many (parent-child hierarchy)
- Gate → Artifacts: one-to-many (gate produces multiple artifacts)
- Gate → Proposals: one-to-many (gate contains multiple proposals)
- Requirement → Proposals: one-to-many (requirement implemented via proposals)
- Dependency: many-to-many via hash references (any entity can depend on any entity)
- Project → Repositories: one-to-many (project spans multiple repos)
- HashRegistry: lookup table for all hashed entities

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

## Timeline (Order of Operations)

### Phase 1: Core Infrastructure (Weeks 1-2)
- [ ] Set up TypeScript project with strict mode
- [ ] Implement CLI framework with Commander
- [ ] Design and create SQLite schema with migrations
- [ ] Implement file system utilities (read/write/ensure directories)
- [ ] Create hash utilities (SHA-256, short hash, content-addressable)
- [ ] Implement basic configuration management (.zeno/config.json)
- [ ] Set up git integration utilities (simple-git wrapper)
- [ ] Create project structure scaffolding
- [ ] Implement logging and error handling
- [ ] Write unit tests for utilities

### Phase 2: Zeno Engine & Gate Generation (Weeks 3-4)
- [ ] Implement Zeno's paradox algorithm (iterative halving to 95%)
- [ ] Create gate template system with optional sections
- [ ] Build LLM integration layer (command-based, no API keys)
- [ ] Implement code analyzer for existing codebases (AST parsing)
- [ ] Create dependency graph generator for existing code
- [ ] Build code metrics calculator (coupling, cohesion, complexity)
- [ ] Implement `zeno init` command with interactive prompts
- [ ] Implement `zeno analyze` command for deep codebase analysis
- [ ] Implement `zeno gates list` command
- [ ] Implement `zeno gates show <gate-id>` command
- [ ] Create gate confidence scoring system
- [ ] Add gate approval workflow
- [ ] Write integration tests for gate generation

### Phase 3: Requirements & Database Layer (Weeks 5-6)
- [ ] Implement requirement generation from gates
- [ ] Create requirement decomposition algorithm (gate → requirements tree)
- [ ] Build SQLite CRUD operations with better-sqlite3
- [ ] Implement hash registry for content-addressable storage
- [ ] Create dependency tracking system with confidence scores
- [ ] Implement `zeno req list` command with filtering
- [ ] Implement `zeno req show <hash>` command
- [ ] Implement `zeno req deps <hash>` command for dependency visualization
- [ ] Build PRD generator from template
- [ ] Create requirement validation rules
- [ ] Implement requirement approval workflow
- [ ] Write tests for requirement generation and storage

### Phase 4: Architecture & Mermaid Generation (Weeks 7-8)
- [ ] Implement Mermaid diagram generator base class
- [ ] Create system architecture diagram generator
- [ ] Create data flow diagram generator
- [ ] Create component diagram generator
- [ ] Create wishbone diagram generator (gates + features)
- [ ] Build dependency graph visualizer (repos and modules)
- [ ] Implement `zeno arch generate` command
- [ ] Implement `zeno arch show <type>` command
- [ ] Create architecture artifact storage
- [ ] Add architecture versioning (per gate)
- [ ] Implement architecture approval workflow
- [ ] Write tests for diagram generation

### Phase 5: Multi-Repo & Subproject Detection (Weeks 9-10)
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

### Phase 6: Proposal Generation & Management (Weeks 11-12)
- [ ] Create proposal template system
- [ ] Implement proposal generator from requirements
- [ ] Build change notice format (OpenSpec-inspired)
- [ ] Implement `zeno proposal list` command with filtering
- [ ] Implement `zeno proposal show <hash>` command
- [ ] Create proposal storage and versioning
- [ ] Build proposal-to-code mapping
- [ ] Implement proposal dependency tracking
- [ ] Add proposal status management
- [ ] Write tests for proposal generation

### Phase 7: Automated Validation & Quality Gates (Weeks 13-14)
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

### Phase 8: Human Approval & Rejection Workflow (Weeks 15-16)
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

### Phase 9: Git Integration & Commit Automation (Weeks 17-18)
- [ ] Implement pre-commit hook installer
- [ ] Create commit message generator (structured format)
- [ ] Build auto-commit on proposal approval
- [ ] Implement gate release tagging
- [ ] Create branch management for proposals
- [ ] Add rollback mechanism for rejected proposals
- [ ] Implement commit validation (check pending approvals)
- [ ] Build git status integration with Zeno status
- [ ] Write tests for git operations

### Phase 10: Rescope & Replan Engine (Weeks 19-20)
- [ ] Implement rescope detection (end state change)
- [ ] Create rescope gate generator (documents the change)
- [ ] Build future gate regeneration from current position
- [ ] Implement gate deletion for obsolete future gates
- [ ] Create rescope approval workflow
- [ ] Implement `zeno rescope` command
- [ ] Build rescope impact analysis
- [ ] Add rescope history tracking
- [ ] Write tests for rescope logic

### Phase 11: Dashboard & Visualization (Weeks 21-22)
- [ ] Implement `zeno status` command (project overview)
- [ ] Create `zeno dashboard` TUI with ink or blessed
- [ ] Build gate progress visualization
- [ ] Create requirement tree visualization
- [ ] Implement proposal status board
- [ ] Add dependency graph viewer
- [ ] Create interactive navigation
- [ ] Build real-time status updates
- [ ] Write tests for dashboard

### Phase 12: Documentation & Polish (Weeks 23-24)
- [ ] Write comprehensive README with examples
- [ ] Create CLI command reference documentation
- [ ] Write architecture documentation
- [ ] Create tutorial for greenfield projects
- [ ] Create tutorial for existing codebases
- [ ] Build example projects (small, medium, large)
- [ ] Create troubleshooting guide
- [ ] Write contribution guidelines
- [ ] Add inline code documentation
- [ ] Create video walkthrough (optional)

_Total estimated timeline: 24 weeks (6 months) for MVP_

## Open Questions

### Technical Decisions
- [ ] Should we support multiple LLM providers simultaneously (e.g., Claude for architecture, GPT-4 for code)?
- [ ] How should we handle very large codebases (>1M LOC) during initial analysis?
- [ ] Should we implement incremental analysis or always full re-analysis?
- [ ] What's the strategy for handling non-TypeScript/JavaScript codebases?
- [ ] Should we support custom quality gate thresholds per project?
- [ ] How do we handle monorepo tools (Turborepo, Nx) in repo detection?
- [ ] Should we implement a plugin system for custom analyzers?
- [ ] What's the migration path from OpenSpec to Zeno's Planner?

### Product Decisions
- [ ] Should gates be editable after generation, or regenerate-only?
- [ ] How verbose should progress reporting be (minimal, normal, verbose modes)?
- [ ] Should we support team collaboration (multiple users approving)?
- [ ] What's the UX for very long-running operations (hours of analysis)?
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

### Risks
- **Code analysis performance on large codebases** - Impact: High - Mitigation: Implement incremental analysis, caching, parallel processing
- **LLM hallucinations in gate generation** - Impact: High - Mitigation: Human approval required, confidence scoring, validation
- **SQLite scalability limits** - Impact: Medium - Mitigation: Optimize queries, add indexes, consider sharding for very large projects
- **Dependency conflict detection false positives** - Impact: Medium - Mitigation: Confidence scoring, allow manual override with justification
- **Repo boundary detection inaccuracy** - Impact: Medium - Mitigation: Confidence scoring, human approval, allow manual adjustment
- **Git hook compatibility issues** - Impact: Low - Mitigation: Test on multiple git versions, provide manual installation fallback
- **Mermaid diagram complexity limits** - Impact: Low - Mitigation: Split large diagrams, provide detail levels (high-level, detailed)
- **User adoption curve** - Impact: Medium - Mitigation: Comprehensive docs, examples, video tutorials

## Success Criteria
- Successfully initialize and analyze an existing codebase of 100k+ LOC in under 5 minutes
- Generate meaningful gates with 80%+ user approval rate (measured via feedback)
- Automated checks catch 95%+ of issues before human review
- Dependency tracking prevents 100% of file conflicts in multi-repo scenarios
- Code coverage maintained at 90%+ across all gates
- Zero security vulnerabilities in production code
- Linting error rate below 0.01% (1 error per 10,000 lines)
- Rescope operation completes in under 30 seconds for typical projects
- PRD generation produces actionable documents 90%+ of the time
- Architecture diagrams accurately represent system design (validated by users)
- Hash-based references reduce LLM context size by 50%+ compared to full paths
- Gate completion time reduced by 30%+ compared to unstructured development
- User reports improved project clarity and reduced scope creep

## Requirements Database
SQLite database path for detailed requirements and specifications:
- Database: `.zeno/requirements.db`
- Query: `SELECT * FROM requirements WHERE project_id = '[project_id]'`
- Schema: See "Schema" section above for complete table definitions
- Indexes: Optimized for hash lookups, gate filtering, dependency traversal
- Migrations: Versioned schema migrations in `src/storage/migrations/`

## Architecture
Mermaid diagrams and architectural models:
- System Architecture: `docs/architecture/system-overview.mmd`
- Data Flow: `docs/architecture/data-flow.mmd`
- Component Diagram: `docs/architecture/components.mmd`
- Dependency Graph: `docs/architecture/dependencies.mmd`
- Wishbone Diagram: `docs/architecture/wishbone.mmd`
- Gate Lifecycle: `docs/architecture/gate-lifecycle.mmd`
- Proposal Workflow: `docs/architecture/proposal-workflow.mmd`

## Out of Scope

### Explicitly NOT Included in MVP
- Web UI or graphical interface (CLI/TUI only)
- Real-time collaboration features (single-user focused)
- LLM orchestration (multiple LLMs working in parallel) - deferred to v2.0
- Cloud synchronization or hosted service
- Integration with project management tools (Jira, Linear, GitHub Projects) - stretch goal
- Support for non-git version control systems
- Built-in LLM API integration (user provides LLM via Cursor/Claude/etc.)
- Automatic code generation (LLM does this, Zeno orchestrates)
- CI/CD pipeline generation (may add in future)
- Docker/container orchestration
- Database migrations for production databases (only for requirements.db)
- Performance profiling and optimization recommendations
- Automated refactoring suggestions
- Code review automation
- Team permission and role management
- Billing or licensing system
- Mobile app or mobile-optimized interface

### Features Deferred to Future Iterations
- Multi-LLM orchestration with task distribution
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

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-04  
**Status**: Draft - Ready for Review  
**Owner**: Zeno's Planner Development Team


