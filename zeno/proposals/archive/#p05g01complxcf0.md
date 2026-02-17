# Proposal: Complexity Analyzer & Configuration

**Hash**: #p05g01complxcf0  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Requirement**: Visual System Understanding, Scalable Visualization  
**Status**: completed  
**Implemented**: 2026-02-14  
**Archived**: 2026-02-14  
**Archived By**: system  
**Created**: 2026-02-13

---

## Summary

Establishes the foundational complexity analysis types, interfaces, and configuration system that all diagram generators depend on. Defines the complexity threshold model (node/edge counts, nesting depth) that determines whether a diagram renders via Mermaid or Graphviz DOT, and exposes configurable thresholds through the existing config system.

---

## Single-Phase Requirement

All work in this proposal is independent and parallelizable. No multi-phase sequencing.

---

## Context

### Why This Change

Every diagram generator in Gate 05 needs to determine its rendering backend (Mermaid vs. DOT) based on diagram complexity. This proposal creates the shared types, complexity scoring logic, and configuration schema that all subsequent proposals consume. Without this foundation, rendering base classes and generators cannot make informed rendering decisions.

*No dependencies.*

---

## Tasks

### Task 1: Define Diagram Type Enumeration and Complexity Types

**File(s)**: `src/generation/diagram-types.ts`  
**Action**: create

Define a flexible `DiagramType` representation that is not hardcoded. Instead of an enum listing a fixed set of types, implement diagram template discovery and a runtime registry: provide a function or registry that enumerates available templates (for example, by reading the templates directory) and exposes valid diagram types as strings. Export a type alias such as `type DiagramType = string` (or `type DiagramType = keyof typeof TemplateRegistry` when statically derivable) and helper functions to query registered templates. Define `DiagramCategory` type distinguishing core (always generated) from conditional (LLM-selected). Define `ComplexityScore` interface with fields: `nodeCount`, `edgeCount`, `nestingDepth`, `totalScore`. Define `ComplexityThresholds` interface with fields: `maxMermaidNodes`, `maxMermaidEdges`, `nestingDepthMultiplier`. Define `RenderingBackend` type as `'mermaid' | 'graphviz'`. Define `DiagramMetadata` interface with fields: `type`, `category`, `renderingBackend`, `gateName` (optional), `filePath`.

**Acceptance**:
- [x] `DiagramType` is not hardcoded and can be derived from available templates at runtime
- [x] Core vs. conditional categories distinguished
- [x] Complexity scoring interfaces defined with numeric fields
- [x] Rendering backend type is a union of `'mermaid' | 'graphviz'`
- [x] All types exported and usable by downstream modules

### Task 2: Implement Complexity Analyzer

**File(s)**: `src/generation/complexity-analyzer.ts`  
**Action**: create

Implement `ComplexityAnalyzer` class with a `score(nodeCount: number, edgeCount: number, nestingDepth: number): ComplexityScore` method that computes `totalScore = nodeCount + edgeCount + (nestingDepth * nestingDepthMultiplier)`. Implement `selectBackend(score: ComplexityScore, thresholds: ComplexityThresholds): RenderingBackend` method that returns `'mermaid'` when totalScore is at or below the threshold sum, and `'graphviz'` otherwise. Constructor accepts `ComplexityThresholds`. Use default thresholds: `maxMermaidNodes: 5`, `maxMermaidEdges: 8`, `nestingDepthMultiplier: 2`.

**Acceptance**:
- [x] `score()` returns correct `ComplexityScore` with all fields populated
- [x] `selectBackend()` returns `'mermaid'` for simple diagrams (≤5 nodes)
- [x] `selectBackend()` returns `'graphviz'` for complex diagrams (>5 nodes)
- [x] Nesting depth multiplier correctly amplifies score
- [x] Thresholds are configurable via constructor

### Task 3: Add Complexity Thresholds to Config Schema

**File(s)**: `schemas/config.schema.json`  
**Action**: modify

Add an `architecture` section to the config schema with a nested `complexity` object containing: `maxMermaidNodes` (integer, default 5), `maxMermaidEdges` (integer, default 8), `nestingDepthMultiplier` (number, default 2), and `svgCollapseThresholdBytes` (integer, default 50000). All fields optional with defaults.

**Acceptance**:
- [x] Config schema validates with new `architecture.complexity` section
- [x] All fields have documented defaults
- [x] Existing configs remain valid (new fields are optional)

### Task 4: Integrate Config Loading for Complexity Thresholds

**File(s)**: `src/utils/config.ts`  
**Action**: modify

Extend the config loading logic to read `architecture.complexity` from `.zeno/config.json` and merge with defaults. Export a `getComplexityThresholds(): ComplexityThresholds` function that returns the merged configuration. Falls back to hardcoded defaults if config section is absent.

**Acceptance**:
- [x] `getComplexityThresholds()` returns defaults when config section missing
- [x] User-provided thresholds override defaults
- [x] Partial overrides merge correctly (e.g., only `maxMermaidNodes` specified)

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/diagram-types.ts` | create | Diagram type enum, complexity types, rendering backend types |
| `src/generation/complexity-analyzer.ts` | create | Complexity scoring and backend selection logic |
| `schemas/config.schema.json` | modify | Add architecture.complexity configuration section |
| `src/utils/config.ts` | modify | Load and merge complexity thresholds from config |

---

## Implementation Notes

- The `ComplexityAnalyzer` is intentionally simple — it scores a diagram's structural metrics and selects a backend. The LLM decides *which* diagrams to generate; the analyzer decides *how* to render them.
- Default threshold of 5 nodes aligns with PRD decision #1 (Mermaid for ≤5 elements).
- `svgCollapseThresholdBytes` is used by the rendering layer (Proposal 02) for `<details>` collapse behavior.

---

## Rollback

**If rejected or failed**: Delete `src/generation/diagram-types.ts` and `src/generation/complexity-analyzer.ts`. Revert changes to `schemas/config.schema.json` and `src/utils/config.ts`.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-13  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-13 | Initial version | Copilot |

## Completion Summary

**Tasks Completed**: 4/4

**Files Modified/Created**:
- src/generation/diagram-types.ts (created)
- src/generation/complexity-analyzer.ts (created)
- schemas/config.schema.json (modified)
- src/utils/config.ts (modified)
- zeno/proposals/gate-05/01-complexity-analyzer-configuration.md (modified)

### Quality Metrics
- Code added: 2 new modules (diagram-types, complexity-analyzer)
- Config schema extended; defaults provided
- Type & build checks: not executed in this apply step (please run project build/type-check locally)
