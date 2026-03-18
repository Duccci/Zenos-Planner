# Zeno's Planner: Repository Structure

**Purpose**: Canonical repo map and directory reference for AI agents, contributors, and onboarding
**Generated**: 2026-03-02
**Stack**: Node.js/TypeScript · CLI tool + MCP server · SQLite

---

## Overview

This repository contains Zeno's Planner — a CLI tool and MCP server that guides solo developers and AI agents through iterative project delivery via "gates" (concrete milestones inspired by Zeno's dichotomy paradox). It manages gate decomposition, requirements, proposals, architecture diagram generation, and multi-repo detection in a SQLite-backed registry. The package is distributed as an npm CLI (`zeno`) and as an MCP server consumed directly by AI coding assistants.

---

## Repository Map

> Legend: `/` = directory &nbsp;|&nbsp; `†` = Zeno-managed

```text
zenos-planner/
│
├── src/                          # Primary source tree
│   ├── index.ts                  # Public entry point / barrel export
│   ├── analysis/                 # Static code analysis (AST, metrics, dependency graph)
│   ├── cli/                      # Commander-based CLI entry point and subcommands
│   │   ├── index.ts              # CLI root (program setup, global flags)
│   │   ├── cli-tool-invoker.ts   # Bridges CLI commands → integration/function-registry
│   │   └── commands/             # One file per `zeno <command>` (gates, req, proposal, repos, …)
│   ├── core/                     # Domain orchestration — gate lifecycle, proposals, archiving
│   ├── generation/               # LLM artifact generation (diagrams, gates, proposals, requirements)
│   ├── integration/              # Cross-cutting service wiring (scaffold entry)
│   ├── mcp/                      # MCP server, tool handlers, schemas, validators
│   ├── registry/                 # In-memory registries (gates, requirements, proposals, config, LLM layer)
│   ├── scaffold/                 # Project init scaffolding
│   ├── storage/                  # SQLite database layer (migrations, sync, cleanup)
│   ├── types/                    # Shared ambient type definitions
│   └── utils/                    # Cross-cutting helpers (hash, git, file, logger, errors, …)
│
├── tests/                        # Test suite (mirrors src/ structure)
│   ├── analysis/
│   ├── cli/
│   ├── core/
│   ├── generation/
│   ├── integration/
│   ├── mcp/
│   ├── scaffold/
│   ├── scripts/
│   ├── storage/
│   ├── utils/
│   ├── fixtures/                 # Shared test data, factory helpers, mock databases
│   ├── setup.ts                  # Global Vitest bootstrap
│   ├── entity-action-handler.test.ts
│   └── index.test.ts
│
├── scripts/                      # Developer utilities (not in build)
│   ├── seed-requirements.ts      # Seed the SQLite registry with baseline requirements
│   └── verify-mcp-docs-coverage.ts # Assert all MCP tools are documented
│
├── docs/                         # Supplemental documentation
│   ├── MCP-SETUP.md              # MCP server setup and client configuration guide
│   └── MCP-TOOLS.md              # Auto-generated MCP tool reference
│
├── templates/                    # Markdown and architecture templates used by generation layer
│   ├── architecture-templates/   # DOT/Mermaid diagram base templates
│   └── md-templates/             # Gate PRD, proposal, AGENTS, STRUCTURE templates
│
├── agents/                       # Subagent catalog (planning, specialist, meta-orchestration agents)
│   ├── CLAUDE.md
│   ├── CONTRIBUTING.md
│   ├── README.md
│   └── categories/               # 10 category folders (01-core-development … 10-research-analysis)
│
├── bin/                          # Compiled entry-point shims (published with package)
│   ├── zeno.js                   # CLI entry shim (`zeno` command)
│   └── mcp-server.js             # MCP server entry shim
│
├── schemas/                      # JSON Schema / Zod schema documentation
│   └── README.md
│
├── zeno/                     †   # Zeno's Planner project management layer
│   ├── AGENTS.md             †   # AI agent instructions for this project
│   ├── PROJECT_PRD.md        †   # Single source of truth for project scope
│   ├── architecture/         †   # Generated architecture diagrams (Mermaid + SVG)
│   ├── gates/                †   # Gate PRDs (gate-06 … gate-14 active; archive/ for completed)
│   ├── proposals/            †   # Proposal documents by gate (gate-06/, solitary/)
│   └── .zeno/                †   # Internal Zeno state (registry.db, config.json)
│
├── package.json                  # npm manifest, scripts, dependencies
├── tsconfig.json                 # TypeScript config (production build)
├── tsconfig.test.json            # TypeScript config (test build — relaxed)
├── vitest.config.ts              # Vitest test runner config
├── eslint.config.mjs             # ESLint flat config
├── commitlint.config.js          # Commitlint conventional-commit rules
├── LICENSE                       # MIT
├── README.md
└── AGENTS.md                 †   # Root AI agent dispatch and operational guide
```

