# Zeno Functions Reference

This document lists all Zeno functions available to AI agents for programmatic invocation.

## Function Index

### Project Management
- [init](#init)
- [status](#status)
- [gates_list](#gates_list)
- [gates_show](#gates_show)
- [gates_start](#gates_start)
- [gates_complete](#gates_complete)

### Requirements Management
- [req_list](#req_list)
- [req_show](#req_show)
- [req_deps](#req_deps)
- [req_transfer](#req_transfer)

### Proposal Management
- [proposal_list](#proposal_list)
- [proposal_show](#proposal_show)
- [proposal_start](#proposal_start)
- [proposal_validate](#proposal_validate)
- [proposal_approve](#proposal_approve)
- [proposal_reject](#proposal_reject)

### Architecture
- [arch_generate](#arch_generate)
- [arch_show](#arch_show)

### Utilities
- [show](#show)
- [config_get](#config_get)

---

## Project Management Functions

### init

Initialize a new Zeno project with interactive prompts.

**Signature:** `init()`

**Parameters:** None

**Returns:** `void`

**Examples:**
```javascript
await init()
```

---

### status

Show current project status and progress overview.

**Signature:** `status()`

**Parameters:** None

**Returns:** `ProjectStatus`

**Examples:**
```javascript
const status = await status()
console.log(`Project has ${status.gates.length} gates`)
```

---

### gates_list

List all gates in the project with their status.

**Signature:** `gates_list()`

**Parameters:** None

**Returns:** `Gate[]`

**Examples:**
```javascript
const gates = await gates_list()
gates.forEach(gate => console.log(`${gate.id}: ${gate.status}`))
```

---

### gates_show

Show detailed information about a specific gate.

**Signature:** `gates_show(gateId: string)`

**Parameters:**
- `gateId` (string, required): The ID of the gate to show (e.g., "gate-01")

**Returns:** `GateDetails`

**Examples:**
```javascript
const details = await gates_show("gate-01")
console.log(`Gate ${details.id}: ${details.description}`)
```

---

### gates_start

Start working on a gate (changes status from pending to in_progress).

**Signature:** `gates_start(gateId: string)`

**Parameters:**
- `gateId` (string, required): The ID of the gate to start

**Returns:** `void`

**Examples:**
```javascript
await gates_start("gate-02")
```

---

### gates_complete

Mark a gate as completed and create a release tag.

**Signature:** `gates_complete(gateId: string)`

**Parameters:**
- `gateId` (string, required): The ID of the gate to complete

**Returns:** `void`

**Examples:**
```javascript
await gates_complete("gate-01")
```

---

## Requirements Management Functions

### req_list

List requirements, optionally filtered by gate or project-wide.

**Signature:** `req_list(gateId?: string, project?: boolean)`

**Parameters:**
- `gateId` (string, optional): Optional gate ID to filter requirements
- `project` (boolean, optional): If true, list project-level requirements only

**Returns:** `Requirement[]`

**Examples:**
```javascript
// All requirements
const all = await req_list()

// Gate-specific requirements
const gateReqs = await req_list("gate-02")

// Project-level requirements
const projectReqs = await req_list(null, true)
```

---

### req_show

Show detailed information about a specific requirement.

**Signature:** `req_show(hash: string)`

**Parameters:**
- `hash` (string, required): The hash identifier of the requirement

**Returns:** `RequirementDetails`

**Examples:**
```javascript
const details = await req_show("#a3f9c2d1")
console.log(`Requirement: ${details.title}`)
```

---

### req_deps

Show dependency graph for a requirement.

**Signature:** `req_deps(hash: string)`

**Parameters:**
- `hash` (string, required): The hash identifier of the requirement

**Returns:** `DependencyGraph`

**Examples:**
```javascript
const deps = await req_deps("#a3f9c2d1")
console.log(`Dependencies: ${deps.requires.join(', ')}`)
```

---

### req_status

Update the status of a requirement.

**Signature:** `req_status(hash: string, status: string)`

**Parameters:**
- `hash` (string, required): The hash identifier of the requirement
- `status` (string, required): New status: "pending", "implemented", "tested"

**Returns:** `void`

**Examples:**
```javascript
await req_status("#a3f9c2d1", "implemented")
await req_status("#a3f9c2d1", "tested")
```

---

## Proposal Management Functions

### proposal_list

List proposals, optionally filtered by gate or status.

**Signature:** `proposal_list(gateId?: string, status?: string)`

**Parameters:**
- `gateId` (string, optional): Optional gate ID to filter proposals
- `status` (string, optional): Optional status filter: "pending", "in_progress", "completed", "rejected"

**Returns:** `Proposal[]`

**Examples:**
```javascript
// All proposals
const all = await proposal_list()

// Pending proposals
const pending = await proposal_list(null, "pending")

// Gate-specific proposals
const gateProps = await proposal_list("gate-02")
```

---

### proposal_show

Show detailed information about a specific proposal.

**Signature:** `proposal_show(hash: string)`

**Parameters:**
- `hash` (string, required): The hash identifier of the proposal

**Returns:** `ProposalDetails`

**Examples:**
```javascript
const details = await proposal_show("#g02p07llm")
console.log(`Proposal: ${details.title}`)
```

---

### proposal_start

Start implementation of a proposal (status: pending -> in_progress).

**Signature:** `proposal_start(hash: string)`

**Parameters:**
- `hash` (string, required): The hash identifier of the proposal

**Returns:** `void`

**Examples:**
```javascript
await proposal_start("#g02p07llm")
```

---

### proposal_validate

Run automated validation checks on a proposal.

**Signature:** `proposal_validate(hash: string)`

**Parameters:**
- `hash` (string, required): The hash identifier of the proposal

**Returns:** `ValidationResult`

**Examples:**
```javascript
const result = await proposal_validate("#g02p07llm")
if (result.passed) {
  console.log("Validation passed")
} else {
  console.log("Issues found:", result.issues)
}
```

---

### proposal_approve

Approve a completed proposal (status: in_progress -> completed).

**Signature:** `proposal_approve(hash: string)`

**Parameters:**
- `hash` (string, required): The hash identifier of the proposal

**Returns:** `void`

**Examples:**
```javascript
await proposal_approve("#g02p07llm")
```

---

### proposal_reject

Reject a proposal (status: in_progress -> rejected).

**Signature:** `proposal_reject(hash: string)`

**Parameters:**
- `hash` (string, required): The hash identifier of the proposal

**Returns:** `void`

**Examples:**
```javascript
await proposal_reject("#g02p07llm")
```

---

## Architecture Functions

### arch_generate

Generate all architecture diagrams for the project.

**Signature:** `arch_generate()`

**Parameters:** None

**Returns:** `void`

**Examples:**
```javascript
await arch_generate()
```

---

### arch_show

Show a specific type of architecture diagram.

**Signature:** `arch_show(type: string)`

**Parameters:**
- `type` (string, required): Diagram type: "system", "lifecycle", "flow", "gate-roadmap"

**Returns:** `Diagram`

**Examples:**
```javascript
const diagram = await arch_show("system")
console.log(diagram.content)
```

---

## Utility Functions

### show

Resolve a hash to its entity details.

**Signature:** `show(hash: string)`

**Parameters:**
- `hash` (string, required): The hash identifier to resolve

**Returns:** `EntityDetails`

**Examples:**
```javascript
const entity = await show("#a3f9c2d1")
console.log(`${entity.type}: ${entity.name}`)
```

### config_get

Get project configuration values from zeno/.zeno/config.json.

**Signature:** `config_get()`

**Parameters:** None

**Returns:** `ZenoConfig`

**Examples:**
```javascript
const config = await config_get()
console.log(`Code coverage threshold: ${config.qualityThresholds.codeCoverage}%`)
console.log(`Security vulnerabilities allowed: ${config.qualityThresholds.securityVulnerabilities}`)
```

---

## Error Handling

All functions may throw errors. Common error types:

- `ValidationError`: Invalid parameters
- `DependencyError`: Missing dependencies
- `StatusError`: Invalid status transition
- `NotFoundError`: Entity not found

Handle errors appropriately:
```javascript
try {
  await proposal_start("#invalid")
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    console.log("Fix parameters and retry")
  } else if (error.code === 'NOT_FOUND') {
    console.log("Check hash and try again")
  }
}
```

## Prerequisites

Some functions require specific project state:

- **req_* functions**: Project must be initialized
- **proposal_* functions**: Project must be initialized
- **gates_* functions**: Project must be initialized
- **arch_* functions**: Project must be initialized

Check project status with `status()` before calling functions.