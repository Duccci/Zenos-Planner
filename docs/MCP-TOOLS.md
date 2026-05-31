# MCP Tools Reference Documentation

**Project:** Zeno's Planner
**Last Updated:** March 18, 2026
**Purpose:** Authoritative reference for all Model Context Protocol (MCP) tools, their input/output schemas, validators, preconditions, and error codes.

---

## Canonical MCP Tool Surface

This table is the stable tool surface exposed by `registerTools()`. Runtime
registration, diagnostics, and `zeno mcp tools` must all report this same set.

| Tool | Actions |
| ---- | ------- |
| `repos_action` | `list`, `detect`, `deps`, `adjust`, `add`, `remove`, `analyze` |
| `gates_action` | `list`, `show`, `generate`, `validate`, `start`, `complete`, `regenerate`, `cancel`, `defer` |
| `reg_action` | `list`, `show`, `deps`, `transfer`, `search`, `inherit`, `trace`, `update`, `db_sync`, `db_status`, `purge_orphans`, `reset_gate`, `regenerate` |
| `proposal_action` | `list`, `show`, `scaffold`, `generate`, `validate`, `approve`, `reject`, `start`, `progress`, `cancel`, `defer`, `delete`, `db_status`, `db_sync`, `purge_orphans`, `regenerate` |
| `config_get` | None |
| `artifact_validate` | None |
| `diagram_action` | `catalogue`, `select`, `generate`, `show`, `render`, `list_template`, `get_template` |
| `project_action` | `init`, `status` |
| `context_action` | `gate`, `proposal`, `requirement`, `repository` |
| `git_trace` | None |
| `worktree_action` | `list`, `remove`, `prune`, `merge` |
| `project_sync` | `status`, `commit`, `propagate`, `full`, `diff` |

---

## Overview

The Model Context Protocol (MCP) tools expose Zeno's Planner functionality to AI agents via a unified **Entity Action Pattern**: each tool accepts an `action` parameter that determines the operation to perform. This document covers:

- **Input Schema**: All accepted fields, types, required vs. optional

