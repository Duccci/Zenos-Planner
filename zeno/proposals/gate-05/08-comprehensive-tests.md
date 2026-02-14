# Proposal: Comprehensive Test Suite

**Hash**: #p05g08testsuite
**Gate**: gate-05 - Architecture & Diagram Generation
**Status**: pending
**Created**: 2026-02-09

---

## Summary

Creates the comprehensive test suite for all Gate 05 modules: complexity analyzer, renderers, diagram generators, diagram selector, metadata scanner, change detector, gate template integration, and CLI commands. Targets 90% coverage for the diagram generation and selection modules as required by the gate completion criteria.

---

## Context

### Why This Change

Gate 05 completion criteria require test coverage >= 90% for diagram generation and selection modules, all tests passing with TypeScript strict mode, and zero lint/type errors. This is the gate's dedicated test proposal per the proposal template's test scoping rules for gate-tied proposals.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g01complxcf0 | requires | Complexity analyzer module to test |
| #p05g02rendbase0 | requires | Renderers and base classes to test |
| #p05g03corediag0 | requires | Core diagram generators to test |
| #p05g04conddiag0 | requires | Conditional diagram generators to test |
| #p05g05selctmet0 | requires | Diagram selector and metadata scanner to test |
| #p05g06gatetmpl0 | requires | Gate template integration to test |
| #p05g07cliregint | requires | CLI commands and registry integration to test |

---

## Tasks

### Task 1: Complexity Analyzer Unit Tests

**File(s)**: `tests/generation/complexity-analyzer.test.ts`
**Action**: create

Write unit tests for `ComplexityAnalyzer`: test `countElements` with various node/edge combinations, test `calculateEffectiveThreshold` with nesting depths at/above/below 2 (boundary cases), test `shouldUseDot` with element counts at/above/below threshold, test `shouldUseDot` with nesting depth exceeding `maxMermaidDepth`. Test config defaults from `ZenoConfigSchema`. Use Vitest with `describe`/`it` blocks following the existing test patterns in `tests/generation/`.

**Acceptance**:
- [ ] Tests cover countElements with edge cases (0 nodes, 0 edges, large values)
- [ ] Tests cover calculateEffectiveThreshold boundary conditions (depth=2 no penalty, depth>2 penalty applied, floor at 1)
- [ ] Tests cover shouldUseDot threshold logic and maxMermaidDepth override
- [ ] Tests cover config schema defaults and validation

---

### Task 2: Renderer Unit Tests

**File(s)**: `tests/generation/renderers.test.ts`
**Action**: create

Write unit tests for `MermaidRenderer` and `GraphvizRenderer`. For MermaidRenderer: test `render` returns input unchanged, test `embedInMarkdown` produces valid fenced code block. For GraphvizRenderer: test `checkGraphvizAvailability` function, test `render` with valid DOT input (mock `graphviz` package if Graphviz not installed on CI), test `render` throws when unavailable, test `embedInMarkdown` uses inline SVG for small content and `<details>` collapse for content > 10KB. Mock `child_process.execSync` for availability detection tests.

**Acceptance**:
- [ ] MermaidRenderer render and embedInMarkdown tested
- [ ] GraphvizRenderer availability detection tested with mocks
- [ ] GraphvizRenderer SVG rendering tested (mocked if needed)
- [ ] Inline SVG vs. details collapse threshold tested

---

### Task 3: Diagram Generator Unit Tests

**File(s)**: `tests/generation/diagram-generators.test.ts`
**Action**: create

Write unit tests for all 10 diagram generators (5 core + 5 conditional). For each generator: test that it loads the correct template, test that it accepts the required parameters (gate ID for conditional generators), test that it produces output matching expected structure, test that it calls complexity analyzer for rendering backend selection. Use mock `DiagramContext` objects. Test the barrel exports from `src/generation/diagrams/index.ts` (CORE_DIAGRAM_GENERATORS, CONDITIONAL_DIAGRAM_GENERATORS, ALL_DIAGRAM_GENERATORS arrays).

**Acceptance**:
- [ ] All 10 generators have at least 2 test cases each (happy path, error case)
- [ ] Template loading verified for each generator
- [ ] Generator output structure validated
- [ ] Index barrel exports verified

