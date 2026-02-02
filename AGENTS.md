# Zeno's Planner: AI Agent Instructions

Quick reference for AI coding assistants on how to work with Zeno's Planner projects.

## Cross-File Navigation

| Document | Purpose | Location |
|----------|---------|----------|
| **Root AGENTS.md** | General Zeno's Planner tool usage | `AGENTS.md` (this file) |
| **Project AGENTS.md** | Project-specific AI context | `zeno/AGENTS.md` |
| **Project PRD** | Single source of truth for project scope | `zeno/PROJECT_PRD.md` |
| **Architecture Docs** | System design and diagrams | `zeno/architecture/*.md` |
| **AGENTS Template** | Template for generating project guides | `templates/md-templates/agents-template.md` |

## File Structure

Zeno's Planner uses a two-level documentation pattern:

```
project-root/
├── AGENTS.md              # This file - lightweight tool overview
└── zeno/
    └── .zeno/             # Internal state (version controlled)
    └── AGENTS.md          # Detailed project-specific guide (generated)
```

## Quick Start

**If you're working in a Zeno-initialized project:**

1. **Read `zeno/AGENTS.md` first** - Contains detailed instructions on:
   - How to read project artifacts (PRD, architecture diagrams, requirements)
   - Where files are located
   - Database schema and query patterns
   - Hash-based reference system
   - Quality thresholds
   - Command reference
   - Project-specific conventions

2. **Reference `zeno/PROJECT_PRD.md`** - Single source of truth for:
   - Project scope and goals
   - Technical decisions with rationale
   - User stories
   - Timeline and gates
   - Out of scope items

3. **Check architecture documentation** - Visual system overview:
   - `zeno/architecture/system-overview.md` - Component architecture
   - `zeno/architecture/gate-lifecycle.md` - State machine
   - `zeno/architecture/data-flow.md` - End-to-end flow
   - `zeno/architecture/gate-roadmap.md` - Gate roadmap

## Core Concepts

- **Gates**: Concrete milestones representing actual deliverables, not percentages. Progress measured by completion, not time
- **Hash-Based References**: `#a3f9c2d1` format for internal tracking/commands (internal only). Resolve to plain text names when communicating with users
- **Quality Thresholds**: 90% coverage, 0 vulnerabilities, <0.01% linting, 0 TypeScript errors (strict mode)
- **Human Approval**: Required at gate generation, repository boundaries, proposals, and gate completion

**MCP Handler-First Policy**: Handler-based tools take precedence over CLI-backed function implementations when registering MCP tools. This allows handlers to provide predictable, schema-validated `structuredContent` for LLMs, while function implementations remain available as a fallback. Prefer adding handler implementations for new or critical tools and migrate CLI implementations into handlers incrementally.

**Migration guidance**:
- Implement handler logic in `src/mcp/tools/*` and validate outputs with Zod schemas in `src/mcp/schemas/*`.
- Register handler factories via `registerTools()` (already implemented) so they override function-based tools.
- Add tests that mock the `FunctionRegistry` to assert handlers return validated `structuredContent`.
- Keep CLI commands for backwards compatibility until the handler logic is fully implemented and covered by tests.

## Complete Command Reference

| Category | Command | Description |
|----------|---------|-------------|
| **Project** | `zeno init` | Initialize new project |
| | `zeno status` | Show project overview |
| | `zeno dashboard` | Launch TUI dashboard (Gate 11+) |
| | `zeno rescope` | Rescope project mid-development |
| **Gates** | `zeno gates list` | List all gates |
| | `zeno gates show <id>` | Show gate details |
| | `zeno gates start <id>` | Start gate (pending → in_progress) |
| | `zeno gates complete <id>` | Complete gate (→ completed, creates tag) |
| | `zeno gates regenerate` | Regenerate future gates |
| **Requirements** | `zeno req list [--gate <id>]` | List requirements |
| | `zeno req show <hash>` | Show requirement details |
| | `zeno req deps <hash>` | Show dependency graph |
| | `zeno req status <hash> <status>` | Update status |
| | `zeno req transfer <hash> <gate-id>` | Transfer requirement to another gate |
| **Architecture** | `zeno arch generate` | Generate all diagrams |
| | `zeno arch show <type>` | Show specific diagram type |
| **Repositories** | `zeno repos list` | List detected repositories |
| | `zeno repos deps` | Show cross-repo dependencies |
| | `zeno repos detect` | Re-run boundary detection |
| | `zeno repos adjust` | Manually adjust boundaries |
| **Proposals** | `zeno proposal list [--gate <id>]` | List proposals |
| | `zeno proposal show <hash>` | Show proposal details |
| | `zeno proposal validate <hash>` | Run automated checks |
| | `zeno proposal approve <hash>` | Approve proposal (human) |
| | `zeno proposal reject <hash>` | Reject proposal (human) |
| **Analysis** | `zeno analyze [path]` | Deep codebase analysis |
| | `zeno metrics [path]` | Show code metrics |
| **Registry** | `zeno show <hash>` | Resolve hash to entity |
| | `zeno registry rebuild` | Rebuild hash registry |

