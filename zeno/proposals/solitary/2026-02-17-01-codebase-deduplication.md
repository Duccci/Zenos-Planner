# Proposal: Codebase Deduplication & Consolidation

**Hash**: #d26021701  
**Gate**: solitary  
**Status**: pending  
**Created**: 2026-02-17

---

## Summary

Extract duplicated utility functions, interfaces, and query logic into shared modules to eliminate ~15 instances of copy-pasted code across CLI, core, integration, MCP, and generation layers. The primary targets are `normalizeGateId` (3 copies), `normalizeHash` (2 copies), `ValidationResult` interface (8 copies), archive-fallback gate listing (3 copies), directory-walking helpers (3 copies), and proposal markdown parsing (3 copies).

---

## Single-Phase Requirement

All tasks in this proposal are independent refactorings that can be executed in parallel. Each task extracts duplicated code into a shared location, then updates all consumers to import from the new location. No task depends on another task completing first.

---

## Context

### Why This Change

A codebase audit identified 15+ instances of duplicated logic spread across CLI commands, core modules, integration registries, MCP validators, and generation utilities. Key examples: `normalizeGateId()` implemented 3 times with slightly different regexes (inconsistency risk), `ValidationResult` interface defined 8 times identically, and archive-fallback gate listing copy-pasted 3 times. This duplication increases maintenance burden and creates divergence risk when behavior changes.

### Dependencies

*No dependencies.*

---

## Tasks

### Task 1: Extract `normalizeGateId` and `normalizeHash` to shared utility

**File(s)**: `src/utils/normalize.ts`  
**Action**: create

Create a new `normalize.ts` module exporting `normalizeGateId(input: string): string` and `normalizeHash(input: string): string`. `normalizeGateId` should use the regex from `src/cli/commands/gates.ts` (line 70): extract digits, pad to 2 characters, return `gate-XX`. `normalizeHash` should strip a leading `#` character if present. These are the canonical implementations that all consumers will import.

**Acceptance**:
- [ ] `normalizeGateId('1')` returns `'gate-01'`
- [ ] `normalizeGateId('gate-1')` returns `'gate-01'`
- [ ] `normalizeGateId('gate-01')` returns `'gate-01'`
- [ ] `normalizeHash('#abc123')` returns `'abc123'`
- [ ] `normalizeHash('abc123')` returns `'abc123'`

---

### Task 2: Update `normalizeGateId` consumers

**File(s)**: `src/cli/commands/gates.ts`, `src/core/completions.ts`, `src/integration/gates-registry.ts`  
**Action**: refactor

Remove the local `normalizeGateId` function from `src/cli/commands/gates.ts` (line 70) and `src/core/completions.ts` (line 37). Replace with `import { normalizeGateId } from '../../utils/normalize.js'` (adjust relative path per file). In `src/integration/gates-registry.ts` (line 78), replace the inline regex gate-ID normalization with a call to the imported `normalizeGateId`.

**Acceptance**:
- [ ] No local `normalizeGateId` function remains in any of the three files
- [ ] All three files import from `src/utils/normalize.ts`
- [ ] Existing tests in `tests/cli/commands/gates.test.ts` still pass

---

### Task 3: Update `normalizeHash` consumers

**File(s)**: `src/cli/commands/proposal.ts`, `src/core/completions.ts`  
**Action**: refactor

Remove the local `normalizeHash` function from `src/cli/commands/proposal.ts` (line 16) and `src/core/completions.ts` (line 32). Replace with `import { normalizeHash } from '...'` from `src/utils/normalize.ts`.

**Acceptance**:
- [ ] No local `normalizeHash` function remains in either file
- [ ] Both files import from `src/utils/normalize.ts`
- [ ] Existing tests still pass

---

### Task 4: Extract `ValidationResult` interface to shared types

**File(s)**: `src/mcp/validators/types.ts`  
**Action**: create

Create `src/mcp/validators/types.ts` exporting the `ValidationResult` interface: `{ allowed: boolean; errors?: string[]; warnings?: string[] }`. This becomes the single source of truth for all validator result types.

**Acceptance**:
- [ ] Interface exported with the three fields: `allowed`, `errors?`, `warnings?`
- [ ] TypeScript strict mode passes

---

### Task 5: Update `ValidationResult` consumers in MCP validators

**File(s)**: `src/mcp/validators/apply-phase-validator.ts`, `src/mcp/validators/dependency-validator.ts`, `src/mcp/validators/proposal-phases-validator.ts`, `src/mcp/validators/quality-validator.ts`, `src/mcp/validators/scope-validator.ts`, `src/mcp/tools/handler-factory.ts`  
**Action**: refactor

Remove the local `export interface ValidationResult` declaration from each of the six files. Add `import { ValidationResult } from './types.js'` (for validators) or `import { ValidationResult } from '../validators/types.js'` (for handler-factory). Ensure all existing re-exports are preserved so downstream consumers are unaffected.

