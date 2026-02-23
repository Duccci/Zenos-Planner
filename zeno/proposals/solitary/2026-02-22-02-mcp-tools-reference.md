# Solitary Proposal: MCP Tools Reference Documentation

**Type**: Solitary (Documentation)  
**Hash**: `s26022202mcp-ref`  
**Status**: pending  
**Created**: 2026-02-22  

## Summary

Consolidate and replace `docs/MCP-TOOLS-REVIEW.md` with a single authoritative `docs/MCP-TOOLS.md` covering every MCP tool action: input schema, validators executed, preconditions, output schema, error codes, and an example request/response. Add a CI check that prevents new tool actions from shipping without documentation.

## Context

The MCP tools are the authoritative interface for all workflow actions (`gates_action`, `proposal_action`, `req_action`, `repos_action`, `archive_action`), but there is no single reference showing what each action accepts, what validators it runs, and what it can return. `docs/MCP-TOOLS-REVIEW.md` (created 2026-02-13) covers use cases and narrative examples but lacks input/output schemas, validator chains, and error codes. This creates friction for:
- AI agents guessing field names rather than looking them up
- Debugging failures with no documented error code taxonomy
- Onboarding new contributors who must read source to understand contracts

This proposal replaces `docs/MCP-TOOLS-REVIEW.md` with `docs/MCP-TOOLS.md`, merging what the existing file covers well (use-case narrative, example calls) with the contract-level detail it lacks. Proposal `s26022201mcp-sot` (Task 1) produces a validator audit matrix that identifies which validators each handler calls — that output is the primary input to Task 1 of this proposal.

## Objectives

- Replace `docs/MCP-TOOLS-REVIEW.md` with a single `docs/MCP-TOOLS.md` that merges existing use-case content with input/output contracts, validator chains, and error taxonomy
- Ensure documentation stays in sync with code via CI verification
- Give AI agents and contributors a single lookup path that doesn't require reading source

## Tasks

### Task 1: Consolidate and Replace MCP Tools Documentation
**Description**: Replace `docs/MCP-TOOLS-REVIEW.md` with `docs/MCP-TOOLS.md`. Preserve the narrative use-case content from the existing file while adding input/output contracts, validator chains, preconditions, and error codes for every registered action. Use the validator audit matrix from `s26022201mcp-sot` Task 1 Notes to correctly list the validator chain for each action.

**Acceptance Criteria**:
- [ ] `docs/MCP-TOOLS-REVIEW.md` is deleted
- [ ] `docs/MCP-TOOLS.md` is created as the sole MCP reference file
- [ ] Document structure: one `##` section per tool (`gates_action`, `proposal_action`, `req_action`, `repos_action`, `archive_action`, `config_get`, `diagram_action`, `show_entity`, `git_trace`, `artifact_validate`)
- [ ] Each action (`###` subsection) contains:
  - **Input schema**: all fields, types, required vs optional
  - **Validators executed**: list by function name in call order (sourced from audit matrix)
  - **Preconditions**: required entity state before action is valid
  - **Output schema**: shape of the success response
  - **Error codes**: enumerated error identifiers and human-readable meanings
  - **Example**: one `json` request block + one `json` response block
- [ ] Use-case narrative and example calls from `MCP-TOOLS-REVIEW.md` are preserved where accurate
- [ ] Actions covered match `ToolRegistry` in `src/mcp/schemas/registry.ts` (no invented or missing actions)
- [ ] Cross-references `zeno/architecture/mcp-workflows.md` for state machine context

> **Prerequisite**: Task 1 audit findings from `s26022201mcp-sot` (recorded in that proposal's Notes section) must be complete before authoring the Validators Executed column.

**Files Affected**:

Input files (read only):
- `docs/MCP-TOOLS-REVIEW.md` (content to preserve/merge)
- `s26022201mcp-sot` Notes section (audit findings)
- `src/mcp/schemas/registry.ts`
- `src/mcp/schemas/gates-action-schemas.ts`
- `src/mcp/schemas/proposal-action-schemas.ts`
- `src/mcp/schemas/req-action-schemas.ts`
- `src/mcp/schemas/repository-action-schemas.ts`
- `src/mcp/schemas/archive-schemas.ts`
- `zeno/architecture/mcp-workflows.md`

Output files:
- `docs/MCP-TOOLS.md` (create)
- `docs/MCP-TOOLS-REVIEW.md` (delete)

---

### Task 2: CI Verification — Documentation Coverage
**Description**: Add a lightweight CI check that reads all registered tool names from `ToolRegistry` and verifies each appears as a `##` heading in `docs/MCP-TOOLS.md`. Fail the build if any registered tool is undocumented.

**Acceptance Criteria**:
- [ ] Script reads `ToolRegistry` keys and expected action list from `src/mcp/schemas/registry.ts`
- [ ] Script confirms every `toolName` has a matching `## <toolName>` section in `docs/MCP-TOOLS.md`
- [ ] Script confirms every `action` value has a matching `### <action>` subsection under its tool
- [ ] CI fails with a clear message listing undocumented tools/actions
- [ ] Test added to `tests/` verifying the check catches a missing entry

**Files Affected**:
- `scripts/verify-mcp-docs-coverage.ts` (create)
- `vitest.config.ts` (add script to CI pipeline)
- `tests/scripts/verify-mcp-docs-coverage.test.ts` (create)

---

## Quality Metrics

- **Type Safety**: Script reads `ToolRegistry` via TypeScript import (no regex parsing of source)
- **CI**: Build fails on any undocumented action

## Dependencies

**Upstream**:
- `s26022201mcp-sot` Task 1 must be complete (audit findings in that proposal's Notes section required)

**Downstream**: None