- **Validators Executed**: Validators called in order for each action (from audit matrix #s26022201mcp-sot)

- **Preconditions**: Required entity state before action is valid

- **Output Schema**: Shape of the success response

- **Error Codes**: Enumerated error identifiers and meanings

- **Examples**: Request/response pairs demonstrating usage

---

## Parameter Conventions

### Flat Top-Level Parameters

All fields sit alongside `action` at the top level. The handler extracts everything except `action` as the payload. **Never wrap in `payload`.**

```json
{ "action": "show", "hash": "p03api" }          // ✅ correct
{ "action": "show", "payload": { "hash": "..." } } // ❌ wrong
```

### Hash Normalization

Leading `#` is **optional** on all hash/ID fields — auto-stripped at the MCP boundary.

Normalized fields: `hash`, `artifactHash`, `proposalHash`, `gateHash`, `targetHash`, `gateId`, `targetGateId`.

### Per-Tool Identifier Reference

| Tool | Field | Actions | Notes |
| ---- | ----- | ------- | ----- |
| `gates_action` | `gateId` | show, start, complete, validate, generate, regenerate, cancel, defer | `"gate-01"` format or gate hash |
| `proposal_action` | `hash` | show, start, validate, approve, reject, progress, cancel, defer, delete | Proposal hash |
| `proposal_action` | `gateId` | list, scaffold/generate | Filter or assignment |
| `reg_action` | `hash` | show, deps, transfer, inherit, trace, update | Requirement hash |
| `reg_action` | `gateId` | list, search, inherit, reset_gate | Filter or target |
| `reg_action` | `targetGateId` | transfer | Destination gate |
| `context_action` | `hash` | gate, proposal, requirement, repository | Universal resolver |
| `context_action` | `gateId` | gate | Alternative to `hash` for gates |
| `context_action` | `name` | repository | Alternative to `hash` for repos |
| `worktree_action` | `hash` | remove, merge | Proposal hash |
| `diagram_action` | `diagramType` | show | Enum, not a hash |
| `diagram_action` | `name` | get_template | Template name, not a hash |

---

## gates_action – Gate Lifecycle Management

**Tool Name:** `gates_action`
**Purpose:** Manage project gates—the concrete milestones that represent actual deliverables.

### Supported Actions

#### gates_action: list

**Description:** List all gates with optional status filtering, pagination.

**Input Schema:**

```json
{
  "action": "list",
  "status": "pending|in_progress|completed|archived|cancelled|backlog",
  "skip": 0,
  "take": 50
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"list"` |
| `status` | enum | no | Filter by status (pending, in_progress, completed, archived, cancelled, backlog) |
| `skip` | number | no | Pagination offset; default 0 |
| `take` | number | no | Page size (1-100); default 50 |

**Validators Executed (in order):**

1. `validateGatesActionInput` — schema validation

2. (No other validators for list action)

**Preconditions:** None

**Output Schema:**

```json
{
  "action": "list",
  "result": {
    "gates": [
      {
        "id": "gate-01",
        "sequence": 1,
        "name": "Core Infrastructure",
        "status": "completed",
        "type": "feature",
        "createdAt": "2026-01-25T00:00:00.000Z",
        "objectivesSummary": "Establishes TypeScript project, CLI framework, SQLite schema, core utilities",
        "requirementsCount": 12,
        "proposalsCount": 3,
        "completedProposalsCount": 3
      }
    ],
    "total": 1,
    "skip": 0,
    "take": 50
  },
  "validation": {
    "allowed": true
  }
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — One or more fields failed schema validation

- `UNKNOWN_ACTION` (400) — Action is not a recognized gate action

**Example Request:**

```json
{
  "action": "list",
  "status": "in_progress",
  "take": 10
}

```

**Example Response:**

```json
{
  "action": "list",
  "result": {
    "gates": [
      {
        "id": "gate-05",
        "sequence": 5,
        "name": "Architecture & Diagram Generation",
        "status": "in_progress",
        "type": "feature",
        "createdAt": "2026-02-13T00:00:00.000Z",
        "objectivesSummary": "Mermaid diagram support, 8 diagram types, conditional generation",
        "requirementsCount": 18,
        "proposalsCount": 8,
        "completedProposalsCount": 5
      }
    ],
    "total": 1,
    "skip": 0,
    "take": 10
  },
  "validation": {
    "allowed": true
  }
}

```

---

#### gates_action: show

**Description:** Get detailed information about a specific gate.

**Input Schema:**

```json
{
  "action": "show",
  "gateId": "gate-01"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"show"` |
| `gateId` | string | yes | Gate ID (e.g., `"gate-01"`) |

**Validators Executed:**

1. `validateGatesActionInput` — schema validation

2. `validateGateExists` (via show handler) — gate must exist

**Preconditions:**

- Gate with the given ID exists

**Output Schema:**

```json
{
  "action": "show",
  "result": {
    "id": "gate-01",
    "sequence": 1,
    "name": "Core Infrastructure",
    "hash": "#g01coreinfra",
    "status": "completed",
    "type": "feature",
    "description": "Establishes TypeScript project, CI framework, SQLite schema, core utilities",
    "createdAt": "2026-01-25T00:00:00.000Z",
    "completedAt": "2026-01-28T00:00:00.000Z",
    "objectives": ["Set up TypeScript with strict mode", "Create CLI framework", "Implement SQLite database"],
    "requirements": [{"hash": "#r01core", "title": "...", "status": "tested", "priority": "must"}],
    "proposals": [{"hash": "#p01ts", "title": "TypeScript Setup", "status": "completed"}],
    "qualityMetrics": {"coverage": 91.5, "securityVulnerabilities": 0, "lintErrorRate": 0.005},
    "filesCreated": ["src/cli/index.ts", "src/storage/database.ts"],
    "dependencies": []
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Gate with the given ID does not exist

- `UNKNOWN_ACTION` (400) — Action is not recognized

**Example Request:**

```json
{
  "action": "show",
  "gateId": "gate-01"
}

```

---

#### gates_action: generate (explicit-fields path)

> **Note:** Gate creation uses `action: "generate"` with explicit fields (`name` + `objectives`) to create a gate directly without AI decomposition. The handler detects explicit fields and routes to the creation path automatically.

**Description:** Create a new gate directly with objectives, requirements, and dependencies.

**Input Schema:**

```json
{
  "action": "generate",
  "gateId": "gate-03",
  "name": "API Layer",
  "type": "feature",
  "sequence": 3,
  "objectives": ["Implement REST API", "Add authentication"],
  "dependencies": ["gate-02"],
  "description": "Build the API layer with all required endpoints"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"create"` |
| `gateId` | string | yes | Gate ID (e.g., `"gate-03"`) |
| `name` | string | yes | Human-readable gate name |
| `type` | enum | yes | Gate type (feature, quality, rescope) |
| `sequence` | number | yes | Gate sequence number |
| `objectives` | array[string] | yes | Goals the gate must achieve |
| `dependencies` | array[string] | no | Gate IDs that must complete first |
| `description` | string | no | Optional gate description |

**Validators Executed:**

1. `validateGatesActionInput` — schema validation

2. `validateDependencies` — upstream gate dependencies exist and form valid DAG

**Preconditions:**

- Gate ID is unique

- All dependencies reference existing gates

- No circular dependencies

**Output Schema:**

```json
{
  "action": "create",
  "result": {
    "gateId": "gate-03",
    "name": "API Layer",
    "sequence": 3,
    "status": "pending",
    "created": true,
    "message": "Gate gate-03 created successfully"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `DUPLICATE_ID` (409) — Gate ID already exists

- `INVALID_DEPENDENCY` (400) — Referenced dependency gate not found

- `CIRCULAR_DEPENDENCY` (400) — Dependencies form a cycle

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### gates_action: generate

**Description:** Create or generate gates. Supports two paths:

1. **Explicit-fields path** — Supply `name` + `objectives` to create a gate directly (no AI decomposition). See [gates_action: generate (explicit-fields path)](#gates_action-generate-explicit-fields-path).
2. **AI decomposition path** — Omit `name`/`objectives` and supply `preReview` (with `phase="generate"`) to auto-generate gates from PRD + requirements.

**Input Schema (AI decomposition path):**

```json
{
  "action": "generate",
  "preReview": {
    "phase": "generate",
    "openQuestionsResolved": true,
    "questionsFound": [],
    "gateReviewed": true,
    "requirementsVerified": true,
    "vagueRequirements": [],
    "assumptionsDocumented": [],
    "blockersIdentified": []
  }
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"generate"` |
| `preReview` | object | yes (AI path) | Pre-work review evidence with `phase="generate"`. Required when `name`/`objectives` are not provided. |
| `mode` | enum | no | Generation mode (new, rebaseline, single); default "new" |
| `anchorGateId` | string | no | Gate to anchor generation from |
| `templateName` | string | no | Template name; default "gate-prd-template" |
| `requirementsPerGate` | number | no | Max requirements per gate; default 5 |
| `phases` | array | no | Delivery phase labels `(number \| string)[]`, e.g. `[1, "MVP"]` |

**Validators Executed:**

1. `validateGatesActionInput` — schema validation

2. `validateDependencies` — generated gates respect requirement dependencies

**Preconditions:**

- If anchor gate specified, it must exist

- Requirements database must have content

**Output Schema:**

```json
{
  "action": "generate",
  "result": {
    "generatedCount": 3,
    "gates": [
      {"gateId": "gate-03", "name": "...", "sequence": 3},
      {"gateId": "gate-04", "name": "...", "sequence": 4}
    ],
    "message": "3 gates generated from requirements"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Anchor gate or template not found

- `GENERATION_FAILED` (500) — Internal error during generation

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### gates_action: start

**Description:** Transition a gate from `pending` to `in_progress`. Generates gate-specific requirements and proposals.

**Input Schema:**

```json
{
  "action": "start",
  "gateId": "gate-03",
  "notes": "Optional starting notes"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"start"` |
| `gateId` | string | yes | Gate ID to start |
| `notes` | string | no | Optional notes documenting the start |

**Validators Executed:**

1. `validateGatesActionInput` — schema validation

2. `createStateTransitionValidator` — gate must be `pending`, can transition to `in_progress` (idempotent: already `in_progress` returns success)

3. `validateDependencies` — all upstream dependencies must be `completed`

**Preconditions:**

- Gate exists and has status `pending` (or is already `in_progress` for idempotency)

- All gates listed in `dependencies` must have status `completed`

**Output Schema:**

```json
{
  "action": "start",
  "result": {
    "gateId": "gate-03",
    "previousStatus": "pending",
    "newStatus": "in_progress",
    "timestamp": "2026-02-22T12:00:00.000Z",
    "generatedRequirements": [
      {"hash": "#g03req1", "title": "API Layer", "type": "functional", "priority": "must"},
      {"hash": "#g03req2", "title": "Database Schema", "type": "functional", "priority": "must"}
    ],
    "generatedProposals": [
      {"hash": "#p03api", "title": "API Implementation", "status": "pending"}
    ],
    "message": "Gate gate-03 transitioned to in_progress. 2 requirements generated, 1 proposal template created."
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Gate does not exist

- `INVALID_STATE_TRANSITION` (409) — Gate is not `pending` and not idempotent re-invocation
  - Example message: `"gate gate-03 is 'completed'; valid transitions from this state: none. Cannot start."`

- `DEPENDENCY_NOT_MET` (409) — One or more upstream dependencies not completed
  - Example message: `"Gate gate-02 is required before gate-03 can start; currently 'in_progress'"`

- `UNKNOWN_ACTION` (400) — Action not recognized

**Example Request:**

```json
{
  "action": "start",
  "gateId": "gate-03",
  "notes": "Approved by team lead on 2026-02-22"
}

```

**Example Response (Success - First Time):**

```json
{
  "action": "start",
  "result": {
    "gateId": "gate-03",
    "previousStatus": "pending",
    "newStatus": "in_progress",
    "timestamp": "2026-02-22T12:00:00.000Z",
    "generatedRequirements": [{"hash": "#g03req1", "title": "API Layer", "type": "functional", "priority": "must"}],
    "generatedProposals": [{"hash": "#p03api", "title": "API Implementation", "status": "pending"}],
    "message": "Gate gate-03 transitioned to in_progress. 1 requirement generated, 1 proposal template created."
  }
}

```

**Example Response (Idempotent - Already In Progress):**

```json
{
  "action": "start",
  "result": {
    "gateId": "gate-03",
    "previousStatus": "in_progress",
    "newStatus": "in_progress",
    "timestamp": "2026-02-22T12:00:00.000Z",
    "generatedRequirements": [],
    "generatedProposals": [],
    "message": "Gate gate-03 is already in_progress. No changes made."
  }
}

```

---

#### gates_action: complete

**Description:** Finish a gate and transition to `completed`. Archives all proposals, creates git tag, updates requirement statuses.

**Input Schema:**

```json
{
  "action": "complete",
  "gateId": "gate-01",
  "completionNotes": "All proposals approved and merged",
  "approvalDate": "2026-01-28T00:00:00.000Z"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"complete"` |
| `gateId` | string | yes | Gate ID to complete |
| `completionNotes` | string | no | Summary of completion |
| `approvalDate` | string (ISO) | no | Timestamp of human approval |

**Validators Executed:**

1. `validateGatesActionInput` — schema validation

2. `createStateTransitionValidator` — gate must be `in_progress`; can transition to `completed`

3. `validateQuality` — all requirements must have status `tested` or `implemented`

**Preconditions:**

- Gate exists and has status `in_progress`

- All requirements are marked `tested` or `implemented`

- All proposals are `completed`

**Output Schema:**

```json
{
  "action": "complete",
  "result": {
    "gateId": "gate-01",
    "previousStatus": "in_progress",
    "newStatus": "completed",
    "timestamp": "2026-01-28T12:00:00.000Z",
    "archivedProposals": [{"hash": "#p01ts", "title": "TypeScript Setup"}],
    "gitTag": "gate-01-core-infrastructure",
    "commit": "abc123def456...",
    "message": "Gate gate-01 completed. 3 proposals archived, tag created."
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Gate does not exist

- `INVALID_STATE_TRANSITION` (409) — Gate is not `in_progress`

- `QUALITY_CHECK_FAILED` (409) — Requirements not all tested; metrics below threshold

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### gates_action: regenerate

**Description:** Regenerate the gate roadmap after rescope or mid-project changes.

**Input Schema:**

```json
{
  "action": "regenerate",
  "fromGateId": "gate-02",
  "mode": "full"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"regenerate"` |
| `fromGateId` | string | no | Regenerate from this gate forward; if omitted, regenerate all |
| `mode` | enum | no | Regeneration mode (full, partial, check); default "full" |

**Validators Executed:**

1. `validateGatesActionInput` — schema validation

2. `validateDependencies` — regenerated gates form valid DAG

**Preconditions:**

- If fromGateId specified, gate must exist

**Output Schema:**

```json
{
  "action": "regenerate",
  "result": {
    "regeneratedCount": 3,
    "gates": [
      {"gateId": "gate-03", "name": "...", "status": "pending"}
    ],
    "message": "3 gates regenerated from current position onward"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — fromGateId not found

- `REGENERATION_FAILED` (500) — Internal error during regeneration

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### gates_action: cancel

**Description:** Mark a gate as cancelled/dropped (not to be implemented).

**Input Schema:**

```json
{
  "action": "cancel",
  "gateId": "gate-03",
  "notes": "Feature deprioritized in favor of core functionality"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"cancel"` |
| `gateId` | string | yes | Gate ID to cancel |
| `notes` | string | no | Reason for cancellation |

**Validators Executed:**

1. `validateGatesActionInput` — schema validation

2. `createStateTransitionValidator` — gate must allow transition to `cancelled`

**Preconditions:**

- Gate exists

- Gate is not in a terminal state (completed)

- No active proposals depend on this gate

**Output Schema:**

```json
{
  "action": "cancel",
  "result": {
    "gateId": "gate-03",
    "previousStatus": "pending",
    "newStatus": "cancelled",
    "cancelReason": "Feature deprioritized in favor of core functionality",
    "message": "Gate gate-03 cancelled. Future gates regenerated if needed."
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Gate not found

- `INVALID_STATE_TRANSITION` (409) — Gate cannot be cancelled from current state

- `DEPENDENT_WORK` (409) — Active proposals depend on this gate

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### gates_action: defer

**Description:** Move a gate to backlog for later implementation.

**Input Schema:**

```json
{
  "action": "defer",
  "gateId": "gate-03",
  "notes": "Defer to phase 2 pending budget approval"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"defer"` |
| `gateId` | string | yes | Gate ID to defer |
| `notes` | string | no | Reason for deferral |

**Validators Executed:**

1. `validateGatesActionInput` — schema validation

2. `createStateTransitionValidator` — gate must allow transition to `backlog`

**Preconditions:**

- Gate exists

- Gate is in `pending` status

**Output Schema:**

```json
{
  "action": "defer",
  "result": {
    "gateId": "gate-03",
    "previousStatus": "pending",
    "newStatus": "backlog",
    "deferReason": "Defer to phase 2 pending budget approval",
    "message": "Gate gate-03 moved to backlog. Can be resumed later."
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Gate not found

- `INVALID_STATE_TRANSITION` (409) — Gate cannot be deferred from current state

- `UNKNOWN_ACTION` (400) — Action not recognized

---

## proposal_action – Proposal Lifecycle Management

**Tool Name:** `proposal_action`
**Purpose:** Manage implementation proposals—detailed plans for satisfying gate requirements.

#### proposal_action: list

**Description:** List proposals, optionally filter by gate or status.

**Input Schema:**

```json
{
  "action": "list",
  "gateId": "gate-03",
  "status": "pending",
  "skip": 0,
  "take": 50
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"list"` |
| `gateId` | string | no | Filter by gate ID |
| `status` | enum | no | Filter by status (pending, in_progress, completed, rejected, archived) |
| `skip` | number | no | Pagination offset; default 0 |
| `take` | number | no | Page size (1-100); default 50 |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

**Preconditions:** None

**Output Schema:**

```json
{
  "action": "list",
  "result": {
    "proposals": [
      {
        "hash": "#p03api",
        "title": "API Implementation",
        "gateId": "gate-03",
        "status": "pending",
        "createdAt": "2026-02-13T00:00:00.000Z",
        "acceptanceCriteria": ["All endpoints tested", "Swagger docs complete"],
        "requirements": ["#g03req1", "#g03req2"]
      }
    ],
    "total": 1,
    "skip": 0,
    "take": 50
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### proposal_action: show

**Description:** Get detailed information about a specific proposal.

**Input Schema:**

```json
{
  "action": "show",
  "hash": "#p03api"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"show"` |
| `hash` | string | yes | Proposal hash (e.g., `"#p03api"`) |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

2. `validateProposalExists` — proposal must exist

**Preconditions:**

- Proposal with the given hash exists

**Output Schema:** Full proposal document with all tasks and acceptance criteria

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Proposal hash not found

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### proposal_action: start

**Description:** Create an isolated worktree for proposal implementation.

**Input Schema:**

```json
{
  "action": "start",
  "hash": "#p03api"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"start"` |
| `hash` | string | yes | Proposal hash |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

2. `createStateTransitionValidator` — proposal must be `pending`; can transition to `in_progress`

3. `validateApplyPhase` (Rule 1: no git operations) — detects git cli in PATH

4. `validateScope` — files in `Files Affected` are explicit (no wildcards/dirs)

5. `validateTestFirstPattern` — if proposal is for a gate implementation, no test files modified

**Preconditions:**

- Proposal exists and has status `pending`

- No git CLI operations detected during proposal start

- All files in `Files Affected` are explicit paths

**Output Schema:**

```json
{
  "action": "start",
  "result": {
    "hash": "#p03api",
    "previousStatus": "pending",
    "newStatus": "in_progress",
    "worktreeLocation": ".local/worktrees/p03api/",
    "branch": "proposal-p03api",
    "message": "Proposal #p03api started. Branch proposal-p03api created. Work in .local/worktrees/p03api/"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Proposal hash not found

- `INVALID_STATE_TRANSITION` (409) — Proposal is not `pending`

- `GIT_OPERATIONS_NOT_ALLOWED` (409) — Git CLI operations detected (Rule 1)

- `INVALID_FILE_SCOPE` (400) — Files include wildcards or directory paths (Rule 2)

- `TEST_PATTERN_VIOLATION` (400) — Implementation proposal modified test files (Rule 3)

- `UNKNOWN_ACTION` (400) — Action not recognized

**Example Request:**

```json
{
  "action": "start",
  "hash": "#p03api"
}

```

**Example Response:**

```json
{
  "action": "start",
  "result": {
    "hash": "#p03api",
    "previousStatus": "pending",
    "newStatus": "in_progress",
    "worktreeLocation": ".local/worktrees/p03api/",
    "branch": "proposal-p03api",
    "message": "Proposal #p03api started. Branch proposal-p03api created at .local/worktrees/p03api/"
  },
  "validation": {"allowed": true}
}

```

---

#### proposal_action: validate

**Description:** Run automated quality checks on a proposal (coverage, linting, security, tests).

**Input Schema:**

```json
{
  "action": "validate",
  "hash": "#p03api"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"validate"` |
| `hash` | string | yes | Proposal hash |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

2. `validateProposalExists` — proposal must exist

3. `validateQuality` — runs all quality checks

4. `validateDependencies` — checks proposal dependency graph

**Preconditions:**

- Proposal exists

- Proposal is in `in_progress` or `completed` status

- Proposal has all required sections (Summary, Tasks, Files Affected)

**Output Schema:**

```json
{
  "action": "validate",
  "result": {
    "hash": "#p03api",
    "passed": true,
    "checks": {
      "coverage": {"value": 93.2, "threshold": 90, "passed": true},
      "lintErrors": {"value": 0.002, "threshold": 0.01, "passed": true},
      "securityVulnerabilities": {"count": 0, "threshold": 0, "passed": true},
      "testsPassing": {"passed": 102, "failed": 0, "passed": true},
      "typescriptStrict": {"errors": 0, "passed": true}
    },
    "message": "All quality checks passed. Proposal ready for approval."
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Proposal hash not found

- `FORMAT_INVALID` (400) — Proposal missing required sections

- `QUALITY_FAILED` (409) — One or more quality checks failed

- `TEST_FAILURES` (409) — Tests not passing

- `SECURITY_VULNERABILITIES` (409) — Known CVEs detected

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### proposal_action: approve

**Description:** Merge proposal worktree and finalize implementation.

**Input Schema:**

```json
{
  "action": "approve",
  "hash": "#p03api"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"approve"` |
| `hash` | string | yes | Proposal hash |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

2. `createStateTransitionValidator` — proposal must be `in_progress`; can transition to `completed`

3. `validateQuality` — quality checks must pass

4. `validateApplyPhase` (Rule 1) — no git operations

**Preconditions:**

- Proposal exists and has status `in_progress`

- All quality checks have passed (from previous validate call)

- Worktree exists and is not dirty

**Output Schema:**

```json
{
  "action": "approve",
  "result": {
    "hash": "#p03api",
    "previousStatus": "in_progress",
    "newStatus": "completed",
    "merged": true,
    "commit": "abc123def456...",
    "branch": "proposal-p03api",
    "message": "Proposal #p03api approved and merged to main. Worktree cleaned up."
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Proposal hash not found

- `INVALID_STATE_TRANSITION` (409) — Proposal is not `in_progress`

- `QUALITY_NOT_VALIDATED` (409) — Quality checks not run; must call validate first

- `MERGE_CONFLICT` (409) — Worktree branch has conflicts

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### proposal_action: reject

**Description:** Decline proposal and mark for rework. Preserves proposal for future retry.

**Input Schema:**

```json
{
  "action": "reject",
  "hash": "#p03api",
  "reason": "API design doesn't meet requirements"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"reject"` |
| `hash` | string | yes | Proposal hash |
| `reason` | string | no | Human feedback on why rejected |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

2. `createStateTransitionValidator` — proposal must be `in_progress`; can transition to `rejected`

**Preconditions:**

- Proposal exists and has status `in_progress`

**Output Schema:**

```json
{
  "action": "reject",
  "result": {
    "hash": "#p03api",
    "previousStatus": "in_progress",
    "newStatus": "rejected",
    "feedback": "API design doesn't meet requirements",
    "message": "Proposal #p03api rejected. Preserved for rework. Provide feedback for next iteration."
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Proposal hash not found

- `INVALID_STATE_TRANSITION` (409) — Proposal is not `in_progress`

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### proposal_action: create (via generate)

> **Note:** `create` is not a standalone action value. Use `action: "generate"` with explicit fields (`title` + `tasks`) to create a proposal directly. For solitary proposals, add `solitary: true`.

**Description:** Create a new proposal for a gate from requirements.

**Input Schema:**

```json
{
  "action": "create",
  "gateId": "gate-03",
  "title": "API Implementation",
  "summary": "Implement REST API with all required endpoints",
  "tasks": [
    {"description": "Create endpoints", "acceptanceCriteria": ["Tests pass"]},
    {"description": "Add documentation", "acceptanceCriteria": ["Swagger docs complete"]}
  ],
  "filesAffected": ["src/api/routes.ts", "src/api/handlers.ts"]
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"create"` |
| `gateId` | string | yes | Gate ID this proposal serves |
| `title` | string | yes | Proposal title |
| `summary` | string | yes | Brief description of implementation approach |
| `tasks` | array | yes | Array of tasks with acceptance criteria |
| `filesAffected` | array[string] | yes | Explicit file paths to be modified/created |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

2. `validateGateExists` — gate must exist

3. `validateScope` — files must be explicit paths

4. `validateArtifactFile` — proposal must have required sections

**Preconditions:**

- Gate exists

- All files in Files Affected are explicit paths (no wildcards or directories)

**Output Schema:**

```json
{
  "action": "create",
  "result": {
    "hash": "#p03api",
    "title": "API Implementation",
    "gateId": "gate-03",
    "status": "pending",
    "message": "Proposal #p03api created from gate requirements"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Gate not found

- `INVALID_FILE_SCOPE` (400) — Files include wildcards or directory paths

- `FORMAT_INVALID` (400) — Proposal missing required sections

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### proposal_action: generate

**Description:** Create or generate proposals. Supports three paths:

1. **Explicit-fields path** — Supply `title` + `tasks` to create a proposal directly. Optionally include `gateId` for gate-tied or `solitary: true` for standalone. See [proposal_action: create (via generate)](#proposal_action-create-via-generate).
2. **Gate-tied AI path** — Supply `gateId` + `preReview` (with `phase="generate"`) to auto-decompose the gate PRD into proposals.
3. **Solitary path** — Supply `solitary: true` (no `gateId`) to create a standalone proposal not tied to any gate.

**Input Schema (gate-tied AI path):**

```json
{
  "action": "generate",
  "gateId": "gate-03",
  "preReview": {
    "phase": "generate",
    "openQuestionsResolved": true,
    "questionsFound": [],
    "gateReviewed": true,
    "requirementsVerified": true,
    "vagueRequirements": [],
    "assumptionsDocumented": [],
    "blockersIdentified": []
  }
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"generate"` |
| `gateId` | string | conditional | Gate ID for gate-tied proposals (required for AI decomposition path) |
| `solitary` | boolean | conditional | Set `true` for standalone proposals not tied to a gate |
| `preReview` | object | yes (AI path) | Pre-work review evidence with `phase="generate"`. Required for AI decomposition path. |
| `title` | string | conditional | Proposal title (required for explicit-fields path) |
| `tasks` | array | conditional | Implementation tasks (required for explicit-fields path) |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

2. `validateGateExists` — gate must exist

**Preconditions:**

- Gate exists

**Output Schema:**

```json
{
  "action": "generate",
  "result": {
    "hash": "#p03api",
    "title": "Gate 03 Implementation Proposal",
    "gateId": "gate-03",
    "status": "pending",
    "generatedTasks": 5,
    "message": "Proposal generated from gate requirements"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Gate not found

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### proposal_action: progress

**Description:** Update proposal task progress during implementation.

**Input Schema:**

```json
{
  "action": "progress",
  "hash": "#p03api",
  "taskIndex": 0,
  "status": "in_progress",
  "notes": "Started implementation of endpoints"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"progress"` |
| `hash` | string | yes | Proposal hash |
| `taskIndex` | number | yes | Index of the task to update |
| `status` | enum | yes | Task status (pending, in_progress, completed, blocked) |
| `notes` | string | no | Optional progress notes |

**Validators Executed:**

1. `validateProposalActionInput` — schema validation

2. `validateProposalExists` — proposal must exist

**Preconditions:**

- Proposal exists and is in `in_progress` status

- Task index is valid

**Output Schema:**

```json
{
  "action": "progress",
  "result": {
    "hash": "#p03api",
    "taskIndex": 0,
    "previousStatus": "pending",
    "newStatus": "in_progress",
    "message": "Task 1 progress updated to in_progress"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Proposal hash not found or task index invalid

- `INVALID_STATE` (409) — Proposal is not `in_progress`

- `UNKNOWN_ACTION` (400) — Action not recognized

---

## reg_action – Requirements Database Query

**Tool Name:** `reg_action`
**Purpose:** Query and manage the requirements database (single source of truth for what must be built).

#### reg_action: list

**Description:** Retrieve all requirements, optionally filtered by gate, type, or priority.

**Input Schema:**

```json
{
  "action": "list",
  "gateId": "gate-03",
  "type": "functional",
  "priority": "must",
  "skip": 0,
  "take": 50
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"list"` |
| `gateId` | string | no | Filter by gate ID |
| `type` | enum | no | Filter by type (functional, non_functional, constraint) |
| `priority` | enum | no | Filter by priority (must, should, could, won't) |
| `skip` | number | no | Pagination offset; default 0 |
| `take` | number | no | Page size (1-100); default 50 |

**Validators Executed:**

1. `validateReqActionInput` — schema validation

**Preconditions:** None

**Output Schema:**

```json
{
  "action": "list",
  "result": {
    "requirements": [
      {
        "hash": "#g03req1",
        "title": "API Layer Implementation",
        "type": "functional",
        "priority": "must",
        "status": "pending",
        "acceptanceCriteria": ["All endpoints return 200", "Error handling implemented"],
        "relatedGates": ["gate-03"],
        "dependencies": ["#g03req2"]
      }
    ],
    "total": 1,
    "skip": 0,
    "take": 50
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### reg_action: show

**Description:** Get detailed requirement information by hash.

**Input Schema:**

```json
{
  "action": "show",
  "hash": "#g03req1"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"show"` |
| `hash` | string | yes | Requirement hash |

**Validators Executed:**

1. `validateReqActionInput` — schema validation

2. `validateRequirementExists` — requirement must exist

**Preconditions:**

- Requirement with the given hash exists

**Output Schema:** Full requirement document with all fields and metadata

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Requirement hash not found

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### reg_action: deps

**Description:** View requirement dependency graph.

**Input Schema:**

```json
{
  "action": "deps",
  "hash": "#g03req1"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"deps"` |
| `hash` | string | yes | Requirement hash |

**Validators Executed:**

1. `validateReqActionInput` — schema validation

2. `validateDependencies` — analyze dependency graph

**Preconditions:**

- Requirement exists

**Output Schema:**

```json
{
  "action": "deps",
  "result": {
    "hash": "#g03req1",
    "title": "API Layer Implementation",
    "requires": [["#g03req2", "Database Schema"]],
    "blockedBy": [],
    "relatesTo": [["#g03req3", "Error Handling"]],
    "dependencyChain": [
      {"hash": "#g03req2", "title": "Database Schema", "status": "pending"},
      {"hash": "#g03req3", "title": "Error Handling", "status": "pending"}
    ]
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Requirement hash not found

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### reg_action: transfer

**Description:** Move a requirement from one gate to another.

**Input Schema:**

```json
{
  "action": "transfer",
  "hash": "#g03req1",
  "targetGateId": "gate-04",
  "reason": "Scope moved to next gate"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"transfer"` |
| `hash` | string | yes | Requirement hash to transfer |
| `targetGateId` | string | yes | Target gate ID |
| `reason` | string | no | Reason for transfer |

**Validators Executed:**

1. `validateReqActionInput` — schema validation

2. `validateRequirementExists` — requirement must exist

3. `validateGateExists` — target gate must exist

4. `validateDependencies` — check if transfer violates dependency constraints

**Preconditions:**

- Requirement exists

- Target gate exists

- Transfer doesn't create circular dependencies or violate constraints

**Output Schema:**

```json
{
  "action": "transfer",
  "result": {
    "hash": "#g03req1",
    "title": "API Layer Implementation",
    "previousGateId": "gate-03",
    "newGateId": "gate-04",
    "message": "Requirement transferred from gate-03 to gate-04"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Requirement or target gate not found

- `INVALID_TRANSFER` (409) — Transfer violates dependency constraints or creates cycles

- `UNKNOWN_ACTION` (400) — Action not recognized

---

### Additional reg_action Actions

The following actions are also available but less commonly used during normal workflows:

| Action | Required Fields | Description |
| ------ | --------------- | ----------- |
| `search` | `query` | Full-text search across requirements; optional: `gateId`, `type` |
| `inherit` | `hash`, `gateId` | Link existing requirement to a gate for cross-gate reuse |
| `trace` | `hash` | Full traceability chain — ancestors, children, all referencing gates |
| `update` | `hash` | Edit mutable fields on a requirement; optional: `title`, `type`, `priority`, `acceptance` |
| `db_sync` | — | Reconcile proposals DB with disk (upsert new files, remove orphans) |
| `db_status` | — | Report proposal DB health (orphan count, status breakdown) |
| `purge_orphans` | — | Delete DB rows with no matching .md file; optional: `gateId`, `solitary`, `dryRun` |
| `reset_gate` | `gateId` | Wipe and re-sync proposals for one gate from disk |
| `regenerate` | — | Delete and re-initialise `registry.db` from disk |

---

## repos_action – Repository Analysis & Management

**Tool Name:** `repos_action`
**Purpose:** Manage repository boundaries and analyze multi-repo project structure.

### repos_action: list

**Description:** List detected repository boundaries and structure.

**Input Schema:**

```json
{
  "action": "list"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"list"` |

**Validators Executed:**

1. `validateRepositoryActionInput` — schema validation

**Preconditions:** None

**Output Schema:**

```json
{
  "action": "list",
  "result": {
    "repositories": [
      {
        "name": "core-engine",
        "path": "src/",
        "languages": ["TypeScript"],
        "loc": 15000,
        "confidence": 0.95,
        "couplingMetrics": {
          "afferent": 3,
          "efferent": 2
        }
      }
    ],
    "total": 1
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### repos_action: detect

**Description:** Re-run repository boundary detection.

**Input Schema:**

```json
{
  "action": "detect"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"detect"` |

**Validators Executed:**

1. `validateRepositoryActionInput` — schema validation

**Preconditions:** None

**Output Schema:**

```json
{
  "action": "detect",
  "result": {
    "message": "Boundary detection complete",
    "repositoriesFound": 1,
    "updated": true
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### repos_action: deps

**Description:** Show dependency graph between repositories.

**Input Schema:**

```json
{
  "action": "deps"
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"deps"` |

**Validators Executed:**

1. `validateRepositoryActionInput` — schema validation

2. `validateDependencies` — analyze repo dependency graph

**Preconditions:** None

**Output Schema:**

```json
{
  "action": "deps",
  "result": {
    "repositories": [
      {
        "name": "core-engine",
        "dependsOn": ["utils-lib"],
        "requiredBy": ["cli-tool"]
      }
    ]
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### repos_action: adjust

**Description:** Manually adjust repository boundaries.

**Input Schema:**

```json
{
  "action": "adjust",
  "repositoryName": "core-engine",
  "path": "src/",
  "confidence": 0.95
}

```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | enum | yes | Must be `"adjust"` |
| `repositoryName` | string | yes | Repository name to adjust |
| `path` | string | yes | New path boundary |
| `confidence` | number | no | Confidence score for the boundary (0.0-1.0) |

**Validators Executed:**

1. `validateRepositoryActionInput` — schema validation

**Preconditions:**

- Repository exists

**Output Schema:**

```json
{
  "action": "adjust",
  "result": {
    "name": "core-engine",
    "path": "src/",
    "confidence": 0.95,
    "message": "Repository boundary adjusted successfully"
  },
  "validation": {"allowed": true}
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

- `NOT_FOUND` (404) — Repository does not exist

- `UNKNOWN_ACTION` (400) — Action not recognized

---

## config_get – Access Project Configuration

**Tool Name:** `config_get`
**Purpose:** Retrieve project-level settings and quality thresholds.

### config_get: get

**Description:** Retrieve project configuration and quality metrics.

**Input Schema:** Empty object

```json
{}

```

**Validators Executed:**

1. `validateConfigInput` — basic schema validation (no required fields)

**Preconditions:** None

**Output Schema:**

```json
{
  "project": {
    "name": "Zeno's Planner",
    "version": "0.2.0",
    "description": "Lightweight, LLM-friendly project planning tool"
  },
  "qualityThresholds": {
    "coverage": 0.9,
    "lintErrorRate": 0.00001,
    "vulnerabilities": 0,
    "typeScriptStrict": true
  },
  "git": {
    "commitFormat": "feat(scope): message",
    "defaultBranch": "main"
  },
  "paths": {
    "gatesDir": "zeno/gates",
    "proposalsDir": "zeno/proposals",
    "archiveDir": "zeno/gates/archive"
  }
}

```

**Error Codes:**

- `INVALID_INPUT` (400) — Schema validation failed

**Example Request:**

```json
{}

```

**Example Response:**

```json
{
  "project": {
    "name": "Zeno's Planner",
    "version": "0.2.0"
  },
  "qualityThresholds": {
    "coverage": 0.9,
    "lintErrorRate": 0.00001,
    "vulnerabilities": 0
  }
}

```

---

## context_action – Working Context Retrieval

**Tool Name:** `context_action`
**Purpose:** Provide compact working context for gates and proposals by querying the registry database. Replaces loading full PRD or architecture documents during execution.

### Query Operations

#### context_action: gate

**Description:** Returns gate objectives, linked proposals, and requirements in a single call.

**Input:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | `"gate"` | Yes | Action discriminator |
| `gateId` | `string` | Yes | Gate ID (e.g. `"gate-01"`) |

**Output:**

```json
{
  "gate": {
    "id": "gate-01",
    "name": "Core Infrastructure",
    "status": "in_progress",
    "description": "Set up core project infrastructure",
    "sequence": 1,
    "dependsOn": []
  },
  "proposals": [
    { "id": "prop-1", "title": "Database Setup", "status": "pending", "hash": "abc123..." }
  ],
  "requirements": [
    { "id": "req-1", "description": "Initialize project database", "type": "functional", "priority": "must", "hash": "def456..." }
  ]
}

```

#### context_action: proposal

**Description:** Returns proposal details, parent gate, requirements, and dependencies.

**Input:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | `"proposal"` | Yes | Action discriminator |
| `hash` | `string` | Yes | Proposal hash |

**Output:**

```json
{
  "proposal": {
    "id": "prop-1",
    "title": "Database Setup",
    "status": "in_progress",
    "hash": "abc123...",
    "gateId": "gate-01",
    "createdAt": "2026-01-15T10:00:00Z",
    "startedAt": "2026-01-16T09:00:00Z"
  },
  "gate": {
    "id": "gate-01",
    "name": "Core Infrastructure",
    "status": "in_progress"
  },
  "requirements": [
    { "id": "req-1", "description": "Initialize project database", "type": "functional", "priority": "must", "hash": "def456..." }
  ],
  "dependencies": [
    { "targetHash": "xyz789...", "type": "requires", "description": "Needs config module" }
  ]
}

```

---

## project_action – Project Initialization & Status

**Tool Name:** `project_action`
**Purpose:** Initialize new projects and check project status.

### Available Operations

#### project_action: init

**Description:** Initialize a new Zeno project.

**Input:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | `"init"` | Yes | Action discriminator |
| `projectName` | `string` | Yes | Project name (1-100 chars) |
| `projectStatement` | `string` | Yes | Project statement describing what is being built |

#### project_action: status

**Description:** Get current project status, active gates, and MCP server health.

**Input:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | `"status"` | Yes | Action discriminator |

---

## Error Code Taxonomy

| Code | HTTP | Meaning | When Returned |
| ---- | ---- | ------- | ------------- |
| `INVALID_INPUT` | 400 | One or more required or optional fields failed schema validation | All actions; schema validation failed before handler logic |
| `NOT_FOUND` | 404 | Entity (gate, proposal, requirement) does not exist | show, start, approve, reject, archive actions |
| `INVALID_STATE_TRANSITION` | 409 | Entity status does not permit the requested action | start (not pending), complete (not in_progress), approve (not in_progress), reject (not in_progress) |
| `DEPENDENCY_NOT_MET` | 409 | One or more upstream dependencies are not satisfied | start (upstream gates not completed) |
| `GIT_OPERATIONS_NOT_ALLOWED` | 409 | Git CLI operations detected during proposal start (Rule 1) | proposal_action: start |
| `INVALID_FILE_SCOPE` | 400 | Files in Files Affected include wildcards or directory paths | proposal_action: start |
| `TEST_PATTERN_VIOLATION` | 400 | Implementation proposal modified test files (Rule 3) | proposal_action: start |
| `QUALITY_FAILED` | 409 | Quality checks (coverage, linting, security, tests) failed | proposal_action: validate, gates_action: complete |
| `SECURITY_VULNERABILITIES` | 409 | Known CVEs or security issues detected | proposal_action: validate |
| `TEST_FAILURES` | 409 | One or more test files failed | proposal_action: validate |
| `FORMAT_INVALID` | 400 | Proposal/gate document missing required sections | proposal_action: validate, gates_action: start |
| `MERGE_CONFLICT` | 409 | Worktree branch has unresolved conflicts | proposal_action: approve |
| `QUALITY_NOT_VALIDATED` | 409 | Quality checks not run before approval | proposal_action: approve |
| `UNKNOWN_ACTION` | 400 | Action parameter is not recognized for this tool | All action handlers |

---

## State Machines

State transitions are enforced at the MCP handler level. See [zeno/architecture/mcp-workflows.md](../zeno/architecture/mcp-workflows.md) for detailed state machine diagrams and lifecycle documentation.

**Gate States:** `pending` → `validated` → `in_progress` → `completed | rejected | cancelled` (or from `rejected` back to `in_progress`)

**Proposal States:** `pending` → `validated` → `in_progress` → `completed | rejected | archived`

See the architecture document for preconditions and postconditions on each transition.

---

## Common Use Case Examples

### Use Case: Start a Gate

**Goal:** Begin work on gate-03 after gate-02 is completed.

**Steps:**

1. Call `gates_action` with action `start` and gateId `gate-03`

2. MCP handler validates:
   - Gate exists and is currently `pending`
   - All upstream dependencies (gate-02) are `completed`
   - No git operations in progress

3. On success:
   - Gate transitions to `in_progress`
   - Gate-specific requirements are auto-generated
   - Proposal templates are created
   - Return gate details and list of generated requirements

**Example Request:**

```json
{
  "action": "start",
  "gateId": "gate-03"
}

```

### Use Case: Implement a Proposal

**Goal:** Create a worktree, implement changes, validate, and approve a proposal.

**Steps:**

1. Call `proposal_action: start` with proposal hash `#p03api`
   - Validates proposal is `pending`, creates isolated worktree at `.local/worktrees/p03api/`
   - Returns worktree location and branch name

2. Dev implements changes in the worktree

3. Call `proposal_action: validate` with hash `#p03api`
   - Runs all quality checks (coverage, linting, security, tests)
   - Returns pass/fail for each check

4. If all checks pass, call `proposal_action: approve` with hash `#p03api`
   - Merges worktree branch to main
   - Cleans up worktree and branch
   - Updates proposal status to `completed`

### Use Case: Complete a Gate

**Goal:** Finalize gate-01 after all proposals are implemented and approved.

**Steps:**

1. Ensure all proposals for gate-01 have status `completed`

2. Ensure all requirements have status `tested` or `implemented`

3. Call `gates_action: complete` with gateId `gate-01`
   - Validates all requirements are tested/implemented
   - Creates git tag `gate-01-core-infrastructure`
   - Archives all proposals to `zeno/gates/archive/gate-01.md`
   - Commits the archive

4. Gate transitions to `completed`

---

## worktree_action – Isolated Git Worktree Management

**Tool Name:** `worktree_action`
**Purpose:** Manage the isolated git worktrees that Zeno creates per proposal. Each worktree lives at `.local/worktrees/{proposal-hash}/` on a branch named `proposal/{hash}`. All parameters are flat — do **not** nest them inside a `payload` object.

> **When to use `worktree_action:merge` vs `proposal_action:approve`**
>
> `proposal_action:approve` is the normal path for completing a proposal. It updates the DB, patches the proposal markdown, and then **automatically calls the merge internally** using the default `merge` strategy.
>
> Use `worktree_action:merge` only when:
>
> - `proposal_action:approve` returns a `MERGE_CONFLICT` error and you need to resolve or retry with a different strategy.
> - You need explicit control over the merge strategy (`rebase` or `squash`).
> - You are performing manual worktree cleanup outside the normal approval flow.

### Supported Actions

#### worktree_action: list

**Description:** List active (or all) worktrees.

**Input:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"list"` | yes | — | |
| `status` | `"active"\|"orphaned"\|"all"` | no | `"active"` | Filter worktrees by lifecycle status |

**Output:**

```json
{
  "worktrees": [
    {
      "hash": "p03api",
      "path": ".local/worktrees/p03api",
      "branch": "proposal/p03api",
      "status": "active",
      "created": "2026-04-23T10:00:00.000Z",
      "lastAccessed": "2026-04-23T10:00:00.000Z",
      "commitCount": 0,
      "filesModified": 0
    }
  ],
  "summary": { "total": 1, "active": 1, "orphaned": 0, "diskUsageMB": 0 }
}
```

---

#### worktree_action: remove

**Description:** Explicitly delete a worktree by proposal hash. Use when a proposal was rejected or abandoned and you want to reclaim disk space. `force` discards any uncommitted changes.

**Input:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"remove"` | yes | — | |
| `hash` | string | yes | — | Proposal hash. Leading `#` stripped automatically. |
| `force` | boolean | no | `false` | Discard uncommitted changes and force-remove |

**Output:**

```json
{
  "success": true,
  "hash": "p03api",
  "path": ".local/worktrees/p03api",
  "message": "Worktree for proposal p03api removed."
}
```

**Preconditions:**

- Worktree exists (verified via `git worktree list`)
- If `force` is false, worktree must be clean

---

#### worktree_action: prune

**Description:** Batch-remove all orphaned worktrees — worktrees whose proposal hash no longer exists in the database. Use `dryRun: true` to preview what would be deleted.

**Input:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"prune"` | yes | — | |
| `dryRun` | boolean | no | `false` | Preview without deleting |

**Output:**

```json
{
  "success": true,
  "pruned": [
    { "hash": "old1234", "path": ".local/worktrees/old1234", "reason": "orphaned", "deletedAt": "2026-04-23T10:00:00.000Z" }
  ],
  "summary": { "prunedCount": 1, "diskFreedMB": 0, "worktreesRemaining": 2 },
  "message": "Pruned 1 worktree(s). 2 remaining."
}
```

---

#### worktree_action: merge

**Description:** Merge a proposal branch into `main` with an explicit strategy. On success the worktree is automatically removed. On conflict, the worktree is **preserved** and the conflicting files are listed so you can resolve them manually.

> **Prefer `proposal_action:approve` in the normal flow.** Use this action only for conflict recovery or when a specific merge strategy is required.

**Input:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"merge"` | yes | — | |
| `hash` | string | yes | — | Proposal hash. Leading `#` stripped automatically. |
| `strategy` | `"rebase"\|"squash"\|"merge"` | no | `"rebase"` | Git merge strategy |
| `dryRun` | boolean | no | `false` | Show what would happen without merging |
| `autoResolveConflicts` | boolean | no | `false` | Attempt auto-resolution of simple conflicts |

**Strategy behavior:**

| Strategy | Effect |
|----------|--------|
| `rebase` | Rebases `proposal/{hash}` onto `main`; produces linear history |
| `squash` | Squashes all proposal commits into one on `main` |
| `merge` | Standard merge commit; checks for new commits first — skips if already up-to-date |

**Guards:**

- Refuses if the worktree itself has uncommitted changes. Commit or stash them before merging.
- Auto-stashes uncommitted changes in the main worktree and restores them after the merge.

**Success output:**

```json
{
  "success": true,
  "hash": "p03api",
  "branch": "proposal/p03api",
  "strategy": "rebase",
  "mergedAt": "2026-04-23T10:00:00.000Z",
  "conflicts": [],
  "message": "Worktree for proposal p03api merged into main using rebase."
}
```

**Conflict output** (`success: false`, worktree preserved):

```json
{
  "success": false,
  "hash": "p03api",
  "branch": "proposal/p03api",
  "strategy": "merge",
  "conflicts": ["src/core/completions.ts", "src/mcp/tools/proposal-tools.ts"],
  "message": "Merge failed with conflicts in: src/core/completions.ts, src/mcp/tools/proposal-tools.ts"
}
```

**Error codes:**

| Code | HTTP | Meaning |
|------|------|---------|
| `NOT_FOUND` | 404 | No worktree found for the given proposal hash |
| `UNCOMMITTED_CHANGES` | 409 | Worktree has uncommitted changes; commit or stash first |
| `MERGE_CONFLICT` | 409 | Conflicts detected; worktree preserved for manual resolution |

---

## Known Gaps (as of 2026-03-18)

The following actions and tools are implemented but not yet fully documented in this reference.
A dedicated documentation gate will address these.

### Undocumented actions on existing tools

| Tool | Action | Notes |
|------|--------|-------|
| `gates_action` | `validate` | Dry-run structural and quality checks for a gate before start |
| `proposal_action` | `cancel` | Mark a proposal as cancelled; requires `confirmed: true` |
| `proposal_action` | `defer` | Move a proposal to backlog; requires `confirmed: true` |
| `reg_action` | `search` | Full-text search across requirements |
| `reg_action` | `update` | Update mutable fields (title, type, priority, acceptance criteria) |
| `reg_action` | `inherit` | Inherit project-level requirements into a gate |
| `reg_action` | `trace` | Trace requirement to git commits |
| `reg_action` | `regenerate` | Regenerate requirements for project/gate |

### Tools not yet documented

| Tool | Description |
|------|-------------|
| `diagram_action` | Generate and retrieve architecture diagrams. Actions: `catalogue`, `select`, `generate`, `show`, `render`, `list_template`, `get_template` |

---

## Related Documentation

- [Architecture: MCP Workflows](../zeno/architecture/mcp-workflows.md) — State machines, preconditions, postconditions

- [Zeno's Planner Project PRD](../zeno/overview/PROJECT_PRD.md) — System overview and goals

- [MCP Setup & Integration](MCP-SETUP.md) — Deployment and server setup

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-18
**Status:** Active - Authoritative Reference
