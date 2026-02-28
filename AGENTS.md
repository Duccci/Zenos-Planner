# Zeno's Planner: AI Agent Instructions

Quick reference for AI coding assistants on how to work with Zeno's Planner projects.

## Terminology

### Core Concepts

**Gate**
A concrete, measurable milestone representing an actual deliverable that moves the project toward completion. Gates are generated iteratively through decomposition (inspired by Zeno's dichotomy paradox), not based on percentages or predetermined timelines. Each gate has:

- A unique sequential number (1, 2, 3, ...)
- An objective (what is delivered)
- Requirements (specific capabilities to implement)
- Proposals (implementation approaches)
- Status (pending → in_progress → completed or rejected)

Gates are the primary unit of progress tracking. When you start a gate, you generate gate-specific requirements and proposals for implementation.

**Proposal**
A detailed implementation plan for a set of requirements within a gate. Each proposal includes:

- Title and description
- Requirements it addresses
- Acceptance criteria
- Implementation notes (pseudo-code, API specifications, etc.)
- Status (pending → in_progress → completed or rejected)
- Hash reference (#a3f9c2d1) for content-addressable tracking

Proposals are stored as Markdown files in `zeno/proposals/gate-XX/` during development and completion. Completed proposals remain in place with status metadata and are integrated into gate archive artifacts when the parent gate is completed. Proposals may be rejected by humans with feedback; rejection triggers replan with error context.

**Requirement**
A specific, measurable capability or constraint that must be satisfied. Requirements have:

- Type: functional (feature), non_functional (performance, scalability), or constraint (security, compliance)
- Priority: must, should, could, won't
- Level: project-level (cross-cutting, generation at init) or gate-level (specific to a gate, generated at gate start)
- Acceptance criteria (testable conditions for completion)
- Status: pending → implemented → tested
- Hash reference for tracking

Requirements are stored in the SQLite database (`zeno/.zeno/registry.db`) for queryability and dependency tracking. Gate-level requirements inherit from or decompose project-level requirements.

**Gate-Specific Requirement Generation**
When `zeno gates start <gate-id>` is called:

1. Project-level requirements (broad constraints, cross-cutting concerns) are inherited by the gate
2. Gate-specific requirements are generated (actionable items for this gate)
3. Gate requirements may refine, extend, or decompose project-level requirements
4. All requirements are stored with parent references for traceability

Example:

- Project requirement: "Must support offline mode" (generated at init)
- Gate 3 (API Layer) inherits this and generates: "API must cache responses locally", "Sync must handle network reconnection"

**Architecture Diagram**
Visual representation of system design generated based on project needs. Zeno selects diagram types intelligently:

*Always Generated (all projects):*

- System Overview: Component relationships and module structure
- Data Flow: End-to-end data processing paths
- Gate Roadmap: Gate structure and parallel relationships
- Gate Lifecycle: State machine for gate workflow
- Context Diagram: System boundary and external dependencies

*Generated When Detected:*

- Sequence Diagram: Temporal interactions for complex workflows
- Component Diagram: Detailed module structure for complex components
- Package Diagram: Code organization and module dependencies
- Deployment Diagram: Runtime infrastructure (deployment gates only)
- Network Diagram: Network topology and communication patterns

Diagrams are stored as:

- Mermaid (text-based, simple diagrams ≤5 elements): `zeno/architecture/*.md`
- DOT/SVG (prerendered, complex diagrams >5 elements): `zeno/architecture/diagrams/*.svg` with source in `.dot` files

**Solitary** (Not a standard Zeno term; likely referring to solo/single-developer workflow)
Zeno is designed for solo developers or individual AI agents working sequentially. For multi-developer or multi-agent teams:

- Use git worktrees to isolate parallel work
- Dependency detection prevents file conflicts
- Orchestrator coordinates merge ordering
- Human approval gates provide synchronization points

If you're working "solitary" (solo development), you'll still use gates and proposals, but won't need worktree coordination—just sequential approval and implementation.

**Rescope**
A mid-project change to goals, constraints, or end state. Rescoping triggers:

1. End state analysis (what changed)
2. Future gate regeneration from current position
3. New "rescope gate" documenting the change
4. Re-evaluation of current gate in progress (may need rework)

Use `zeno rescope` command to regenerate the project roadmap based on new constraints.

**Hash** (#prefix)
Content-addressable reference (SHA-256 first 16 characters) used to reference entities without repeating full paths:

- `#a3f9c2d1` → gate, requirement, proposal, artifact, or repository
- Enables 50%+ context reduction for LLM navigation
- Immutable: same content always generates same hash
- Queryable: `zeno show #a3f9c2d1` resolves to full entity

**Dependency**
A relationship between any two Zeno entities (gates, requirements, proposals, repositories):

- Type: requires (must be done first), blocks (prevents progress), relates_to (informational)
- Tracked automatically via hash references
- Enables conflict detection: proposals affecting same files are serialized
- Cross-repository: tracks which modules depend on which services

Query dependencies: `zeno req deps #hash` shows dependency graph for a requirement.

**Multi-Repo**
Project spanning multiple independent repositories (services, libraries, tools). Zeno detects boundaries automatically:

- Coupling metrics (afferent/efferent coupling)
- Domain boundaries (bounded contexts)
- Module size (LOC, complexity)
- Confidence scoring (0.0-1.0)

Use `zeno repos list` to see detected repositories and `zeno repos deps` for cross-repo dependency visualization.

**Git Worktree**
Isolated working directory for a proposal, stored at `.local/worktrees/{proposal-hash}/` (not version-controlled). Enables:

- 4+ agents/proposals to work in parallel without branch switching
- Isolated testing for each proposal
- Conflict-free merges (orchestrator sequences merges when needed)
- Automatic cleanup after approval

When you `zeno proposal start <hash>`, a worktree is created and path returned. You develop in that isolated directory without affecting other agents.

### Proposal Approval Workflow

1. Proposal generated (pending)
2. `zeno proposal validate <hash>` runs automated checks (coverage, security, linting, tests)
3. If checks pass: waits for human approval
4. If checks fail: proposal rejected with error details, replan triggered
5. Human approves: `zeno proposal approve <hash>` merges worktree branch and cleanup
6. Human rejects: `zeno proposal reject <hash>` marks rejected, preserves for rework

Rejected proposals preserve context for retry; no data loss.

**Quality Gates** (Non-Configurable in MVP)
Automated checks that must pass before proposal approval:

- Code Coverage: ≥90% of business logic (fail if <90%)
- Security Vulnerabilities: 0 known CVEs (fail if any found)
- Linting Error Rate: <0.01% (fail if higher)
- TypeScript Strict Mode: 0 type errors (required check)
- All Tests Passing: Required (fail if any test fails)

These are enforced automatically; cannot be overridden in MVP.

## Cross-File Navigation

| Document | Purpose | Location |
| ---------- | ------- | ---------- |
| **Root AGENTS.md** | General Zeno's Planner tool usage | `AGENTS.md` (this file) |
| **Project AGENTS.md** | Project-specific AI context | `zeno/AGENTS.md` |
| **Project PRD** | Single source of truth for project scope | `zeno/PROJECT_PRD.md` |
| **Architecture Docs** | System design and diagrams | `zeno/architecture/*.md` |
| **AGENTS Template** | Template for generating project guides | `templates/md-templates/agents-template.md` |

## File Structure

Zeno's Planner uses a two-level documentation pattern:

```text
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

2. **Reference `#file:PROJECT_PRD.md`** - Single source of truth for:
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

## Key Concepts

- **Gates**: Concrete milestones representing actual deliverables, not percentages. Progress measured by completion, not time
- **Hash-Based References**: `#a3f9c2d1` format for internal tracking/commands (internal only). Resolve to plain text names when communicating with users
- **Quality Thresholds**: 90% coverage, 0 vulnerabilities, <0.01% linting, 0 TypeScript errors (strict mode)
- **Human Approval**: Required at gate generation, repository boundaries, proposals, and gate completion

**MCP Handler-First Policy**: Handler-based tools take precedence over CLI-backed function implementations when registering MCP tools. This allows handlers to provide predictable, schema-validated `structuredContent` for LLMs, while function implementations remain available as a fallback. Prefer adding handler implementations for new or critical tools and migrate CLI implementations into handlers incrementally.

**Migration guidance**:

- Implement handler logic in `src/mcp/tools/*` and validate outputs with Zod schemas in `src/mcp/schemas/*`.
- Register handler factories via `registerTools()` (already implemented) so they override function-based tools.
- Add tests that mock the `FunctionRegistry` to assert handlers return validated `structuredContent`.

## Complete Command Reference

| Category | Command | Description |
| ---------- | ------- | ------------- |
| **Project** | `zeno init` | Initialize new project |
| | `zeno status` | Show project overview |
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
| | `zeno proposal start <hash>` | Start proposal (creates worktree) |
| | `zeno proposal validate <hash>` | Run automated checks |
| | `zeno proposal approve <hash>` | Approve proposal (merges worktree) |
| | `zeno proposal reject <hash>` | Reject proposal (human) |
| **Worktrees** | `zeno worktree list` | List active/orphaned worktrees |
| | `zeno worktree prune` | Remove expired worktrees |
| | `zeno worktree remove <hash>` | Manually delete worktree |
| | `zeno worktree merge <hash>` | Merge branch with conflict handling |
| **Delegation** | `/delegate <model>` | Hand-off to another agent |
| | `zeno metrics [path]` | Show code metrics |
| **Registry** | `zeno show <hash>` | Resolve hash to entity |
| | `zeno registry rebuild` | Rebuild hash registry |

## Typical Workflow

### Planning Phase (with Specialized Agents)

1. **Gate Analysis**: New gate created; determine gate type (API, Database, Frontend, Infrastructure, etc.)
2. **Manifest Lookup**: Query `agents/agent-manifest.json` for planning agents:
   - Use gate type to select from Planning Agent Selection Matrix (see `zeno/AGENTS.md`)
   - Example: For API Integration gate, query `{tier: ["expert","phd"], category: "communication-protocols|api-standards"}`
   - Apply Zod filters in agent-manifest.json for tier, category, and role matching
3. **Candidate Ranking**: Invoke `pipeline-agents/00-orchestration/agent-selector.md` to score and rank:
   - Composite score = (grade_points × 0.4) + (domain_match × 0.3) + (role_fit × 0.2) + (recent_usage × 0.1)
   - Select lead agent (highest score per tier), support agents (next tiers by score)
4. **Planning Agent Assignment**: Record in `.zeno/config.json` planning.agents with manifest references
5. **Architectural Analysis**: PhD Tier agents validate approach, identify cross-gate constraints
   - Read gate PRD, requirements, affected domains
   - Check gate dependencies via `zeno req deps <hash>`
6. **Decomposition**: Expert Tier agents create proposal breakdown with domain-specific insights
   - Draft requirements, technical decisions, acceptance criteria
   - Identify risks, dependencies, sequential constraints
7. **Hand-off to Local Agent**: Planning agents delegate detailed decomposition insights to local agent
   - Record planning phase analysis in proposal summaries
   - Provide implementation agent selection hints based on decomposition insights

### Review Phase

1. **Check status**: `zeno gates list` to see current gate
2. **Read gate PRD**: `zeno/gates/gate-XX-name.md`
   - **Gate Review Check** (guardrails injected via `proposal_action:generate` response — see `src/mcp/content/guardrails.ts` PROPOSAL_GENERATION_GUARDRAILS): Identify any open questions, unclear requirements, or contradictory statements. Flag implicit assumptions and ask for confirmation. Check gate dependencies for blockers. Escalate clarifications to user before proceeding.
3. **Review requirements**: `zeno req list --gate "<id>"`
4. **Review planning insights**: Check planning phase analysis in proposal summaries
5. **View proposals**: `zeno proposal show "<hash>"`
6. **Approve proposals**: User reviews and approves proposals before implementation begins (assumption: approval means user agrees with implementation strategy)

### Execution Phase

1. **Pre-Apply Review** (guardrails injected via `proposal_action:start` response — see `src/mcp/content/guardrails.ts` APPLY_PHASE_GUARDRAILS): Before implementing each proposal:
    - Read the entire proposal and check for open questions, unclear requirements, contradictory statements
    - Verify all Files Affected exist (or are marked as new)
    - Identify implicit assumptions and confirm correctness
    - Flag any incomplete dependency blockers
    - Document issues and escalate to user for clarification if needed
2. **Implement proposals**: Apply phase implements all approved proposals (`/zeno-apply <hash>` for each, or batch)
    - Implementation happens directly without intermediate approval workflow
    - Zeno validates implementation matches proposal specifications
    - All changes remain in active proposal files until gate completion
3. **Gate Completion**: When all proposals implemented, run `zeno gates complete <gate-id>` to:
    - Commit all implementation work
    - Archive all proposals automatically
    - Create git tag for the gate release
    - Set requirements to `tested` status
4. **Repeat**: Continue with next gates

**Key Improvement**: Streamlined workflow assumes user approval during proposal review phase. Archival happens only at gate completion, reducing friction between proposal and implementation. Zeno's role is to ensure implementation adheres to proposal specifications, not to manage intermediate archival steps.

## Best Practices

| Practice | Do | Don't |
| ---------- | ---- | ------- |
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
| ---------- | ---------- |
| Detailed AI instructions | `zeno/AGENTS.md` |
| Project PRD | `zeno/PROJECT_PRD.md` |
| Architecture diagrams | `zeno/architecture/*.md` |
| Gate PRDs | `zeno/gates/gate-XX-name.md` |
| Requirements database | `zeno/.zeno/registry.db` |
| Proposals (active) | `zeno/proposals/gate-XX/<name>.md` |
| Gates (completed archive) | `zeno/gates/archive/<gate-id>.md` |
| Configuration | `zeno/.zeno/config.json` |

## Zeno vs Traditional Spec Systems

Zeno expands beyond traditional spec-driven development (like OpenSpec):

| Aspect | Traditional Specs | Zeno's Planner |
| -------- | ------------------ | ---------------- |
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
