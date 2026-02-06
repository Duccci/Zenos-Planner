# {{PROJECT_NAME}}: AI Agent Context Guide

Detailed instructions for AI coding assistants on how to read and interpret artifacts in this Zeno's Planner project.

**Note**: For general Zeno's Planner tool usage, see the root `AGENTS.md`. This file is project-specific.

## Cross-File Navigation

| Document | Purpose | Location |
|----------|---------|----------|
| **Root AGENTS.md** | General Zeno's Planner tool usage | `../AGENTS.md` |
| **Project AGENTS.md** | Project-specific AI context | `AGENTS.md` (this file) |
| **Project PRD** | Single source of truth for project scope | `PROJECT_PRD.md` |
| **Architecture Docs** | System design and diagrams | `architecture/*.md` |
| **AGENTS Template** | Template for generating project guides | `../templates/md-templates/agents-template.md` |

---

## Project Goals

**Single Source of Truth**: The project's scope and goals are defined in `#file:PROJECT_PRD.md`. The AGENTS.md file generated from this template should not be used as the canonical project definition—read `PROJECT_PRD.md` for project-level decisions and acceptance criteria.

---

## Quick Navigation

| What I Need | Where to Look |
|------------|---------------|
| Project scope and goals | `#file:PROJECT_PRD.md` |
| System architecture | `.zeno/docs/architecture/*.md` |
| Current gate status | `zeno gates list` |
| Gate details | `.zeno/gates/gate-XX-name.md` |
| Requirements for gate | `zeno req list --gate <id>` |
| Specific requirement | `zeno req show <hash>` |
| Proposal details | `zeno proposal show <hash>` |
| Architecture diagrams | `.zeno/docs/architecture/*.mmd` |
| Database queries | `.zeno/requirements.db` |
| Hash lookup | `zeno show <hash>` |

---

## Core Concepts

