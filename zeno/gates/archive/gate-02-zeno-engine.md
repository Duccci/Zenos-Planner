# Gate 02: Zeno Engine & Gate Generation

**Status**: completed  
**Type**: feature  
**Created**: 2026-01-28  
**Completed**: 2026-01-30  
**Sequence**: 2 of 12  
**Hash**: #g02zenoeng

## Overview

Implements the core Zeno engine that generates gates through iterative decomposition and enables project initialization. Delivers the `zeno init` command for project setup, code analysis capabilities for existing codebases, gate generation algorithm, and foundational CLI commands for gate management. This gate transforms Zeno from a static infrastructure tool into a functional project planning system.

## Objectives

- [x] Implement iterative gate generation algorithm that decomposes end state into concrete milestones
- [x] Build `zeno init` command with interactive prompts for project initialization
- [x] Create code analyzer using AST parsing for existing codebase analysis
- [x] Implement core gate management commands (`zeno gates list/show/start/complete`)
- [x] Generate project-level requirements from end state during initialization
- [x] Create gate template system for PRD generation
- [x] Build LLM integration layer for command-based interaction (no API keys)
- [x] Implement code metrics calculator (coupling, cohesion, complexity)
- [x] Create dependency graph generator for existing code
- [x] Generate initial AGENTS.md for tool usage guidance
- [x] Implement write-time analysis integration for greenfield projects (auto-analyze on gate completion)

## Context

### What Was Completed Before This Gate

Gate 01 (Core Infrastructure) established the foundational infrastructure:

- TypeScript project with strict mode, ESLint, Prettier, and Vitest configured
- CLI framework skeleton using Commander.js with extensible command structure
- SQLite database with complete schema and migration system
- Core utility modules: file system, hashing, configuration, logging, git operations
- Project structure scaffolding for `.zeno` directory layout
- Error handling patterns with typed error hierarchy

### What This Gate Enables

- **Gate 3 (Requirements & Database Layer)**: Requires gate generation to create gate-specific requirements and database CRUD operations
- **Gate 4 (Architecture & Mermaid Generation)**: Requires code analysis and dependency graphs for architecture diagram generation
- **Gate 5 (Multi-Repo & Subproject Detection)**: Requires code metrics and coupling analysis for repository boundary detection
- **All subsequent gates**: Depend on functional gate management and project initialization capabilities

### Scope Boundaries

