# Proposal: Gate 05 Test Suite (RED)

**Hash**: #p05g08testsuite  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Role**: test-suite  
**Requirement**: Testing & Quality (90% coverage)  
**Status**: pending  
**Created**: 2026-02-13

---

## Summary

Defines acceptance criteria for proposals 05–08 as failing tests (RED phase). Tests cover conditional diagram generators, diagram catalogue and selector, gate change detector, architecture MCP tools, and CLI commands — all features that do not exist yet. These test files will fail until the corresponding implementation proposals are applied. **Approve this proposal while tests are RED; that is by design.**

Tests for the already-completed modules (complexity analyzer, rendering base classes, core generators — proposals 01–03) are scoped to the test-cleanup proposal (09) where they will be written GREEN.

---

## Context

### Why This Change

Test-First Gate Pattern retrofit for Gate 05. Proposals 01–03 were completed before this pattern was established. This test-suite covers the remaining pending work (proposals 05–08) so the behavioral contract is defined before implementation begins.

### Dependencies

| Hash             | Type     | Description                                                      |
| ---------------- | -------- | ---------------------------------------------------------------- |
| #p05g01complxcf0 | requires | Types and interfaces used by conditional generators and selector |
| #p05g02rendbase0 | requires | Rendering base classes imported by generators under test         |
| #p05g03corediag0 | requires | Core generator types referenced in selector and catalogue tests  |

_Note: Proposals 05–08 are intentionally NOT listed as dependencies. These tests are written against modules that do not exist yet — that is the RED phase._

---

## Tasks

### Task 1: Test Conditional Diagram Generators

**File(s)**: `tests/generation/conditional-diagram-generators.test.ts`  
**Action**: create

Test each of the five conditional generators: Sequence, Component, Package, Deployment, Network. Verify per-gate scoping: filenames include gate hash and descriptor. Test `generateContent()` produces valid syntax. Verify `CONDITIONAL_GENERATORS` and `ALL_GENERATORS` arrays. Test that deployment and network generators default to DOT rendering.

**Acceptance**:

- [ ] Each generator returns correct type and `'conditional'` category
- [ ] Filenames include gate hash for per-gate scoping
- [ ] Generated content valid for each diagram type
- [ ] Generator arrays contain correct entries

### Task 2: Test Diagram Catalogue and Selector

**File(s)**: `tests/generation/diagram-selector.test.ts`  
**Action**: create

Test `getCatalogue()` returns all 10 entries. Test `getCatalogueByCategory('core')` returns 5 entries. Test `DiagramSelector.selectCoreDiagrams()` returns 5 generator instances. Test `selectConditionalDiagrams()` returns only generators for selected types. Test invalid type rejection. Test `selectAll()` combines core and conditional.

**Acceptance**:

- [ ] Catalogue contains all 10 types with complete metadata
- [ ] Category filtering works correctly
- [ ] Selector instantiates correct generators
- [ ] Invalid types produce descriptive errors

### Task 3: Test Gate Change Detector

**File(s)**: `tests/generation/gate-change-detector.test.ts`  
**Action**: create

Test `detectChanges()` identifies gate additions, removals, and reordering. Test `shouldTriggerArchReview()` returns `true` for structural changes and `false` for no changes. Test with empty gate lists, single gate, and multiple gates with varying sequences.

**Acceptance**:

- [ ] Gate addition detected and categorized
- [ ] Gate removal detected and categorized
- [ ] Gate reordering detected
- [ ] Architecture review trigger logic correct

### Task 4: Test Architecture MCP Tools

**File(s)**: `tests/mcp/architecture-tools.test.ts`  
**Action**: create

Test `architectureHandlers()` factory returns handlers for all four tools. Test `arch_catalogue` handler returns structured catalogue. Test `arch_select` handler validates input and records selections. Test `arch_generate` handler invokes generators and returns results. Test `arch_show` handler reads diagram files. Test error cases: invalid types, missing files.

**Acceptance**:

- [ ] All four handlers returned from factory
- [ ] Catalogue handler returns complete data
- [ ] Select handler validates diagram types
- [ ] Generate handler invokes generation pipeline
- [ ] Show handler reads files correctly
- [ ] Error cases produce appropriate error responses

### Task 5: Test CLI Commands Integration

**File(s)**: `tests/cli/arch-commands.test.ts`  
**Action**: create

Test `zeno arch generate` command invokes registry function. Test `zeno arch show <type>` reads correct file. Test `zeno arch list` outputs catalogue. Test `zeno arch setup-graphviz` prints platform-specific instructions. Test error handling for missing diagrams and invalid types.

**Acceptance**:

- [ ] Generate command delegates to function registry
- [ ] Show command reads and displays diagram content
- [ ] List command displays formatted catalogue
- [ ] Setup command prints platform-correct instructions
- [ ] Errors handled with user-friendly messages

---

## Files Affected

_All files will fail on first run (RED phase — implementation proposals 05–08 not yet applied)._

| File                                                      | Action | Description                                                    |
| --------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `tests/generation/conditional-diagram-generators.test.ts` | create | Conditional generator tests — RED until P05 applied            |
| `tests/generation/diagram-selector.test.ts`               | create | Catalogue and selector tests — RED until P06 applied           |
| `tests/generation/gate-change-detector.test.ts`           | create | Gate change detection tests — RED until P06/07 applied         |
| `tests/mcp/architecture-tools.test.ts`                    | create | Architecture MCP tool handler tests — RED until P06/08 applied |
| `tests/cli/arch-commands.test.ts`                         | create | CLI command integration tests — RED until P08 applied          |

---

## Implementation Notes

- **RED phase by design**: all five test files are expected to fail when this proposal is approved. The apply agent writes the tests but does NOT make them pass — that is the implementation proposals' job.
- Import paths must reference the future module locations (e.g. `../../src/generation/conditional-generators.ts`) even though those files do not exist yet. TypeScript compilation errors are expected and acceptable at this stage.
- Mock `child_process.execFile` for Graphviz tests to avoid requiring `dot` CLI in CI.
- Use the existing Vitest configuration and test patterns from `tests/generation/`.
- Tests for the completed modules (complexity analyzer, rendering, core generators) are scoped to the test-cleanup proposal (09) where they will be written GREEN from the start.

---

## Rollback

**If rejected or failed**: Delete all test files listed in Files Affected. No production code is modified.

---

**Document Version**: 2.1.0  
**Last Updated**: 2026-02-18  
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date       | Summary                                                                                                | Author  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------ | ------- |
| 2.1.0   | 2026-02-18 | Renumbered from P08 to P04 for Test-First ordering; updated cross-refs P04-07 → P05-08                 | Copilot |
| 2.0.0   | 2026-02-18 | Test-First retrofit: repurposed as test-suite (RED) for P04-07; moved P01-03 tests to P09 test-cleanup | Copilot |
| 1.0.0   | 2026-02-13 | Initial version                                                                                        | Copilot |