---

## Module Index

### `src/analysis/` — Static Code Analysis

**Responsibility**: Parse project source trees to extract AST-level metrics, coupling scores, and import/export topology. Does NOT make LLM calls — output feeds the LLM generation layer.
**Owns**: `CodeAnalyzer`, `DependencyExtractor`, metrics types.
**Consumes**: File system, `src/utils/file.ts`.
**Exposes**: `analyzeProject()`, `extractDependencies()`, structured `AnalysisResult`.

| File | Purpose |
| ------ | --------- |
| `code-analyzer.ts` | Entry point — orchestrates parsing, metric collection, dependency extraction |
| `parser.ts` | AST parsing (TypeScript/JavaScript via ts-morph or acorn) |
| `dependency-extractor.ts` | Import/export graph extraction from parsed AST |
| `artifact-validation-service.ts` | Validates generated artifacts against expected schemas |
| `types.ts` | Analysis-specific TypeScript types |
| `graph/` | Graph algorithms (topological sort, cycle detection) |
| `metrics/` | Individual metric calculators (LOC, coupling, cohesion) |

---

### `src/cli/` — CLI Interface

**Responsibility**: Expose all Zeno functionality as a terminal CLI via Commander. Delegates all business logic to the integration/registry layer — contains no domain logic itself.
**Owns**: Program definition, argument parsing, output formatting.
**Consumes**: `src/integration/`, `src/registry/`.
**Exposes**: `zeno` binary (via `bin/zeno.js`).

| File | Purpose |
| ------ | --------- |
| `index.ts` | Commander program setup, global options, help text |
| `cli-tool-invoker.ts` | Translates CLI invocations to `FunctionRegistry` calls |
| `commands/arch.ts` | `zeno arch` — architecture diagram commands |
| `commands/gates.ts` | `zeno gates` — gate lifecycle commands |
| `commands/proposal.ts` | `zeno proposal` — proposal CRUD and approval workflow |
| `commands/req.ts` | `zeno req` — requirement management |
| `commands/repos.ts` | `zeno repos` — repository declaration and detection |
| `commands/init.ts` | `zeno init` — project initialization |
| `commands/status.ts` | `zeno status` — project overview |
| `commands/show.ts` | `zeno show <hash>` — hash resolution |
| `commands/config.ts` | `zeno config` — configuration management |
| `commands/template.ts` | `zeno template` — template listing and retrieval |
| `commands/trace.ts` | `zeno trace` — git traceability queries |
| `commands/mcp.ts` | `zeno mcp` — MCP server management |
| `commands/db.ts` | `zeno db` — database utilities |

---

### `src/core/` — Domain Orchestration

**Responsibility**: All gate lifecycle logic — generation, transitions, archiving, proposal application, and PRD updates. This is the primary business-logic layer.
**Owns**: Gate state machine, proposal apply pipeline, archive consolidation.
**Consumes**: `src/storage/`, `src/generation/`, `src/registry/`, `src/utils/`.
**Exposes**: `ZenoEngine`, `transitions`, `archiveGate()`, `applyProposal()`.