**In Scope**:
- Iterative gate generation algorithm (Zeno's paradox-inspired decomposition)
- Project initialization via `zeno init` with interactive prompts
- Code analyzer using @babel/parser and @babel/traverse for AST parsing
- Dependency graph generation from AST analysis
- Code metrics calculation (afferent/efferent coupling, cyclomatic complexity, LOC)
- Gate management CLI commands (list, show, start, complete)
- Gate template system with markdown generation
- Project-level requirement generation from end state analysis
- AGENTS.md generation for AI context
- Gate confidence scoring system
- LLM integration layer (command-based, no external API calls)
- Write-time analysis integration for greenfield projects:
  - Auto-analyze hook triggered on `zeno gates complete <gate-id>`
  - Incremental analysis (only parse files changed in current gate)
  - Update project metadata and dependency graph with newly written code
  - Store metrics for future gate generation
- Integration tests for gate generation workflow

**Out of Scope**:
- Database CRUD operations beyond schema (deferred to Gate 3)
- Architecture diagram generation (deferred to Gate 4)
- Multi-repo detection logic (deferred to Gate 5)
- Proposal generation (deferred to Gate 6)
- Automated validation (deferred to Gate 7)
- Human approval workflow (deferred to Gate 8)

## Requirements

### Project Requirements (Attributed to This Gate)

Project-level requirements were primarily defined during `zeno init` at project inception. Requirements may be updated or added during rebaseline/rescope operations, but init is the primary source. This section lists those that are attributed to this gate. Query all project requirements via `zeno req list --project`.

| Hash | Name | Type | Priority | How This Gate Addresses It |
|------|------|------|----------|---------------------------|
| #p02gategen | Gate Generation Algorithm | functional | must | Implements iterative decomposition algorithm |
| #p02init | Project Initialization | functional | must | Implements `zeno init` command with prompts |
| #p02codeanalysis | Code Analysis Capabilities | functional | must | Implements AST parsing and code metrics |
| #p02llmint | LLM Integration Layer | functional | must | Creates command-based interaction system |
| #p02agentsmd | AGENTS.md Generation | functional | must | Generates AI context documentation |
| #p02writeanalysis | Write-Time Analysis Integration | functional | must | Enables auto-analysis on gate completion for greenfield projects to support data-driven future gate generation |

### Gate-Specific Requirements

Gate-specific requirements will be generated when `zeno gates start gate-02` is called. These decompose project requirements and gate objectives into actionable items. Stored in `.zeno/requirements.db` and queried via `zeno req list --gate gate-02`.

**Status**: Requirements will be generated when gate is started.

[After gate start, view detailed requirement information via: `zeno req show <hash>`]

### Requirement-to-Task Breakdown

Individual tasks are created during proposal generation (`/zeno-proposal`), not during gate generation. Each requirement may spawn multiple proposals (tasks) that implement it. See "Proposal Status" section below for tasks derived from these requirements.

---

## Technical Decisions for This Gate

### Iterative Decomposition Algorithm
- **Choice**: Use recursive decomposition that splits remaining work in half conceptually until concrete deliverables emerge
- **Alternatives Considered**: Fixed percentage gates, Fibonacci sequence, user-defined milestones, complexity-based sizing
- **Rationale**: Natural decomposition that adapts to actual complexity. Each gate represents concrete deliverables, not arbitrary percentages. Algorithm continues until remaining work is small enough to be a single gate.
- **Impact**: Gates emerge organically from project analysis rather than predetermined structure
- **Trade-offs**: Gained adaptive structure; lost rigid predictability but gained realistic progress tracking

### AST Parsing with Babel
- **Choice**: Use @babel/parser and @babel/traverse for JavaScript/TypeScript code analysis
- **Alternatives Considered**: TypeScript compiler API, ESLint parser, Acorn, manual regex parsing
- **Rationale**: Babel handles both JavaScript and TypeScript, provides rich AST traversal, widely used and maintained. Supports modern syntax and experimental features.
- **Impact**: Can analyze existing codebases regardless of TypeScript configuration
- **Trade-offs**: Additional dependency; gained comprehensive syntax support

### Command-Based LLM Integration
- **Choice**: LLM integration via function invocation, not API calls or external services
- **Alternatives Considered**: OpenAI API integration, Anthropic API, local LLM server, prompt-based only
- **Rationale**: Zeno functions are invoked by AI agents (like Cursor) during workflow execution. No API keys needed - LLM calls Zeno functions directly. Humans provide prompts; LLMs execute commands.
- **Impact**: Seamless integration with AI coding assistants without external dependencies
- **Trade-offs**: Requires LLM to understand function signatures; gained simplicity and no API costs

### Gate Template System
- **Choice**: Markdown templates with optional sections, filled via template engine
- **Alternatives Considered**: Handlebars, Mustache, custom DSL, code generation
- **Rationale**: Markdown is human-readable, version-controllable, and LLM-friendly. Template system allows consistent structure while supporting gate-specific variations.
- **Impact**: All gate PRDs follow consistent structure while allowing customization
- **Trade-offs**: Template parsing overhead; gained consistency and maintainability

### Write-Time Analysis for Greenfield Projects
- **Choice**: Auto-trigger code analysis on `zeno gates complete <gate-id>` to capture newly written code metrics, then use those metrics to inform future gate generation
- **Alternatives Considered**: Manual analysis only, postpone analysis until all gates complete, scan only at init
- **Rationale**: Greenfield projects benefit from deterministic analysis like brownfield projects. By analyzing code after each gate completes, future gates are generated based on real metrics (coupling, complexity, LOC) rather than theoretical decomposition alone. This creates a data-driven feedback loop: vision → Gate 1 → analyze → Gate 2 (informed by data) → analyze → Gate 3 (informed by data) → etc.
- **Implementation Details**:
  - Gate completion hook calls `zeno analyze --incremental` for only files changed in current gate
  - Metrics stored in project `start_state` metadata (previously only populated for brownfield analysis)
  - Dependency graph updated with newly analyzed code
  - Optional: `zeno gates regenerate --from-analysis` enables LLM to regenerate future gates using real metrics
- **Impact**: Greenfield projects get same architectural benefits as brownfield (coupling detection, complexity tracking, circular dependency detection, adaptive gate generation)
- **Trade-offs**: Additional analysis step adds time to gate completion (~5-30s depending on code size); gained significant architectural insights and adaptive planning

## Architecture Updates

### Components Modified or Created

- **src/core/zeno-engine.ts** (`src/core/`)
  - Purpose: Core iterative decomposition algorithm for gate generation
  - Changes: New file - implements Zeno's paradox-inspired decomposition
  - Interfaces: `generateGates(endState, existingCodebase?)`, `decomposeWork(remainingWork)`

- **src/core/gate-generator.ts** (`src/core/`)
  - Purpose: Gate generation orchestration and PRD creation
  - Changes: New file - coordinates engine, templates, and requirements
  - Interfaces: `generateGatePRD(gateData)`, `createGateSequence(endState)`

- **src/analysis/code-analyzer.ts** (`src/analysis/`)
  - Purpose: AST parsing and code structure analysis
  - Changes: New file - uses @babel/parser and @babel/traverse
  - Interfaces: `analyzeCodebase(path)`, `parseFile(filePath)`, `extractDependencies(ast)`

- **src/analysis/metrics.ts** (`src/analysis/`)
  - Purpose: Code metrics calculation (coupling, complexity, LOC)
  - Changes: New file - calculates afferent/efferent coupling, cyclomatic complexity
  - Interfaces: `calculateCoupling(modules)`, `calculateComplexity(ast)`, `countLines(filePath)`

- **src/analysis/dependency-graph.ts** (`src/analysis/`)
  - Purpose: Dependency graph generation from AST analysis
  - Changes: New file - builds graph structure from imports/exports
  - Interfaces: `buildDependencyGraph(analyzedModules)`, `findCircularDependencies(graph)`

- **src/core/write-time-analyzer.ts** (`src/core/`)
  - Purpose: Incremental analysis hook for greenfield projects on gate completion
  - Changes: New file - runs analysis on changed files when gate completes, updates project metrics
  - Interfaces: `analyzeOnGateComplete(gateId)`, `updateProjectMetrics(newMetrics)`, `regenerateGatesFromAnalysis()`

- **src/generation/requirement-generator.ts** (`src/generation/`)
  - Purpose: Project-level requirement generation from end state
  - Changes: New file - analyzes end state to extract cross-cutting requirements
  - Interfaces: `generateProjectRequirements(endState)`, `extractConstraints(description)`

- **src/generation/gate-template.ts** (`src/generation/`)
  - Purpose: Gate PRD template system
  - Changes: New file - template engine for markdown generation
  - Interfaces: `renderGateTemplate(template, data)`, `loadTemplate(templateName)`

- **src/generation/agents-generator.ts** (`src/generation/`)
  - Purpose: AGENTS.md generation for AI context
  - Changes: New file - generates project-specific AI instructions
  - Interfaces: `generateAgentsMD(projectConfig, gates)`

- **src/cli/commands/init.ts** (`src/cli/commands/`)
  - Purpose: Project initialization command
  - Changes: Modify - implement interactive prompts using @inquirer/prompts
  - Interfaces: `initCommand()`, prompts for project name, end state, existing codebase

- **src/cli/commands/gates.ts** (`src/cli/commands/`)
  - Purpose: Gate management commands
  - Changes: Modify - implement list, show, start, complete subcommands
  - Interfaces: `listGates()`, `showGate(gateId)`, `startGate(gateId)`, `completeGate(gateId)`

- **src/integration/llm-layer.ts** (`src/integration/`)
  - Purpose: LLM integration layer for command invocation
  - Changes: New file - provides function signatures and invocation helpers
  - Interfaces: `invokeZenoFunction(name, args)`, `getFunctionSignatures()`

### Architecture Diagrams
- System Overview: `zeno/architecture/system-overview.md` - Core Layer and Analysis Layer components are implemented in this gate
- Data Flow: `zeno/architecture/data-flow.md` - Initialization and gate generation flows are implemented
- Gate Roadmap: `zeno/architecture/gate-roadmap.md` - Gate 2 marked as pending

### Integration Points

- **@babel/parser**: AST parsing for JavaScript/TypeScript code analysis
- **@babel/traverse**: AST traversal for dependency extraction
- **@inquirer/prompts**: Interactive terminal prompts for `zeno init`
- **Commander.js**: CLI command registration (from Gate 1)
- **SQLite database**: Schema queries for gate storage (from Gate 1)
- **File utilities**: Template file reading and PRD writing (from Gate 1)
- **Hash utilities**: Content-addressable references for gates (from Gate 1)
- **Logger**: Debug output for gate generation process (from Gate 1)

## Gate-Specific Quality Considerations

### Security Considerations

- AST parsing must validate file paths to prevent path traversal
- Template rendering must sanitize user input to prevent injection
- Code analysis must not execute user code (read-only analysis)
- Gate generation must validate end state input to prevent malicious content

### Performance Requirements

- Gate generation for new project: < 5 seconds
- Code analysis for medium codebase (10k LOC): < 30 seconds
- AST parsing per file: < 100ms
- Dependency graph generation: < 10 seconds for 100 modules

## Dependencies

### External Dependencies (New or Updated)

- **@babel/parser** (^7.26.3) - JavaScript/TypeScript AST parsing
- **@babel/traverse** (^7.26.5) - AST traversal for dependency extraction
- **@inquirer/prompts** (^7.8.0) - Interactive terminal prompts
- **dependency-cruiser** (^16.8.1) - Dependency graph visualization (optional, for validation)

### Internal Dependencies

- **Depends on Gate(s)**: Gate 1 (Core Infrastructure) - requires CLI framework, database schema, file utilities, hash utilities, logging, error handling
- **Blocks Gate(s)**: Gate 3 (Requirements & Database Layer) - requires gate generation to create gate-specific requirements

### Infrastructure Dependencies

- Node.js >= 24.0.0 (for native ESM, fs/promises)
- Existing codebase analysis requires readable source files
- Terminal with ANSI color support for interactive prompts

## Implementation Steps

1. **Code Analysis Foundation**
   - Implement AST parser wrapper using @babel/parser
   - Create code analyzer that traverses codebase directory structure
   - Build dependency extractor that identifies imports/exports
   - This enables analysis of existing codebases during initialization

2. **Metrics and Dependency Graph**
   - Implement coupling calculator (afferent/efferent dependencies)
   - Create complexity metrics (cyclomatic complexity, LOC)
   - Build dependency graph structure from analyzed modules
   - These metrics inform gate generation and future multi-repo detection

3. **Requirement Generation**
   - Implement project-level requirement generator from end state
   - Extract cross-cutting concerns and constraints from description
   - Store requirements in database with hash references
   - This establishes requirement-first workflow foundation

4. **Gate Generation Engine**
   - Implement iterative decomposition algorithm
   - Create gate sequence generator that builds dependency chain
   - Build gate confidence scoring system
   - This is the core Zeno functionality

5. **Template System and PRD Generation**
   - Create gate template loader and renderer
   - Implement PRD generation from gate data
   - Generate AGENTS.md for project context
   - This produces human-readable gate documentation

6. **CLI Commands Implementation**
   - Implement `zeno init` with interactive prompts
   - Implement `zeno gates list` command
   - Implement `zeno gates show <gate-id>` command
   - Implement `zeno gates start <gate-id>` command (generates gate-specific requirements)
   - Implement `zeno gates complete <gate-id>` command
   - These commands enable user interaction with Zeno system

7. **LLM Integration Layer**
   - Create function signature definitions
   - Implement invocation helpers for AI agents
   - Document command-based interaction pattern
   - This enables LLM-driven workflow execution

8. **Write-Time Analysis Integration**
   - Implement `zeno analyze --incremental` for only changed files in current gate
   - Create gate completion hook that triggers analysis
   - Update project metadata `start_state` with newly discovered metrics
   - Implement optional `zeno gates regenerate --from-analysis` command
   - Enable future gates to be generated using real code metrics instead of purely theoretical decomposition
   - Document how analysis informs gate regeneration in AGENTS.md

9. **Integration Tests**
   - Write tests for gate generation algorithm
   - Test code analysis on sample codebases
   - Verify requirement generation from end states
   - Validate CLI command workflows end-to-end
   - Test write-time analysis captures metrics correctly
   - Test gate regeneration from analysis data

## Known Issues & Limitations

### Current Limitations

- Gate generation algorithm is heuristic-based; may need refinement through testing
- Code analysis supports JavaScript/TypeScript only; other languages deferred
- AST parsing may be slow for very large codebases (>100k LOC)
- Gate confidence scoring is initial implementation; may need calibration

### Technical Debt

- Code analyzer uses synchronous file I/O; may need async for large codebases - evaluate in Gate 11
- Dependency graph is in-memory only; may need persistence for large projects - address in Gate 3
- Template system is basic; may need conditional sections and loops - enhance if needed in Gate 4

### Future Improvements

- Support for additional languages (Python, Rust, Go) - deferred to post-MVP
- Incremental code analysis (only changed files) - deferred to Gate 11
- Machine learning for gate confidence scoring - deferred to post-MVP

## Risks & Mitigation

### Technical Risks

1. **AST Parsing Performance on Large Codebases**
   - **Impact**: High
   - **Probability**: Medium
   - **Mitigation**: Implement file filtering (skip node_modules, dist), parallel processing for independent files, progress indicators
   - **Contingency**: Add timeout limits, sample-based analysis for very large codebases

2. **Gate Generation Algorithm Quality**
   - **Impact**: High
   - **Probability**: Medium
   - **Mitigation**: Extensive testing on diverse project types, iterative refinement based on feedback, human approval required for generated gates
   - **Contingency**: Allow manual gate editing, provide fallback to simpler decomposition

3. **Babel Parser Compatibility**
   - **Impact**: Medium
   - **Probability**: Low
   - **Mitigation**: Pin Babel versions, test on various TypeScript configurations, handle parse errors gracefully
   - **Contingency**: Fallback to simpler regex-based analysis if AST parsing fails

### Process Risks

1. **Scope Creep in Code Analysis**
   - **Impact**: Medium
   - **Probability**: Medium
   - **Mitigation**: Focus on dependency extraction and basic metrics only. Defer advanced analysis to later gates.
   - **Contingency**: Time-box analysis features; document limitations clearly

## Gate Completion Criteria

- [ ] All must-have requirements implemented and tested
- [ ] All should-have requirements implemented or explicitly deferred
- [ ] All acceptance criteria met
- [ ] Architecture diagrams updated
- [ ] Gate-specific quality considerations addressed
- [ ] 90% code coverage achieved across all modules
- [ ] Zero linting errors
- [ ] Zero TypeScript errors in strict mode
- [ ] Integration tests pass for gate generation workflow
- [ ] Stakeholder approval obtained

## Proposal Status

| Proposal | Hash | Status | Archived |
|----------|------|--------|----------|
| 03-requirement-generation | #g02p03reqgen | completed | 2026-01-30 |
| 04-gate-engine | #g02p04engine | completed | 2026-01-30 |
| 05-template-system | #g02p05templates | completed | 2026-01-30 |
| 06-cli-commands | #g02p06cli | completed | 2026-01-30 |
| 07-llm-integration | #g02p07llm | completed | 2026-01-30 |

---

## Gate Completion Summary

**Completed**: 2026-01-30  
**Proposals Completed**: 8  
**Requirements Fulfilled**: 6  
**Quality Metrics**: Coverage 92.18%, Security 0, Lint <0.01%

All proposals for this gate have been completed and archived. See **Consolidated Proposals Summary** section for detailed breadcrumbs.

## Consolidated Proposals Summary

*This section consolidates information from all archived proposals for this gate to reduce context size while preserving key breadcrumbs.*

### Requirements Fulfilled

| Requirement | Proposal |
|-------------|----------|
| #p02writeanalysis | #g02p09writeanalysis |
| #p02codeanalysis | #g02p02metrics |
| #p02init | #g02p06cli |
| #p02gategen | #g02p08integration |
| #p02agentsmd | #g02p05templates |
| #p02llmint | #g02p07llm |

### Lessons Learned

*No implementation notes captured.*

### Next Dependencies

*Proposals that are unblocked by this gate (identified from proposal dependency tables):*

*No downstream dependencies identified.*

### High-Level Delta

**Summary**:
Implements write-time analysis integration that auto-triggers code analysis when developers complete a gate (`zeno gates complete <gate-id>`).
 This enables greenfield projects to benefit from the same deterministic architectural analysis as brownfield projects. Incremental analysis captures only files changed in the current gate, storing metrics in project metadata. Optional `zeno gates regenerate --from-analysis` command enables data-driven future gate generation based on real code metrics instead of purely theoretical decomposition. Implements the foundational AST parsing infrastructure using Babel for JavaScript/TypeScript code analysis. This proposal creates the code analyzer module that traverses codebase directory structures and extracts import/export dependencies from source files. These capabilities enable analysis of existing codebases during project initialization. Implements code metrics calculation (afferent/efferent coupling, cyclomatic complexity, lines of code) and builds a dependency graph data structure from analyzed modules. The dependency graph enables analysis of code organization, detection of circular dependencies, and identification of architectural anti-patterns. These metrics inform gate generation decisions and future multi-repo detection. Implements the project-level requirement generator that analyzes the end state description provided during `zeno init` to extract high-level project requirements. Identifies cross-cutting concerns (testing, performance, security, scalability) and constraints from the end state text. Stores requirements in the SQLite database with hash-based content addressing, establishing the foundation for gate-specific requirement decomposition. Implements the core iterative decomposition algorithm that generates gates from an end state description and optional existing codebase analysis. The engine applies Zeno's paradox-inspired decomposition to split remaining work into concrete, achievable milestones. Includes gate sequencing, dependency tracking, and confidence scoring. This is the heart of Zeno's project planning capability. Implements the gate template system that renders markdown Gate PRDs from generated gate data. Creates templates for consistent gate documentation structure while allowing gate-specific customization. Generates AGENTS.md for project-specific AI context and guidance. All templates are markdown-based, version-controllable, and human-friendly. AGENTS.md can be manually edited by users to add custom rules and updates. Implements the `zeno init` command with interactive prompts and gate management commands (`zeno gates list`, `zeno gates show`, `zeno gates start`, `zeno gates complete`). The init command guides users through project setup, collects end state description and existing codebase info, and triggers the full initialization workflow. Gate commands enable project roadmap navigation and gate lifecycle management. Implements the LLM integration layer that defines function signatures for Zeno commands and provides invocation helpers for AI agents. This layer doesn't call external APIs; instead, it documents how LLM-based coding assistants (like Cursor with Claude) can invoke Zeno functions during workflow execution. Enables seamless AI-driven implementation without external dependencies. Implements comprehensive integration tests that validate the end-to-end gate generation workflow. Tests exercise the full system: from project initialization through gate generation, requirement extraction, CLI interaction, and PRD generation. Covers multiple project types (greenfield, existing codebase, various sizes) to ensure robustness. Validates that all components work together correctly and produce expected outputs.                                                                                      
**Artifacts Created**:
*No artifacts tracked.*

**Quality Metrics**:
- Total Coverage: 92.18%
- Total Files Modified: 62
- Total Tasks Completed: 47

## Notes

### Implementation Notes

- Start with code analysis foundation before gate generation (needs existing codebase understanding)
- Gate generation algorithm should be tested on diverse project types before finalizing
- Interactive prompts should provide clear examples and validation
- LLM integration layer is documentation-focused; actual invocation happens via AI agents

### Lessons Learned

- [To be filled during/after implementation]

### Next Gate Preview

Gate 3 (Requirements & Database Layer) builds on gate generation to implement requirement decomposition, database CRUD operations, and hash registry. It will add:
- Gate-specific requirement generation (decompose project requirements + gate objectives)
- Requirement inheritance and transfer between gates
- SQLite CRUD operations with better-sqlite3
- Hash registry for content-addressable storage
- Dependency tracking system with confidence scores
- `zeno req` command family for requirement management

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-30  
**Gate Owner**: Development Team  
**Reviewers**: Project Lead

**Related Documents**:
- Project PRD: `zeno/PROJECT_PRD.md`
- Previous Gate: `zeno/gates/gate-01-core-infrastructure.md`
- Next Gate: `zeno/gates/gate-03-requirements-db.md` (to be generated)
- Architecture: `zeno/architecture/`
