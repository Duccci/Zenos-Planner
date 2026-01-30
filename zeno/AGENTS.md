# Zeno's Planner: AI Agent Context Guide

Detailed instructions for AI coding assistants on how to read and interpret artifacts in this Zeno's Planner project.

**Note**: For general Zeno's Planner tool usage, see the root `AGENTS.md`. This file is project-specific.

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
| Architecture diagrams | `zeno/architecture/*.md` |
| Database queries | `zeno/.zeno/requirements.db` |
| Hash lookup | `zeno show <hash>` |

---

## Understanding Zeno's Planner Concepts

### Core Methodology: Zeno's Paradox

Zeno's Planner uses Zeno's dichotomy paradox as a conceptual framework for project planning:
- Gates are concrete project milestones that progressively move toward the end goal
- Each gate represents actual deliverables, not percentages
- Gates are generated dynamically based on project analysis and decomposition
- Conceptually, each gate closes the remaining distance to the goal (inspired by Zeno's paradox)
- Progress is measured by gate completion, NOT time estimates

**Key Insight**: LLMs cannot reliably estimate time, but they can decompose problems into actionable milestones. Zeno provides structure for breaking down large projects into manageable, measurable chunks.

**Example for Zeno's Planner itself**:
- **Gate 1**: Core Infrastructure (foundation for everything else)
- **Gate 2**: Zeno Engine & Gate Generation (builds on infrastructure)
- **Gate 3**: Requirements & Database Layer (extends core capabilities)
- **Gate 12**: Documentation & Polish (completes the goal)

### Hash-Based References

Instead of full file paths, Zeno uses SHA-256 hashes (first 16 chars) for internal tracking of all entities:

```
Traditional Spec Systems:
"Requirement 'User Authentication' in specs/auth/spec.md depends on specs/core/spec.md"

Zeno's Internal Approach:
"Requirement #a3f9c2d1 depends on #b7e4d8f2"
```

**Benefits**:
- Reduces LLM context size by 50%+
- Enables cross-repository dependency tracking
- Provides immutable content-addressable references
- Works across multiple repositories seamlessly

**Critical: Internal Use Only**

Hash references are for **internal tracking and AI-to-system communication only**. When communicating with users:
- **Always resolve hashes to plain text names**
- Say "User Authentication requirement" not "#a3f9c2d1"
- Say "the Config Utilities proposal" not "proposal #b7e4d8f2"
- Use `zeno show <hash>` to resolve any hash before presenting to user

**Usage** (AI-to-system, not user-facing):
```bash
# Find entity by hash
zeno show <hash>

# View dependencies
zeno req deps <hash>

# View proposal details
zeno proposal show <hash>
```

### Hybrid Storage Model

Zeno uses both SQLite and files:

**SQLite** (`zeno/.zeno/requirements.db`):
- Gates, requirements, proposals, dependencies
- Queryable for complex relationships
- Hash registry for lookups

**Files** (Markdown/Mermaid/DOT/SVG/JSON):
- Architecture diagrams (embedded Mermaid for simple diagrams or SVG for DOT-based complex diagrams) - version controlled
- Gate PRDs (per-gate Product Requirements Documents)
- Proposals (structured change notices with implementation details)
- AGENTS.md (this file - AI context and instructions)

### Quality Gates (Non-Configurable in MVP)

All proposals must pass automated checks before human review:
- **Code Coverage**: 90% minimum (statements, branches, functions, lines)
- **Security Vulnerabilities**: 0 allowed (npm audit checks)
- **Linting Error Rate**: <0.01% - 1 error per 10,000 lines
- **Type Checking**: 0 TypeScript errors (strict mode)
- **Tests**: All unit tests must pass
- **Dependency Conflicts**: No hash conflicts detected

These thresholds are enforced automatically and cannot be bypassed in the MVP. Future versions may allow per-project configuration.

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
│   │   └── ...
│   ├── architecture/           # Mermaid (simple) or DOT/SVG (complex) diagrams
│   │   ├── system-overview.md
│   │   ├── gate-lifecycle.md
│   │   ├── data-flow.md
│   │   └── gate-roadmap.md
│   ├── proposals/              # Change proposals
│   │   ├── active/
│   │   └── completed/
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

Active proposals are organized by gate in subdirectories: `zeno/proposals/gate-XX/<name>.md` (e.g., `zeno/proposals/gate-02/02-metrics-graph.md`). Completed/archived proposals are stored flat and hashed: `zeno/proposals/archive/<hash>.md`.

```markdown
# Proposal: [Title]

**Hash**: #a3f9c2d1  
**Gate**: Gate X  
**Requirement**: #b7e4d8f2  
**Status**: pending

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

---

## Common Workflows

### Workflow 1: Starting a New Project

```bash
# Initialize Zeno in project directory
zeno init

# Interactive prompts will ask:
# - Project name
# - End state description (natural language goal)
# - Existing codebase path (optional)

# Result:
# - Project-level requirements generated from end state
# - Gates generated using Zeno's paradox
# - Initial architecture diagrams created
# - SQLite database initialized
# - Hash registry established
```

**AI Assistant Tasks**:
1. Help user articulate clear end state
2. Analyze existing codebase if provided (AST parsing)
3. Generate project-level requirements (cross-cutting concerns, constraints)
4. Generate gates based on analysis
5. Create initial architecture diagrams
6. Store all data in SQLite + files

### Workflow 2: Working on a Gate

```bash
# List available gates
zeno gates list

# Select and start a gate
zeno gates start <gate-id>

# System generates:
# - Gate-specific requirements (from project reqs + gate objectives)
# - Inherits applicable project-level requirements
# - Accepts transferred requirements from other gates (if any)
# - Architecture diagrams (updated)
# - PRD for the gate
# - Repository boundaries (if multi-repo)
# - Proposals for each requirement
```

**AI Assistant Tasks**:
1. Read gate PRD from `zeno/gates/gate-XX-name.md`
2. Identify applicable project-level requirements
3. Decompose gate objectives into gate-specific requirements
4. Link gate requirements to parent project requirements
5. Generate architecture updates
6. Detect repository boundaries (coupling analysis)
7. Create proposals for implementation
8. Store requirements with hash references and source tracking

### Workflow 3: Implementing a Proposal

```bash
# List proposals for current gate
zeno proposal list --gate <gate-id>

# View specific proposal
zeno proposal show <hash>

# Validate proposal (automated checks)
zeno proposal validate <hash>

# If validation passes, human approves:
zeno proposal approve <hash>

# If validation fails, replan:
# System automatically regenerates with error context
```

**AI Assistant Tasks**:
1. Read proposal from SQLite or `zeno/proposals/gate-XX/<name>.md`
2. Implement code changes according to proposal
3. Write tests (aiming for 90%+ coverage)
4. Run automated checks locally
5. Wait for human approval before proceeding
6. Auto-commit on approval with structured message

### Workflow 4: Handling Failures

```bash
# If automated checks fail:
# - Linting errors → Fix code style
# - Type errors → Fix TypeScript issues
# - Test failures → Debug and fix tests
# - Coverage below 90% → Add more tests
# - Security vulnerabilities → Update dependencies

# System triggers replan automatically
# Provides error context for regeneration
```

**AI Assistant Tasks**:
1. Parse validation error messages
2. Identify root cause (lint/type/test/coverage/security)
3. Generate fix proposal with context
4. Rerun validation
5. Iterate until all checks pass

### Workflow 5: Rescoping Mid-Project

```bash
# User changes end state
zeno rescope

# Interactive prompt:
# - New end state description
# - Reason for rescope

# System:
# - Creates rescope gate (documents the change)
# - Regenerates future gates from current position
# - Preserves completed gates
# - Updates architecture diagrams
```

**AI Assistant Tasks**:
1. Document the rescope (why and what changed)
2. Regenerate gates using Zeno's paradox from current state
3. Update architecture diagrams
4. Identify affected requirements and proposals
5. Create migration plan if needed

### Workflow 6: Multi-Repository Projects

```bash
# During gate start, if complexity detected:
# System analyzes:
# - Coupling metrics (afferent/efferent)
# - Domain boundaries (bounded contexts)
# - Module size (LOC, complexity)

# Generates repo boundary proposal with confidence scores
zeno repos list
zeno repos deps  # Cross-repo dependency graph

# Human approves or adjusts boundaries
```

**AI Assistant Tasks**:
1. Calculate coupling metrics for modules
2. Identify domain boundaries
3. Propose repository split with confidence scores
4. Generate dependency graph across repos
5. Scaffold new repositories (package.json, tsconfig)
6. Update hash registry for cross-repo references

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
zeno dashboard                      # Launch TUI dashboard (Gate 11+)
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

## Best Practices for AI Assistants

### 1. Use Hash References Internally, Plain Text for Users

Hash references are for internal tracking and system commands. When communicating with users, always resolve hashes to human-readable names.

**Internal/System Commands** (Good):
```bash
zeno req show #a3f9c2d1
zeno req deps #b7e4d8f2
```

**User-Facing Communication** (Good):
```markdown
The "User Authentication" requirement depends on the "Core Library" module.
```

**User-Facing Communication** (Bad):
```markdown
Requirement #a3f9c2d1 depends on module #b7e4d8f2
```

Use `zeno show <hash>` to resolve any hash before presenting information to the user.

### 2. Check Dependencies Before Implementation

```bash
# Before implementing proposal
zeno req deps <hash>
zeno proposal show <hash>

# Verify no conflicts
zeno proposal validate <hash>
```

### 3. Respect Quality Thresholds

- Write tests FIRST (TDD approach)
- Aim for 90%+ coverage from the start
- Run linters before proposing changes
- Check for security vulnerabilities in dependencies
- Use TypeScript strict mode

### 4. Wait for Human Approval

Do NOT auto-implement without approval at:
- Gate generation (human reviews roadmap)
- Repository boundaries (human validates split)
- Proposals (human approves implementation)
- Gate completion (human confirms release)

### 5. Provide Context in Replans

When automated checks fail:
```markdown
## Replan Context

**Previous Attempt**: #a3f9c2d1
**Failure**: Coverage 78% (threshold: 90%)
**Root Cause**: Missing tests for error handling paths
**Proposed Fix**: Add 5 test cases for edge conditions
**New Coverage Estimate**: 93%
```

### 6. Reference Architecture Diagrams

When implementing:
- Read `zeno/architecture/system-overview.md` for context
- Check `zeno/architecture/data-flow.md` for data paths
- Review `zeno/architecture/gate-lifecycle.md` for state flow
- Understand `zeno/architecture/gate-roadmap.md` for gate roadmap and parallel relationships

### 7. Use Structured Commit Messages

```
type(scope): Brief description #hash

Detailed description of changes.

- Change 1
- Change 2

Proposal: #a3f9c2d1
Gate: gate-03-requirements-db
Quality: coverage 92%, security 0, lint 0.005%

Co-authored-by: Zeno <zeno@planner.dev>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

---

## Troubleshooting

### Issue: Hash Not Found

```bash
# Check hash registry
zeno show <hash>

# If not found, may be stale reference
# Regenerate hash registry
zeno registry rebuild
```

### Issue: Dependency Conflict

```bash
# View conflict details
zeno proposal validate <hash>

# Shows:
# Conflict: Proposal #a3f9c2d1 modifies #b7e4d8f2
#           Proposal #c8d4e1f5 also modifies #b7e4d8f2
# Resolution: Serialize proposals or merge changes
```

### Issue: Quality Gate Failure

```bash
# Check detailed results
zeno proposal show <hash>

# Common fixes:
# - Coverage low: Add more tests
# - Security vuln: Run `npm audit fix`
# - Lint errors: Run `npm run lint -- --fix`
# - Type errors: Fix TypeScript issues
```

### Issue: Gate Generation Produces Unexpected Results

```bash
# Verify end state is clear
cat zeno/.zeno/config.json | grep end_state

# Regenerate gates with more context
zeno gates regenerate --verbose

# Manual adjustment (if needed)
# Edit gate PRDs in zeno/gates/
# Update SQLite with manual changes
```

### Issue: Multi-Repo Detection Incorrect

```bash
# View detected boundaries
zeno repos list

# Check confidence scores
# If low confidence (<0.8), review manually

# Adjust boundaries
zeno repos adjust

# Re-run detection with different thresholds
zeno repos detect --coupling-threshold 0.7
```

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
# ✓ Linting: PASSED
# ✓ Type Check: PASSED
# ✓ Tests: PASSED (24/24)
# ✓ Coverage: 94.2% (threshold: 90%)
# ✓ Security: 0 vulnerabilities
# ✓ Dependencies: No conflicts
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
1. Reads `zeno/architecture/system-overview.md`
2. Parses Mermaid diagram
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
2. **Hash-based references** reduce context size and enable cross-repo tracking (internal use only)
3. **Quality gates** enforce 90% coverage, 0 security issues, <0.01% linting errors
4. **Human approval** required at key decision points
5. **Hybrid storage** uses SQLite for queries, files for human artifacts
6. **Multi-repo support** with automated boundary detection
7. **Replan engine** handles failures with context-aware regeneration
8. **Architecture diagrams** provide visual system understanding

### For AI Assistants
- Use hash references internally for system commands; resolve to plain text names when communicating with users
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

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-04  
**Status**: Active - Zeno's Planner Self-Documentation

**Generated by Zeno's Planner** | [Project Documentation](PROJECT_PRD.md)
