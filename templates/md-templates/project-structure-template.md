# [Project Name]: Repository Structure

**Purpose**: Canonical repo map and directory reference for AI agents, contributors, and onboarding  
**Generated**: [DATE]  
**Stack**: [e.g., Node.js/TypeScript | Python | Rust | Go | Monorepo]

---

## Overview

[2-3 sentences describing what this repository contains, its primary responsibility, and its architectural role within the larger system. Identify whether it is a standalone service, library, CLI tool, monorepo, or full-stack application.]

---

## Repository Map

> Legend: `/` = directory &nbsp;|&nbsp; `†` = Zeno-managed
> Only include entries that **exist** in this project. Omit directories, files, and config files that are not present.
> Omit gitignored and generated directories/files (e.g., `coverage/`, `dist/`, `.local/`, `node_modules/`) unless there is an explicit reason to document them.

```text
[project-root]/
│
├── [src-dir]/                    # Primary source tree (see Module Index below)
│   ├── index.[ext]               # Public entry point / barrel export
│   ├── [module-a]/               # [one-line purpose]
│   ├── [module-b]/               # [one-line purpose]
│   ├── [module-c]/               # [one-line purpose]
│   ├── types/                    # Shared type definitions and interfaces
│   └── utils/                    # Cross-cutting helpers (no business logic)
│
├── tests/                        # Test suite
│   ├── [mirror of src/ -or- unit/integration split — owner's choice]
│   ├── fixtures/                 # Shared test data and factory helpers
│   └── setup.[ext]               # Global test bootstrap
│
├── scripts/                      # Developer utilities not in the main build
│   └── [script-name].[ext]       # [one-line purpose]
│
├── docs/                         # Supplemental documentation
│   └── [topic].md
│
├── zeno/                     †   # Zeno's Planner project management layer
│   ├── AGENTS.md             †   # AI agent instructions for this project
│   ├── PROJECT_PRD.md        †   # Single source of truth for project scope
│   ├── architecture/         †   # Generated architecture diagrams
│   ├── gates/                †   # Gate PRDs (active + archived)
│   ├── proposals/            †   # Proposal documents by gate
│   └── .zeno/                †   # Internal Zeno state (registry.db, config.json)
│
├── [package-config]              # e.g., package.json / pyproject.toml / Cargo.toml
├── [build-config]                # e.g., tsconfig.json / setup.cfg / build.rs
├── [test-config]                 # e.g., vitest.config.ts / pytest.ini
├── [lint-config]                 # e.g., eslint.config.mjs / .flake8 / clippy.toml
├── [commit-config]               # e.g., commitlint.config.js
├── LICENSE
├── README.md
└── AGENTS.md                 †   # Root AI agent dispatch and operational guide
```

---

## Module Index

### `[module-a]/` — [Module Name]

**Responsibility**: [One sentence: what this module does and what it does NOT do.]  
**Owns**: [Key types, services, or subsystems managed here.]  
**Consumes**: [Other modules or external packages it depends on.]  
**Exposes**: [Public API surface — re-exported symbols, service interfaces, or CLI commands.]

| File              | Purpose                |
|-------------------|------------------------|
| `[file-a].[ext]`  | [one-line description] |
| `[file-b].[ext]`  | [one-line description] |

---

## Entry Points

| Entry Point            | Invocation              | Purpose                     |
|------------------------|-------------------------|--------------               |
| `[src/index.ext]`      | `import from '[pkg]'`   | Library public API / barrel |
| `[src/main.ext]`       | `[run-command]`         | Application bootstrap       |
| `[src/server.ext]`     | `[start-command]`       | HTTP / RPC server           |

---

## Dependency Flow

[Document your project's module dependency rules here. Common patterns: strict unidirectional layering, domain-driven rings, feature-based isolation. Circular imports are a decision for the project owner to govern via tooling if desired.]

```text
[describe or diagram the dependency direction for this project]
```

---

## Naming Conventions

> Conventions are stack- and language-dependent. Fill in what applies to this project; remove rows that don't apply.

| Artifact | Convention | Example |
| --- | --- | --- |
| Source files | [e.g., `kebab-case` / `snake_case`] | |
| Test files | [e.g., `[name].test.[ext]` / `test_[name].[ext]`] | |
| Classes | [e.g., `PascalCase`] | |
| Functions / methods | [e.g., `camelCase` / `snake_case`] | |
| Constants | [e.g., `UPPER_SNAKE_CASE`] | |
| Types / interfaces | [e.g., `PascalCase` with suffix] | |
| Database tables | [e.g., `snake_case`] | |
| Git branches | `<type>/<ticket>-<description>` | `feature/GH-42-user-auth` |
| Commit messages | `<type>(<scope>): <summary>` | `feat(auth): add refresh token` |
| Gate PRD files | `gate-NN-[kebab-name].md` | `gate-03-api-layer.md` |
| Proposal files | `NN-[phase]--[kebab-name].md` | `01-red--test-suite.md` |
| Architecture diagrams | `[diagram-type].md` or `.svg` | `system-overview.md` |

---

## Extension Points

When adding new capabilities, use these locations:

| What you're adding | Where it goes |
| --- | --- |
| New domain module | `[src-dir]/[module-name]/` |
| New utility function | `[src-dir]/utils/[category].[ext]` |
| New shared type | `[src-dir]/types/[domain].[ext]` |
| New test fixture | `tests/fixtures/[factory-or-mock-name].[ext]` |
| New dev script | `scripts/[script-name].[ext]` (not in build) |
| New gate PRD | `zeno/gates/gate-NN-[name].md` (via `zeno gates generate`) |
| New proposal | `zeno/proposals/gate-NN/NN-[phase]--[name].md` (via `zeno proposal generate`) |
| New architecture diagram | `zeno/architecture/[diagram-name].md` (via `zeno arch generate`) |

---

**Document Version**: 1.0.0  
**Last Updated**: [YYYY-MM-DD]  
**Owner**: [git.user.name]
