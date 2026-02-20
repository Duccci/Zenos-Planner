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
│   ├── state.json              # Current state
│   ├── project-overview.json   # LLM-optimized project memory
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

## Proposal Development Best Practices

**Test-First Principle with Reuse:**

- Always search existing test files in the `tests/` directory before creating new tests
- Extend or enhance existing test cases rather than duplicating similar test scenarios
- Create new tests only when existing ones cannot adequately cover the new functionality
- Document in proposal task descriptions why new tests are necessary if reuse is not possible
- Maintain awareness of test file locations across the codebase to minimize discovery overhead

This approach ensures efficient test coverage, reduces duplication, and maintains a lean test suite aligned with quality thresholds (90% coverage minimum).

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
