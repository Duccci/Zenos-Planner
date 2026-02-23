# Solitary Proposal: project_action MCP Tool

**Type**: Solitary (Feature / Infrastructure)  
**Hash**: `s26022204proj-act`  
**Status**: pending  
**Created**: 2026-02-22  

## Summary

Add a `project_action` unified MCP tool covering `init` and `status`. Extract the business logic currently embedded in the CLI command handlers into registry-backed implementations, and refactor the CLI commands to delegate to those implementations. Aligns with the design principle that CLI commands are thin wrappers over MCP-callable logic.

## Context

Two CLI commands implement their logic directly inside the commander action callbacks with no MCP-callable path:

- `src/cli/commands/init.ts` — `runInitWorkflow()` calls scaffold, requirement generation, gate generation, AGENTS.md generation, and database init all inline. No MCP tool exists; an AI agent cannot initialize a project without CLI access.
- `src/cli/commands/status.ts` — queries the `gates` table directly, reads archive directory, and runs diagnostics inline. No MCP tool exists.

Every other workflow action (`gates_action`, `proposal_action`, `req_action`, etc.) follows the unified action pattern: handler registered in `ToolRegistry`, CLI delegates to it. `init` and `status` are the only two that bypass this entirely.

## Objectives

- Expose `project_action: init` and `project_action: status` as MCP tools
- Register input/output Zod schemas in the schemas layer
- Add the tool entry to `ToolRegistry`
- Refactor CLI commands to delegate to the handler (no logic duplication)

## Tasks

### Task 1: Define Schemas
**Description**: Create Zod input and output schemas for `project_action` covering both actions.

**Acceptance Criteria**:
- [ ] `ProjectActionInputSchema` — discriminated union: `{ action: 'init', projectName: string, endState: string }` | `{ action: 'status' }`
- [ ] `ProjectActionOutputSchema` — discriminated union matching each action's response shape:
  - `init`: `{ success: boolean, projectName: string, gatesGenerated: number, requirementsGenerated: number }`
  - `status`: `{ activeGates: { id: string, name: string, status: string }[], completedGates: string[], mcp: { status: string, toolsRegistered: number, configLoaded: boolean } | null }`
- [ ] Schemas exported from `src/mcp/schemas/project-action-schemas.ts` (create)
- [ ] `ToolRegistry` entry added for `project_action` in `src/mcp/schemas/registry.ts`

**Files Affected**:
- `src/mcp/schemas/project-action-schemas.ts` (create)
- `src/mcp/schemas/registry.ts` (add `project` entry)

---

### Task 2: Implement Handler
**Description**: Extract the business logic from both CLI command callbacks into a `project_action` MCP handler. The handler must not import from commander or use interactive prompts — those stay in the CLI layer.

**Acceptance Criteria**:
- [ ] `src/mcp/tools/project-tools.ts` created with:
  - `projectHandlers(registry)` factory exported
  - `projectToolDefinitions` array exported
  - `init` action: calls `createProjectStructure`, `saveConfig`, `initializeDatabase`, `RequirementGenerator`, `generateGates`, `generateAgentsMD`, `writeAgentsMD` — same sequence as `runInitWorkflow` in `init.ts`
  - `status` action: queries `gates` table, reads archive directory, calls `diagnostics.generateReport` — same sequence as current `status.ts` action callback
- [ ] Handler registered in `src/mcp/tools/index.ts` alongside existing handlers
- [ ] No interactive prompts (`@inquirer/prompts`) imported in handler file; CLI layer handles prompts before invoking the tool

**Files Affected**:
- `src/mcp/tools/project-tools.ts` (create)
- `src/mcp/tools/index.ts` (add `projectHandlers` to registration loop)

---

### Task 3: Refactor CLI Commands to Delegate
**Description**: Replace the inline logic in both CLI command callbacks with calls to the `project_action` handler (via `FunctionRegistry` or direct handler invocation), making them thin wrappers.

**Acceptance Criteria**:
- [ ] `src/cli/commands/init.ts`: `runInitWorkflow` removed; CLI action collects prompts, then calls `project_action: init` handler with collected values; output rendered from structured response
- [ ] `src/cli/commands/status.ts`: inline DB queries and diagnostics calls removed; CLI action calls `project_action: status` handler; output rendered from structured response
- [ ] Both CLI commands render identical output to current behaviour (no visible regression)
- [ ] `runInitWorkflow` in `init.ts` is fully deleted (logic now lives in handler only)

**Files Affected**:
- `src/cli/commands/init.ts`
- `src/cli/commands/status.ts`

---

### Task 4: Tests
**Description**: Add unit tests for the `project_action` handler covering both actions.

**Acceptance Criteria**:
- [ ] `tests/mcp/tools/project-tools.test.ts` created
- [ ] `init` action test: mocks scaffold, DB init, requirement/gate generation; verifies structured output shape
- [ ] `status` action test: mocks DB `gates` query and archive directory read; verifies active/completed gate lists in response
- [ ] `status` action: verifies graceful null `mcp` field when diagnostics throws
- [ ] Existing `tests/cli/` tests for init and status commands pass without modification (CLI output unchanged)

**Files Affected**:
- `tests/mcp/tools/project-tools.test.ts` (create)

---

## Task Execution Order

1. **Task 1** (Schemas) — no prerequisites; defines the contract everything else depends on.
2. **Task 2** (Handler) — requires Task 1 schemas.
3. **Task 3** (CLI refactor) — requires Task 2 handler to exist.
4. **Task 4** (Tests) — requires Tasks 2 and 3 complete.

## Quality Metrics

- **No logic duplication**: after Task 3, `init.ts` and `status.ts` contain only CLI formatting and prompt collection
- **Type Safety**: handler input/output validated against Zod schemas
- **Test Coverage**: both actions covered with mocked dependencies

## Dependencies

**Upstream**: None.

**Downstream**:
- `s26022201mcp-sot` Task 4 (skill refactoring) should reference `project_action` once this tool exists — update `zeno-gate/SKILL.md` to reference `project_action: init` for initialization steps if applicable.