| File | Purpose |
| ------ | --------- |
| `zeno-engine.ts` | Top-level orchestrator coordinating all core workflows |
| `transitions.ts` | Gate and proposal state machine (pending → validated → in_progress → completed) |
| `gate-generation.ts` | Gate decomposition and PRD generation logic |
| `gate-generator.ts` | Gate content builder (objective, requirements decomposition) |
| `gate-planner.ts` | Roadmap planning and gate sequencing strategy |
| `gate-sequencer.ts` | Dependency-aware gate ordering |
| `gate-scoring.ts` | Gate complexity and priority scoring |
| `gate-writer.ts` | Writes gate PRD files to `zeno/gates/` |
| `proposal-generation.ts` | Proposal content generation (Red/Green/implementation phases) |
| `proposal-application.ts` | Applies proposal implementation instructions to codebase |
| `proposal-parser.ts` | Parses proposal Markdown into structured data |
| `proposal-progress.ts` | Tracks proposal completion state |
| `proposal-writer.ts` | Writes proposal files to `zeno/proposals/gate-NN/` |
| `archive-logic.ts` | Archive eligibility and consolidation rules |
| `archive-execution.ts` | Executes gate archive (commit, tag, cleanup) |
| `archive-consolidation.ts` | Merges proposal artifacts into gate archive document |
| `archive-validation.ts` | Pre-archive quality and completeness checks |
| `completions.ts` | Gate and proposal completion criteria evaluation |
| `metrics-capture.ts` | Captures code metrics snapshot at gate completion |
| `prd-updater.ts` | Keeps PROJECT_PRD.md in sync with gate progress |
| `workflow-logic.ts` | Shared workflow helpers used across core |
| `write-time-analyzer.ts` | Estimates write-time cost for proposals |
| `types.ts` | Core domain types |

---

### `src/generation/` — LLM Artifact Generation

**Responsibility**: Generate all Zeno-managed Markdown artifacts (gates, proposals, requirements, AGENTS.md, architecture diagrams) using LLM prompts plus structured analysis data.
**Owns**: Prompt templates, diagram generators, requirement patterns, agent discovery.
**Consumes**: `src/analysis/`, `src/registry/`, `src/utils/`, LLM layer.
**Exposes**: `generateGate()`, `generateProposal()`, `generateRequirements()`, `generateDiagram()`.

| File | Purpose |
| ------ | --------- |
| `agent-discovery.ts` | Discovers and ranks subagents from `agents/` catalog |
| `agents-generator.ts` | Generates `zeno/README.md` project reference |
| `agents-writer.ts` | Writes AGENTS.md to disk |
| `artifact-discovery-service.ts` | Locates existing Zeno artifacts by type/gate |
| `complexity-analyzer.ts` | Scores gate/proposal complexity to guide prompt depth |
| `dependency-graph.ts` | Builds requirement and gate dependency graphs |
| `diagram-catalogue.ts` | Registers all available diagram types with metadata |
| `diagram-generator-base.ts` | Base class for diagram generators |
| `diagram-generators/` | Per-type diagram generators (system-overview, data-flow, etc.) |
| `diagram-selector.ts` | Selects which diagrams to generate based on project characteristics |
| `diagram-types.ts` | Diagram type enum and metadata |
| `gate-change-detector.ts` | Detects which gates are affected by a rescope |
| `gate-template.ts` | Gate PRD Markdown template |
| `gate-writer.ts` | Generation-layer gate writer (distinct from core/gate-writer) |
| `gates-discovery.ts` | Scans filesystem to discover existing gate documents |
| `graphviz-renderer.ts` | Renders DOT source to SVG via local Graphviz CLI |
| `mermaid-renderer.ts` | Renders Mermaid diagrams to Markdown |
| `proposal-template.ts` | Proposal Markdown template |
| `proposals-discovery.ts` | Scans filesystem to discover existing proposals |
| `requirement-generator.ts` | Generates gate-level requirements via LLM |
| `requirement-patterns.ts` | Requirement pattern library (functional, NFR, constraint templates) |
| `requirement-storage.ts` | Persists generated requirements to SQLite |
| `template-discovery.ts` | Discovers templates from `templates/` directory |
| `types.ts` | Generation-specific types |

---

### `src/integration/` — Service Wiring

**Responsibility**: Bootstrap and wire all services together; acts as the composition root for CLI and MCP layers.
**Owns**: Top-level service initialization.
**Consumes**: All other `src/` modules.
**Exposes**: `index.ts` — single bootstrap entry used by both CLI and MCP server.

---

### `src/mcp/` — MCP Server

**Responsibility**: Expose all Zeno functionality as an MCP (Model Context Protocol) server for AI coding assistants. Handler-first policy: handlers in `tools/` take precedence over function-based fallbacks.
**Owns**: MCP server lifecycle, tool registration, schema validation, audit logging, dev-mode diagnostics.
**Consumes**: `src/registry/`, `src/integration/`.
**Exposes**: MCP server via `bin/mcp-server.js`.

