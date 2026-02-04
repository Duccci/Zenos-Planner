# Zeno's Planner: AI Agent Context Guide

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

## Project Overview

**Name**: Zeno's Planner  
**Type**: CLI Tool / Project Planning System  
**Technology Stack**: TypeScript (strict mode), Node.js >= 20.19.0, SQLite (better-sqlite3), Mermaid, Commander.js, Zod, Vitest  
**Architecture**: Layered architecture (UI → Core → Analysis → Generation → Validation → Storage → Integration)  
**End State**: Lightweight, LLM-friendly project planning and orchestration tool that enhances human "vibe coding" by maintaining long-term project memory, reducing context size, and ensuring consistency from vision through implementation.

---

## Quick Navigation

| What I Need | Where to Look |
|------------|---------------|
| Project scope and goals | `zeno/PROJECT_PRD.md` |
| System architecture | `zeno/architecture/*.md` |
| Current gate status | `zeno gates list` |
| Gate details | `zeno/gates/gate-XX-name.md` |
| Requirements for gate | `zeno req list --gate <id>` |
| Specific requirement | `zeno req show <hash>` |
| Proposal details | `zeno proposal show <hash>` |
| Active gate-tied proposals | `zeno/proposals/gate-XX/` |
| Active solitary proposals | `zeno/proposals/solitary/` |
| Completed proposals for gate | `zeno/gates/archive/gate-XX-name.md` (Consolidated Proposals Summary section) |
| Completed solitary work | `zeno/gates/archive/solitary.md` |
| Architecture diagrams | `zeno/architecture/*.md` |
| Database queries | `zeno/.zeno/requirements.db` |
| Hash lookup | `zeno show <hash>` |

---

## Core Concepts

See [root AGENTS.md](../AGENTS.md) for detailed reference on:
- Gate-based methodology and workflow
- Hash-based reference system (internal use)
- Quality thresholds (90% coverage, 0 vulnerabilities, <0.01% lint errors)
- Human approval gates and decision points

### MCP Tools: Handler-First Policy
Handler implementations in `src/mcp/tools` take precedence over CLI-backed functions when registering MCP tools. Handlers should:
- Return `structuredContent` validated by Zod schemas in `src/mcp/schemas` (avoid free-form text for structured responses).
- Prefer internal module calls (analysis utilities, DB queries) over parsing CLI outputs.
- Use `FunctionRegistry.invoke()` only as a fallback when the implementation is not yet available.

Migration checklist:
1. Create handler in `src/mcp/tools` and validate responses using `schema.safeParse()`.
2. Add integration tests that mock `FunctionRegistry.invoke()` and assert `structuredContent` matches the schema.
3. Replace CLI-backed implementations only after tests and coverage are satisfactory.
4. Document the change in PRs and update `zeno/AGENTS.md` and root `AGENTS.md` accordingly.

---

## Project Structure

