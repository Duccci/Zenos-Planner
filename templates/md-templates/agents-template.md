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
| Requirements for gate | `req_action:list { gateId }` |
| Specific requirement | `req_action:show { hash }` |
| Proposal details | `proposal_action:show { hash }` |
| Quality thresholds | `config_get` |
| Hash lookup | `show_entity { hash }` |
| Project config | `config_get` |

### Context Phase Rules

| Phase | Triggered by | Load |
| ----- | ------------ | ---- |
| `execution` | `proposal_action:start` | Single proposal file only. No PRD or STRUCTURE.md. |
| `gate-proposal-gen` | `proposal_action:generate` | Gate PRD + `AGENTS.md` only. |
| `planning` | `gates_action:generate` | `overview/PROJECT_PRD.md` + `overview/STRUCTURE.md` + `AGENTS.md`. |

> Pass `operationMode` to `context_action` to declare the phase. In `execution` mode the response is DB-only. In `planning` mode `_planningContext` paths are included as load hints.

### Database Access

> **CRITICAL — MCP Tools Only**: Never query `registry.db` directly (no `better-sqlite3` scripts, no raw SQL, no `node -e`, no `npx tsx -e` DB scripts). The database schema changes between gates; direct queries will silently return stale or incomplete data. Always use MCP tools — they are schema-validated and return structured content.

### MCP Tool Reference

> **NO CLI COMMANDS OR DIRECT DB SCRIPTS**: MCP tools are the **only** sanctioned interface for agents.

| MCP Tool | Actions | Purpose |
| -------- | ------- | ------- |
| `context_action` | `gate`, `proposal` | Get working context (objectives, tasks, requirements, files) |
| `gates_action` | `list`, `show`, `create`, `generate`, `start`, `complete`, `regenerate` | Gate lifecycle |
| `proposal_action` | `list`, `show`, `create`, `generate`, `validate`, `approve`, `reject`, `start`, `progress` | Proposal lifecycle |
| `req_action` | `list`, `show`, `deps`, `transfer`, `search` | Requirements queries |
| `archive_action` | `gate`, `batch` | Finalize completed work |
| `diagram_action` | `show`, `generate` | Architecture diagrams (on-demand) |
| `repos_action` | `list`, `detect`, `deps`, `adjust` | Repository management |
| `config_get` | — | Quality thresholds and configuration |
| `show_entity` | — | Resolve hash to entity |

### Reading Artifacts

#### Gate PRDs (`gates/gate-XX-name.md`)

Each gate file contains objectives, deliverables, requirements references, and dependencies. Gates are sequential — complete in order. Requirements use `#hash` references.

#### Proposals (`proposals/gate-XX/<name>.md`)

Each proposal is self-contained: title, hash, gate, tasks (checkbox list), files affected, dependencies, and acceptance criteria. A proposal contains all information needed for execution — do not load external documents unless the proposal explicitly references them.

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
