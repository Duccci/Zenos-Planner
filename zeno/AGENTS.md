# zenos-planner: AI Agent Context Guide

How to read and navigate artifacts in this Zeno project. For tool usage and terminology, see the root `../AGENTS.md`. For project scope, goals, and technical decisions, see `PROJECT_PRD.md`.

## Quick Navigation

| What I Need                       | Where to Look               |
| --------------------------------- | --------------------------- |
| Project scope, goals, decisions   | `PROJECT_PRD.md`            |
| Tool usage, terminology, workflow | `../AGENTS.md`              |
| System architecture               | `architecture/*.md`         |
| Current gate status               | `zeno gates list`           |
| Gate details                      | `gates/gate-XX-name.md`     |
| Requirements for gate             | `zeno req list --gate <id>` |
| Specific requirement              | `zeno req show <hash>`      |
| Proposal details                  | `zeno proposal show <hash>` |
| Requirements database             | `.zeno/requirements.db`     |
| Project config                    | `.zeno/config.json`         |
| Hash lookup                       | `zeno show <hash>`          |

## Project Structure

```
zeno/
├── .zeno/                      # Internal state (version controlled)
│   ├── config.json             # Project configuration
│   ├── state.json              # Historical snapshot of gate progress (synced with gate workflow)
│   ├── project-overview.json   # LLM-optimized project memory (source of truth)
│   └── requirements.db         # SQLite requirements database
├── AGENTS.md                   # This file
├── PROJECT_PRD.md              # Single source of truth for scope
├── architecture/               # Mermaid diagram docs
│   ├── system-overview.md
│   ├── data-flow.md
│   ├── gate-lifecycle.md
│   └── gate-roadmap.md
├── gates/                      # Gate PRDs
│   ├── gate-04-*.md ... gate-14-*.md  (active)
│   └── archive/                       (completed)
├── proposals/
│   ├── gate-XX/<name>.md       # Active proposals by gate
│   ├── solitary/<name>.md      # Out-of-gate proposals
│   └── (no long-term archive; proposals are consolidated into gates)
├── requirements/               # README for DB access
└── subprojects/                # Multi-repo detection artifacts
```

## Reading Artifacts

### Gate PRDs (`gates/gate-XX-name.md`)

Each gate file contains objectives, deliverables, requirements references, and dependencies. Gates are sequential — complete in order. Requirements use `#hash` references. Quality thresholds are enforced automatically (see `PROJECT_PRD.md` for thresholds).

### Requirements (`zeno/.zeno/requirements.db`)

Query via CLI or directly in SQLite:

```sql
-- Requirements for a gate
SELECT hash, type, priority, title, description, acceptance_criteria
FROM requirements
WHERE gate_id = '<gate-id>'
ORDER BY priority DESC, created_at ASC;
```

```bash
zeno req list --gate <gate-id>
zeno req show <hash>
zeno req deps <hash>
```

No `status` field — presence in DB = approved. Lifecycle tracked via proposal approvals and gate archival.

### Architecture Diagrams (`architecture/*.md`)

Each file contains an embedded Mermaid diagram plus description:

| File                 | Content                                      |
| -------------------- | -------------------------------------------- |
| `system-overview.md` | Component relationships and module structure |
| `data-flow.md`       | End-to-end data processing paths             |
| `gate-lifecycle.md`  | State machine for gate/proposal workflow     |
| `gate-roadmap.md`    | Gate structure and parallel relationships    |

Gate roadmap shows gate-level structure only; detailed features are in gate-specific PRDs.

### Proposals (`proposals/gate-XX/<name>.md`)

Active proposals organized by gate. Completed proposals remain in place until gate completion, where they are consolidated into gate archive artifacts under `gates/archive/`. Each proposal contains: title, hash, gate, tasks (checkbox list), files affected, dependencies, and acceptance criteria.

### Commits & Traceability

Commits reference artifact hashes using the `commitFormat` from `.zeno/config.json`:

```bash
# Find commits for an artifact
git log --grep '#<hash>' --pretty=format:'%h %ad %an %s' --date=short

# Resolve hash to entity
zeno show <hash>
```

## MCP Tool Reference

MCP tools are the authoritative interface for all workflow actions. Use these instead of guessing CLI mappings. Each tool exposes a unified `action` parameter — always pass `action` as a string.

| CLI Equivalent | MCP Tool | Action Values |
| -------------- | -------- | ------------- |
| `zeno init` | `project_action` | `init`, `status` |
| `zeno status` | `project_action` | `init`, `status` |
| `zeno gates *` | `gates_action` | `list`, `show`, `create`, `generate`, `start`, `complete`, `regenerate` |
| `zeno proposal *` | `proposal_action` | `list`, `show`, `create`, `generate`, `validate`, `approve`, `reject`, `start`, `progress` |
| `zeno req *` | `req_action` | `list`, `show`, `deps`, `transfer` |
| `zeno repos *` | `repos_action` | `list`, `detect`, `deps`, `adjust` |
| `zeno gates complete` + archive | `archive_action` | `gate`, `batch` |
| `zeno arch *` | `diagram_action` | *(see tool schema)* |
| `zeno show <hash>` | `show_entity` | — |
| `config_get()` in skills | `config_get` | — |