## Typical Workflow

1. **Check status**: `zeno gates list` to see current gate
2. **Read gate PRD**: `zeno/gates/gate-XX-name.md`
3. **Review requirements**: `zeno req list --gate "<id>"`
4. **View proposals**: `zeno proposal show "<hash>"`
5. **Validate**: `zeno proposal validate "<hash>"`
6. **Wait for approval**: Human runs `zeno proposal approve "<hash>"`
7. **Implement**: Execute approved proposal
8. **Repeat**: Continue with next requirement

## Best Practices

| Practice | Do | Don't |
|----------|----|-------|
| **References** | Use hashes internally, resolve to names for users | Expose hashes in user-facing text |
| **Dependencies** | Check `zeno req deps <hash>` before implementation | Implement without verification |
| **Quality** | Enforce 90% coverage, 0 vulns, <0.01% lint errors | Skip automated checks |
| **Approval** | Wait for human sign-off at key gates | Auto-implement without review |
| **Context** | Reference architecture diagrams | Implement blindly |
| **Commits** | Use structured messages with proposal hashes | Generic commit messages |
## Traceability via Git History

Use Git history to trace work back to Zeno artifacts (requirements, proposals, gates) by leveraging the project's commit format and the artifact hash values.

- Parse `commitFormat` in `.zeno/config.json` to extract commit type and scope (for example: `feat(gate): archive core-infrastructure gate ...`).
- Require commit messages to include related Zeno hashes (`#<hash>`) in the subject or body so that commits can be automatically associated with requirements, proposals, or gates.
- Useful commands for tracing work:
  - `git log --grep '#<hash>' --pretty=format:'%h %ad %an %s%n%b' --date=short` — list commits referencing a hash.
  - `git log --pretty=format:'%h %ad %an %s' --grep 'feat(' --date=short` — find commits by type/scope matching the configured commitFormat.
- Cross-reference the resolved entity using `zeno show <hash>` to confirm the commit maps to the correct proposal/requirement/gate.
- Best practice: when archiving or completing work, include both the proposal or requirement hash and the gate id in the commit message using the configured `commitFormat` so automation and audits can detect and tag the change.

## File Locations Quick Reference

| Artifact | Location |
|----------|----------|
| Detailed AI instructions | `zeno/AGENTS.md` |
| Project PRD | `zeno/PROJECT_PRD.md` |
| Architecture diagrams | `zeno/architecture/*.md` |
| Gate PRDs | `zeno/gates/gate-XX-name.md` |
| Requirements database | `zeno/.zeno/requirements.db` |
| Proposals (active) | `zeno/proposals/gate-XX/<name>.md` |
| Proposals (completed) | `zeno/proposals/archive/<hash>.md` |
| Configuration | `zeno/.zeno/config.json` |

## Zeno vs Traditional Spec Systems

Zeno expands beyond traditional spec-driven development (like OpenSpec):

| Aspect | Traditional Specs | Zeno's Planner |
|--------|------------------|----------------|
| Scope | Implementation details | Vision → Implementation |
| Planning | Manual milestones | Iterative gate decomposition |
| Architecture | Optional design docs | Required Mermaid diagrams |
| Requirements | Flat capability list | Hierarchical gate decomposition |
| Dependencies | Manual tracking | Hash-based automated tracking |
| Multi-Repo | Not addressed | Automated detection + scaffolding |
| Quality | External tools | Integrated enforcement |
| Progress | Change-based | Gate completion tracking |

Zeno provides project-level planning (gates, roadmap) with architecture as a first-class citizen, queryable requirements database, automated analysis, quality enforcement, and cross-repository intelligence.

## For More Details

**Read `zeno/AGENTS.md`** in your project for:
- Complete command reference with examples
- Database schema and query patterns
- Hash registry usage
- Workflow examples
- Troubleshooting guide
- Project-specific conventions
- Quality metrics calculation
- Git integration details

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-04  
**Status**: Active - Production Ready

**Zeno's Planner** | Bridging Vision and Implementation