| File / Dir | Purpose |
| ----------- | --------- |
| `server.ts` | MCP server setup, transport binding, lifecycle |
| `manager.ts` | Tool registration manager — wires handler factories |
| `tool-handlers.ts` | Legacy function-backed tool dispatch |
| `editor-adapters.ts` | VS Code / Cursor editor-specific adaptations |
| `dev-mode.ts` | Development mode flags and overrides |
| `diagnostics.ts` | Runtime diagnostics and health checks |
| `error-handler.ts` | Structured MCP error formatting |
| `tools/` | Handler-first tool implementations (one file per tool group) |
| `schemas/` | Zod schemas for all tool inputs/outputs |
| `validators/` | Input validation helpers |
| `allowlists/` | Permitted path and operation allowlists |
| `audit/` | Audit log writers for tool invocations |
| `content/` | Guardrail and prompt content injected into tool responses |
| `resources/` | MCP resource definitions (read-only data endpoints) |

---

### `src/registry/` — In-Memory Registries

**Responsibility**: Fast, in-process lookup tables and service registries. Caches database state and provides the single source of truth for runtime queries.
**Owns**: All registry singletons, LLM provider wiring, function dispatch.
**Consumes**: `src/storage/`, `src/utils/config.ts`.
**Exposes**: `FunctionRegistry`, `GatesRegistry`, `RequirementsRegistry`, `ProposalsRegistry`, `ConfigRegistry`, `LlmLayer`.

| File | Purpose |
| ------ | --------- |
| `function-registry.ts` | Central dispatch table mapping tool names → implementations |
| `function-implementations.ts` | Concrete implementations registered in the function registry |
| `gates-registry.ts` | In-memory gate index with status caching |
| `requirements-registry.ts` | Requirement lookup and dependency resolution |
| `proposals-registry.ts` | Proposal state cache |
| `config-registry.ts` | Project config (`.zeno/config.json`) accessor |
| `project-registry.ts` | Multi-project registration support |
| `schema-registry.ts` | Zod schema registry for runtime validation |
| `template-registry.ts` | Template cache (loaded from `templates/`) |
| `workflow-registry.ts` | Named workflow definitions |
| `archive-registry.ts` | Completed gate archive index |
| `llm-layer.ts` | LLM provider abstraction (OpenAI/Anthropic/local) |
| `context-provider.ts` | Builds context bundles for LLM calls |
| `command-invoker.ts` | Thin shell-command invoker used by CLI bridges |

---

### `src/scaffold/` — Project Initialization

**Responsibility**: Create the `zeno/` directory structure and seed files when `zeno init` is run.
**Owns**: Init templates, folder scaffolding, initial config generation.
**Exposes**: `scaffold()` — called by `commands/init.ts`.

---

### `src/storage/` — SQLite Database Layer

**Responsibility**: All durable state persistence via `better-sqlite3`. Owns migrations, sync adapters between filesystem Markdown and the registry DB, and cleanup utilities.
**Owns**: `registry.db` schema and migrations, sync logic.
**Consumes**: `src/utils/`, `better-sqlite3`.
**Exposes**: `Database`, `RequirementsSync`, `ProposalSync`, `MigrationsRunner`.

| File | Purpose |
| ------ | --------- |
| `database.ts` | Database connection factory and base query helpers |
| `migrations.ts` | Migration runner — applies pending migrations in order |
| `migrations/` | Individual migration files (timestamped SQL or TS) |
| `requirements-sync.ts` | Syncs requirement Markdown ↔ SQLite registry |
| `proposal-sync.ts` | Syncs proposal file state ↔ SQLite registry |
| `metrics-storage.ts` | Persists gate-completion code metric snapshots |
| `database-cleanup.ts` | Removes orphaned rows and vacuum utilities |

---

### `src/types/` — Ambient Type Definitions

**Responsibility**: Declare ambient types for third-party modules that lack bundled typings.

| File | Purpose |
| ------ | --------- |
| `graphviz.d.ts` | Ambient declarations for Graphviz npm bindings |

---

### `src/utils/` — Cross-Cutting Helpers

**Responsibility**: Pure utility functions with no business logic. Safe to import from any layer.