**Validator functions** (called by handlers; not invoked directly):

| Validator | Purpose |
| --------- | ------- |
| `validateApplyPhase` | Enforces apply-phase constraints |
| `validateQuality` | Code coverage, CVEs, linting |
| `validateDependencies` | Blocks on unresolved dependencies |
| `validateProposalPhases` | Verifies RED/GREEN phase ordering |
| `validateScope` | Checks changes are within declared scope |
| `validateTestFirstPattern` | Enforces test-first design |
| `validateArtifact` | Checks artifact structure and completeness |

## Proposal Development Best Practices

**Test-First Principle with Reuse:**

- Always search existing test files in the `tests/` directory before creating new tests
- Extend or enhance existing test cases rather than duplicating similar test scenarios
- Create new tests only when existing ones cannot adequately cover the new functionality
- Document in proposal task descriptions why new tests are necessary if reuse is not possible
- Maintain awareness of test file locations across the codebase to minimize discovery overhead

This approach ensures efficient test coverage, reduces duplication, and maintains a lean test suite aligned with quality thresholds (90% coverage minimum).

## Pre-Action Review: Identifying Issues Before Implementation

Before generating proposals or applying them, AI agents must perform validation checks to identify open questions, unclear requirements, and incorrect assumptions. This prevents propagating ambiguity into implementation.

### Before Generating Proposals (Gate Review)

When starting proposal generation for a gate, read the entire Gate PRD and:
- **Flag open questions** — Any ambiguous or incomplete requirement descriptions
- **Identify unclear acceptance criteria** — Requirements saying "should be fast" without quantified metrics need clarification
- **List implicit assumptions** — Assumptions about existing systems, migration paths, or constraints that may not be correct
- **Check for blocked dependencies** — Gate dependencies that are incomplete or blocked by other work

**See**: `../AGENTS.md` step 9 (Gate Review Check); `../.claude/skills/zeno-proposal/SKILL.md` (Pre-Generation Gate Review guardrails)

### Before Applying Proposals (Pre-Apply Review)

When starting proposal implementation, read the entire proposal and:
- **Flag open questions** — Unclear tasks, contradictory acceptance criteria, or vague requirements
- **Verify Files Affected** — Ensure all target files exist or are explicitly marked as new; flag non-existent paths
- **Identify implicit assumptions** — Assumptions about installed packages, existing schemas, or system state
- **Check for incomplete blockers** — Dependencies marked as incomplete that will prevent implementation

**See**: `../AGENTS.md` step 14 (Pre-Apply Review); `../.claude/skills/zeno-apply/SKILL.md` (Pre-Apply Review guardrails)

**Process**: If any issues are found, document them and escalate to the user for clarification BEFORE proceeding. Do not implement around unclear requirements.

### Pre-Action Review Checklist

Use this checklist when performing pre-action reviews (gate review before proposal generation, pre-apply review before implementation):

| Check | Gate Review | Pre-Apply Review | Action if Found |
|-------|-----------|-----------------|-----------------|
| **Open Questions** | Any ambiguous/incomplete requirements | Unclear tasks, contradictory acceptance criteria | Document and escalate for clarification |
| **Vague Acceptance Criteria** | "Should be fast" without metrics | Missing quantified thresholds | Flag and request specific measurements |
| **Implicit Assumptions** | Assumed existing systems, migration paths | Assumed installed packages, schemas | List assumptions and request confirmation |
| **Blocked Dependencies** | Gate dependencies incomplete/blocked | Dependency tasks marked incomplete | Document blocker and wait for user guidance |
| **File/Path Verification** | (N/A) | Files Affected exist or marked as new | Flag non-existent paths and request confirmation |
| **Clarity Across Sections** | PRD objectives, requirements, decisions | Summary, Context, Tasks sections | Document contradictions and ask for alignment |

If any of these checks reveal issues, **STOP and escalate to the user** rather than proceeding with implementation or proposal generation.

## Troubleshooting

| Issue                | Solution                                                    |
| -------------------- | ----------------------------------------------------------- |
| Hash not found       | `zeno show <hash>` — verify hash, check if archived         |
| Dependency conflict  | `zeno proposal validate <hash>` to see conflicts            |
| Quality gate failure | Add tests, fix vulnerabilities, resolve lint issues         |
| Stale gate structure | Check `.zeno/config.json`, review `PROJECT_PRD.md` timeline |

---

**Document Version**: 0.2.0
**Last Updated**: 2026-02-06
**Status**: Active
