 # Zeno's Planner

Zeno's Planner is a lightweight, LLM-friendly project planning and orchestration tool that bridges the gap between high-level vision and detailed implementation. Based on Zeno's dichotomy paradox, it generates iterative milestones (gates) that progressively approach your project goal, with human approval and automated quality checks at every step.

## Core Concept

**The Problem**: Large projects are overwhelming. LLMs lose context. Requirements drift. Code quality suffers.

**The Solution**: Zeno's Planner decomposes your end goal into manageable gates inspired by Zeno's paradox:
- Gate 1: Foundation (conceptually 50% to goal)
- Gate 2: Core Features (75% to goal)
- Gate 3: Advanced Features (87.5% to goal)
- Gate 4: Polish (93.75% to goal)
- Gate N: Progressively approach completion

**Note**: Percentages shown above are conceptual aids to help the user understand the iterative approach. The tool does not use percentages in its functionality - each gate represents concrete deliverables that move the project closer to the end goal.

Each gate generates:
- Requirements (SQLite database with hash-based references)
- Architecture (Mermaid diagrams)
- Subprojects (Multi-repo detection and scaffolding)
- Proposals (OpenSpec-inspired change notices)
- Quality Gates (90% coverage, 0 vulnerabilities, <0.01% lint errors)

## Key Features

### LLM-Optimized
- **Hash-based references**: `#a3f9c2d1` instead of long file paths
- **Reduced context**: Reference requirements without full content
- **Dependency tracking**: Prevent conflicts across parallel work
- **Structured memory**: SQLite database for long-term project knowledge

### Human-in-the-Loop
- **Gate approval**: Review and approve each milestone
- **Proposal approval**: Review generated code before commit
- **Rescope support**: Regenerate future gates when goals change
- **Quality thresholds**: Automated checks before human review

### Deep Code Analysis
- **AST parsing**: Understand existing codebase structure
- **Dependency graphs**: Visualize module relationships
- **Coupling metrics**: Detect repo boundaries automatically
- **Confidence scoring**: Flag uncertain architectural decisions

### Quality Enforcement
- **Code Coverage**: 90% minimum (configurable)
- **Security**: 0 vulnerabilities allowed
- **Linting**: <0.01% error rate
- **Pre-commit hooks**: Block commits that fail checks

### Multi-Repo Support
- **Automatic detection**: Identify logical repo boundaries
- **Scaffolding**: Generate package.json, tsconfig, etc.
- **Cross-repo deps**: Track dependencies with hashes
- **Monorepo support**: Limited (focus on proper separation)

## Quick Start

### Prerequisites
- Node.js >= 20.19.0
- Git 2.x
- LLM access (Cursor, Claude, GPT-4, etc.)

### Installation

```bash
# Install globally
npm install -g zenos-planner

# Verify installation
zeno --version
```

### Editor Integrations (MCP)

Zeno supports editor integrations (VS Code, Cursor, Windsurf) via the MCP protocol. Use the CLI installer to set up editor configs and optional adapters, or run the single-step install from your workspace. The installer is idempotent and supports workspace-local or global installation (global installs may require elevated privileges on some platforms).

Quick 3-step setup (recommended):
1. Install Zeno CLI (global or per-user): `npm install -g zenos-planner`
2. Run installer for your editor: `zeno mcp install --editor <vscode|cursor|windsurf|all> [--global]`
3. Follow the printed next steps (enable MCP in the editor or run the adapter activation command)

Example `mcp.json` (workspace):
```json
{
  "servers": {
    "zenoPlanner": {
      "command": "node",
      "args": ["./bin/mcp-server.js"],
      "env": { "ZENO_PROJECT_ROOT": "${workspaceFolder}" }
    }
  }
}
```

Flags:
- `--editor`: which editor(s) to scaffold. Defaults to `vscode` if omitted.
- `--global`: install adapter globally (requires admin rights on some platforms). Otherwise installs workspace-local files.
- `--dry-run`: display actions without making changes.

