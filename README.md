# Zeno's Planner

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
- An LLM-powered editor (VS Code + Copilot, Cursor, etc.)

### Installation

```bash
npm install -g zenos-planner
zeno --version
```

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

1. **Initialize** — `zeno init` creates gates from your end goal
2. **Start a gate** — `zeno gates start gate-01` activates the next milestone
3. **Generate proposals** — AI creates implementation proposals for the gate's requirements
4. **Implement** — Work through proposals (AI or manual), scoped to declared files
5. **Validate** — `zeno proposal validate <hash>` runs quality checks
6. **Approve** — Human reviews and approves each proposal
7. **Complete gate** — `zeno gates complete gate-01` archives proposals, creates git tag
8. **Repeat** — Move to the next gate

## Project Structure

```
my-project/
├── zeno/
│   ├── .zeno/                  # Internal state (version controlled)
│   │   ├── config.json         # Project configuration
│   │   ├── state.json          # Current state
│   │   ├── project-overview.json
│   │   └── requirements.db     # SQLite requirements database
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
│   ├── requirements/           # README for requirements DB
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

| Check | Threshold |
|-------|-----------|
| Code Coverage | >= 90% |
| Security Vulnerabilities | 0 |
| Linting Error Rate | < 0.01% |
| Type Checking Errors | 0 |
| Unit Tests | All passing |

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
