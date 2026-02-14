# Solitary Proposal: Centralize MCP Schema Registry

**Hash**: p0209mcp-registry  
**Type**: Refactoring / Architecture  
**Status**: completed  
**Date Created**: 2026-02-09  
**Implemented**: 2026-02-11  
**Archived**: 2026-02-12  
**Archived By**: system  
**Priority**: Medium (Improves maintainability)  
**Depends On**: p0209mcp-tool-unify  
**Blocks**: p0209mcp-testing-docs

---

## Summary

Create centralized `schemas/registry.ts` as single source of truth for tool metadata (actions, input/output schemas, descriptions). Replace manual tool definition arrays in `tools/index.ts` with programmatic registration driven by registry. Result: Tool registry is declarative and queryable; tool registration is consistent; easier to add new tools.

---

## Goals

1. **Create Tool Registry** - Centralized mapping of entity → actions → schemas
2. **Replace Array Concat** - Eliminate `allToolDefs` array concatenation in index.ts
3. **Programmatic Registration** - Drive tool registration from registry metadata
4. **Improve Discoverability** - Tools and actions documented in one place
5. **Enable Future Queries** - Registry can be queried for schema, action list, etc.

---

## Acceptance Criteria

- [x] `src/mcp/schemas/registry.ts` created with `ToolRegistry` object
- [x] Registry contains entries for: gates, proposals, requirements, archives, config (core unified-action tools)
- [x] Each registry entry has: action name, allowed actions[], input schema, output schema, description
- [x] `tools/index.ts` refactored to iterate through registry instead of array concat
- [x] `allToolDefs` now generated from registry metadata
- [x] Tool registration loop uses registry metadata
- [x] All handler-based tools still register correctly (registration output preserved)
- [x] No change to MCP tool API or behavior
- [x] No TypeScript errors (verified locally)
- [x] Codebase references registry via `src/mcp/schemas/index.ts` utilities

---

## Tasks

**Task 1: Create tool registry structure**
- Create `src/mcp/schemas/registry.ts`
- Define `ToolRegistry` object with entry per entity:
  ```typescript
  {
    gates: { action: 'gates_action', actions: [...], inputSchema, outputSchema, description },
    proposals: { action: 'proposal_action', actions: [...], inputSchema, outputSchema, description },
    requirements: { action: 'req_action', actions: [...], inputSchema, outputSchema, description },
    archives: { action: 'archive_action', actions: [...], inputSchema, outputSchema, description },
    repositories: { action: '...', actions: [...], inputSchema, outputSchema, description, note: "Not implemented" },
    analysis: { action: '...', actions: [...], inputSchema, outputSchema, description, note: "Not implemented" },
    workflows: { action: '...', actions: [...], inputSchema, outputSchema, description },
    config: { action: 'config_get', actions: [...], inputSchema, outputSchema, description },
  }
  ```
- Include all active (unified action) tools only
- **Files Affected**: `src/mcp/schemas/registry.ts`
- **Tests**: Unit tests verify registry structure and completeness

**Task 2: Update schema exports**
- Update `src/mcp/schemas/index.ts` to export `ToolRegistry`
- Add utility function: `getToolSchema(entity: string, action?: string)` - returns schema(s) for entity
- Add utility function: `getToolActions(entity: string)` - returns allowed actions
- **Files Affected**: `src/mcp/schemas/index.ts`
- **Tests**: Unit tests for schema lookup utilities

**Task 3: Refactor tool registration**
- Update `src/mcp/tools/index.ts`:
  - Remove manual `allToolDefs = [...]` array concatenation
  - Remove all individual `*ToolDefinitions` array imports
  - Loop through `ToolRegistry` entries
  - For each entry, create tool definition from registry metadata
  - Generate `allToolDefs` programmatically
  - Keep existing handler registration logic unchanged
- Result: Single loop that drives registration from registry
- **Files Affected**: `src/mcp/tools/index.ts`
- **Tests**: Tool registration tests; verify same tools registered

**Task 4: Verify registry-driven registration**
- Run full test suite: `npm run test` (all tests pass)
- Run type check: `npm run typecheck` (zero errors)
- Verify tool count matches before/after (same number of tools)
- Verify MCP server startup still works
- Confirm registry is source of truth
- **Files Affected**: All tool files, test files
- **Tests**: 100+ tests pass; registration verification tests

---

## Completion Summary

**Tasks Completed**: 4/4

**Files Modified**: 4

**Test Coverage**: existing tests updated; new unit tests added for registry utilities

### Artifacts Created
- `src/mcp/schemas/registry.ts` — central ToolRegistry
- `src/mcp/schemas/index.ts` — exports + registry utilities

### Files Modified
- `src/mcp/tools/index.ts` — registration driven from registry
- `tests/mcp/schemas/registry.test.ts` — unit tests for registry utilities

### Quality Metrics
- **TypeScript**: no type errors
- **Unit tests**: added/updated; all tests pass locally
- **Behavior**: MCP tool registration unchanged from caller perspective

---

## File Changes

### Files Created

```
src/mcp/schemas/registry.ts
  New file: ~200 LOC
  Contains: ToolRegistry object with entries for all tools
```

### Files Modified

```
src/mcp/tools/index.ts
  Before: ~75 LOC (imports 8+ tool def arrays, concatenates allToolDefs)
  After: ~100 LOC (imports registry, generates allToolDefs from registry)
  Change: +25 LOC (but eliminates manual array management)

src/mcp/schemas/index.ts
  Before: ~50 LOC (schema re-exports)
  After: ~80 LOC (adds registry export and utilities)
  Change: +30 LOC (new utilities)
```

**Net Change**: +200 new file, +55 modified = **+255 LOC** (but trades maintenance burden away)

---

## Dependencies

**Depends On**: p0209mcp-tool-unify (Phase 3 must be complete; all unified tools must exist)

**Subsequent Proposals** (depend on this one):
- `p0209mcp-testing-docs` - Testing & documentation (registry now stable)

---

## Implementation Notes

- Registry is declarative (just data, no logic)
- Registration loop should handle both metadata lookup and handler registration
- Tool registration must remain in same place (handlers from tool-specific factories)
- Registry should be queryable for future tooling (schema lookup, action discovery)
- No change to MCP tool behavior or API (purely internal refactor)
- Keep registry structure extensible for future tools

