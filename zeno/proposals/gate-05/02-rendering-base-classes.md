# Proposal: Rendering Base Classes & Graphviz Integration

**Hash**: #p05g02rendbase0
**Gate**: gate-05 - Architecture & Diagram Generation
**Status**: pending
**Created**: 2026-02-09

---

## Summary

Implements the MermaidRenderer and GraphvizRenderer base classes that all diagram generators inherit from. Includes Graphviz host availability detection with graceful fallback to Mermaid-only mode, inline SVG embedding in markdown with `<details>` collapse for large diagrams, and the `zeno setup graphviz` helper command.

---

## Context

### Why This Change

Technical Decisions 1, 5, and 8 specify a hybrid rendering system where Mermaid handles simple diagrams and Graphviz DOT handles complex ones, with Graphviz as a host-installed dependency. The rendering base classes provide the shared contract that all 10 diagram generators build upon. Without these, no diagram can be generated.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g01complxcfg | requires | Provides ComplexityConfig and shouldUseDot() used by base classes to select rendering backend |

---

## Tasks

### Task 1: Create Diagram Renderer Interfaces

**File(s)**: `src/generation/diagram-renderer.ts`
**Action**: create

Define a `DiagramRenderer` interface with methods: `render(content: string): Promise<string>` (returns rendered output as string), `getFormat(): 'mermaid' | 'svg'`, and `embedInMarkdown(rendered: string, title: string): string` (wraps output for markdown embedding). Define a `DiagramGeneratorBase` abstract class with properties for diagram type, name, and description, plus an abstract `generate(context: DiagramContext)` method. Define `DiagramContext` interface containing project metadata (gates, requirements, existing architecture paths). Follow the interface patterns from `src/generation/dependency-graph.ts`.

**Acceptance**:
- [ ] `DiagramRenderer` interface exported with render, getFormat, and embedInMarkdown methods
- [ ] `DiagramGeneratorBase` abstract class exported with type, name, description properties
- [ ] `DiagramContext` interface exported with gates, requirements, and architecture paths
- [ ] All types use strict TypeScript (no `any`)

---

### Task 2: Implement MermaidRenderer

**File(s)**: `src/generation/mermaid-renderer.ts`
**Action**: create

Implement `MermaidRenderer` class satisfying the `DiagramRenderer` interface. The `render` method returns the input content unchanged (Mermaid is text-based, no transformation needed). The `getFormat` method returns `'mermaid'`. The `embedInMarkdown` method wraps content in a fenced code block with `mermaid` language identifier, preceded by a heading. Follow the existing Mermaid embedding pattern visible in `zeno/architecture/system-overview.md`.

**Acceptance**:
- [ ] `MermaidRenderer` implements `DiagramRenderer`
- [ ] `render` returns content as-is (text passthrough)
- [ ] `embedInMarkdown` produces valid Mermaid-in-markdown format matching existing architecture docs

---

### Task 3: Implement GraphvizRenderer with Host Detection

**File(s)**: `src/generation/graphviz-renderer.ts`
**Action**: create

Implement `GraphvizRenderer` class satisfying the `DiagramRenderer` interface. Constructor checks for `dot` CLI availability using `child_process.execSync('dot -V')` wrapped in try/catch. Store availability as a boolean property `isAvailable`. The `render` method invokes the `graphviz` npm package to convert DOT string to SVG string; if Graphviz is unavailable, throw a descriptive error. The `getFormat` method returns `'svg'`. The `embedInMarkdown` method embeds inline SVG directly in markdown; for SVG content exceeding 10KB, wrap in a `<details><summary>[title]</summary>` block. Export a standalone `checkGraphvizAvailability(): boolean` function for use by CLI commands.

**Acceptance**:
- [ ] `GraphvizRenderer` implements `DiagramRenderer`
- [ ] Constructor detects `dot` CLI availability without throwing
- [ ] `render` converts DOT to SVG via `graphviz` npm package
- [ ] `render` throws descriptive error when Graphviz unavailable
- [ ] `embedInMarkdown` uses inline SVG for small diagrams, `<details>` collapse for > 10KB
- [ ] `checkGraphvizAvailability` exported as standalone function

---

### Task 4: Implement Setup Graphviz Helper Command

**File(s)**: `src/cli/commands/arch.ts`
**Action**: modify

Add a `setup graphviz` subcommand under the existing `arch` command group (or add a top-level `setup` command group with `graphviz` subcommand, matching the gate PRD's `zeno setup graphviz` specification). The command detects the current platform via `process.platform` and prints platform-specific install instructions: `brew install graphviz` for darwin, `sudo apt-get install graphviz` or `sudo dnf install graphviz` for linux, `winget install graphviz` or `choco install graphviz` for win32. Also check current Graphviz availability using `checkGraphvizAvailability` and report status.

**Acceptance**:
- [ ] `zeno setup graphviz` command registered and prints platform-specific install instructions
- [ ] Reports current Graphviz availability status (installed/not installed)
- [ ] Covers darwin, linux, and win32 platforms

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/diagram-renderer.ts` | create | DiagramRenderer interface, DiagramGeneratorBase abstract class, DiagramContext interface |
| `src/generation/mermaid-renderer.ts` | create | MermaidRenderer implementation |
| `src/generation/graphviz-renderer.ts` | create | GraphvizRenderer implementation with host detection |
| `src/cli/commands/arch.ts` | modify | Add setup graphviz helper command |

---

## Implementation Notes

The `graphviz` npm package (already installed) provides Node.js bindings but still requires the host `dot` binary. The availability check at construction time (not per-render) avoids repeated shell invocations. The 10KB threshold for `<details>` collapse is a reasonable default; complex system diagrams with 20+ nodes typically produce SVGs in the 15-30KB range.

---

## Rollback

**If rejected or failed**: Delete `src/generation/diagram-renderer.ts`, `src/generation/mermaid-renderer.ts`, `src/generation/graphviz-renderer.ts`. Revert `src/cli/commands/arch.ts` to stub state.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-09
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-09 | Initial version | Zeno |
