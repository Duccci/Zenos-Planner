# Zeno's Planner: AI Agent Instructions

Quick reference for AI coding assistants on how to work with Zeno's Planner projects.

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

## Core Concepts (Quick Reference)

### Zeno's Paradox Methodology
- Gates are project milestones that progressively move toward the end goal
- Each gate represents concrete deliverables, not percentages
- Conceptually inspired by Zeno's paradox to help humans understand the iterative approach
- Percentages are NOT used in functionality - only as a conceptual explanation
- Progress measured by gate completion, not time estimates or percentages

### Hash-Based References (Internal Only)
- Hashes like `#a3f9c2d1` are for **internal tracking and system commands only**
- Reduces LLM context size by 50%+
- Enables cross-repository dependency tracking
- Format: SHA-256 (first 16 characters)
- **When communicating with users**: Always resolve hashes to plain text names (e.g., say "User Authentication requirement" not "#a3f9c2d1")

### Quality Thresholds (Non-Configurable in MVP)
- Code Coverage: 90% minimum
- Security Vulnerabilities: 0 allowed
- Linting Error Rate: <0.01%
- Type Checking: 0 TypeScript errors (strict mode)

### Human Approval Gates
Always wait for approval at:
- Gate generation (human reviews roadmap)
- Repository boundaries (human validates split)
- Proposals (human approves implementation)
- Gate completion (human confirms release)

## LLM-Invoked Functions

All Zeno operations are invoked by AI agents during workflow execution. These are functions the LLM calls, not commands humans type. Humans interact by providing prompts and approvals.

```bash
# Project status
zeno status                         # Show project overview
zeno gates list                     # List all gates

# Working with gates (status: pending -> in_progress -> completed)
zeno gates show <gate-id>           # Show gate details
zeno gates start <gate-id>          # Start gate (pending -> in_progress)
zeno gates complete <gate-id>       # Complete gate (-> completed, creates tag)

# Requirements (status: pending -> implemented -> tested)
zeno req list [--gate <id>]         # List requirements
zeno req show <hash>                # Show requirement details
zeno req deps <hash>                # Show dependency graph
zeno req status <hash> <status>     # Update requirement status

# Proposals (status: pending -> in_progress -> completed | rejected)
zeno proposal list [--gate <id>]    # List proposals
zeno proposal show <hash>           # Show proposal details
zeno proposal start <hash>          # Start implementation (pending -> in_progress)
zeno proposal validate <hash>       # Run automated checks
zeno proposal approve <hash>        # Approve proposal (-> completed)
zeno proposal reject <hash>         # Reject proposal (-> rejected)

# Architecture
zeno arch generate                  # Generate all diagrams
zeno arch show <type>               # Show specific diagram

# Hash lookup
zeno show <hash>                    # Resolve hash to entity
```

## Typical Workflow

1. **Check status**: `zeno gates list` to see current gate
2. **Read gate PRD**: `zeno/gates/gate-XX-name.md`
3. **Review requirements**: `zeno req list --gate <id>`
4. **View proposals**: `zeno proposal show <hash>`
5. **Validate**: `zeno proposal validate <hash>`
6. **Wait for approval**: Human runs `zeno proposal approve <hash>`
7. **Implement**: Execute approved proposal
8. **Repeat**: Continue with next requirement

## Best Practices

1. **Use hash references internally** for system commands (`zeno req show #a3f9c2d1`), but **resolve to plain text names** when communicating with users
2. **Check dependencies** before implementation (`zeno req deps <hash>`)
3. **Respect quality thresholds** (90% coverage, 0 vulnerabilities, <0.01% lint errors)
4. **Wait for human approval** at key decision points
5. **Reference architecture diagrams** for system context
6. **Use structured commit messages** (see `zeno/AGENTS.md` for format)

## File Locations Quick Reference

| Artifact | Location |
|----------|----------|
| Detailed AI instructions | `zeno/AGENTS.md` |
| Project PRD | `zeno/PROJECT_PRD.md` |
| Architecture diagrams | `zeno/architecture/*.md` |
| Gate PRDs | `zeno/gates/gate-XX-name.md` |
| Requirements database | `zeno/.zeno/requirements.db` |
| Proposals (active) | `zeno/proposals/active/<name>.md` |
| Proposals (completed) | `zeno/proposals/completed/<hash>.md` |
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
