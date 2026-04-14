# zenos-planner: AI Agent Context Guide

Project-specific guide for AI agents. For general Zeno dispatch rules, see `../AGENTS.md`.

## Quick Navigation

| What I Need | MCP Call |
| --- | --- |
| Project scope & decisions | Read `overview/PROJECT_PRD.md` *(planning only)* |
| Repo structure & naming | Read `overview/STRUCTURE.md` *(planning only)* |
| Architecture diagram | `diagram_action` → `show` with `diagramType` |
| All gates | `gates_action` → `list` |
| Gate context | `context_action` → `gate` with `gateId` |
| Proposal context | `context_action` → `proposal` with `hash` |
| Solitary proposals | `proposal_action` → `list` with `gateId: "solitary"` |
| Gate requirements | `reg_action` → `list` with `gateId` |
| Single requirement | `reg_action` → `show` with `hash` |
| Proposal details | `proposal_action` → `show` with `hash` |
| Quality thresholds | `config_get` |
| Resolve any hash | `context_action` → `gate`/`proposal`/`requirement`/`repository` with `hash` |

## Context Phase Rules

| Phase | Triggered by | Load |
| ----- | ------------ | ---- |
| `execution` | `proposal_action:start` (gate-tied) | Single proposal file only. No PRD or STRUCTURE.md. |
| `solitary-execution` | `proposal_action:start` (solitary) | Single proposal file only. No gate PRD. No PRD or STRUCTURE.md. |
| `gate-proposal-gen` | `proposal_action:scaffold` / `proposal_action:generate` (gate-tied) | Gate PRD + `zeno/AGENTS.md` only. |
| `solitary-generate` | `proposal_action:scaffold` / `proposal_action:generate { solitary: true }` | `zeno/AGENTS.md` only. No PRD, no gate PRD. |
| `planning` | `gates_action:generate` | `overview/PROJECT_PRD.md` + `overview/STRUCTURE.md` + `zeno/AGENTS.md`. |

> Pass `operationMode` to `context_action` to declare the phase. In `execution` mode the response is DB-only. In `planning` mode `_planningContext` paths are included as load hints.

## Database Access

> **`zeno init` creates `config.json` only** — `registry.db` does not exist until the first database operation (e.g. `zeno gates start`). Do not assume the database is present in a freshly initialised project.
>
> **CRITICAL — MCP Tools Only**: Never query `registry.db` directly (no `better-sqlite3` scripts, no raw SQL, no `node -e`, no `npx tsx -e` DB scripts). The database schema changes between gates; direct queries will silently return stale or incomplete data. Always use MCP tools — they are schema-validated and return structured content.

## MCP Tool Reference

> **NO CLI COMMANDS OR DIRECT DB SCRIPTS**: MCP tools are the **only** sanctioned interface for agents.

| MCP Tool | Actions | Purpose |
| -------- | ------- | ------- |
| `context_action` | `gate`, `proposal`, `requirement`, `repository` | Get working context or resolve any entity by hash/name |
| `gates_action` | `list`, `show`, `generate`, `validate`, `start`, `complete`, `replan`, `cancel`, `defer` | Gate lifecycle |
| `proposal_action` | `list`, `show`, `scaffold` (alias: `generate`), `validate`, `approve`, `reject`, `start`, `progress`, `cancel`, `defer`, `delete`, `db_status`, `db_sync`, `purge_orphans`, `regenerate` | Proposal lifecycle. **scaffold** stamps blank templates — fill all `[placeholders]` before validate. **delete** removes DB row + disk file atomically. **db_status/db_sync/purge_orphans** for housekeeping. |
| `reg_action` | `list`, `show`, `deps`, `transfer`, `search`, `inherit`, `trace`, `update`, `db_sync`, `db_status`, `purge_orphans`, `reset_gate`, `regenerate` | Registry DB queries — all entity lookups, requirements, hashes, and dependencies |
| `repos_action` | `list`, `detect`, `deps`, `adjust`, `add`, `remove`, `analyze` | Repository management and boundary detection |
| `project_action` | `init`, `status` | Project initialization and status |
| `config_get` | — | Quality thresholds and configuration |
| `diagram_action` | `catalogue`, `select`, `generate`, `show`, `render`, `list_template`, `get_template` | Architecture & templates management |
| `worktree_action` | `list`, `remove`, `prune`, `merge` | Git worktree management for proposals |
| `artifact_validate` | — | Unified artifact validator (format/quality/dependency) |
| `git_trace` | — | Trace git commits for artifacts (gates, proposals, requirements) |

### Parameter Conventions

