# Proposal: Complexity Analyzer & Configuration

**Hash**: #p05g01complxcf0
**Gate**: gate-05 - Architecture & Diagram Generation
**Status**: pending
**Created**: 2026-02-09

---

## Summary

Implements the configurable complexity threshold system that determines whether diagrams render via Mermaid or Graphviz DOT. Introduces element counting (nodes + edges), nesting depth analysis, and project-level configuration for threshold overrides. This is the foundational decision layer that all diagram generators depend on.

---

## Context

### Why This Change

Gate 05 Technical Decision 6 specifies configurable complexity thresholds where element count (nodes + edges) and nesting depth determine the rendering backend. All diagram generators need this analysis before they can select a rendering path. Without this foundation, no diagram generator can make informed Mermaid vs. DOT decisions.

### Dependencies

*No dependencies.*

---

## Tasks

### Task 1: Define Complexity Configuration Schema

**File(s)**: `src/utils/config.ts`
**Action**: modify

Extend `ZenoConfigSchema` with a `complexity` section containing three fields: `elementThreshold` (default 5), `depthPenalty` (default 1), and `maxMermaidDepth` (default 3). Use the existing Zod schema pattern with `.default()` values. The schema must be backward-compatible with existing config files (use `.optional()` with defaults so existing configs without the section still validate).

**Acceptance**:
- [ ] `ZenoConfigSchema` includes `complexity` object with three numeric fields
- [ ] Defaults match Technical Decision 6: elementThreshold=5, depthPenalty=1, maxMermaidDepth=3
- [ ] Existing config files without `complexity` section still validate successfully

---

### Task 2: Create Complexity Analyzer Module

**File(s)**: `src/generation/complexity-analyzer.ts`
**Action**: create

Create a module exporting a `ComplexityAnalyzer` class with three methods: `countElements(nodes: number, edges: number): number` returning the sum, `calculateEffectiveThreshold(configuredThreshold: number, nestingDepth: number, depthPenalty: number): number` applying the formula from Technical Decision 6, and `shouldUseDot(elementCount: number, nestingDepth: number, config: ComplexityConfig): boolean` that returns true when element count exceeds effective threshold or nesting depth exceeds `maxMermaidDepth`. Define a `ComplexityConfig` interface matching the Zod schema fields. Follow the functional pattern used in `src/generation/dependency-graph.ts`.

**Acceptance**:
- [ ] `countElements` returns nodes + edges
- [ ] `calculateEffectiveThreshold` applies formula: `configuredThreshold - (nestingDepth - 2) * depthPenalty` (minimum 1)
- [ ] `shouldUseDot` returns true when element count exceeds effective threshold
- [ ] `shouldUseDot` returns true when nesting depth exceeds `maxMermaidDepth` regardless of element count
- [ ] `ComplexityConfig` interface exported for use by other modules

---

### Task 3: Create Complexity Types

**File(s)**: `src/generation/types.ts`
**Action**: modify

Add `DiagramComplexityResult` interface with fields: `elementCount` (number), `nodeCount` (number), `edgeCount` (number), `nestingDepth` (number), `effectiveThreshold` (number), `renderBackend` ('mermaid' | 'dot'). Add `ComplexityConfig` type re-export if needed for cross-module usage. Follow the existing pattern of type definitions in this file.

**Acceptance**:
- [ ] `DiagramComplexityResult` interface exported with all specified fields
- [ ] `renderBackend` field uses string literal union type ('mermaid' | 'dot')
- [ ] Types are consistent with existing patterns in the file

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/utils/config.ts` | modify | Add complexity threshold configuration to ZenoConfigSchema |
| `src/generation/complexity-analyzer.ts` | create | Complexity analysis module with threshold calculation |
| `src/generation/types.ts` | modify | Add DiagramComplexityResult and related types |

---

## Implementation Notes

The effective threshold formula ensures deeply nested graphs (depth > 2) trigger DOT rendering at lower element counts. The floor of 1 prevents negative thresholds. The `maxMermaidDepth` acts as an absolute ceiling independent of element count, catching cases where a graph has few elements but renders poorly in Mermaid due to deep nesting.

---

## Rollback

**If rejected or failed**: Delete `src/generation/complexity-analyzer.ts`, revert additions to `src/utils/config.ts` and `src/generation/types.ts`. No other modules depend on these changes yet.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-09
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-09 | Initial version | Zeno |