Editor notes:
- **VS Code**: installer writes `mcp.json` and prints the VS Code steps to enable MCP; see `docs/MCP_VSCODE_SETUP.md` for screenshots and examples.
- **Cursor**: installer can register a global or workspace adapter; you can also run `node ./bin/mcp-server.js --adapter cursor` to start manually.
- **Windsurf**: similar to Cursor; installer provides a small helper script to launch a local WebSocket bridge if required.

Security & Permissions:
- Global installs may prompt for admin permissions. The installer will not modify unrelated files.

See `docs/MCP_VSCODE_SETUP.md` for VS Code-specific examples and troubleshooting.

### Initialize a New Project

```bash
# Navigate to your project
cd my-project

# Initialize Zeno
zeno init

# Follow interactive prompts:
# 1. Project name?
# 2. Existing codebase or greenfield?
# 3. [If existing] Analyze codebase now?
# 4. Describe your end goal (natural language)
```

### Example: Greenfield Project

```bash
$ zeno init

Zeno's Planner Initialization

Project name: Task Management App
Existing codebase? No
Describe your end goal:
> A full-stack task management app with user auth, 
> real-time collaboration, file attachments, and 
> mobile-responsive UI. Support 1000+ concurrent users.

Generating gates using Zeno's paradox...

Generated 5 gates:
  1. Gate 1: Foundation (50%) - Database, auth, basic CRUD
  2. Gate 2: Core Features (75%) - Real-time sync, file uploads
  3. Gate 3: Advanced Features (87.5%) - Collaboration, notifications
  4. Gate 4: Polish (93.75%) - Mobile UI, performance optimization
  5. Gate 5: Production Ready (96.875%) - Security audit, deployment

Note: Percentages are conceptual markers to help humans understand progress, not used in tool functionality.

Next steps:
  zeno gates list          # View all gates
  zeno gates start gate-01 # Start working on Gate 1
```

### Example: Existing Codebase

```bash
$ zeno init

Zeno's Planner Initialization

Project name: Legacy E-commerce Platform
Existing codebase? Yes
Codebase path: ./src

Analyzing codebase...
  Parsing AST (1,247 files)
  Extracting dependencies (3,891 imports)
  Calculating metrics (coupling, cohesion, complexity)
  Detecting architecture patterns

Current state detected:
  - Monolithic Express.js app (87,432 LOC)
  - PostgreSQL database
  - React frontend (mixed with backend)
  - Test coverage: 34%
  - 12 security vulnerabilities

Describe your end goal:
> Migrate to microservices architecture with separate 
> repos for user service, product service, and order service.
> Increase test coverage to 90%+. Fix all security issues.

Generating gates...

Generated 6 gates:
  1. Gate 1: Security Fixes (50%) - Fix vulnerabilities, add auth
  2. Gate 2: Test Coverage (75%) - Increase coverage to 90%
  3. Gate 3: Extract User Service (87.5%) - Separate repo, API gateway
  4. Gate 4: Extract Product Service (93.75%) - Separate repo, shared types
  5. Gate 5: Extract Order Service (96.875%) - Separate repo, event bus
  6. Gate 6: Production Migration (98.4375%) - Deploy, monitor, rollback plan

Note: Percentages are conceptual markers to help humans understand progress, not used in tool functionality.

Next steps:
  zeno arch show system    # View current architecture
  zeno gates start gate-01 # Start with security fixes
```

## Workflow

### 1. Start a Gate

```bash
$ zeno gates start gate-01

Starting Gate 1: Foundation...

Phase 1: Generating architecture diagrams...
  System overview (system-overview.mmd)
  Data flow (data-flow.mmd)
  Component diagram (components.mmd)

Phase 2: Generating requirements...
  24 requirements created
  Stored in zeno/.zeno/requirements.db
  Hash registry updated

Phase 3: Detecting repository boundaries...
  Detected 3 repos: main-app, shared-lib, user-service
  Confidence scores: 0.89, 0.92, 0.87
  
  Review repo split? (y/n): y
  Repos approved

Phase 4: Generating proposals...
  24 proposals generated (1 per requirement)
  Stored in zeno/proposals/gate-XX/

Phase 5: Running automated checks...
  Linting: passed
  Type checking: passed
  Tests: passed
  Coverage: 0% (baseline for new project)
  Security: passed
  Dependencies: no conflicts

Gate 1 ready for implementation!

Next steps:
  zeno proposal list       # View all proposals
  zeno proposal show <hash> # View specific proposal
  
  # In your LLM (Cursor):
  "Implement proposal #a3f9c2d1"
```