**Flat parameters only** — every field sits alongside `action` at the top level. **Never wrap in `payload`.**

```json
{ "action": "show", "hash": "p03api" }          // ✅ correct
{ "action": "show", "payload": { "hash": "..." } } // ❌ wrong
```

**`#` prefix is optional** — auto-stripped from `hash`, `gateId`, `targetGateId`, and other hash fields.

**Identifier field per tool:**

| Tool | Field | Scope | Example Call |
| ---- | ----- | ----- | ------------ |
| `gates_action` | `gateId` | All gate ops | `{ "action": "start", "gateId": "gate-03" }` |
| `proposal_action` | `hash` | Single-proposal ops | `{ "action": "show", "hash": "p03api" }` |
| `proposal_action` | `gateId` | List filter / scaffold target | `{ "action": "list", "gateId": "gate-03" }` |
| `reg_action` | `hash` | Single-requirement ops | `{ "action": "show", "hash": "g03req1" }` |
| `reg_action` | `gateId` | List/search filter | `{ "action": "list", "gateId": "gate-03" }` |
| `reg_action` | `targetGateId` | Transfer destination | `{ "action": "transfer", "hash": "g03req1", "targetGateId": "gate-04" }` |
| `context_action` | `hash` or `gateId` | Universal resolver | `{ "action": "gate", "gateId": "gate-03" }` |
| `worktree_action` | `hash` | remove / merge | `{ "action": "remove", "hash": "p03api" }` |
| `diagram_action` | `diagramType` / `name` | show / get_template | `{ "action": "show", "diagramType": "system-overview" }` |

## Proposal Execution Protocol

**When asked to "start", "implement", "work on", or "execute" a proposal**: extract its `#hash` from the `**Hash**:` line, then call `proposal_action:start { hash }` before touching any files. The response returns the worktree path — all edits and commits belong there, not in the main workspace. Finish with `proposal_action:validate` → `proposal_action:approve`.

## Reading Artifacts

### Gate PRDs (`gates/gate-XX-name.md`)

Each gate file contains objectives, deliverables, requirements references, and dependencies. Gates are sequential — complete in order. Requirements use `#hash` references.

### Proposals (`proposals/gate-XX/<name>.md`)

Each proposal is self-contained: title, hash, gate, tasks (checkbox list), files affected, dependencies, and acceptance criteria. A proposal contains all information needed for execution — do not load external documents unless the proposal explicitly references them.

**Task completion checkpointing**: After finishing each task during apply phase, immediately mark its checkbox `[x]` in the proposal markdown file before starting the next task. If the session crashes or is interrupted, the next session reads the proposal file to find the first unchecked task and resumes from there — no duplicated work.

### Solitary Proposals (`proposals/solitary/<name>.md`)

Solitary proposals are **gate-independent** (`gateId = NULL`). List them with `proposal_action:list { gateId: 'solitary' }`. Create with `proposal_action:generate { solitary: true, title: '...', tasks: [...] }` — no gate PRD is loaded, only `zeno/AGENTS.md`. The `Gate` header field reads `Solitary`. RED and GREEN phases are combined inline. Dependency validation skips gate-ordering checks.

### Commits & Traceability

Commits reference artifact hashes using the `commitFormat` from `.zeno/config.json`:

```bash
git log --grep '#<hash>' --pretty=format:'%h %ad %an %s' --date=short
```

### Worktree Commit Behaviour

The pre-commit hook automatically detects the commit context and adjusts the test run:

| Context | Detection | Test strategy |
|---------|-----------|---------------|
| Commit inside a worktree | `.git` is a file (gitdir pointer) | `vitest --changed HEAD` (scoped — only files changed in this branch) |
| Merge commit on main | `.git/MERGE_MSG` exists | `vitest --changed ORIG_HEAD` (scoped — only files brought in by the branch) |
| Regular commit on main | default | Full `vitest run --coverage` + 90% threshold |

**No manual override is required.** This lets proposals in parallel worktrees commit and merge cleanly without being blocked by unrelated failing tests on other in-progress branches.

### Worktree Approval & Merge

When `proposal_action:approve` is called for a gate-tied proposal that has an active worktree:

1. The worktree branch is automatically **merged into main** before the worktree directory is removed.
2. If merge conflicts are detected, the worktree is **preserved** (not deleted) so no work is lost.
3. If conflicts occur: resolve them manually in the worktree directory, commit the resolution, then call `proposal_action:approve` again.
4. **Do NOT call `worktree_action:remove` directly** — approval handles cleanup after a successful merge.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-18
**Status**: Active
