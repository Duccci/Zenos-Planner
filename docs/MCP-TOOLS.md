# MCP Tools Reference Documentation

**Project:** Zeno's Planner  
**Last Updated:** February 22, 2026  
**Purpose:** Authoritative reference for all Model Context Protocol (MCP) tools, their input/output schemas, validators, preconditions, and error codes.

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

## gates_action – Gate Lifecycle Management

**Tool Name:** `gates_action`  
**Purpose:** Manage project gates—the concrete milestones that represent actual deliverables.

### Actions

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
|-------|------|----------|-------------|
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
|-------|------|----------|-------------|
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
|-------|------|----------|-------------|
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
|-------|------|----------|-------------|
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

### proposal_action – Proposal Lifecycle Management

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
|-------|------|----------|-------------|
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
|-------|------|----------|-------------|
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
|-------|------|----------|-------------|
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
|-------|------|----------|-------------|
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
|-------|------|----------|-------------|
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
|-------|------|----------|-------------|
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

### req_action – Requirements Database Query

**Tool Name:** `req_action`  
**Purpose:** Query and manage the requirements database (single source of truth for what must be built).

#### req_action: list

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
|-------|------|----------|-------------|
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

#### req_action: show

**Description:** Get detailed requirement information by hash.

**Input Schema:**
```json
{
  "action": "show",
  "hash": "#g03req1"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
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

#### req_action: deps

**Description:** View requirement dependency graph.

**Input Schema:**
```json
{
  "action": "deps",
  "hash": "#g03req1"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
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

### archive_action – Finalize Completed Work

**Tool Name:** `archive_action`  
**Purpose:** Archive and close out completed gates and proposals, creating historical records.

#### archive_action: gate

**Description:** Archive a completed gate and all its proposals.

**Input Schema:**
```json
{
  "action": "gate",
  "gateId": "gate-01"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | enum | yes | Must be `"gate"` |
| `gateId` | string | yes | Gate ID to archive |

**Validators Executed:**
1. `validateArchiveActionInput` — schema validation
2. `validateGateExists` — gate must exist
3. `validateGateStatus` — gate must be `completed`

**Preconditions:**
- Gate exists and has status `completed`

**Output Schema:**
```json
{
  "action": "gate",
  "result": {
    "gateId": "gate-01",
    "status": "archived",
    "archivedProposals": [
      {"hash": "#p01ts", "title": "TypeScript Setup"},
      {"hash": "#p01db", "title": "Database Layer"}
    ],
    "commit": "abc123def456...",
    "archiveLocation": "zeno/gates/archive/gate-01.md",
    "message": "Gate gate-01 archived. 3 proposals moved to archive. Git commit created."
  },
  "validation": {"allowed": true}
}
```

**Error Codes:**
- `INVALID_INPUT` (400) — Schema validation failed
- `NOT_FOUND` (404) — Gate does not exist
- `INVALID_STATE` (409) — Gate is not `completed`
- `UNKNOWN_ACTION` (400) — Action not recognized

---

#### archive_action: batch

**Description:** Archive multiple gates in a single operation.

**Input Schema:**
```json
{
  "action": "batch",
  "gateIds": ["gate-01", "gate-02"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | enum | yes | Must be `"batch"` |
| `gateIds` | array[string] | yes | Array of gate IDs to archive |

**Validators Executed:**
1. `validateArchiveActionInput` — schema validation
2. `validateGateExists` — all gates must exist
3. `validateGateStatus` — all gates must be `completed`

**Preconditions:**
- All gates exist and have status `completed`

**Output Schema:**
```json
{
  "action": "batch",
  "result": {
    "archivedCount": 2,
    "gateIds": ["gate-01", "gate-02"],
    "failed": [],
    "commit": "abc123def456...",
    "message": "2 gates archived successfully. 1 commit created."
  },
  "validation": {"allowed": true}
}
```

**Error Codes:**
- `INVALID_INPUT` (400) — Schema validation failed
- `NOT_FOUND` (404) — One or more gates do not exist
- `INVALID_STATE` (409) — One or more gates are not `completed`
- `UNKNOWN_ACTION` (400) — Action not recognized

---

### config_get – Access Project Configuration

**Tool Name:** `config_get`  
**Purpose:** Retrieve project-level settings and quality thresholds.

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

## Error Code Taxonomy

| Code | HTTP | Meaning | When Returned |
|------|------|---------|---------------|
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

**Gate States:** `pending` → `in_progress` → `completed | rejected | cancelled` (or from `rejected/cancelled` back to `in_progress`)

**Proposal States:** `pending` → `in_progress` → `completed | rejected | archived`

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

## Related Documentation

- [Architecture: MCP Workflows](../zeno/architecture/mcp-workflows.md) — State machines, preconditions, postconditions
- [Zeno's Planner Project PRD](../zeno/PROJECT_PRD.md) — System overview and goals
- [MCP Setup & Integration](MCP-SETUP.md) — Deployment and server setup
- [zeno-apply Skill](../.claude/skills/zeno-apply/SKILL.md) — How to implement proposals using MCP tools

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-02-22  
**Status:** Active - Authoritative Reference