| File | Purpose |
| ------ | --------- |
| `hash.ts` | SHA-256 content-addressable hash generation (#prefix format) |
| `git.ts` | Git command wrappers (commit, tag, branch, worktree) |
| `file.ts` | File read/write/glob helpers |
| `logger.ts` | Structured console logger with log levels |
| `errors.ts` | Custom error classes with context maps |
| `config.ts` | Project config read/write (`.zeno/config.json`) |
| `datetime.ts` | Date formatting and ISO helpers |
| `dot-renderer.ts` | Renders DOT syntax to SVG via local Graphviz process |
| `normalize.ts` | String and path normalisation helpers |
| `state-sync.ts` | Filesystem ↔ DB state reconciliation utilities |
| `gate-sync.ts` | Gate-specific sync helpers |
| `gate-consolidation.ts` | Helpers for merging gate data from multiple sources |
| `memory-sync.ts` | Serena memory read/write helpers |
| `artifact-locator.ts` | Resolves artifact paths from hash or name |
| `ansi-strip.ts` | Strips ANSI escape codes from terminal output |
| `version.ts` | Package version accessor |

---

## Entry Points

| Entry Point | Invocation | Purpose |
| ------------- | ----------- | ------- |
| `bin/zeno.js` | `zeno <command>` | CLI binary (compiled shim → `src/cli/index.ts`) |
| `bin/mcp-server.js` | `node bin/mcp-server.js` | MCP server (compiled shim → `src/mcp/server.ts`) |
| `src/index.ts` | `import from 'zenos-planner'` | Library public API / barrel export |

---

## Dependency Flow

Strict unidirectional layering — lower layers must not import from higher ones:

```text
cli / mcp
    ↓
integration  (composition root)
    ↓
core  ←→  generation
    ↓           ↓
registry      analysis
    ↓
storage
    ↓
utils / types
```

- `core` and `generation` may call each other for tightly coupled workflows (e.g., proposal generation triggers requirement storage).
- `registry` is the only layer permitted to hold in-process singletons.
- `utils` has zero internal dependencies — never import from `core`, `registry`, or `storage`.

---

## Naming Conventions

| Artifact | Convention | Example |
| --- | --- | --- |
| Source files | `kebab-case.ts` | `gate-generator.ts` |
| Test files | `[name].test.ts` | `gate-generator.test.ts` |
| Classes | `PascalCase` | `ZenoEngine` |
| Functions / methods | `camelCase` | `generateGate()` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_GATE_LIMIT` |
| Types / interfaces | `PascalCase` | `GateDefinition`, `ProposalStatus` |
| Database tables | `snake_case` | `requirements`, `gate_metrics` |
| Git branches | `<type>/<ticket>-<description>` | `feature/GH-42-repos-detect` |
| Commit messages | `<type>(<scope>): <summary>` | `feat(repos): add detect command` |
| Gate PRD files | `gate-NN-<kebab-name>.md` | `gate-06-multi-repo-subproject-detection.md` |
| Proposal files | `NN-<phase>--<kebab-name>.md` | `01-red--test-suite.md` |
| Architecture diagrams | `<diagram-type>.md` or `.svg` | `system-overview.md` |

---

## Extension Points

When adding new capabilities, use these locations:

| What you're adding | Where it goes |
| --- | --- |
| New domain module | `src/<module-name>/` |
| New utility function | `src/utils/<category>.ts` |
| New shared type | `src/types/<domain>.d.ts` |
| New CLI command | `src/cli/commands/<command>.ts` + register in `src/cli/index.ts` |
| New MCP tool | `src/mcp/tools/<group>-tools.ts` + handler in `src/mcp/tools/handler-factory.ts` |
| New registry | `src/registry/<name>-registry.ts` + wire in `src/integration/index.ts` |
| New storage migration | `src/storage/migrations/<timestamp>-<description>.ts` |
| New test fixture | `tests/fixtures/<factory-or-mock-name>.ts` |
| New dev script | `scripts/<script-name>.ts` (not in build) |
| New gate PRD | `zeno/gates/gate-NN-<name>.md` (via `zeno gates generate`) |
| New proposal | `zeno/proposals/gate-NN/NN-<phase>--<name>.md` (via `zeno proposal generate`) |
| New architecture diagram | `zeno/architecture/<diagram-name>.md` (via `zeno arch generate`) |
| New Markdown template | `templates/md-templates/<name>-template.md` |

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-02
**Owner**: Zeno's Planner
