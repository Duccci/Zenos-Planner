# Proposal: JSDoc & Error Message Review

**Hash**: #2d8f6a3e9c1b4075
**Gate**: gate-09
**Status**: completed
**Approved By**: Duccci
**Implemented**: 2026-03-18T23:25:17.811Z
**Roles**: feature
**Created**: 2026-03-18

---

## Summary

Adds JSDoc comments to all public API symbols exported from `src/index.ts` and their source files in `src/integration/`. Reviews CLI command error messages for clarity, actionable context, and consistent tone. Verifies no TypeScript strict-mode errors are introduced. This proposal is independent of the README/AGENTS.md audit proposals and can run in parallel.

---

## Context

### Why This Change

`src/index.ts` exports the public API surface: `VERSION`, `FunctionRegistry`, `createFunctionRegistry`, `getGlobalRegistry`, and associated types. None of these have JSDoc documentation, reducing IDE discoverability. CLI commands in gates 07-08 added error paths under time pressure; some messages may lack the entity name, actionable suggestion, or exit context that makes them useful to users and AI agents.

### Dependencies

*No dependencies.*

---

## Tasks

### Task 1 — JSDoc for `src/index.ts`

**File(s)**: src/index.ts

- [x] Add a `@module` JSDoc block at the top of the file describing the Zeno's Planner public API
- [x] Add JSDoc to `VERSION`: document what it contains and when it is updated
- [x] Ensure re-exported symbols from `function-registry.ts` and `function-implementations.ts` are noted in the module description (they are re-exported; their JSDoc lives in the source files covered in tasks 2-3)
- [x] Run `tsc --noEmit` after changes to confirm no type errors introduced

### Task 2 — JSDoc for `src/integration/function-registry.ts`

**File(s)**: src/integration/function-registry.ts

Add JSDoc to each exported symbol:

- [x] `FunctionRegistry` class — document its purpose, the registry pattern it implements, and how CLI and MCP layers consume it
- [x] `RegisteredFunction` type — document structure fields: name, description, handler signature, schema
- [x] `FunctionErrorResponse` type — document the structure and when it is returned vs. throwing
- [x] `FunctionResult` type — document the success/error discriminated union shape
- [x] Add `@param` and `@returns` to public methods on `FunctionRegistry` that lack them
- [x] Run `tsc --noEmit` after changes

### Task 3 — JSDoc for `src/integration/function-implementations.ts`

**File(s)**: src/integration/function-implementations.ts

- [x] `createFunctionRegistry` — document: what it instantiates, what handlers it registers, what the caller receives
- [x] `getGlobalRegistry` — document: singleton behaviour, when it is initialized, thread-safety note (Node.js single-threaded)
- [x] Run `tsc --noEmit` after changes

### Task 4 — Error message review in CLI commands

**File(s)**: src/cli/commands/gates.ts, src/cli/commands/req.ts, src/cli/commands/proposal.ts, src/cli/commands/worktree.ts, src/cli/commands/repos.ts, src/cli/commands/init.ts

For each file, read all `console.error`, `process.exit`, and thrown error strings. Apply these criteria:

- **Clarity**: message names the entity that failed (e.g., "Gate gate-04 not found" not "Not found")
- **Actionable**: message tells the user what to do next (e.g., "Run `zeno gates list` to see available gates")
- **Consistent tone**: use lower-case sentence fragments consistent with Commander.js conventions; no stack traces in user-facing output
- **Exit codes**: verify non-zero exit on errors (`process.exit(1)`)

Fix any messages that fail these criteria. Text-only changes; do not alter logic.

### Task 5 — Error message review in remaining CLI commands

**File(s)**: src/cli/commands/arch.ts, src/cli/commands/show.ts, src/cli/commands/trace.ts, src/cli/commands/status.ts, src/cli/commands/mcp.ts, src/cli/commands/registry.ts

Apply the same criteria as Task 4 to these command files.

### Task 6 — Final verification

**File(s)**: src/index.ts, src/integration/function-registry.ts, src/integration/function-implementations.ts

- [x] Run `tsc --noEmit` one final time across the full project to confirm zero type errors
- [x] Confirm no `@ts-ignore` or `@ts-expect-error` comments were added during JSDoc work

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/index.ts` | modify | Add `@module` JSDoc block and `VERSION` JSDoc |
| `src/integration/function-registry.ts` | modify | Add JSDoc to `FunctionRegistry`, `RegisteredFunction`, `FunctionErrorResponse`, `FunctionResult`, and public methods |
| `src/integration/function-implementations.ts` | modify | Add JSDoc to `createFunctionRegistry` and `getGlobalRegistry` |
| `src/cli/commands/gates.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/req.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/proposal.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/worktree.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/repos.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/init.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/arch.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/show.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/trace.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/status.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/mcp.ts` | modify | Improve error message clarity and actionability |
| `src/cli/commands/registry.ts` | modify | Improve error message clarity and actionability |

---

## Rollback

**If rejected or failed**: Remove all JSDoc comment blocks added in tasks 1-3 by reverting `src/index.ts`, `src/integration/function-registry.ts`, and `src/integration/function-implementations.ts`. Revert error message text changes in the CLI command files. No structural or behavioral changes were made, so rollback is a text-only revert.

---

## Completion Summary

**Tasks Completed**: 6/6

- [x] Task 1: Added `@module` JSDoc block and `VERSION` JSDoc to `src/index.ts`
- [x] Task 2: Added/improved JSDoc on all exported types and `FunctionRegistry` methods in `src/integration/function-registry.ts`
- [x] Task 3: Improved JSDoc on singleton variable and `getGlobalRegistry` in `src/integration/function-implementations.ts`
- [x] Task 4: Fixed error messages in `req.ts` (added entity names to all 7 error paths), `proposal.ts` (improved 4 `Not a Zeno project` messages), `worktree.ts`/`repos.ts`/`init.ts` (already compliant)
- [x] Task 5: Fixed `status.ts` (`JSON.stringify` → human-readable), `mcp.ts` (removed duplicate `console.error` lines); `arch.ts`, `show.ts`, `trace.ts`, `registry.ts` already compliant
- [x] Task 6: `tsc --noEmit` passes with zero errors; no `@ts-ignore` added

**Deviations**: None. `repos.ts` had no `logger.error` calls; `arch.ts` and `show.ts` had none either — all already compliant.