**Acceptance**:
- [ ] No local `ValidationResult` interface definition remains in any of the six files
- [ ] All six files import from `src/mcp/validators/types.ts`
- [ ] External consumers that import `ValidationResult` from these files continue to work (re-exports if needed)
- [ ] TypeScript strict mode passes

---

### Task 6: Update `ValidationResult` consumers outside MCP

**File(s)**: `src/generation/mermaid-renderer.ts`, `src/analysis/artifact-validation-service.ts`  
**Action**: refactor

Remove the local `ValidationResult` interface from `src/generation/mermaid-renderer.ts` (line 13) and `src/analysis/artifact-validation-service.ts` (line 17). Replace with import from `src/mcp/validators/types.ts`. If these two files have a slightly different shape (check fields), unify to the canonical shape or create a separate domain-specific type if structurally different.

**Acceptance**:
- [ ] No local `ValidationResult` interface in either file
- [ ] Both import from `src/mcp/validators/types.ts`
- [ ] TypeScript strict mode passes

---

### Task 7: Extract archive-fallback gate listing to shared function

**File(s)**: `src/utils/gate-consolidation.ts`  
**Action**: modify

Add an exported function `listArchivedGates(archivePath: string): Array<{ id: string; name: string; status: string }>` to `src/utils/gate-consolidation.ts`. This function encapsulates the `readdirSync(archivePath).filter(f => f.endsWith('.md'))` + mapping pattern currently copy-pasted in three locations. It reads `.md` files from the archive directory, extracts gate IDs from filenames, and returns structured gate records.

**Acceptance**:
- [ ] Function reads archive directory and returns gate records with `id`, `name`, `status` fields
- [ ] Handles missing/empty directory gracefully (returns empty array)

---

### Task 8: Update archive-fallback consumers

**File(s)**: `src/integration/gates-registry.ts`, `src/cli/commands/gates.ts`  
**Action**: refactor

Replace the inline archive-fallback blocks in `src/integration/gates-registry.ts` (line 33), `src/cli/commands/gates.ts` (line 147), and `src/cli/commands/gates.ts` (line 473) with calls to `listArchivedGates()` imported from `src/utils/gate-consolidation.ts`.

**Acceptance**:
- [ ] No inline `readdirSync(archivePath).filter(...)` archive-reading pattern remains in either file
- [ ] All three locations use `listArchivedGates()`
- [ ] Existing gate listing behavior unchanged

---

### Task 9: Extract `walkDir` utility

**File(s)**: `src/utils/file.ts`  
**Action**: modify

Add exported functions `walkDir(dir: string, ext?: string): Promise<string[]>` and `walkDirSync(dir: string, ext?: string): string[]` to the existing `src/utils/file.ts`. These replace the three independent directory-walking implementations: `walk()` in `src/generation/proposals-discovery.ts` (line 13), `walkSync()` in `src/generation/proposals-discovery.ts` (line 109), and `getAllFiles()` in `src/utils/gate-consolidation.ts` (line 239). Default `ext` to `.md`.

**Acceptance**:
- [ ] `walkDir` recursively collects files matching the extension filter
- [ ] `walkDirSync` provides a synchronous variant
- [ ] Handles missing directories gracefully

---

### Task 10: Update `walkDir` consumers

**File(s)**: `src/generation/proposals-discovery.ts`, `src/utils/gate-consolidation.ts`  
**Action**: refactor

Remove the local `walk()` and `walkSync()` functions from `src/generation/proposals-discovery.ts`. Remove `getAllFiles()` from `src/utils/gate-consolidation.ts`. Replace all call sites with imports from `src/utils/file.ts`.

**Acceptance**:
- [ ] No local walk/directory-traversal helper remains in either file
- [ ] Both files import `walkDir` or `walkDirSync` from `src/utils/file.ts`
- [ ] Existing proposal discovery and gate consolidation behavior unchanged

---

### Task 11: Extract shared proposal metadata parser

**File(s)**: `src/core/proposal-parser.ts`  
**Action**: modify

Add an exported function `parseProposalMetadata(content: string): { hash?: string; title?: string; status?: string; gate?: string }` to the existing `src/core/proposal-parser.ts`. This consolidates the `**Hash**: #xxx`, `**Status**: xxx`, and `**Gate**: xxx` regex extraction currently duplicated in `src/utils/gate-consolidation.ts` (line 55 `parseProposal()`), `src/generation/proposals-discovery.ts` (line 48), and `src/core/archive-validation.ts` (line 139).

**Acceptance**:
- [ ] Extracts hash, title, status, and gate from standard proposal frontmatter
- [ ] Returns `undefined` for fields not found (graceful)
- [ ] Handles both `#hash` and `hash` formats for the Hash field

---

### Task 12: Update proposal metadata consumers

**File(s)**: `src/utils/gate-consolidation.ts`, `src/generation/proposals-discovery.ts`, `src/core/archive-validation.ts`  
**Action**: refactor

