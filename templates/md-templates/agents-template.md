# [Project Name]: AI Agent Instructions

Project-specific guide for AI coding assistants working on [Project Name].

## Quick Reference

| Document | Purpose | Location |
| -------- | ------- | -------- |
| **This File** | Project-specific AI context | `zeno/AGENTS.md` |
| **Project PRD** | Single source of truth for project scope | `zeno/PROJECT_PRD.md` |
| **Architecture Docs** | System design and diagrams | `zeno/architecture/*.md` |
| **Gates** | Milestone specifications | `zeno/gates/gate-*.md` |
| **Requirements DB** | Queryable requirements | `zeno/.zeno/registry.db` |

## Core Terminology

### Zeno Concepts Applied to This Project

**Gate** (in this project)
[Project-specific definition: What does a gate represent for your project? E.g., "For our microservices platform, each gate represents a deployable service or infrastructure layer."]

Example gates in this project:

- Gate 1: [name]
- Gate 2: [name]
- (insert remaining gates)

**Proposal** (in this project)
[Project-specific definition: What kinds of proposals appear here? E.g., "Proposals are service interfaces, data models, and deployment manifests."]

Current active proposals: See `zeno/proposals/gate-*/*.md`

**Requirement** (in this project)
[Project-specific definition: Focus areas for requirements. E.g., "Must support 10k concurrent users", "Zero-downtime deployments required".]

Query requirements: `zeno req list` or `zeno req show <hash>`

**Architecture Diagram** (in this project)
[Project-specific note on which diagrams are critical. E.g., "System overview shows microservice boundaries; data flow emphasizes event streaming patterns."]

Diagrams: See `zeno/architecture/`

**Multi-Repo Structure** (if applicable)
[List detected repositories and their roles:]

- `main-repo`: [description]
- `service-auth`: [description]
- `shared-libs`: [description]
(use `zeno repos list` for current structure)

**Quality Thresholds** (non-configurable, enforced)

- Code Coverage: ≥90% (fail if <90%)
- Security Vulnerabilities: 0 (fail if any found)
- Linting Error Rate: <0.01% (fail if higher)
- TypeScript Strict Mode: 0 errors
- All Tests Passing: Required

## File Locations

| Artifact | Location | Purpose |
| -------- | -------- | ------- |
| Project Overview | `zeno/PROJECT_PRD.md` | Vision, technical decisions, timeline |
| Gate Specifications | `zeno/gates/gate-XX-name.md` | Gate-specific PRD |
| Architecture | `zeno/architecture/*.md` | System design diagrams |
| Requirements Database | `zeno/.zeno/registry.db` | Queryable requirements |
| Active Proposals | `zeno/proposals/gate-XX/*.md` | Implementation proposals |
| Completed Proposals | `zeno/proposals/archive/<hash>.md` | Historical record |
| Configuration | `zeno/.zeno/config.json` | Project settings |
| Worktrees | `.local/worktrees/{hash}/` | Isolated development (not version-controlled) |

## Database Schema Summary

### requirements Table

```sql
id, parent_id, type (functional/non_functional/constraint), 
priority (must/should/could/won't), level (project/gate),
source (generated/inherited/transferred), description,
acceptance_criteria, hash (unique), created_at, updated_at
```

### repositories Table

```sql
id, name, path, type (main/service/library/tool), 
hash (unique), metadata (JSON), created_at
```

**Query Examples**:

```sql
-- Find all requirements for a gate
SELECT * FROM requirements WHERE gate_id = '[gate-id]';

-- Find requirement by hash
SELECT * FROM requirements WHERE hash = 'a3f9c2d1';

-- Find dependencies on a requirement
SELECT * FROM dependencies WHERE target_hash = 'a3f9c2d1';

-- List all repositories
SELECT * FROM repositories;
```

## Hash-Based References

All entities are referenced by hash (first 16 chars of SHA-256):