**[Reference: Root AGENTS.md#core-concepts]**

- Gates are concrete project milestones that progressively move toward the end goal
- Each gate represents actual deliverables, not percentages
- Progress measured by gate completion, not time estimates
- Hash-based references reduce context by 50%+, enable cross-repo tracking
- Quality gates: 90% coverage, 0 vulnerabilities, <0.01% lint errors

## Command Reference

**[Reference: Root AGENTS.md#complete-command-reference]**

All Zeno commands are available. Key commands for this project:

---

## Project Structure

```
{{PROJECT_NAME}}/
├── .zeno/                      # Zeno internal data
│   ├── config.json             # Project configuration
│   ├── requirements.db         # SQLite database
│   ├── AGENTS.md               # This file
│   └── gates/                  # Per-gate PRDs
│       ├── gate-01-*.md
│       ├── gate-02-*.md
│       └── ...
├── docs/
│   ├── architecture/           # Mermaid diagrams
│   │   ├── system-overview.mmd
│   │   ├── gate-lifecycle.mmd
│   │   ├── data-flow.mmd
│   │   └── gate-roadmap.md
│   ├── PROJECT_PRD.md          # Master PRD
│   └── ARCHITECTURE.md         # Architecture overview
├── {{SOURCE_DIR}}/             # Source code
├── AGENTS.md                   # Tool usage guide (lightweight)
├── package.json
└── tsconfig.json
```

---

## Reading Zeno Artifacts

### Gates (`.zeno/gates/gate-XX-name.md`)

```markdown
# Gate X: Name

## Overview
[High-level description]

## Objectives
- [Objective 1]
- [Objective 2]

## Requirements
### Requirement #hash: Name
[Description with acceptance criteria]

### Requirement #hash: Name
[Description with acceptance criteria]

## Architecture Updates
[Links to .mmd diagrams]

## Dependencies
- Depends on Gate X-1
- Requires #hash1, #hash2

## Quality Gates
- Coverage: 90%
- Security: 0 vulnerabilities
- Linting: <0.01% error rate
```

**Key Points**:
- Gates are sequential (must complete in order)
- Requirements use hash references
- Quality gates are enforced automatically
- Architecture diagrams linked, not embedded

### Requirements (SQLite `requirements` table)

```sql
-- Query requirements for a gate
SELECT 
  r.hash,
  r.type,
  r.priority,
  r.description,
  r.acceptance_criteria,
  r.status
FROM requirements r
WHERE r.gate_id = '<gate-id>'
ORDER BY r.priority DESC, r.created_at ASC;

-- Query dependencies
SELECT 
  d.source_hash,
  d.target_hash,
  d.type,
  d.confidence_score
FROM dependencies d
WHERE d.source_hash = '<requirement-hash>';
```

**CLI Alternative**:
```bash
zeno req list --gate <gate-id>
zeno req show <hash>
zeno req deps <hash>
```

### Architecture Diagrams (`.zeno/docs/architecture/*.md`)

Mermaid diagram types:
- **system-overview.mmd**: High-level system architecture
- **gate-lifecycle.mmd**: State machine for gate flow
- **data-flow.mmd**: End-to-end data flow
- **gate-roadmap.md**: Gate roadmap showing parallel relationships and progression. Does NOT show feature-level details.

**Reading Tips**:
- Use Mermaid-enabled markdown viewer (VS Code, GitHub)
- Diagrams are text-based (version controllable)
- Updated automatically on gate generation
- Reference these for implementation context
- Gate Roadmap shows gate-level structure only; detailed features are in gate-specific PRDs

### Proposals

Active proposals are organized by gate in subdirectories: `.zeno/proposals/gate-XX/<name>.md` (e.g., `.zeno/proposals/gate-02/02-metrics-graph.md`). Completed/archived proposals are stored flat and hashed: `.zeno/proposals/archive/<hash>.md`.

```markdown
# Proposal: [Title]

**Hash**: #a3f9c2d1  
**Gate**: Gate X  
**Requirement**: #b7e4d8f2  
**Status**: pending_approval

## What Changes
- [Change 1]
- [Change 2]

## Why
[Rationale for implementation approach]

## Implementation Details
[Technical specifics]

## Files Affected
- `src/module/file.ts` - [Description]
- `tests/module/file.test.ts` - [Description]

## Dependencies
- Requires #c8d4e1f5
- Blocks #f2a7b3c9

## Automated Checks
- [x] Linting: PASSED
- [x] Type Check: PASSED
- [x] Tests: PASSED (15/15)
- [x] Coverage: 92.3% (threshold: 90%)
- [x] Security: 0 vulnerabilities
- [ ] Human Approval: PENDING

## Approval
Awaiting human review.
```

**Key Points**:
- Hash-based references for all entities
- Automated checks run before human review
- Dependencies tracked to prevent conflicts
- Files affected listed explicitly

### Commits & Traceability

To trace work for a proposal, use structured commits that reference the proposal hash and follow the project's `commitFormat` (found in `.zeno/config.json`):

- Include the proposal hash (`#a3f9c2d1`) and gate id in commit subject or body so automation and auditors can link commits to artifacts.
- Example command to find commits for a proposal:
  - `git log --grep '#a3f9c2d1' --pretty=format:'%h %ad %an %s' --date=short`
- Use the configured `commitFormat` to parse commit subjects for `type(scope): subject` patterns (e.g., `chore(proposal): archive solitary proposal - template loader infrastructure`).
- Cross-reference with `zeno show <hash>` to resolve the artifact and confirm intent.

---

## Workflows

| Workflow | Key Commands | AI Tasks | Human Approval Points |
|----------|-------------|----------|----------------------|
| **Project Init** | `zeno init` | Analyze codebase, generate gates, create diagrams | Gate generation review |
| **Gate Work** | `zeno gates start <id>` | Decompose requirements, update architecture, create proposals | Repository boundaries |
| **Implementation** | `zeno proposal validate <hash>` | Implement code, write tests, run checks | Proposal approval |
| **Failure Handling** | Auto-replan with context | Parse errors, generate fixes, re-validate | - |
| **Rescoping** | `zeno rescope` | Document changes, regenerate gates | - |
| **Multi-Repo** | `zeno repos detect` | Calculate coupling, propose boundaries | Boundary approval |

---



## CLI Command Reference

### Project Management
```bash
zeno init                           # Initialize new project
zeno status                         # Show project overview
zeno dashboard                      # Launch TUI dashboard (Gate 11+)
zeno rescope                        # Rescope project mid-development
```

### Gates
```bash
zeno gates list                     # List all gates
zeno gates show <gate-id>           # Show gate details
zeno gates start <gate-id>          # Start working on gate
zeno gates complete <gate-id>       # Mark gate complete (creates tag)
zeno gates regenerate               # Regenerate future gates
```

### Requirements
```bash
zeno req list [--gate <id>]         # List requirements
zeno req show <hash>                # Show requirement details
zeno req deps <hash>                # Show dependency graph
```

### Architecture
```bash
zeno arch generate                  # Generate all diagrams
zeno arch show <type>               # Show specific diagram type
                                    # Types: system (architecture), lifecycle (state machine),
                                    # flow (data flow), gate-roadmap (gate roadmap with parallels)
```

### Repositories
```bash
zeno repos list                     # List detected repositories
zeno repos deps                     # Show cross-repo dependencies
zeno repos detect                   # Re-run boundary detection
zeno repos adjust                   # Manually adjust boundaries
```

### Proposals
```bash
zeno proposal list [--gate <id>]    # List proposals
zeno proposal show <hash>           # Show proposal details
zeno proposal validate <hash>       # Run automated checks
zeno proposal approve <hash>        # Approve proposal (human)
zeno proposal reject <hash>         # Reject proposal (human)
```

### Analysis
```bash
zeno analyze [path]                 # Deep codebase analysis
zeno metrics [path]                 # Show code metrics
```

### Registry
```bash
zeno show <hash>                    # Resolve hash to entity
zeno registry rebuild               # Rebuild hash registry
```

---

## Best Practices

**[Reference: Root AGENTS.md#best-practices]**

Key practices for this project:
- Use hash references internally, resolve to plain text for users
- Check dependencies before implementation
- Respect quality thresholds (90% coverage, 0 vulnerabilities, <0.01% lint errors)
- Wait for human approval at key decision points
- Reference architecture diagrams for context
- Use structured commit messages

---

## Troubleshooting

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Hash Not Found** | `zeno show <hash>` returns error | Run `zeno registry rebuild` |
| **Dependency Conflict** | Proposal validation fails | Run `zeno proposal validate <hash>` to see conflicts |
| **Quality Gate Failure** | Coverage <90%, security issues, lint errors | Add tests, fix security vulns, resolve lint issues |
| **Gate Generation Issues** | Unexpected gate structure | Check `.zeno/config.json`, run `zeno gates regenerate --verbose` |
| **Multi-Repo Detection** | Incorrect boundaries, low confidence | Run `zeno repos adjust`, review coupling metrics |

---



## Quality Metrics

### Coverage Calculation
```bash
# Zeno uses c8 for coverage
npm test -- --coverage

# Must meet 90% threshold:
# - Statements: 90%+
# - Branches: 90%+
# - Functions: 90%+
# - Lines: 90%+
```

### Security Scanning
```bash
# Zeno checks for vulnerabilities
npm audit --json

# Must have 0 vulnerabilities
# Any high/critical = auto-fail
```

### Linting Error Rate
```bash
# Zeno calculates error rate
eslint . --format json

# Formula: (errors / total_lines) * 100
# Threshold: <0.01% (1 error per 10k lines)
```

---

## Example: Complete Gate Implementation Flow

```bash
# 1. List gates and select one
zeno gates list
# Output: Gate 3: Requirements & DB - Status: pending

# 2. Start gate
zeno gates start gate-3

# System generates:
# - Requirements tree
# - Architecture updates
# - PRD for gate
# - Proposals

# 3. Review generated requirements
zeno req list --gate gate-3
# Output: 
# #a3f9c2d1 - Requirement Generation [must]
# #b7e4d8f2 - Hash Registry [must]
# #c8d4e1f5 - Dependency Tracking [must]
# #f2a7b3c9 - PRD Generator [should]

# 4. View proposal for first requirement
zeno proposal show #a3f9c2d1
# Reads: Implement requirement generation algorithm

# 5. AI implements code changes
# - Write src/generation/requirement-generator/index.ts
# - Write tests/generation/requirement-generator.test.ts
# - Ensure 90%+ coverage

# 6. Validate proposal
zeno proposal validate #a3f9c2d1
# Output:
# Linting: PASSED
# Type Check: PASSED
# Tests: PASSED (24/24)
# Coverage: 94.2% (threshold: 90%)
# Security: 0 vulnerabilities
# Dependencies: No conflicts
# Status: Ready for approval

# 7. Human approval
zeno proposal approve #a3f9c2d1
# System auto-commits with structured message

# 8. Repeat for remaining requirements
# ... (iterate through #b7e4d8f2, #c8d4e1f5, #f2a7b3c9)

# 9. Complete gate
zeno gates complete gate-3
# System creates git tag: v0.3.0-gate-3
# Updates project status
# Unlocks Gate 4

# 10. Move to next gate
zeno gates start gate-4
```

---

## AI Interaction Patterns

### Pattern 1: Exploration
```
Human: "Show me the current gate status"
AI: Runs `zeno gates list`, interprets output, explains progress
```

### Pattern 2: Implementation
```
Human: "Implement requirement #a3f9c2d1"
AI: 
1. Runs `zeno req show #a3f9c2d1`
2. Reads acceptance criteria
3. Generates code
4. Writes tests (90%+ coverage)
5. Runs `zeno proposal validate #a3f9c2d1`
6. Reports results, waits for approval
```

### Pattern 3: Debugging
```
Human: "Proposal #a3f9c2d1 failed validation"
AI:
1. Runs `zeno proposal show #a3f9c2d1`
2. Reads error details
3. Identifies root cause
4. Proposes fix
5. Regenerates proposal with context
6. Re-validates
```

### Pattern 4: Architecture Review
```
Human: "Explain the system architecture"
AI:
1. Reads `.zeno/docs/architecture/system-overview.md`
2. Parses Mermaid diagram and description
3. Explains layers and components
4. References specific modules in src/
5. Highlights key dependencies
```

### Pattern 5: Multi-Repo Planning
```
Human: "Should we split this into multiple repos?"
AI:
1. Runs `zeno analyze .`
2. Reviews coupling metrics
3. Runs `zeno repos detect`
4. Presents boundary proposals with confidence scores
5. Explains rationale
6. Waits for human decision
```

---

## Summary

Zeno's Planner provides a structured approach to project planning and execution with AI assistance:

1. **Gates** represent concrete project milestones that progressively move toward the goal
2. **Hash-based references** reduce context size and enable cross-repo tracking
3. **Quality gates** enforce 90% coverage, 0 security issues, <0.01% linting errors
4. **Human approval** required at key decision points
5. **Hybrid storage** uses SQLite for queries, files for human artifacts
6. **Multi-repo support** with automated boundary detection
7. **Replan engine** handles failures with context-aware regeneration
8. **Architecture diagrams** provide visual system understanding

### For AI Assistants
- Use hash references in all communications
- Check dependencies before implementation
- Respect quality thresholds
- Wait for human approval
- Provide context in replans
- Reference architecture diagrams
- Use structured commit messages

### For Humans
- Review generated gates for accuracy
- Approve repository boundaries
- Review and approve/reject proposals
- Provide feedback on failures
- Validate final gate completion

---

**Document Version**: {{VERSION}}  
**Last Updated**: {{DATE}}  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Status**: {{STATUS}}

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| {{VERSION}} | {{DATE}} | [Summary of changes] | [git.user.name] |

**Generated by Zeno's Planner** | [Project Documentation](docs/PROJECT_PRD.md)