Update `parseProposal()` in `src/utils/gate-consolidation.ts` to call `parseProposalMetadata()` for extracting hash/title/status instead of its own regexes. Update `discoverProposals()` in `src/generation/proposals-discovery.ts` to call `parseProposalMetadata()` instead of inline regex parsing. Update `validateProposalReady()` in `src/core/archive-validation.ts` to call `parseProposalMetadata()` for status checking instead of its own regex.

**Acceptance**:
- [ ] No duplicate `**Hash**` / `**Status**` regex patterns remain in the three files
- [ ] All three files import `parseProposalMetadata` from `src/core/proposal-parser.ts`
- [ ] Existing behavior preserved

---

### Task 13: Tests for new shared utilities

**File(s)**: `tests/utils/normalize.test.ts`, `tests/utils/file.test.ts`, `tests/core/proposal-parser.test.ts`  
**Action**: create (normalize.test.ts), modify (file.test.ts, proposal-parser.test.ts)

Create `tests/utils/normalize.test.ts` with tests for `normalizeGateId` and `normalizeHash` covering standard inputs, edge cases (empty string, already-normalized values, numeric-only input). Add tests for `walkDir`/`walkDirSync` to `tests/utils/file.test.ts`. Add tests for `parseProposalMetadata` to `tests/core/proposal-parser.test.ts`.

**Acceptance**:
- [ ] `normalizeGateId` tests cover: numeric input, `gate-X`, `gate-XX`, whitespace
- [ ] `normalizeHash` tests cover: with `#` prefix, without prefix, empty string
- [ ] `walkDir` tests cover: normal directory, empty directory, missing directory
- [ ] `parseProposalMetadata` tests cover: complete frontmatter, partial frontmatter, missing fields
- [ ] All tests passing
- [ ] Coverage meets 90% threshold for new utilities

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/utils/normalize.ts` | create | Shared `normalizeGateId` and `normalizeHash` functions |
| `src/mcp/validators/types.ts` | create | Shared `ValidationResult` interface |
| `src/utils/file.ts` | modify | Add `walkDir` and `walkDirSync` utilities |
| `src/utils/gate-consolidation.ts` | modify | Add `listArchivedGates`; replace `getAllFiles` with `walkDirSync` import |
| `src/core/proposal-parser.ts` | modify | Add `parseProposalMetadata` function |
| `src/cli/commands/gates.ts` | refactor | Remove local `normalizeGateId`; replace archive-fallback blocks |
| `src/cli/commands/proposal.ts` | refactor | Remove local `normalizeHash` |
| `src/core/completions.ts` | refactor | Remove local `normalizeGateId` and `normalizeHash` |
| `src/integration/gates-registry.ts` | refactor | Replace inline gate-ID normalization and archive-fallback |
| `src/mcp/validators/apply-phase-validator.ts` | refactor | Remove local `ValidationResult`; import from types |
| `src/mcp/validators/dependency-validator.ts` | refactor | Remove local `ValidationResult`; import from types |
| `src/mcp/validators/proposal-phases-validator.ts` | refactor | Remove local `ValidationResult`; import from types |
| `src/mcp/validators/quality-validator.ts` | refactor | Remove local `ValidationResult`; import from types |
| `src/mcp/validators/scope-validator.ts` | refactor | Remove local `ValidationResult`; import from types |
| `src/mcp/tools/handler-factory.ts` | refactor | Remove local `ValidationResult`; import from validators/types |
| `src/generation/mermaid-renderer.ts` | refactor | Remove local `ValidationResult`; import from validators/types |
| `src/analysis/artifact-validation-service.ts` | refactor | Remove local `ValidationResult`; import from validators/types |
| `src/generation/proposals-discovery.ts` | refactor | Remove local `walk`/`walkSync`; use `parseProposalMetadata` |
| `src/core/archive-validation.ts` | refactor | Use `parseProposalMetadata` for status checks |
| `tests/utils/normalize.test.ts` | create | Tests for normalizeGateId, normalizeHash |
| `tests/utils/file.test.ts` | modify | Tests for walkDir, walkDirSync |
| `tests/core/proposal-parser.test.ts` | modify | Tests for parseProposalMetadata |

---

## Implementation Notes

- Follow the approach used successfully in the prior MCP consolidation series (archived proposals `#p0209mcp-util-extract`, `#p0209mcp-handler-generic`, `#p0209mcp-tool-unify`).
- Re-export `ValidationResult` from each validator file that currently exports it, to avoid breaking downstream consumers. After confirming no external imports rely on file-specific exports, the re-exports can be removed in a follow-up.
- The `listArchivedGates` function should match the current mapping pattern: extract gate ID from filename, set `status: 'completed'`, set `project_id: 'archived'`.
- `parseProposalMetadata` should handle regex variations found across consumers: `\*\*Hash\*\*:\s*#?([^\s]+)` covers both `#hash` and `hash` formats.
- The `walkDir` utility should default extension filter to `.md` since all three current implementations filter for markdown files.

---

## Rollback

No rollback needed — all changes are import path refactors and utility extractions. If any task fails, the local function definitions can be restored by reverting the specific file changes.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-17  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Owner**: Developer  
**Reviewers**: Developer

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-17 | Initial version | Developer |