- Requirements: `#a3f9c2d1` instead of `/long/path/to/requirements.md`
- Proposals: `#b7e4d8f2` for implementation proposals
- Gates: `#c8d4e1f5` for milestones
- Artifacts: `#f2a7b3c9` for diagrams and docs

**Resolve a hash**:

```bash
zeno show #a3f9c2d1
```

This reduces LLM context by 50%+ while maintaining precise, immutable references.

## Proposal Workflow

1. **Generate**: Proposals created during gate analysis (pending status)
2. **Validate**: `zeno proposal validate <hash>` runs automated checks:
   - Code coverage ≥90%
   - Security: 0 vulnerabilities
   - Linting: <0.01% error rate
   - TypeScript strict mode: 0 errors
   - Tests: all passing
3. **Request Approval**: If validation passes, proposal waits for human review
4. **Approve**: Human runs `zeno proposal approve <hash>` → proposal marked completed, worktree merged and cleaned up
5. **Reject**: Human runs `zeno proposal reject <hash>` → proposal rejected with feedback, replan triggered with error context

**Proposal Files**:

- Active: `zeno/proposals/gate-XX/<name>.md`
- Archived: `zeno/proposals/archive/<hash>.md` (immutable, content-addressable)

## Git Worktrees for Parallel Work

When implementing proposals:

1. **Start**: `zeno proposal start <hash>` creates isolated worktree at `.local/worktrees/{hash}/`
2. **Develop**: Work in the worktree directory without branch switching
3. **Validate**: `zeno proposal validate <hash>` runs checks in worktree context
4. **Merge**: `zeno proposal approve <hash>` merges worktree branch, orchestrator handles conflict resolution and cleanup
5. **Cleanup**: Worktree automatically deleted after successful merge

**Active Worktrees**:

```bash
zeno worktree list
```

**Worktree Management**:

- `zeno worktree prune` - Remove expired worktrees
- `zeno worktree remove <hash>` - Manually delete specific worktree
- `zeno worktree merge <hash>` - Merge branch with conflict handling

Worktrees enable 4+ agents to work simultaneously on independent proposals without merge conflicts.

## Command Reference

| Command | Purpose | MCP Tool |
| ------- | ------- | -------- |
| `zeno init` | Initialize project | `project_action` (`init`) |
| `zeno status` | Show project overview | `project_action` (`status`) |
| `zeno gates list` | List all gates | `gates_action` (`list`) |
| `zeno gates show <id>` | Show gate details | `gates_action` (`show`) |
| `zeno gates start <id>` | Start gate (generates requirements) | `gates_action` (`start`) |
| `zeno gates complete <id>` | Complete gate (commits work) | `gates_action` (`complete`) |
| `zeno req list [--gate <id>]` | List requirements (filtered) | `req_action` (`list`) |
| `zeno req show <hash>` | Show requirement details | `req_action` (`show`) |
| `zeno req deps <hash>` | Show requirement dependencies | `req_action` (`deps`) |
| `zeno req transfer <hash> <gate>` | Move requirement to different gate | `req_action` (`transfer`) |
| `zeno proposal list [--gate <id>]` | List proposals | `proposal_action` (`list`) |
| `zeno proposal show <hash>` | Show proposal details | `proposal_action` (`show`) |
| `zeno proposal start <hash>` | Start proposal (create worktree) | `proposal_action` (`start`) |
| `zeno proposal validate <hash>` | Run automated checks | `proposal_action` (`validate`) |
| `zeno proposal approve <hash>` | Approve + merge worktree | `proposal_action` (`approve`) |
| `zeno proposal reject <hash>` | Reject proposal | `proposal_action` (`reject`) |
| `zeno worktree list` | List active worktrees | CLI only |
| `zeno worktree prune` | Remove expired worktrees | CLI only |
| `zeno worktree remove <hash>` | Manually delete worktree | CLI only |
| `zeno worktree merge <hash>` | Merge worktree branch | CLI only |
| `zeno repos list` | List detected repositories | `repos_action` (`list`) |
| `zeno repos deps` | Show cross-repo dependencies | `repos_action` (`deps`) |
| `zeno arch generate` | Generate architecture diagrams | `diagram_action` (`generate`) |
| `zeno arch show <type>` | Show specific diagram | `diagram_action` (`show`) |
| `zeno rescope` | Rescope project mid-development | CLI only |
| `zeno show <hash>` | Resolve hash to entity | `show_entity` |