```
zenos-planner/
├── zeno/                       # All Zeno artifacts
│   ├── .zeno/                  # Internal state (version controlled)
│   │   ├── config.json         # Project configuration
│   │   ├── state.json          # Current state
│   │   └── requirements.db     # SQLite database
│   ├── AGENTS.md               # This file - project-specific AI guide
│   ├── PROJECT_PRD.md          # Master PRD
│   ├── gates/                  # Per-gate PRDs
│   │   ├── gate-01-core-infrastructure.md
│   │   ├── gate-02-zeno-engine.md
│   │   ├── archive/            # Completed gate PRDs
│   │   │   ├── gate-01-core-infrastructure.md
│   │   │   ├── gate-02-zeno-engine.md
│   │   │   └── solitary.md     # Consolidated solitary proposals
│   │   └── ...
│   ├── architecture/           # Mermaid (simple) or DOT/SVG (complex) diagrams
│   │   ├── system-overview.md
│   │   ├── gate-lifecycle.md
│   │   ├── data-flow.md
│   │   └── gate-roadmap.md
│   ├── proposals/              # Change proposals (active + archived)
│   │   ├── gate-01/            # Gate-tied proposals (active)
│   │   │   ├── 01-component-setup.md
│   │   │   ├── 02-database-schema.md
│   │   │   └── 03-api-endpoints.md
│   │   ├── gate-02/            # Gate-tied proposals (active)
│   │   │   └── 01-migrations.md
│   │   ├── solitary/           # Solitary proposals (active, cross-cutting)
│   │   │   ├── 2026-01-15-01-eslint-upgrade.md
│   │   │   ├── 2026-01-20-02-typescript-strict.md
│   │   │   └── 2026-01-25-01-readme-reorganization.md
│   │   └── archive/            # Completed proposals (archived + hashed)
│   │       ├── gate-01/
│   │       │   ├── #p010reinfra.md
│   │       │   └── #p010setup.md
│   │       └── solitary/
│   │           ├── #s20260115eslint.md
│   │           ├── #s20260120tsstrict.md
│   │           └── #s20260125readme.md
│   ├── requirements/           # Requirements artifacts
│   └── subprojects/            # Multi-repo tracking
├── src/                        # Source code
│   ├── cli/                    # CLI commands
│   ├── core/                   # Core engines
│   ├── analysis/               # Code analysis
│   ├── generation/             # Content generation
│   ├── validation/             # Quality checks
│   └── storage/                # Data persistence
├── templates/                  # Templates for generation
│   ├── md-templates/
│   │   ├── agents-template.md
│   │   ├── gate-prd-template.md
│   │   └── project-prd-template.md
│   └── architecture-templates/
├── AGENTS.md                   # Tool usage guide (lightweight)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Reading Zeno Artifacts

### Gates (`zeno/gates/gate-XX-name.md`)

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
Status: pending | implemented | tested

### Requirement #hash: Name
[Description with acceptance criteria]
Status: pending | implemented | tested

## Architecture Updates
[Links to .md diagrams with embedded Mermaid]

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

Requirements are generated at two levels:
1. **Project-level**: Generated during `zeno init` from the end state (cross-cutting concerns, constraints)
2. **Gate-level**: Generated during `zeno gates start` by decomposing project requirements and gate objectives

```sql
-- Query project-level requirements
SELECT r.hash, r.type, r.priority, r.description, r.status
FROM requirements r
WHERE r.level = 'project'
ORDER BY r.priority DESC, r.created_at ASC;

-- Query gate-specific requirements
SELECT 
  r.hash,
  r.type,
  r.priority,
  r.description,
  r.acceptance_criteria,
  r.status,
  r.source,
  r.project_requirement_id
