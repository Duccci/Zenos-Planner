# Zeno's Planner

[![Test](https://github.com/Duccci/zenos-planner/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Duccci/zenos-planner/actions/workflows/test.yml)
[![Lint](https://github.com/Duccci/zenos-planner/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/Duccci/zenos-planner/actions/workflows/lint.yml)
[![Security](https://github.com/Duccci/zenos-planner/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/Duccci/zenos-planner/actions/workflows/security.yml)
[![Coverage](https://github.com/Duccci/zenos-planner/actions/workflows/coverage.yml/badge.svg?branch=main)](https://github.com/Duccci/zenos-planner/actions/workflows/coverage.yml)

Zeno's Planner is an LLM-friendly project planning and orchestration tool that decomposes high-level goals into iterative milestones (gates), with human approval and automated quality checks at every step. Inspired by Zeno's dichotomy paradox — each gate brings the project progressively closer to the end goal.

## Core Concept

Large projects overwhelm both humans and LLMs. Requirements drift, context is lost, and code quality suffers. Zeno addresses this by decomposing your end goal into concrete, sequential gates:

- Each gate represents real deliverables, not percentages or time estimates
- Gates generate requirements (SQLite), architecture diagrams (Mermaid), and proposals (markdown)
- Quality gates enforce thresholds before human review
- Hash-based references (`#a3f9c2d1`) keep LLM context compact

## Key Features

- **LLM-Optimized**: Hash references, SQLite-backed requirements, dependency tracking, reduced context size
- **Human-in-the-Loop**: Gate approval, proposal review, rescope support
- **Code Analysis**: AST parsing, dependency graphs, coupling metrics, repo boundary detection
- **Quality Enforcement**: 90% coverage, 0 vulnerabilities, <0.01% lint error rate
- **Multi-Repo Support**: Automatic boundary detection, cross-repo dependency tracking
- **MCP Server**: Editor integration via Model Context Protocol (VS Code, Cursor, Windsurf)

## Quick Start

### Prerequisites

- Node.js >= 24.0.0
- Git 2.x
- Graphviz >= 14.0 (for architecture diagram rendering)
- An LLM-powered editor (VS Code + Copilot, Cursor, etc.)

### Installation

```bash
npm install -g zenos-planner
zeno --version
```

#### System Dependencies

Zeno's architecture diagram generation uses Graphviz for rendering. Install the `graphviz` system package:

**macOS:**

```bash
brew install graphviz
```

**Ubuntu/Debian:**

```bash
sudo apt-get install graphviz
```

**Windows (Chocolatey):**

```bash
choco install graphviz
```

**Windows (Windows Package Manager):**

```bash
winget install graphviz
```

Or download from [graphviz.org](https://graphviz.org/download/).

### MCP Editor Integration

Add to your workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "zeno-planner": {
      "type": "stdio",
      "command": "node",
      "args": ["./bin/mcp-server.js"],
      "description": "Zeno Planner MCP server for AI-powered project management"
    }
  }
}
```

Or use the CLI installer:

```bash
zeno mcp install --editor vscode
```

### Initialize a Project

```bash
cd my-project
zeno init
```

## Workflow

Zeno's workflow consists of three phases: **Planning**, **Review**, and **Execution**. Gates flow through these phases iteratively until the project end goal is reached.

### Planning Phase

1. **Initialize** — `zeno init` decomposes your end goal into concrete gates
2. **Gate Analysis** — Determine gate type (API, Database, Frontend, etc.)
3. **Generate Requirements** — Zeno generates gate-specific requirements from project constraints
4. **Generate Proposals** — AI creates implementation proposals addressing the requirements
5. **Architecture Review** — Review system design diagrams and cross-gate dependencies

### Review Phase

1. **Check Status** — `zeno gates list` shows all gates and their status
2. **Read Gate PRD** — `zeno gates show <gate-id>` displays detailed gate requirements
3. **Review Requirements** — `zeno req list --gate <gate-id>` shows assigned tasks
4. **View Proposals** — `zeno proposal show <hash>` displays implementation strategies
5. **Approve Proposals** — Human reviews and approves each proposal before implementation

### Execution Phase

1. **Start Gate** — `zeno gates start <gate-id>` marks milestone as in-progress
2. **Implement Proposals** — Apply approved proposals; Zeno validates they match specification
3. **Validate Quality** — `zeno proposal validate <hash>` runs automated checks:
    - Code coverage >= 90%
    - Zero known vulnerabilities
    - Lint error rate < 0.01%
    - All tests passing
4. **Reject or Approve** — Proposals are approved if quality gates pass
5. **Complete Gate** — `zeno gates complete <gate-id>` archives proposals and creates git tag
6. **Repeat** — Move to the next gate

### Key Workflow Principles

- **Sequential Gates** — Each gate represents a concrete deliverable, not a percentage
- **Hash References** — Use `#a3f9c2d1` format to reference proposals, requirements, and gates with minimal context
- **Human Approval** — Required at gate generation, proposal review, and completion
- **Automated Quality** — 90% coverage, 0 vulnerabilities, <0.01% lint errors enforced before approval
- **Git Integration** — Commits reference artifact hashes for full traceability

## Git Workflow

### Branch Naming

Use kebab-case branch names following the pattern:

```text
<type>/<ticket-id>-<description>
```

**Types:**

- `feature/` — New functionality
- `bugfix/` — Bug fixes for issues
- `hotfix/` — Critical production fixes
- `refactor/` — Code restructuring without behavior changes
- `docs/` — Documentation updates
- `test/` — Test additions or improvements
- `chore/` — Build, tooling, or dependency updates

**Examples:**

```bash
git checkout -b feature/GH-42-auth-middleware
git checkout -b bugfix/GH-88-fix-memory-leak
git checkout -b docs/GH-3-api-endpoint-docs
```

### Commit Messages

Write clear, descriptive commit messages:

- **First line** (50–72 chars): Summary of changes
- **Body** (optional, wrapped at 72 chars): Extended explanation of why changes were made and any breaking changes

**Format:**

```text
<type>(<scope>): <subject>

<body>
```

**Reference related issues/artifacts:**

```text
feat(gate): implement authentication layer

- Add JWT middleware for request validation
- Integrate session management with database

Addresses #42
Related to #a3f9c2d1 (proposal hash)
```

### Pull Requests

**Before requesting review:**

- Keep PRs small (<400 lines of changes)
- Single responsibility per PR
- Self-review: verify code quality, tests, and coverage
- All CI/CD checks must pass

**PR Description:**

- Reference related issue(s) or Zeno artifacts: `Fixes #42`, `Related to #a3f9c2d1`
- Link proposals and requirements being implemented
- Document any breaking changes
- Include test coverage or QA steps if applicable

### Merge Strategies

- **Feature branches** — Squash and merge (clean, linear history)
- **Hotfix branches** — Rebase and merge (preserves commits for traceability)
- **Main/develop** — Never force push

**Merging with Zeno:**
When completing a gate (`zeno gates complete <gate-id>`), include related artifact hashes in the commit message:

```bash
zeno gates complete gate-04

# Results in commit like:
# feat(gate): archive core-infrastructure gate #a3f9c2d1
```

## Project Structure

```text
my-project/
├── zeno/
│   ├── .zeno/                  # Internal state (version controlled)
│   │   ├── config.json         # Project configuration
│   │   ├── state.json          # Historical snapshot of gate progress (synced with workflow)
│   │   ├── project-overview.json
│   │   └── registry.db         # SQLite registry database
│   ├── AGENTS.md               # Project-specific AI context guide
│   ├── PROJECT_PRD.md          # Single source of truth for scope
│   ├── architecture/           # Mermaid diagram docs
│   │   ├── system-overview.md
│   │   ├── data-flow.md
│   │   ├── gate-lifecycle.md
│   │   └── gate-roadmap.md
│   ├── gates/                  # Gate PRDs (active)
│   │   ├── gate-04-requirements-database-layer.md
│   │   └── ...
│   ├── gates/archive/          # Completed gates
│   ├── proposals/              # Proposals organized by gate
│   │   └── gate-XX/            # Proposal records (pending/in_progress/completed/rejected)
│   ├── requirements/           # README for registry DB
│   └── subprojects/            # Multi-repo detection artifacts
├── src/                        # Source code
├── agents/                     # AI agent definitions (git submodule)
├── templates/                  # Gate, proposal, architecture templates
├── schemas/                    # JSON validation schemas
├── AGENTS.md                   # Root AI agent reference
└── package.json
```

## CLI Reference

```bash
# Project
zeno init                         # Initialize new project
zeno status                       # Show project overview
zeno show <hash>                  # Resolve hash to entity
zeno config                       # Show project configuration
zeno trace <hash>                 # Trace git commits for artifact

# Gates
zeno gates list                   # List all gates
zeno gates show <gate-id>         # Show gate details
zeno gates start <gate-id>        # Start working on a gate
zeno gates complete <gate-id>     # Mark gate complete, create tag

# Requirements
zeno req list [--gate <id>]       # List requirements
zeno req show <hash>              # Show requirement details
zeno req deps <hash>              # Show dependency graph

# Proposals
zeno proposal list [--gate <id>]  # List proposals
zeno proposal show <hash>         # Show proposal details
zeno proposal validate <hash>     # Run automated checks
zeno proposal approve <hash>      # Approve proposal
zeno proposal reject <hash>       # Reject with feedback

# Architecture
zeno arch generate                # Generate all diagrams
zeno arch show <type>             # Show diagram (system|lifecycle|flow|gate-roadmap)

# Repositories
zeno repos list                   # List detected repos
zeno repos deps                   # Show dependency graph
zeno repos detect                 # Re-run boundary detection
zeno repos adjust                 # Manually adjust boundaries

# Templates
zeno template                     # Access project templates

# MCP
zeno mcp install                  # Set up editor MCP integration
```

## Quality Gates

| Check                    | Threshold   |
| ------------------------ | ----------- |
| Code Coverage            | >= 90%      |
| Security Vulnerabilities | 0           |
| Linting Error Rate       | < 0.01%     |
| Type Checking Errors     | 0           |
| Unit Tests               | All passing |

## Documentation

- [PROJECT_PRD.md](zeno/PROJECT_PRD.md) — Product requirements (single source of truth)
- [Architecture](zeno/architecture/) — System design diagrams
- [AGENTS.md](AGENTS.md) — AI agent reference guide
- [Schemas](schemas/) — JSON validation schemas

## License

MIT — see [LICENSE](LICENSE) for details.

## Acknowledgments

- Inspired by [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven development
- Based on Zeno's dichotomy paradox
- Built for the AI coding assistant era
