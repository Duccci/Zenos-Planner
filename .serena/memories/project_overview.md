# Zeno's Planner - Project Overview

## Purpose
Zeno's Planner is an AI-powered project management CLI tool and MCP server. It helps developers progressively approach project completion through iterative "gates" (milestones), inspired by Zeno's dichotomy paradox. It decomposes projects into: **Gates → Architecture → Requirements → Subprojects → Proposals**, with dependency tracking and multi-repository support.

## Core Concept: Gates Are the Unit of Progress
- **Gates** are concrete, measurable milestones representing features delivered. They are permanent records.
- **Proposals** are *transient* implementation planning documents. They are created per-gate to plan work, then archived or discarded once the gate completes. Do not treat proposal files as long-lived artifacts.
- Gate completion is tracked via git tags; proposals are archived into `zeno/gates/archive/` on gate completion.

## Tech Stack
- **Runtime**: Node.js >=24.0.0
- **Language**: TypeScript 5.x (strict mode, ES2024, NodeNext modules)
- **Build**: `tsc` → `dist/`
- **CLI**: Commander.js (entry: `bin/zeno.js` → `dist/cli/index.js`)
- **MCP Server**: `@modelcontextprotocol/sdk` (entry: `src/mcp/server.ts`)
- **Database**: `better-sqlite3` (SQLite at `zeno/.zeno/requirements.db`)
- **Testing**: Vitest (v8 coverage, 90% threshold)
- **Linting**: ESLint 9 + typescript-eslint (strict + stylistic)
- **Formatting**: Prettier (no semicolons, single quotes, 2-space indent, 100 col)
- **Git Hooks**: Husky

## Key Libraries
`zod`, `chalk`, `ora`, `@inquirer/prompts`, `simple-git`, `js-yaml`, `commander`,
`@babel/parser`, `@babel/traverse`, `dependency-cruiser`, `graphviz`

## Full Codebase Structure (verified 2026-02-17)
```
src/
  index.ts
  cli/
    index.ts
    commands/  arch, config, db, gates, index, init, mcp, proposal,
               repos, req, show, status, template, trace
  core/        archive-consolidation, archive-execution, archive-logic,
               archive-validation, completions, gate-generation,
               gate-generator, gate-planner, gate-scoring, gate-sequencer,
               gate-writer, prd-updater, proposal-application,
               proposal-generation, proposal-locator, proposal-parser,
               proposal-progress, proposal-writer, types, workflow-logic,
               write-time-analyzer, zeno-engine
  generation/  agent-discovery, artifact-discovery-service,
               complexity-analyzer, dependency-graph,
               diagram-generator-base, diagram-types, gate-template,
               gate-writer, gates-discovery, graphviz-renderer,
               mermaid-renderer, proposal-template, proposals-discovery,
               requirement-generator, requirement-patterns,
               requirement-storage, template-discovery, types
               diagram-generators/  context, data-flow, gate-lifecycle,
                                    gate-roadmap, system-overview, index
  integration/ archive-registry, command-invoker, config-registry,
               function-implementations, function-registry,
               gates-registry, llm-layer, proposals-registry,
               requirements-registry, schema-registry, template-registry,
               workflow-registry
  analysis/    artifact-validation-service, code-analyzer,
               dependency-extractor, parser, types
               graph/dependency-graph
               metrics/complexity, coupling, loc
  mcp/
    server.ts
    tool-handlers.ts
    dev-mode, diagnostics, editor-adapters, error-handler, manager
    handlers/        (per-tool MCP handlers)
    schemas/         analysis, architecture-action, archive,
                     artifact-validation, common, config, gate-create,
                     gate, gates-action, git-trace, index, proposal-action,
                     proposal-create, proposal, registry, repository-action,
                     repository, req-action, requirement, workflow, worktree
    tools/           analysis, architecture, archive, config,
                     entity-action-handler, gate, git-trace, handler-factory,
                     index, proposal, repository, requirement, template,
                     validation, workflow
    validators/      apply-phase, dependency, proposal-phases, quality, scope
    audit/           git-operation-tracker
    resources/       index
  registry/
  scaffold/index
  storage/
    database, database-cleanup, migrations
    migrations/  001_initial_schema.sql, 002_remove_status_column.sql
  utils/
    config, errors, file, gate-consolidation, git, hash, logger, version
```

## Gate Roadmap (from PROJECT_PRD.md)
### Archived (completed, gates 1-4)
- Gate 1: Core Infrastructure
- Gate 2: Zeno Engine & Gate Generation
- Gate 3: Requirements & Database Layer
- Gate 4: Architecture & Mermaid Generation

### Active MVP (gates 5-12)
- **Gate 5**: Architecture & Diagram Generation ← *currently in progress*
- Gate 6: Multi-Repo & Subproject Detection
- Gate 7: Proposal Generation & Management
- Gate 8: Automated Validation & Quality Gates
- Gate 9: Human Approval & Rejection Workflow
- Gate 10: Git Integration & Commit Automation (includes worktree management)
- Gate 11: Rescope & Replan Engine
- Gate 12: Status & Reporting

### Post-MVP
- Gate 13: Subagent Orchestration & Parallel Execution (DEFERRED)
- Gate 14: Documentation Cleanup (DEFERRED)

## Quality Thresholds (Non-Configurable in MVP)
- Code coverage: ≥90%
- Security vulnerabilities: 0 known CVEs
- Linting error rate: <0.01%
- TypeScript strict mode: 0 errors
- All tests passing

## Architecture Principles
1. Lightweight — minimal dependencies, fast, portable
2. LLM-Driven Execution — CLI functions called by AI; humans only approve
3. Human-in-the-Loop — approval at gate gen, repo boundaries, proposals, gate completion
4. Quality-First — automated checks before human review
5. Minimalist Storage — SQLite only for requirements + repositories; everything else is Markdown + Git
6. AI-Contextual — MCP tools provide schema-validated project access; no static docs needed
7. Hash-Based References — SHA-256 first 16 chars for 50%+ context reduction
8. Parallel-First — git worktrees for isolated concurrent proposal development

## Database (SQLite — 2 Core Tables in MVP)
- `requirements` — hierarchical, project/gate level, with status (pending → implemented → tested)
- `repositories` — multi-repo boundary tracking
- No proposal table — proposals stored as Markdown files, tracked via Git
- Full data model in PRD includes: User, Project, Gate, Requirement, Artifact, Dependency, Repository, RequirementRepository, Proposal, HashRegistry, StateHistory (all with indexes)

## MCP Handler-First Policy
- `src/mcp/tools/*` handler-based tools take precedence over CLI-backed function implementations
- Zod schemas in `src/mcp/schemas/*` validate all tool inputs/outputs
- Handlers registered via `registerTools()` in `src/mcp/tool-handlers.ts`
- Return validated `structuredContent`; function implementations are fallback only

## File Locations (Self-Hosted Project)
| Artifact | Location |
|----------|----------|
| Project PRD | `zeno/PROJECT_PRD.md` |
| Architecture diagrams | `zeno/architecture/*.md` |
| Gate PRDs (active) | `zeno/gates/gate-XX-name.md` |
| Gate archives | `zeno/gates/archive/<gate-id>.md` |
| Proposals (transient) | `zeno/proposals/gate-XX/<name>.md` |
| Proposal archive | `zeno/proposals/archive/` |
| Requirements DB | `zeno/.zeno/requirements.db` |
| Configuration | `zeno/.zeno/config.json` |
