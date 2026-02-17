# Proposal: Comprehensive Test Suite

**Hash**: #p05g08testsuite  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Requirement**: Testing & Quality (90% coverage)  
**Status**: pending  
**Created**: 2026-02-13

---

## Summary

Creates comprehensive unit and integration tests for all Gate 05 modules: complexity analyzer, rendering backends (Mermaid validator, Graphviz renderer), all 10 diagram generators, diagram selector/catalogue, gate change detector, gate template integration, and CLI/MCP tool integration. Targets ≥90% coverage for the diagram generation module.

---

## Single-Phase Requirement

Test files are independent and can be written in parallel. No sequencing required.

---

## Context

### Why This Change

Gate 05 completion criteria require ≥90% test coverage for diagram generation, rendering, and selection modules. All tests are consolidated in this final proposal following the gate-tied convention of deferring tests to a dedicated test proposal.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g01complxcf0 | requires | Complexity analyzer and types to test |
| #p05g02rendbase0 | requires | Rendering base classes and Graphviz integration to test |
| #p05g03corediag0 | requires | Core diagram generators to test |
| #p05g04conddiag0 | requires | Conditional diagram generators to test |
| #p05g05diagselec | requires | Diagram catalogue, selector, and MCP tools to test |
| #p05g06gatetmpl0 | requires | Gate template integration and change detector to test |
| #p05g07cliregint | requires | CLI commands and function registry integration to test |

---

## Tasks

### Task 1: Test Complexity Analyzer

**File(s)**: `tests/generation/complexity-analyzer.test.ts`  
**Action**: create

Test `ComplexityAnalyzer.score()` with various node/edge/nesting combinations. Verify `selectBackend()` returns `'mermaid'` for simple diagrams (≤5 nodes, ≤8 edges) and `'graphviz'` for complex ones. Test custom threshold overrides. Test edge cases: zero nodes, very large counts, fractional multipliers.

**Acceptance**:
- [ ] Score calculation verified for 5+ input combinations
- [ ] Backend selection boundary tested at threshold
- [ ] Custom thresholds override defaults correctly
- [ ] Edge cases handled without errors

### Task 2: Test Diagram Types and Configuration

**File(s)**: `tests/generation/diagram-types.test.ts`  
**Action**: create

Verify `DiagramType` enum contains all 10 types. Verify `DiagramCategory` distinguishes core from conditional. Test `getComplexityThresholds()` returns defaults and merges user config. Test that config schema validates the architecture.complexity section.

**Acceptance**:
- [ ] All 10 diagram types present in enum
- [ ] Category classification correct for each type
- [ ] Config defaults returned when no user config
- [ ] Config merge works for partial overrides

### Task 3: Test Mermaid Renderer

**File(s)**: `tests/generation/mermaid-renderer.test.ts`  
**Action**: create

Test `MermaidRenderer.render()` wraps syntax in correct markdown fences. Test `validateSyntax()` accepts valid `graph`, `sequenceDiagram`, `stateDiagram` syntax. Test validation rejects empty content, missing diagram type keywords. Verify rendered output is embeddable in markdown.

**Acceptance**:
- [ ] Mermaid fences correctly applied
- [ ] Valid diagram types accepted by validator
- [ ] Invalid/empty content rejected with descriptive errors
- [ ] Output format is valid markdown

### Task 4: Test Graphviz Renderer

**File(s)**: `tests/generation/graphviz-renderer.test.ts`  
**Action**: create

Test `GraphvizRenderer.isAvailable()` returns boolean based on `dot` CLI presence (mock `execFile`). Test `renderToSvg()` with valid DOT input produces SVG string (mock CLI invocation). Test `embedInMarkdown()` wraps SVG in `<details>` when exceeding threshold and embeds directly when under threshold. Test error handling when `dot` CLI fails.

**Acceptance**:
- [ ] Availability check mocked for both present/absent cases
- [ ] SVG rendering produces valid output from mocked CLI
- [ ] Collapse threshold correctly determines `<details>` wrapping
- [ ] CLI errors produce descriptive error messages

### Task 5: Test Core Diagram Generators

**File(s)**: `tests/generation/core-diagram-generators.test.ts`  
**Action**: create

