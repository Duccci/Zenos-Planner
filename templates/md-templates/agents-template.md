# {{PROJECT_NAME}}: AI Agent Context Guide

Detailed instructions for AI coding assistants on how to read and interpret artifacts in this Zeno's Planner project.

**Note**: For general Zeno's Planner tool usage, see the root `AGENTS.md`. This file is project-specific.

---

## Project Overview

**Name**: {{PROJECT_NAME}}  
**Type**: {{PROJECT_TYPE}}  
**Technology Stack**: {{TECH_STACK}}  
**Architecture**: {{ARCHITECTURE_STYLE}}  
**End State**: {{END_STATE}}

---

## Quick Navigation

| What I Need | Where to Look |
|------------|---------------|
| Project scope and goals | `.zeno/docs/PROJECT_PRD.md` |
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

## Understanding Zeno's Planner Concepts

### Core Methodology: Iterative Gate Decomposition

Zeno's Planner uses an iterative decomposition approach inspired by Zeno's dichotomy paradox:
- Gates are concrete project milestones that progressively move toward the end goal
- Each gate represents actual deliverables, not percentages
- Gates are generated dynamically based on project analysis and decomposition
- Zeno's paradox serves as a conceptual framework to help humans understand the approach
- Percentages are NOT used in the tool's functionality - only as a conceptual explanation
- Progress is measured by gate completion, NOT time estimates or percentages

**Key Insight**: LLMs cannot reliably estimate time, but they can decompose problems into actionable milestones. Zeno provides structure for breaking down large projects into manageable, measurable chunks.

**Example**:
- **Gate 1**: Core infrastructure (foundation for everything else)
- **Gate 2**: Add essential features (builds on infrastructure)
- **Gate 3**: Add advanced features (extends core capabilities)
- **Gate N**: Final polish and deployment (completes the goal)

### Hash-Based References

Instead of full file paths, Zeno uses SHA-256 hashes (first 16 chars) for all entities:

```
Traditional Spec Systems:
"Requirement 'User Authentication' in specs/auth/spec.md depends on specs/core/spec.md"

Zeno's Approach:
"Requirement #a3f9c2d1 depends on #b7e4d8f2"
```

**Benefits**:
- Reduces LLM context size by 50%+
- Enables cross-repository dependency tracking
- Provides immutable content-addressable references
- Works across multiple repositories seamlessly

**Usage**:
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

**SQLite** (`.zeno/requirements.db`):
- Gates, requirements, proposals, dependencies
- Queryable for complex relationships
- Hash registry for lookups

**Files** (Markdown/Mermaid/JSON):
- Architecture diagrams (`.mmd` Mermaid files) - version controlled, text-based
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
# - Gates generated through iterative decomposition
# - Initial architecture diagrams created
# - SQLite database initialized
# - Hash registry established
```

**AI Assistant Tasks**:
1. Help user articulate clear end state
2. Analyze existing codebase if provided (AST parsing)
3. Generate gates based on analysis
4. Create initial architecture diagrams
5. Store all data in SQLite + files

### Workflow 2: Working on a Gate

```bash
# List available gates
zeno gates list

# Select and start a gate
zeno gates start <gate-id>

# System generates:
# - Requirements (hierarchical tree)
# - Architecture diagrams (updated)
# - PRD for the gate
# - Repository boundaries (if multi-repo)
# - Proposals for each requirement
```

**AI Assistant Tasks**:
1. Read gate PRD from `.zeno/gates/gate-XX-name.md`
2. Decompose gate into requirements
3. Generate architecture updates
4. Detect repository boundaries (coupling analysis)
5. Create proposals for implementation
6. Store requirements with hash references

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
1. Read proposal from SQLite or `.zeno/proposals/gate-XX/<name>.md`
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
2. Regenerate gates through iterative decomposition from current state
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

## Best Practices for AI Assistants

### 1. Always Use Hash References

**Good**:
```markdown
Requirement #a3f9c2d1 depends on module #b7e4d8f2
```

**Bad**:
```markdown
Requirement "User Authentication" in .zeno/gates/gate-03.md depends on CoreLib at src/core/lib.ts
```

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
- Read `.zeno/docs/architecture/system-overview.md` for context
- Check `.zeno/docs/architecture/data-flow.md` for data paths
- Review `.zeno/docs/architecture/gate-lifecycle.md` for state flow
- Understand `.zeno/docs/architecture/gate-roadmap.md` for gate roadmap and parallel relationships

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
cat .zeno/config.json | grep end_state

# Regenerate gates with more context
zeno gates regenerate --verbose

# Manual adjustment (if needed)
# Edit gate PRDs in .zeno/gates/
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
