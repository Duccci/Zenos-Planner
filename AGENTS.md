# Zeno's Planner: AI Agent Instructions

Lightweight dispatch for AI coding assistants. Context is delivered on-demand via MCP tools — do NOT preload large documents.

> **Project-specific instructions**: Add team conventions, architecture notes, or coding standards below the Zeno block.

<!-- ZENO:START — Managed by Zeno's Planner. Do not edit this block manually. -->

## Zeno Planner: MCP Tool Dispatch

### Context Loading Rules

- **Never** read `PROJECT_PRD.md`, `STRUCTURE.md`, or `architecture/*.md` unless performing **planning or gate generation**.
- During **gate/proposal execution**, all context comes from the proposal file itself and MCP tool queries.
- Use `context_action` to get working context for a gate or proposal from the database.
- Use `config_get` for quality thresholds and project configuration.
- Use `diagram_action:show` to view a specific architecture diagram **only when needed**.

### Cross-File Navigation

| Document | Purpose | When to Load |
| -------- | ------- | ------------ |
| **Project PRD** | Project scope, goals, decisions | Planning & gate generation **only** |
| **Repository Structure** | Repo map, modules, conventions | Planning & gate generation **only** |
| **Architecture Docs** | System design diagrams | On-demand via `diagram_action:show` |

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

### Key Concepts

- **Gates**: Concrete milestones measured by completion, not time. Sequential by default.
- **Proposals**: Self-contained implementation plans within a gate. Each proposal has all context needed for execution.
- **Hash References**: `#a3f9c2d1` format for internal tracking. Resolve to plain text names for users.
- **Human Approval**: Required at gate generation, proposals, and gate completion.
- **Quality Thresholds**: Enforced automatically — query via `config_get`.

### Quick Start

1. **Use MCP tools directly** — all project context is available on-demand without preloading files.
2. **Use MCP tools for all queries** — `gates_action`, `proposal_action`, `req_action`, `context_action`, `config_get`, `show_entity`.
3. **For planning/generation only** — load `PROJECT_PRD.md` and `architecture/STRUCTURE.md` via the generation workflow steps.

<!-- ZENO:END -->

## Agent References

For current agent availability and capabilities, consult [agents/README.md](./agents/README.md).

---

**Zeno's Planner** | Bridging Vision and Implementation