## Quality Thresholds (Non-Configurable)

All proposals must pass these automated checks before human approval:

- **Code Coverage**: ≥90% of business logic (measured by c8)
- **Security**: 0 known CVEs (npm audit, npm version check)
- **Linting**: <0.01% error rate (eslint strict)
- **TypeScript Strict Mode**: 0 type errors (required, non-negotiable)
- **Tests**: 100% passing (vitest)

Failing even one check rejects the proposal; error details guide replanning.

## Project-Specific Conventions

[Add any project-specific patterns here:]

### Naming Conventions

- [Gates: Gate-{number}-{kebab-case-name}]
- [Requirements: {domain}-{capability-description}]
- [Proposals: proposal-{gate-id}-{short-name}]

### Directory Structure

- [Where are source files?]
- [Test directory?]
- [Configuration?]

### Key Dependencies

[List critical libraries and their purpose]

### Architecture Patterns

[Describe architectural style: microservices, monolith, modular, etc.]

## Typical Workflow for AI Agents

1. **Read this file** to understand project context and terminology
2. **Check current status**: `zeno status` or `zeno gates list`
3. **Read gate PRD**: `cat zeno/gates/gate-XX-name.md`
4. **List gate requirements**: `zeno req list --gate <gate-id>`
5. **Review proposals**: `zeno proposal list --gate <gate-id>`
6. **For each proposal**:
   - Create worktree: `zeno proposal start <hash>` (returns path)
   - Implement in isolation: work in `.local/worktrees/{hash}/`
   - Validate: `zeno proposal validate <hash>` (run in worktree)
   - Request approval: Update status and inform orchestrator
7. **Orchestrator coordinates**:
   - Validate all proposals passed checks
   - Merge non-dependent proposals in parallel
   - Rebase dependent proposals with conflict handling
   - Cleanup worktrees after successful merge
8. **Gate completion**: `zeno gates complete <gate-id>` (human action)
9. **Repeat**: Continue with next gate

## Troubleshooting

**Issue**: Worktree creation fails  
**Solution**: Run `zeno worktree list` to check active worktrees; `zeno worktree prune` to cleanup expired ones. Verify disk space.

**Issue**: Proposal validation fails  
**Solution**: Check error message from `zeno proposal validate <hash>`. Common failures: coverage <90% (add tests), security CVE (update dependency), linting (fix code style), TypeScript errors (add types).

**Issue**: Merge conflict  
**Solution**: Orchestrator handles most conflicts automatically via dependency analysis. If manual intervention needed: run `zeno worktree merge <hash>` with force option, or escalate to human review.

**Issue**: Can't resolve hash  
**Solution**: Run `zeno show <hash>` to verify hash exists. Ensure hash is exactly 8+ characters. If not found, hash may be from old/archived proposal.

## More Information

- **Full Project Vision**: See `zeno/PROJECT_PRD.md` for technical decisions and rationale
- **Architecture Deep Dive**: See `zeno/architecture/` for diagrams and design docs
- **Gate Details**: See `zeno/gates/gate-XX-*.md` for gate-specific PRDs
- **Zeno Usage Guide**: See root `AGENTS.md` for complete tool reference

---

**Document Version**: 1.0.0  
**Project**: [Project Name]  
**Last Updated**: [TIMESTAMP]  
**Status**: Active

Custom instructions for this project generated by Zeno's Planner