Test each of the five core generators: SystemOverview, DataFlow, GateLifecycle, GateRoadmap, Context. Verify `getType()` and `getCategory()` return correct values. Test `generateContent()` produces valid Mermaid or DOT syntax for a sample `DiagramContext`. Verify output markdown structure matches template expectations. Test that `CORE_GENERATORS` array contains all five.

**Acceptance**:
- [ ] Each generator returns correct type and category
- [ ] Generated content contains expected diagram keywords
- [ ] Output follows template structure
- [ ] `CORE_GENERATORS` array verified

### Task 6: Test Conditional Diagram Generators

**File(s)**: `tests/generation/conditional-diagram-generators.test.ts`  
**Action**: create

Test each of the five conditional generators: Sequence, Component, Package, Deployment, Network. Verify per-gate scoping: filenames include gate hash and descriptor. Test `generateContent()` produces valid syntax. Verify `CONDITIONAL_GENERATORS` and `ALL_GENERATORS` arrays. Test that deployment and network generators default to DOT rendering.

**Acceptance**:
- [ ] Each generator returns correct type and `'conditional'` category
- [ ] Filenames include gate hash for per-gate scoping
- [ ] Generated content valid for each diagram type
- [ ] Generator arrays contain correct entries

### Task 7: Test Diagram Catalogue and Selector

**File(s)**: `tests/generation/diagram-selector.test.ts`  
**Action**: create

Test `getCatalogue()` returns all 10 entries. Test `getCatalogueByCategory('core')` returns 5 entries. Test `DiagramSelector.selectCoreDiagrams()` returns 5 generator instances. Test `selectConditionalDiagrams()` returns only generators for selected types. Test invalid type rejection. Test `selectAll()` combines core and conditional.

**Acceptance**:
- [ ] Catalogue contains all 10 types with complete metadata
- [ ] Category filtering works correctly
- [ ] Selector instantiates correct generators
- [ ] Invalid types produce descriptive errors

### Task 8: Test Gate Change Detector

**File(s)**: `tests/generation/gate-change-detector.test.ts`  
**Action**: create

Test `detectChanges()` identifies gate additions, removals, and reordering. Test `shouldTriggerArchReview()` returns `true` for structural changes and `false` for no changes. Test with empty gate lists, single gate, and multiple gates with varying sequences.

**Acceptance**:
- [ ] Gate addition detected and categorized
- [ ] Gate removal detected and categorized
- [ ] Gate reordering detected
- [ ] Architecture review trigger logic correct

### Task 9: Test Architecture MCP Tools

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

### Task 10: Test CLI Commands Integration

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

| File | Action | Description |
|------|--------|-------------|
| `tests/generation/complexity-analyzer.test.ts` | create | Complexity scoring and backend selection tests |
| `tests/generation/diagram-types.test.ts` | create | Type definitions and config integration tests |
| `tests/generation/mermaid-renderer.test.ts` | create | Mermaid rendering and validation tests |
| `tests/generation/graphviz-renderer.test.ts` | create | Graphviz CLI integration and SVG embedding tests |
| `tests/generation/core-diagram-generators.test.ts` | create | Core diagram generator tests (5 types) |
| `tests/generation/conditional-diagram-generators.test.ts` | create | Conditional diagram generator tests (5 types) |
| `tests/generation/diagram-selector.test.ts` | create | Catalogue and selector service tests |
| `tests/generation/gate-change-detector.test.ts` | create | Gate structure change detection tests |
| `tests/mcp/architecture-tools.test.ts` | create | Architecture MCP tool handler tests |
| `tests/cli/arch-commands.test.ts` | create | Architecture CLI command integration tests |

---

## Implementation Notes

- Mock `child_process.execFile` for Graphviz tests to avoid requiring `dot` CLI in CI.
- Use the existing Vitest configuration and test patterns from `tests/generation/`.
- Each test file mirrors the source module it tests for clear traceability.
- Target ≥90% statement coverage across all Gate 05 source files.

---

## Rollback

**If rejected or failed**: Delete all test files listed in Files Affected. No production code is modified.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-13  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-13 | Initial version | Copilot |
