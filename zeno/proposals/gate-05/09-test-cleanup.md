# Proposal: Gate 05 Test Cleanup & Full Coverage

**Hash**: #p05g09testclean  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Role**: test-cleanup  
**Requirement**: Testing & Quality (90% coverage)  
**Status**: pending  
**Created**: 2026-02-18

---

## Summary

Comprehensive test suite covering all Gate 05 modules: complexity analyzer, rendering backends, all 10 diagram generators, diagram selector/catalogue, gate change detector, gate template integration, and CLI/MCP tools. All tests must pass GREEN. Refines the test-suite proposal (04) tests for conditional generators and integration points, and adds coverage for the already-completed modules (01–03) not included in the test-suite. Targets ≥90% statement coverage across the entire `src/generation/` and `src/mcp/` (architecture tools) surface.

---

## Context

### Why This Change

Final quality gate for Gate 05. All implementation proposals (01–03, 05–08) have been applied. This proposal refines the RED tests from proposal 04 (they should now pass), fills coverage gaps for proposals 01–03, improves fixture quality, removes brittle tests discovered during implementation, and adds edge cases surfaced by the implementation work.

### Dependencies

| Hash             | Type     | Description                                        |
| ---------------- | -------- | -------------------------------------------------- |
| #p05g01complxcf0 | requires | Complexity analyzer and types                      |
| #p05g02rendbase0 | requires | Rendering base classes and Graphviz integration    |
| #p05g03corediag0 | requires | Core diagram generators                            |
| #p05g04conddiag0 | requires | Conditional diagram generators                     |
| #p05g05diagselec | requires | Diagram catalogue, selector, and MCP tools         |
| #p05g06gatetmpl0 | requires | Gate template integration and change detector      |
| #p05g07cliregint | requires | CLI commands and function registry integration     |
| #p05g08testsuite | requires | Test-suite (RED) — all RED tests must now be GREEN |

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
- [ ] All tests pass GREEN

### Task 2: Test Diagram Types and Configuration

**File(s)**: `tests/generation/diagram-types.test.ts`  
**Action**: create

Verify `DiagramType` representation covers all registered templates. Verify `DiagramCategory` distinguishes core from conditional. Test `getComplexityThresholds()` returns defaults and merges user config. Test that config schema validates the architecture.complexity section.

**Acceptance**:

- [ ] All registered diagram types accessible
- [ ] Category classification correct for each type
- [ ] Config defaults returned when no user config
- [ ] Config merge works for partial overrides
- [ ] All tests pass GREEN

### Task 3: Test Mermaid Renderer

**File(s)**: `tests/generation/mermaid-renderer.test.ts`  
**Action**: create

Test `MermaidRenderer.render()` wraps syntax in correct markdown fences. Test `validateSyntax()` accepts valid `graph`, `sequenceDiagram`, `stateDiagram` syntax. Test validation rejects empty content and missing diagram type keywords. Verify rendered output is embeddable in markdown.

**Acceptance**:

- [ ] Mermaid fences correctly applied
- [ ] Valid diagram types accepted by validator
- [ ] Invalid/empty content rejected with descriptive errors
- [ ] Output format is valid markdown
- [ ] All tests pass GREEN

### Task 4: Test Graphviz Renderer

**File(s)**: `tests/generation/graphviz-renderer.test.ts`  
**Action**: create

Test `GraphvizRenderer.isAvailable()` returns boolean based on `dot` CLI presence (mock `execFile`). Test `renderToSvg()` with valid DOT input produces SVG string (mock CLI invocation). Test `embedInMarkdown()` wraps SVG in `<details>` when exceeding threshold and embeds directly when under. Test error handling when `dot` CLI fails.

**Acceptance**:

- [ ] Availability check mocked for both present/absent cases
- [ ] SVG rendering produces valid output from mocked CLI
- [ ] Collapse threshold correctly determines `<details>` wrapping
- [ ] CLI errors produce descriptive error messages
- [ ] All tests pass GREEN

### Task 5: Test Core Diagram Generators

**File(s)**: `tests/generation/core-diagram-generators.test.ts`  
**Action**: create

Test each of the five core generators: SystemOverview, DataFlow, GateLifecycle, GateRoadmap, Context. Verify `getType()` and `getCategory()` return correct values. Test `generateContent()` produces valid Mermaid or DOT syntax for a sample `DiagramContext`. Verify output markdown structure matches template expectations. Test that `CORE_GENERATORS` array contains all five.

**Acceptance**:

- [ ] Each generator returns correct type and category
- [ ] Generated content contains expected diagram keywords
- [ ] Output follows template structure
- [ ] `CORE_GENERATORS` array verified
- [ ] All tests pass GREEN

### Task 6: Refine Conditional Diagram Generator Tests

**File(s)**: `tests/generation/conditional-diagram-generators.test.ts`  
**Action**: update

Refine the RED tests from proposal 04. Fix any brittle assertions, improve fixtures, add edge cases discovered during implementation of proposal 05. Ensure all five generators (Sequence, Component, Package, Deployment, Network) are fully covered including error states.

**Acceptance**:

- [ ] Each generator returns correct type and `'conditional'` category
- [ ] Filenames include gate hash for per-gate scoping
- [ ] Generated content valid for each diagram type
- [ ] Generator arrays contain correct entries
- [ ] All edge cases covered
- [ ] All tests pass GREEN

### Task 7: Refine Diagram Catalogue and Selector Tests

**File(s)**: `tests/generation/diagram-selector.test.ts`  
**Action**: update

Refine the RED tests from proposal 04. Fix any brittle assertions discovered during implementation of proposal 06. Add tests for edge cases: empty selections, duplicate type requests, unknown type rejections.

**Acceptance**:

- [ ] Catalogue contains all 10 types with complete metadata
- [ ] Category filtering works correctly
- [ ] Selector instantiates correct generators
- [ ] Invalid types produce descriptive errors
- [ ] All edge cases covered
- [ ] All tests pass GREEN

### Task 8: Refine Gate Change Detector Tests

**File(s)**: `tests/generation/gate-change-detector.test.ts`  
**Action**: update

Refine the RED tests from proposal 04. Validate actual `detectChanges()` and `shouldTriggerArchReview()` signatures match implementation from proposals 06/07. Add coverage for boundary conditions surfaced during implementation.

**Acceptance**:

- [ ] Gate addition detected and categorized
- [ ] Gate removal detected and categorized
- [ ] Gate reordering detected
- [ ] Architecture review trigger logic correct
- [ ] All tests pass GREEN

### Task 9: Refine Architecture MCP Tool Tests

**File(s)**: `tests/mcp/architecture-tools.test.ts`  
**Action**: update

Refine the RED tests from proposal 04. Align mock expectations with actual handler implementations from proposals 06 and 08. Add coverage for the `arch_generate` pipeline integration and `arch_show` file-reading path including missing-file error handling.

**Acceptance**:

- [ ] All four handlers returned from factory
- [ ] Catalogue handler returns complete structured data
- [ ] Select handler validates diagram types correctly
- [ ] Generate handler invokes generation pipeline end-to-end
- [ ] Show handler reads files and handles missing-file errors
- [ ] All tests pass GREEN

### Task 10: Refine CLI Command Integration Tests

**File(s)**: `tests/cli/arch-commands.test.ts`  
**Action**: update

Refine the RED tests from proposal 04. Align test expectations with actual `zeno arch` command implementations from proposal 08. Add coverage for `zeno arch list` and `zeno setup graphviz` platform detection.

**Acceptance**:

- [ ] Generate command delegates to function registry
- [ ] Show command reads and displays diagram content
- [ ] List command displays formatted catalogue
- [ ] Setup command prints platform-correct instructions
- [ ] Errors handled with user-friendly messages
- [ ] All tests pass GREEN

---

## Files Affected

| File                                                      | Action | Description                                                           |
| --------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `tests/generation/complexity-analyzer.test.ts`            | create | Complexity scoring and backend selection tests (new — P01 coverage)   |
| `tests/generation/diagram-types.test.ts`                  | create | Type definitions and config integration tests (new — P01 coverage)    |
| `tests/generation/mermaid-renderer.test.ts`               | create | Mermaid rendering and validation tests (new — P02 coverage)           |
| `tests/generation/graphviz-renderer.test.ts`              | create | Graphviz CLI integration and SVG embedding tests (new — P02 coverage) |
| `tests/generation/core-diagram-generators.test.ts`        | create | Core diagram generator tests (new — P03 coverage)                     |
| `tests/generation/conditional-diagram-generators.test.ts` | update | Refined from P04 test-suite; all RED tests made GREEN                 |
| `tests/generation/diagram-selector.test.ts`               | update | Refined from P04 test-suite; all RED tests made GREEN                 |
| `tests/generation/gate-change-detector.test.ts`           | update | Refined from P04 test-suite; all RED tests made GREEN                 |
| `tests/mcp/architecture-tools.test.ts`                    | update | Refined from P04 test-suite; all RED tests made GREEN                 |
| `tests/cli/arch-commands.test.ts`                         | update | Refined from P04 test-suite; all RED tests made GREEN                 |

---

## Implementation Notes

- Mock `child_process.execFile` for Graphviz tests to avoid requiring `dot` CLI in CI.
- Use the existing Vitest configuration and test patterns from `tests/generation/`.
- Each test file mirrors the source module it tests for clear traceability.
- Target ≥90% statement coverage across all Gate 05 source files.
- Run `npm test -- --coverage` and verify coverage report before marking complete.
- **All 10 test files must pass GREEN. Zero failures permitted before approving this proposal.**

---

## Rollback

**If rejected or failed**: Revert all test file changes to the RED state from proposal 04. No production code is modified.

---

**Document Version**: 1.1.0  
**Last Updated**: 2026-02-18  
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date       | Summary                                                                    | Author  |
| ------- | ---------- | -------------------------------------------------------------------------- | ------- |
| 1.1.0   | 2026-02-18 | Updated cross-refs: old P08→P04, old P04-07→P05-08 for Test-First ordering | Copilot |
| 1.0.0   | 2026-02-18 | Initial version — test-cleanup for Gate 05 Test-First retrofit             | Copilot |