### 2. Implement Proposals

```bash
# In Cursor terminal, ask your LLM:
You: Implement proposal #a3f9c2d1

LLM: I'll implement the user authentication requirement.
     *Generates code*
     *Runs tests*
     *Checks coverage*

# Validate the implementation
$ zeno proposal validate a3f9c2d1

Running automated checks...
  Linting: passed (0 errors)
  Type checking: passed
  Tests: passed (12/12)
  Coverage: 94% (threshold: 90%) PASS
  Security: 0 vulnerabilities PASS
  Dependencies: no conflicts

All checks passed! Ready for approval.
```

### 3. Approve and Commit

```bash
$ zeno proposal approve a3f9c2d1

Proposal approved!

# Commit (pre-commit hook runs automatically)
$ git commit -m "feat: implement user authentication"

Running pre-commit checks...
  No pending proposals
  All automated checks passed

Commit successful!

Proposal #a3f9c2d1 marked as implemented.
```

### 4. Complete Gate

```bash
$ zeno gates complete gate-01

Checking gate completion...
  24/24 proposals implemented
  All quality gates passed
  Code coverage: 92%
  Security: 0 vulnerabilities
  Linting: 0.003% error rate

Creating release...
  Git tag created: gate-01-foundation
  Gate marked as complete

Gate 1 complete! Ready for Gate 2.

Next steps:
  zeno gates start gate-02
```

### 5. Rescope (Optional)

```bash
# If your end goal changes mid-project
$ zeno rescope

Current gate: Gate 2 (in progress)
Completed gates: Gate 1

Your end goal has changed? Describe the new goal:
> Actually, we need to add real-time notifications 
> and integrate with Stripe for payments.

Generating rescope gate...
  Rescope gate created (documents the change)

Regenerating future gates...
  Deleted old gates 3-5
  Generated new gates 3-6

New gates:
  3. Gate 3: Real-time Notifications (87.5%)
  4. Gate 4: Stripe Integration (93.75%)
  5. Gate 5: Advanced Features (96.875%)
  6. Gate 6: Production Ready (98.4375%)

Project rescoped! Continue with Gate 2.
```

## Project Structure

```
my-project/
├── zeno/                           # All Zeno artifacts
│   ├── .zeno/                      # Internal state (version controlled)
│   │   ├── config.json             # Project configuration
│   │   ├── state.json              # Current state
│   │   └── requirements.db         # SQLite database
│   ├── gates/                      # Gate PRDs
│   │   ├── gate-01-foundation.md
│   │   ├── gate-02-core-features.md
│   │   └── ...
│   ├── architecture/               # Mermaid diagrams
│   │   ├── system-overview.mmd
│   │   ├── data-flow.mmd
│   │   └── components.mmd
│   ├── requirements/
│   │   └── requirements.db         # Symlink to .zeno/requirements.db
│   ├── subprojects/
│   │   ├── repo-map.json
│   │   └── dependency-graph.mmd
│   └── proposals/
│       ├── active/
│       │   └── add-user-auth/
│       │       ├── proposal.md
│       │       ├── tasks.md
│       │       └── changes.md
│       └── completed/
├── src/                            # Your code
└── package.json
```

## CLI Commands

### Initialization
```bash
zeno init                    # Initialize project
zeno analyze                 # Analyze existing codebase
```