---

### Task 4: Diagram Selector and Metadata Scanner Tests

**File(s)**: `tests/generation/diagram-selection.test.ts`
**Action**: create

Write unit tests for `DiagramSelector`: test that core diagrams always selected, test gate-level selection triggered by complexity threshold, test infrastructure selection triggered by keyword detection (deploy, network, infrastructure, container, kubernetes, cloud), test project type parameter passthrough. Write unit tests for `ArchitectureMetadataScanner`: test scanning empty directory, test scanning directory with mixed diagram types, test filename parsing for diagram type and gate hash extraction, test handling of non-diagram files in the directory.

**Acceptance**:
- [ ] DiagramSelector always includes core diagrams
- [ ] Conditional diagram triggering tested at threshold boundaries
- [ ] Infrastructure keyword detection tested
- [ ] Metadata scanner tested with empty directory, populated directory, and edge cases

---

### Task 5: Architecture Change Detector Tests

**File(s)**: `tests/generation/architecture-change-detector.test.ts`
**Action**: create

Write unit tests for `ArchitectureChangeDetector`: test detection of new gates without diagrams, test detection of orphaned diagrams for removed gates, test `needsReview` flag logic, test with unchanged architecture (no review needed). Use mock gate lists and architecture indexes.

**Acceptance**:
- [ ] New gate detection tested
- [ ] Orphaned diagram detection tested
- [ ] needsReview flag correctly set for changes and unset for no changes
- [ ] Change description array populated with meaningful messages

---

### Task 6: Gate Template Integration Tests

**File(s)**: `tests/generation/gate-template-integration.test.ts`
**Action**: create

Write unit tests for gate template diagram metadata generation: test that new gate PRDs include Architecture Diagrams table, test that core diagrams always present, test conditional diagram inclusion based on DiagramSelector, test ordering reflects dependency relationships, test `GateDiagramEntry` and `GateDiagramPlan` type usage. Test with mock proposal writer context.

**Acceptance**:
- [ ] Gate PRD generation includes Architecture Diagrams table
- [ ] Core diagram entries always present
- [ ] Ordering reflects topological sort of dependencies
- [ ] Type contracts validated

---

### Task 7: CLI Command Integration Tests

**File(s)**: `tests/cli/commands/arch.test.ts`
**Action**: create

Write integration tests for `zeno arch generate` and `zeno arch show` commands. Test generate command with mock generators and verify output files created. Test show command with existing architecture directory and verify correct file displayed. Test show command with missing type and verify available types listed. Test `--gate` and `--type` flags. Test setup graphviz helper command output for current platform. Mock file system operations to avoid actual file writes in tests.

**Acceptance**:
- [ ] arch generate command tested with mock pipeline
- [ ] arch show command tested with existing and missing diagram types
- [ ] --gate and --type flags tested
- [ ] setup graphviz platform detection tested
- [ ] Schema registry in-process functions tested

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `tests/generation/complexity-analyzer.test.ts` | create | Complexity analyzer unit tests |
| `tests/generation/renderers.test.ts` | create | MermaidRenderer and GraphvizRenderer unit tests |
| `tests/generation/diagram-generators.test.ts` | create | All 10 diagram generator unit tests |
| `tests/generation/diagram-selection.test.ts` | create | DiagramSelector and ArchitectureMetadataScanner tests |
| `tests/generation/architecture-change-detector.test.ts` | create | Change detection unit tests |
| `tests/generation/gate-template-integration.test.ts` | create | Gate template diagram metadata tests |
| `tests/cli/commands/arch.test.ts` | create | CLI command integration tests |

---

## Implementation Notes

Tests should use Vitest `vi.mock()` for file system operations and external dependencies (Graphviz). The existing test patterns in `tests/generation/` use `describe`/`it` blocks with `expect` assertions. For Graphviz rendering tests, mock the `graphviz` npm package to return a predictable SVG string. Coverage should be measured per-module; the 90% target applies to files in `src/generation/` and `src/cli/commands/arch.ts`. Run coverage with `vitest --coverage` and verify thresholds.

---

## Rollback

**If rejected or failed**: Delete all created test files. No production code is modified by this proposal.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-09
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-09 | Initial version | Zeno |