FROM requirements r
WHERE r.gate_id = '<gate-id>' AND r.level = 'gate'
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
zeno req list --project           # Project-level requirements
zeno req list --gate <gate-id>    # Gate-specific requirements
zeno req show <hash>              # Details including parent refs
zeno req deps <hash>
```

### Architecture Diagrams (`zeno/architecture/*.md`)

Mermaid diagram types (embedded in markdown files):
- **system-overview.md**: High-level system architecture showing 7 layers (UI, Core, Analysis, Generation, Validation, Storage, Integration)
- **gate-lifecycle.md**: State machine for gate flow with proposal workflow details
- **data-flow.md**: End-to-end data flow from user input to project completion
- **gate-roadmap.md**: Gate roadmap showing all 12 gates with key tasks. Does NOT show feature-level details.

**Reading Tips**:
- Use Mermaid-enabled markdown viewer (VS Code, GitHub)
- Diagrams are text-based (version controllable)
- Updated automatically on gate generation
- Reference these for implementation context
- Gate Roadmap shows gate-level structure only; detailed features are in gate-specific PRDs

### Proposals

Proposals are organized into two categories:

#### Gate-Tied Proposals
Active gate-tied proposals are organized by gate in subdirectories: `zeno/proposals/gate-XX/<name>.md` (e.g., `zeno/proposals/gate-02/02-metrics-graph.md`).

#### Solitary Proposals
Cross-cutting or foundational work (infrastructure, documentation, maintenance, refactoring, tooling) not tied to a specific gate. Active solitary proposals are stored as: `zeno/proposals/solitary/YYYY-MM-DD-XX-name.md` (date-prefixed for chronological organization).

**Proposal Structure** (both types):

```markdown
# Proposal: [Title]

**Hash**: #a3f9c2d1  
**Gate**: Gate X (or "solitary" for cross-cutting work)
**Status**: pending

## Summary
[2-3 sentence description]

## Tasks
1. [Task 1] - File(s), Action, Description, Acceptance Criteria
2. [Task 2]
...

## Dependencies
- Requires #c8d4e1f5
- Blocks #f2a7b3c9

## Automated Checks
- Linting, Type Check, Tests, Coverage (90%+), Security (0 vulns)
```

**Key Points**:
- Hash-based references for all entities
- Automated checks run before human review
- Dependencies tracked to prevent conflicts
- Solitary proposals use "solitary" in Gate field (no Requirement field)

---

## Accessing Archived Work

When gates are completed, their proposals are consolidated into the gate document and archived. This maintains semantic consistency for LLM navigation while reducing file clutter.

### Completed Gates

**Location**: `zeno/gates/archive/gate-XX-name.md`

When a gate completes:
- Gate status changes to `completed`
- All proposals for that gate are consolidated into a **Consolidated Proposals Summary** section
- Key deliverables, implementation notes, and lessons learned are extracted from proposals
- Gate document is moved to archive folder

**Access patterns**:
```bash
# View completed gate details (auto-finds archived location)
zeno gates show gate-02

# List all completed gates
ls zeno/gates/archive/

# Check archived gate requirements
zeno req list --gate gate-02
# Requirements remain in database with status 'tested'
```

**Reading archived gate PRD**:
1. Completed objectives appear as `[x]` in gate document
2. **Consolidated Proposals Summary** section shows:
   - Requirements fulfilled (extracted from proposals)
   - Lessons learned from implementation
   - Dependencies unblocked for downstream gates
   - Aggregate quality metrics (coverage, security, linting)
3. Implementation details no longer shown as separate proposal files
4. All artifacts and code changes referenced by hash for traceability

### Completed Proposals

**Location**: Consolidated into parent gate document

When a proposal completes:
- Proposal status changes to `completed`
- Individual proposal file is removed
- Key information extracted and merged into gate's **Consolidated Proposals Summary**
- Proposal hash remains queryable for reference

**Access patterns**:
```bash
# View completed proposal details
zeno proposal show #p01hash01

# Check which proposals contributed to Gate 2
# → Read zeno/gates/archive/gate-02-name.md, 
#   see "Consolidated Proposals Summary" section

# See all requirements linked to completed proposals
zeno req list --gate gate-02
# All show status 'tested'
```

### Solitary Proposals

**Location**: 
- Active: `zeno/proposals/solitary/YYYY-MM-DD-XX-name.md` (date-prefixed for chronological organization)
- Completed: Consolidated into `zeno/gates/archive/solitary.md` with proposal file moved to `zeno/proposals/archive/solitary/`

Solitary proposals represent cross-cutting or foundational work unrelated to specific gates:
- Infrastructure improvements (ESLint upgrades, TypeScript strict mode enablement)
- Documentation enhancements (README reorganization, troubleshooting guides)
- Maintenance work (security updates, dependency upgrades)
- Refactoring initiatives (code cleanup, architectural improvements)
- Tooling additions (pre-commit hooks, testing frameworks)

**Reading active solitary proposals**:
```bash
# List all active solitary proposals
ls zeno/proposals/solitary/

# View specific solitary proposal
cat zeno/proposals/solitary/2026-01-15-01-eslint-upgrade.md
```

**Reading completed solitary proposals**:

When a solitary proposal completes:
1. Implementation summary is extracted (2-3 sentences describing what was accomplished)
2. Entry is added to `zeno/gates/archive/solitary.md` under appropriate category
3. Proposal file is moved to `zeno/proposals/archive/solitary/#hash.md`
4. Completion date is recorded

**Solitary Registry Structure** (`zeno/gates/archive/solitary.md`):

```markdown
# Solitary Proposals - Completed Work

## [Category Name]

### [Proposal Title] (#hash)
**Completed**: YYYY-MM-DD

High-level implementation: [2-3 sentence summary of what was accomplished]

## Infrastructure

### ESLint Configuration (#s20260115eslint)
**Completed**: 2026-01-15

High-level implementation: Updated ESLint to latest version with strict TypeScript rules, added pre-commit hooks to enforce linting on every commit.

### TypeScript Strict Mode (#s20260120tsstrict)
**Completed**: 2026-01-20

High-level implementation: Enabled strict mode globally across project, fixed all type errors, updated tsconfig.json with strict compiler options.

## Documentation

### README Reorganization (#s20260125readme)
**Completed**: 2026-01-25

High-level implementation: Restructured README with architecture diagrams, quick start guide, and troubleshooting section for improved developer onboarding.

## Security

### Dependency Audit & Updates (#s20260201deps)
**Completed**: 2026-02-01

High-level implementation: Performed comprehensive npm audit, updated vulnerable packages, verified zero critical vulnerabilities, added pre-commit security scanning.
```

**Access patterns**:

```bash
# View solitary work registry
cat zeno/gates/archive/solitary.md

# Look up specific solitary proposal (even if completed)
zeno proposal show #s20260115eslint
# Returns: Title, category, completion date, high-level summary

# Find related solitary work
# → Search by category in zeno/gates/archive/solitary.md
```

**Key Differences from Gate-Tied Proposals**:
- **Timing**: Can be initiated at any time, not constrained by gate sequence
- **Scope**: Cross-cutting concerns vs. gate-specific deliverables
- **Naming**: Date-prefixed (`YYYY-MM-DD-XX-name.md`) vs. gate-prefixed (`gate-XX/XX-name.md`)
- **Consolidation**: Registry file (`solitary.md`) vs. gate document consolidation
- **Categories**: Organized by work type (Infrastructure, Documentation, etc.) vs. by gate

### Query Reference

| What I Need | Command/Path | Notes |
|------------|---|---|
| Completed gate | `zeno gates show gate-02` | Auto-finds archived location |
| Completed proposal | `zeno proposal show #p01hash01` | Resolved from archive |
| Consolidated proposals for gate | `zeno/gates/archive/gate-XX-name.md` | See "Consolidated Proposals Summary" section |
| Active solitary proposals | `ls zeno/proposals/solitary/` | Date-prefixed files |
| Completed solitary work | `zeno/gates/archive/solitary.md` | Organized by category |
| Lookup solitary proposal | `zeno proposal show #s20260115hash` | Works for active and completed |

### Navigation Tips

**When starting a new gate:**
1. Run `zeno gates list` to see pending gates and current status
2. For completed gates: `zeno gates show gate-XX` auto-finds archived location
3. Review lessons learned: Read "Consolidated Proposals Summary" in archived gate
4. Check dependencies: `zeno req deps #hash` shows what this gate's work depends on

**When resuming after break:**
1. Read `AGENTS.md` (this file) for quick orientation
2. Run `zeno status` to see current project state
3. If last gate was completed: Find it in `zeno/gates/archive/`
4. Understand what led to current position via consolidated proposals
5. Continue with next pending gate: `zeno gates start gate-XX`

---

## Workflows

| Workflow | Key Commands | AI Tasks | Human Approval Points |
|----------|-------------|----------|----------------------|
| **Project Init** | `zeno init` | Analyze codebase, generate gates, create diagrams | Gate generation review |
| **Gate Work** | `zeno gates start <id>` | Decompose requirements, update architecture, create proposals | Repository boundaries |
| **Gate-Tied Proposals** | `zeno proposal list --gate <id>` | Generate gate-specific proposals, map requirements | Proposal approval |
| **Solitary Proposals** | Manual creation or user request | Generate cross-cutting proposals (infrastructure, docs, maintenance) | Proposal approval |
| **Implementation** | `zeno proposal validate <hash>` | Implement code, write tests, run checks | Proposal approval |
| **Write-Time Analysis** | `zeno gates complete <id>` | Analyze code changes, store metrics, suggest regeneration | Analysis-based regeneration |
| **Failure Handling** | Auto-replan with context | Parse errors, generate fixes, re-validate | - |
| **Rescoping** | `zeno rescope` | Document changes, regenerate gates | - |
| **Multi-Repo** | `zeno repos detect` | Calculate coupling, propose boundaries | Boundary approval |

### Workflow 2: Creating and Managing Proposals

Proposals can be gate-tied or solitary (cross-cutting). Both follow the same approval and implementation workflow, but with different scoping:

**Gate-Tied Proposals**:
- Decomposed from gate PRD requirements
- Located in `zeno/proposals/gate-XX/`
- Mapped to specific requirements via hash
- Dependencies tracked with earlier/later proposals

**Solitary Proposals**:
- Cross-cutting work (infrastructure, documentation, maintenance, refactoring, tooling)
- Located in `zeno/proposals/solitary/YYYY-MM-DD-XX-name.md` (date-prefixed)
- Requirements field is "n/a"
- Can be initiated at any time, not constrained by gate sequence
- Organized by category (Infrastructure, Documentation, Security, Maintenance, Refactoring, Tooling)

**Workflow for Both Types**:

```bash
# 1. Create proposal(s) from gate PRD or solitary work item
# For gate-tied: zeno proposal list --gate <id>
# For solitary: Create in zeno/proposals/solitary/YYYY-MM-DD-XX-name.md

# 2. Review proposal structure
zeno proposal show <hash>
# Verify: Hash, Status (pending), Summary, Tasks, Files Affected, Dependencies

# 3. Implement (AI task)
# - Write code
# - Write tests
# - Ensure 90%+ coverage

# 4. Validate proposal
zeno proposal validate <hash>
# Output:
# Linting: PASSED
# Type Check: PASSED
# Tests: PASSED (24/24)
# Coverage: 94.2% (threshold: 90%)
# Security: 0 vulnerabilities
# Dependencies: No conflicts
# Status: Ready for approval

# 5. Human approval
zeno proposal approve <hash>
# Status: pending -> completed
# System auto-commits with structured message

# 6. Archive (automatic on approval)
# Gate-tied: Move to zeno/proposals/archive/gate-XX/#hash.md
# Solitary: Move to zeno/proposals/archive/solitary/#hash.md
#          Add entry to zeno/gates/archive/solitary.md with category and summary
```

**Solitary Consolidation**:

When solitary proposals complete, they're added to `zeno/gates/archive/solitary.md` with:
- Category (Infrastructure, Documentation, Security, etc.)
- Completion date
- 2-3 sentence implementation summary
- Hash reference for traceability

This enables quick lookup by category, historical context for similar work, and understanding of accumulated improvements.

### Workflow 3: Write-Time Analysis & Regeneration

After completing gates, use write-time analysis to regenerate future gates based on actual metrics:

```bash
zeno gates complete gate-01
# Prompts for optional analysis of code changes

zeno gates regenerate
# Uses analysis data (if available) to suggest gate adjustments
# Falls back to theoretical decomposition if no analysis yet
```

**When to regenerate**: After each completed gate or when implementation diverges from plan. Uses coupling metrics, complexity analysis, and LOC growth to optimize gate sequencing. High coupling (>3 hotspots) or complexity >8 may require gate splitting or architectural review.

---

## LLM Function Reference

All Zeno operations are invoked by AI agents during workflow execution. These are functions the LLM calls, not commands humans type.

### Execution Model
1. Human provides prompt/instruction
2. LLM reads Zeno artifacts and invokes functions
3. LLM updates entity statuses as work progresses
4. Human approves/rejects at designated gates
5. LLM continues based on human decision

### Project Management
```bash
zeno init                           # Initialize new project
zeno status                         # Show project overview
zeno rescope                        # Rescope project mid-development
```

### Gates
```bash
zeno gates list                     # List all gates
zeno gates show <gate-id>           # Show gate details
zeno gates start <gate-id>          # Start gate (status: pending -> in_progress)
zeno gates complete <gate-id>       # Complete gate (status: -> completed, creates tag)
zeno gates regenerate               # Regenerate future gates
```

### Requirements
```bash
zeno req list [--gate <id>]         # List gate-specific requirements
zeno req list --project             # List project-level requirements
zeno req show <hash>                # Show requirement details (includes parent refs)
zeno req deps <hash>                # Show dependency graph
zeno req status <hash> <status>     # Update status (pending/implemented/tested)
zeno req transfer <hash> <gate-id>  # Transfer requirement to another gate
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
zeno proposal start <hash>          # Start implementation (status: pending -> in_progress)
zeno proposal validate <hash>       # Run automated checks
zeno proposal approve <hash>        # Approve proposal (status: -> completed)
zeno proposal reject <hash>         # Reject proposal (status: -> rejected)
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

See [root AGENTS.md](../AGENTS.md#best-practices) for comprehensive best practices. Key points for this project:
- Hash references: internal tracking only; resolve to names for users
- Always verify dependencies before implementation
- Enforce quality thresholds (90% coverage, 0 vulns, <0.01% lint)
- Wait for human approval at gates, boundaries, and proposals
- Reference architecture diagrams for implementation context

---

## Troubleshooting

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Hash Not Found** | `zeno show <hash>` returns error | Run `zeno registry rebuild` |
| **Dependency Conflict** | Proposal validation fails | Run `zeno proposal validate <hash>` to see conflicts |
| **Quality Gate Failure** | Coverage <90%, security issues, lint errors | Add tests, fix security vulns, resolve lint issues |
| **Gate Generation Issues** | Unexpected gate structure | Check `zeno/.zeno/config.json`, complete a gate and run `zeno gates regenerate` |
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

## AI Interaction Patterns

### Gate-Tied Proposal Implementation
```
Human: "Implement requirement #a3f9c2d1"
AI: (1) Read requirement (2) Generate proposal (3) Write code & tests (90%+ coverage) (4) Validate (5) Report
```

### Solitary Proposal Creation & Approval
```
Human: "Create proposal to upgrade ESLint"
AI: (1) Create solitary proposal (2) Define tasks & files (3) Await approval
Human: "Approve"
AI: (1) Implement (2) Validate (3) Extract 2-3 sentence summary (4) Add to solitary.md registry
```

### Architecture Review
```
Human: "Explain system architecture"
AI: (1) Read architecture diagram (2) Explain layers & components (3) Reference modules (4) Highlight dependencies
```

### Multi-Repo Planning
```
Human: "Should we split into multiple repos?"
AI: (1) Analyze coupling (2) Detect boundaries (3) Present proposals with confidence scores (4) Wait for decision
```

---

## Summary

Zeno's Planner provides structured project planning with AI assistance:
- **Gates** are concrete milestones moving toward the goal
- **Hash references** reduce context size (internal use only)
- **Quality gates** enforce 90% coverage, 0 vulns, <0.01% linting
- **Human approval** at key decision points
- **Architecture diagrams** provide visual system understanding
- **Multi-repo support** with automated boundary detection

For comprehensive guidance on tool usage, commands, and best practices, see [root AGENTS.md](../AGENTS.md).

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-04  
**Status**: Active - Zeno's Planner Self-Documentation

**Generated by Zeno's Planner** | [Project Documentation](PROJECT_PRD.md)
