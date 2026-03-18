# [Project Name]: AI Agent Context Guide

> **Project-specific instructions**: Replace this line with team conventions, architecture notes, or coding standards. Everything inside the Zeno block below is managed automatically — do not edit it manually.

<!-- ZENO:START — Managed by Zeno's Planner. Do not edit this block manually. -->

## Zeno Planner: MCP Tool Dispatch

### Quick Navigation

| What I Need | How to Get It |
| --- | --- |
| Project scope, goals, decisions | `overview/PROJECT_PRD.md` *(planning/generation only)* |
| Repo map, modules, naming | `overview/STRUCTURE.md` *(planning/generation only)* |
| Architecture diagrams | `diagram_action:show { type }` *(on-demand only)* |
| Current gate status | `gates_action:list` |
| Gate details & objectives | `context_action:gate { gateId }` |
| Proposal working context | `context_action:proposal { hash }` |
| Requirements for gate | `reg_action:list { gateId }` |
| Specific requirement | `reg_action:show { hash }` |
| Proposal details | `proposal_action:show { hash }` |
| Quality thresholds | `config_get` |
| Hash lookup | `context_action { hash, action: 'requirement'\|'repository'\|'gate'\|'proposal' }` |
| Project config | `config_get` |

### Context Phase Rules

| Phase | Triggered by | Load |
| ----- | ------------ | ---- |
| `execution` | `proposal_action:start` | Single proposal file only. No PRD or STRUCTURE.md. |
| `gate-proposal-gen` | `proposal_action:generate` | Gate PRD + `AGENTS.md` only. |
| `planning` | `gates_action:generate` | `overview/PROJECT_PRD.md` + `overview/STRUCTURE.md` + `AGENTS.md`. |

> Pass `operationMode` to `context_action` to declare the phase. In `execution` mode the response is DB-only. In `planning` mode `_planningContext` paths are included as load hints.

### Database Access

> **`zeno init` creates `config.json` only** — `registry.db` does not exist until the first database operation (e.g. `zeno gates start`). Do not assume the database is present in a freshly initialised project.
>
> **CRITICAL — MCP Tools Only**: Never query `registry.db` directly (no `better-sqlite3` scripts, no raw SQL, no `node -e`, no `npx tsx -e` DB scripts). The database schema changes between gates; direct queries will silently return stale or incomplete data. Always use MCP tools — they are schema-validated and return structured content.

### MCP Tool Reference

> **NO CLI COMMANDS OR DIRECT DB SCRIPTS**: MCP tools are the **only** sanctioned interface for agents.

| MCP Tool | Actions | Purpose |
| -------- | ------- | ------- |
| `context_action` | `gate`, `proposal`, `requirement`, `repository` | Get working context or resolve any entity by hash/name |
| `gates_action` | `list`, `show`, `generate`, `validate`, `start`, `complete`, `regenerate`, `cancel`, `defer` | Gate lifecycle |
| `proposal_action` | `list`, `show`, `generate`, `validate`, `approve`, `reject`, `start`, `progress`, `cancel`, `defer` | Proposal lifecycle |
| `reg_action` | `list`, `show`, `deps`, `transfer`, `search`, `inherit`, `trace`, `update`, `db_sync`, `db_status`, `purge_orphans`, `reset_gate`, `regenerate` | Registry DB queries — all entity lookups, requirements, hashes, and dependencies |
| `repos_action` | `list`, `detect`, `deps`, `adjust`, `add`, `remove`, `analyze` | Repository management and boundary detection |
| `project_action` | `init`, `status` | Project initialization and status |
| `config_get` | — | Quality thresholds and configuration |
| `diagram_action` | `catalogue`, `select`, `generate`, `show`, `render`, `list_template`, `get_template` | Architecture & templates management |
| `worktree_action` | `list`, `remove`, `prune`, `merge` | Git worktree management for proposals |
| `artifact_validate` | — | Unified artifact validator (format/quality/dependency) |
| `git_trace` | — | Trace git commits for artifacts (gates, proposals, requirements) |

### Reading Artifacts

#### Gate PRDs (`gates/gate-XX-name.md`)

Each gate file contains objectives, deliverables, requirements references, and dependencies. Gates are sequential — complete in order. Requirements use `#hash` references.

#### Proposals (`proposals/gate-XX/<name>.md`)

Each proposal is self-contained: title, hash, gate, tasks (checkbox list), files affected, dependencies, and acceptance criteria. A proposal contains all information needed for execution — do not load external documents unless the proposal explicitly references them.

**Task completion checkpointing**: After finishing each task during apply phase, immediately mark its checkbox `[x]` in the proposal markdown file before starting the next task. If the session crashes or is interrupted, the next session reads the proposal file to find the first unchecked task and resumes from there — no duplicated work.

#### Commits & Traceability

Commits reference artifact hashes using the `commitFormat` from `.zeno/config.json`:

```bash
git log --grep '#<hash>' --pretty=format:'%h %ad %an %s' --date=short
```

<!-- ZENO:END -->

## Project-Specific Conventions

[Add any project-specific patterns here]

### Key Dependencies

[List critical libraries and their purpose]

### Architecture Patterns

[Describe architectural style: microservices, monolith, modular, etc.]

---

**Project**: [Project Name]
**Last Updated**: [TIMESTAMP]