### Gate Management
```bash
zeno gates list              # List all gates
zeno gates show <gate-id>    # Show gate details
zeno gates start <gate-id>   # Start working on a gate
zeno gates complete <gate-id> # Mark gate as complete
zeno gates rescope           # Rescope remaining gates
```

### Requirements
```bash
zeno req list [--gate <id>]  # List requirements
zeno req show <hash>         # Show requirement by hash
zeno req deps <hash>         # Show dependencies
```

### Proposals
```bash
zeno proposal list           # List active proposals
zeno proposal show <hash>    # Show proposal details
zeno proposal validate <hash> # Run automated checks
zeno proposal approve <hash> # Human approval
zeno proposal reject <hash>  # Reject with feedback
```

### Architecture
```bash
zeno arch generate           # Generate architecture diagrams
zeno arch show <type>        # Show diagram (system|data-flow|components)
```

### Repositories
```bash
zeno repos list              # List detected repos
zeno repos deps              # Show dependency graph
```

### Utilities
```bash
zeno show <hash>             # Show any entity by hash
zeno status                  # Show project status
zeno dashboard               # Interactive TUI dashboard
```

## Architecture Diagrams

Zeno generates Mermaid diagrams for visualization:

- **System Overview**: High-level component architecture
- **Data Flow**: How data moves through the system
- **Gate Roadmap Diagram**: Gates and their supporting features
- **Dependency Graph**: Cross-repo and module dependencies
- **Component Diagram**: Detailed component breakdown

View diagrams in:
- VS Code (with Mermaid extension)
- GitHub (native Mermaid support)
- [Mermaid Live Editor](https://mermaid.live/)

## Hash-Based References

Instead of long file paths, Zeno uses content-addressable hashes:

```bash
# Traditional (verbose, context-heavy)
"See requirement in /Users/me/project/zeno/requirements.db table requirements row 42"

# Zeno (concise, LLM-friendly)
"See requirement #a3f9c2d1"

# LLM can resolve the hash
$ zeno show a3f9c2d1

Type: Requirement
Hash: a3f9c2d1
Gate: gate-01-foundation
Description: User authentication with JWT tokens
Priority: must
Status: implemented

Dependencies:
  - #b7e4d8f2: Core library (requires)
  - #c9a1e5b3: Types library (requires)
```

## Quality Gates

Every proposal must pass automated checks before human approval:

| Check | Threshold | Configurable |
|-------|-----------|--------------|
| Code Coverage | 90% | No (MVP) |
| Security Vulnerabilities | 0 | No (MVP) |
| Linting Error Rate | <0.01% | No (MVP) |
| Type Checking | 0 errors | No (MVP) |
| Unit Tests | All passing | No (MVP) |
| Dependency Conflicts | 0 conflicts | No (MVP) |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Roadmap

### MVP (v1.0) - 6 months
- Core infrastructure
- Zeno engine & gate generation
- Requirements database
- Architecture generation (Mermaid)
- Multi-repo detection
- Proposal system
- Automated validation
- Human approval workflow
- Git integration
- Rescope engine
- TUI dashboard

### Future (v2.0+)
- [ ] Multi-LLM orchestration
- [ ] GitHub Projects integration
- [ ] Custom quality thresholds
- [ ] Plugin system
- [ ] Web UI
- [ ] Team collaboration
- [ ] Advanced analytics

## Documentation

- [PRD](zeno/PROJECT_PRD.md) - Complete product requirements
- [Architecture](zeno/architecture/) - System design diagrams
- [AGENTS.md](AGENTS.md) - AI agent context guide
- [API Reference](docs/api.md) - CLI command reference (coming soon)
- [Examples](examples/) - Example projects (coming soon)

## Support

- [GitHub Issues](https://github.com/yourusername/zenos-planner/issues)
- [Discussions](https://github.com/yourusername/zenos-planner/discussions)
- [Discord](https://discord.gg/zenos-planner) (coming soon)

## Acknowledgments

- Inspired by [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven development
- Based on Zeno's dichotomy paradox
- Built for the AI coding assistant era

---

Built for developers who want to build ambitious projects without losing their way
