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

### Using the `zeno/` Directory as a Shared Git Submodule

By default `zeno init` creates a plain `zeno/` directory inside your project. If you use Zeno across multiple projects and want a **single centralized planning repo** that each implementation repo links to, you can mount `zeno/` as a git submodule.

**Why this is useful:**

- Planning artifacts (gates, proposals, requirements manifests) live in their own versioned repo
- Implementation repos reference a specific commit of the planning data — no drift
- The planning repo can be private while implementation repos are public (or vice versa)
- All Zeno commits land in the planning repo's history; implementation commits land in the implementation repo's history

**Set up a new project with a submodule:**

```bash
cd my-new-project
zeno init --submodule https://github.com/you/my-project-plans.git
```

This runs `git submodule add <url> zeno` before scaffolding, sets `"zenoSubmodule": true` in `zeno/.zeno/config.json`, and from that point all artifact commits (gate archives, proposal approvals) are written to the planning repo's history. The parent repo receives a follow-up commit that updates the submodule pointer.

**Attach a pre-existing planning repo:**

```bash
cd my-new-project
git submodule add https://github.com/you/my-project-plans.git zeno
zeno init   # auto-detects zeno/.git is a submodule gitfile → sets zenoSubmodule: true
```

**Clone a project that uses a submodule:**

```bash
git clone --recurse-submodules https://github.com/you/my-project.git
# or, if already cloned:
git submodule update --init
```

**Configuration flag:**

`zeno/.zeno/config.json`

```json
{
  "zenoSubmodule": true
}
```

Setting `zenoSubmodule: true` manually has the same effect as using the flag — all subsequent Zeno operations will commit inside `zeno/` and update the parent pointer.

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
├── zeno/                       # Planning dir — plain folder OR git submodule (see below)
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
zeno init                                          # Initialize new project
zeno init --submodule <url>                        # Init with zeno/ as a git submodule
zeno status                                        # Show project overview
zeno show <hash>                                   # Resolve hash to entity
zeno doctor                                        # Audit environment prerequisites
zeno trace <artifactHash>                          # Trace git commits for artifact

# Configuration
zeno config show                                   # Show project configuration
zeno config set <key> <value>                      # Update a configuration value

# Gates
zeno gates list                                    # List all gates
zeno gates show <gate-id>                          # Show gate details
zeno gates start <gate-id>                         # Start working on a gate
zeno gates validate <gate-id>                      # Run gate quality checks
zeno gates complete <gate-id>                      # Mark gate complete, create tag
zeno gates replan [gate-id]                        # Regenerate future gates (alias: regenerate)
zeno gates replan --prd-changed                    # Rescope: regenerate from updated PRD end-state

# Requirements
zeno req list [--gate <id>]                        # List requirements
zeno req show <hash>                               # Show requirement details
zeno req deps <hash>                               # Show dependency graph
zeno req transfer <hash> <gate-id>                 # Transfer requirement to another gate
zeno req update <hash>                             # Update requirement fields
zeno req search <query>                            # Search requirements by keyword

# Proposals
zeno proposal list [--gate <id>]                   # List proposals
zeno proposal show <hash>                          # Show proposal details
zeno proposal create <title>                       # Create a new proposal
zeno proposal start <hash>                         # Start proposal (creates worktree)
zeno proposal validate <hash>                      # Run automated checks
zeno proposal approve <hash>                       # Approve proposal
zeno proposal reject <hash>                        # Reject with feedback

# Architecture
zeno arch generate                                 # Generate all diagrams
zeno arch show <type>                              # Show diagram (system|lifecycle|flow|gate-roadmap)

# Repositories
zeno repos list                                    # List detected repos
zeno repos deps                                    # Show dependency graph
zeno repos detect                                  # Re-run boundary detection
zeno repos adjust                                  # Manually adjust boundaries

# Worktrees
zeno worktree list                                 # List active and orphaned worktrees
zeno worktree remove <hash>                        # Remove worktree by proposal hash
zeno worktree prune                                # Remove expired worktrees
zeno worktree merge <hash>                         # Merge worktree branch with conflict handling

# Templates
zeno template list                                 # List available templates
zeno template get <name>                           # Show a template by name
zeno template context <name>                       # Show template context

# Database
zeno db cleanup                                    # Clean up old database records
zeno db validate                                   # Validate database integrity
zeno db checkpoint                                 # Force WAL checkpoint

# Registry
zeno registry rebuild                              # Rebuild the hash registry

# MCP
zeno mcp install [--editor vscode|cursor|windsurf|all]  # Set up editor MCP integration
zeno mcp diagnostics                               # Show MCP server diagnostics
zeno mcp tools                                     # List available MCP tools
zeno mcp errors                                    # Show recent MCP errors
```

## Quality Gates

| Check                    | Threshold   |
| ------------------------ | ----------- |
| Code Coverage            | >= 90%      |
| Security Vulnerabilities | 0           |
| Linting Error Rate       | < 0.01%     |
| Type Checking Errors     | 0           |
| Unit Tests               | All passing |

## Multi-language Analysis

Zeno's Planner can analyze non-JavaScript/TypeScript codebases using
[Tree-sitter](https://tree-sitter.github.io/tree-sitter/) as an optional
parsing backend.

**Supported languages** (via optional dependencies):

| Language | npm package | Recognized extensions |
|----------|-------------|----------------------|
| Python   | `tree-sitter-python` | `.py` |
| Rust     | `tree-sitter-rust`   | `.rs` |
| Go       | `tree-sitter-go`     | `.go` |
| C / C++  | `tree-sitter-cpp`    | `.c`, `.h`, `.cpp` |

Enable the Tree-sitter backend when running analysis programmatically:

```typescript
import { CodeAnalyzer } from './src/analysis/code-analyzer.js';

const analyzer = new CodeAnalyzer({ enableTreeSitter: true });
const result = await analyzer.analyzeCodebase('/path/to/project');

console.log(result.fileCount);          // includes .py / .rs / .go / .cpp
console.log(result.totalLOC);           // aggregated across all languages
```

- The Babel path (JS/TS) and Tree-sitter path run in the same pass; results are
  merged into a single `AnalysisResult`.
- Dependency extraction (`imports`/`exports`) is only available for Babel-parsed
  files; Tree-sitter modules have empty dependency arrays.
- LOC metrics (code / blank / comment lines) are available for all supported
  languages via `extractTreeSitterMetrics()`.

## Documentation

- [PROJECT_PRD.md](zeno/overview/PROJECT_PRD.md) — Product requirements (single source of truth)
- [Architecture](zeno/architecture/) — System design diagrams
- [AGENTS.md](AGENTS.md) — AI agent reference guide
- [Schemas](schemas/) — JSON validation schemas

## License

MIT — see [LICENSE](LICENSE) for details.

## Acknowledgments

- Inspired by [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven development
- Based on Zeno's dichotomy paradox
- Built for the AI coding assistant era
