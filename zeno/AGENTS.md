# zenos-planner: AI Agent Context Guide

Project-specific guide for AI agents. For general Zeno dispatch rules, see `../AGENTS.md`.

## Quick Navigation

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

## Context Phase Rules

| Phase | Triggered by | Load |
| ----- | ------------ | ---- |
| `execution` | `proposal_action:start` | Single proposal file only. No PRD or STRUCTURE.md. |
| `gate-proposal-gen` | `proposal_action:generate` | Gate PRD + `zeno/AGENTS.md` only. |
| `planning` | `gates_action:generate` | `overview/PROJECT_PRD.md` + `overview/STRUCTURE.md` + `zeno/AGENTS.md`. |

> Pass `operationMode` to `context_action` to declare the phase. In `execution` mode the response is DB-only. In `planning` mode `_planningContext` paths are included as load hints.

## Database Access

> **CRITICAL — MCP Tools Only**: Never query `registry.db` directly (no `better-sqlite3` scripts, no raw SQL, no `node -e`, no `npx tsx -e` DB scripts). The database schema changes between gates; direct queries will silently return stale or incomplete data. Always use MCP tools — they are schema-validated and return structured content.

## MCP Tool Reference

> **NO CLI COMMANDS OR DIRECT DB SCRIPTS**: MCP tools are the **only** sanctioned interface for agents.

| MCP Tool | Actions | Purpose |
| -------- | ------- | ------- |
| `context_action` | `gate`, `proposal`, `requirement`, `repository` | Get working context or resolve any entity by hash/name |
| `gates_action` | `list`, `show`, `create`, `generate`, `start`, `complete`, `regenerate` | Gate lifecycle |
| `proposal_action` | `list`, `show`, `create`, `generate`, `validate`, `approve`, `reject`, `start`, `progress` | Proposal lifecycle |
| `reg_action` | `list`, `show`, `deps`, `transfer`, `search` | Requirements queries |
| `archive_action` | `gate`, `batch` | Finalize completed work |
| `diagram_action` | `show`, `generate` | Architecture diagrams (on-demand) |
| `repos_action` | `list`, `detect`, `deps`, `adjust` | Repository management |
| `config_get` | — | Quality thresholds and configuration |
| `show_entity` removed | — | Replaced by `context_action` — use `requirement` or `repository` action |

## Reading Artifacts

### Gate PRDs (`gates/gate-XX-name.md`)

Each gate file contains objectives, deliverables, requirements references, and dependencies. Gates are sequential — complete in order. Requirements use `#hash` references.

### Proposals (`proposals/gate-XX/<name>.md`)

Each proposal is self-contained: title, hash, gate, tasks (checkbox list), files affected, dependencies, and acceptance criteria. A proposal contains all information needed for execution — do not load external documents unless the proposal explicitly references them.

**Task completion checkpointing**: After finishing each task during apply phase, immediately mark its checkbox `[x]` in the proposal markdown file before starting the next task. If the session crashes or is interrupted, the next session reads the proposal file to find the first unchecked task and resumes from there — no duplicated work.

### Commits & Traceability

Commits reference artifact hashes using the `commitFormat` from `.zeno/config.json`:

```bash
git log --grep '#<hash>' --pretty=format:'%h %ad %an %s' --date=short
```

---

**Document Version**: 0.3.0
**Last Updated**: 2026-02-06
**Status**: Active
