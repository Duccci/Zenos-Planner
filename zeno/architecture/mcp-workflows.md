# MCP Workflow State Machines

Formal state machines for Gates and Proposals. Each transition is triggered by a specific MCP action (via `gates_action` or `proposal_action`). Preconditions and postconditions enforce the Zeno workflow contract enforced at the MCP handler layer.

---

## Gate State Machine

### Valid Transitions

| From | Action (MCP) | To | Precondition | Postcondition |
|---|---|---|---|---|
| `pending` | `gates_action: start` | `in_progress` | Gate exists with status `pending` | Requirements are attributed; gate PRD is present |
| `in_progress` | `gates_action: complete` | `completed` | Gate exists with status `in_progress`; quality thresholds met | All proposals archived; git tag created |
| `in_progress` | `gates_action: cancel` | `cancelled` | Gate exists with status `in_progress` | Reason recorded |
| `in_progress` | `gates_action: defer` | `backlog` | Gate exists with status `in_progress` | Reason recorded |
| `rejected` | `gates_action: start` | `in_progress` | Gate exists with status `rejected` | Restart allowed |

**Terminal states**: `completed`, `cancelled` — no outgoing transitions.

```mermaid
stateDiagram-v2
    [*] --> pending : gates_action:create / gates_action:generate
    pending --> in_progress : gates_action:start\n[gate exists, status=pending]
    in_progress --> completed : gates_action:complete\n[quality thresholds met]
    in_progress --> cancelled : gates_action:cancel
    in_progress --> backlog : gates_action:defer
    rejected --> in_progress : gates_action:start\n[restart allowed]
    completed --> [*]
    cancelled --> [*]

    note right of in_progress
        MCP enforces:
        - Quality thresholds on complete
        - Dependency validation on create
    end note
```

### Gate Preconditions & Postconditions

**`start` (pending → in_progress)**
- *Pre*: Gate status must be `pending` or `rejected`
- *Pre*: All dependency gates must be `completed`
- *Post*: Gate status = `in_progress`; `started_at` timestamp set
- *Idempotent*: Calling `start` on an already `in_progress` gate returns success (no-op)

**`complete` (in_progress → completed)**
- *Pre*: Gate status must be `in_progress`
- *Pre*: Quality metrics must meet configured thresholds (`codeCoverage ≥90%`, `securityVulnerabilities = 0`, `lintingErrorRate <0.01%`)
- *Post*: Gate status = `completed`; git tag created; proposals archived
- *Idempotent*: Calling `complete` on an already `completed` gate returns success (no-op)

---

## Proposal State Machine

### Valid Transitions

| From | Action (MCP) | To | Precondition | Postcondition |
|---|---|---|---|---|
| `pending` | `proposal_action: start` | `in_progress` | Proposal exists with status `pending`; artifact validation passes | Worktree created (if applicable) |
| `in_progress` | `proposal_action: approve` | `completed` | Proposal exists with status `in_progress`; quality thresholds met | Requirements set to `implemented` |
| `in_progress` | `proposal_action: reject` | `rejected` | Proposal exists with status `in_progress` | Rejection reason recorded |
| `any` | `proposal_action: cancel` | `cancelled` | Proposal exists | Reason recorded |
| `any` | `proposal_action: defer` | `backlog` | Proposal exists | Reason recorded |

**Terminal states**: `completed`, `cancelled` — no outgoing transitions.

```mermaid
stateDiagram-v2
    [*] --> pending : proposal_action:create / proposal_action:generate
    pending --> in_progress : proposal_action:start\n[status=pending; artifact valid]
    in_progress --> completed : proposal_action:approve\n[quality thresholds met]
    in_progress --> rejected : proposal_action:reject
    pending --> cancelled : proposal_action:cancel
    in_progress --> cancelled : proposal_action:cancel
    pending --> backlog : proposal_action:defer
    in_progress --> backlog : proposal_action:defer
    completed --> [*]
    cancelled --> [*]

    note right of in_progress
        MCP enforces:
        - Apply-phase constraints on start
        - Quality thresholds on approve
        - State pre-conditions enforced
          at the MCP handler layer
    end note
```

### Proposal Preconditions & Postconditions

**`start` (pending → in_progress)**
- *Pre*: Proposal status must be `pending`
- *Pre*: Artifact file must pass format + structure validation (`validateArtifactFile`)
- *Pre*: No git operations detected (`validateApplyPhase`)
- *Post*: Proposal status = `in_progress`; `started_at` timestamp set
- *Idempotent*: Calling `start` on an already `in_progress` proposal returns success (no-op)

**`approve` (in_progress → completed)**
- *Pre*: Proposal status must be `in_progress`
- *Pre*: Quality metrics must meet configured thresholds
- *Post*: Proposal status = `completed`; requirements set to `implemented`
- *Idempotent*: Calling `approve` on an already `completed` proposal returns success (no-op)

**`reject` (in_progress → rejected)**
- *Pre*: Proposal status must be `in_progress`
- *Post*: Proposal status = `rejected`; rejection reason recorded
- *Idempotent*: Calling `reject` on an already `rejected` proposal returns success (no-op)

---

## Error Response Contract

When an invalid transition is attempted, the MCP handler returns a structured error:

```json
{
  "action": "start",
  "error": "Validation failed",
  "validation": {
    "allowed": false,
    "errors": [
      "gate:completed cannot transition to in_progress. Valid transitions from completed: none"
    ]
  }
}
```

The error message format is: `<entity>:<currentStatus> cannot transition to <targetStatus>. Valid transitions from <currentStatus>: <validTargets | none>`

This format allows callers to programmatically determine the next valid action without reading documentation.

---

## Implementation Notes

State transition enforcement is split across two layers:

| Layer | Responsibility |
|---|---|
| **MCP Handler (validators)** | Pre-condition checks before any action is executed; returns structured error with valid next actions |
| **CLI layer** | Secondary safety net (handles direct CLI invocations bypassing MCP) |

The MCP layer is authoritative when Zeno runs as an MCP server. The CLI layer provides defence-in-depth for direct CLI usage.

Source: `src/mcp/tools/gate-tools.ts`, `src/mcp/tools/proposal-tools.ts`, `src/mcp/tools/entity-action-handler.ts`
