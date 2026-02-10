# Proposal: CLI Commands & Function Registry Integration

**Hash**: #p05g07cliregint
**Gate**: gate-05 - Architecture & Diagram Generation
**Status**: pending
**Created**: 2026-02-09

---

## Summary

Replaces the stub implementations of `zeno arch generate` and `zeno arch show` with working commands that orchestrate LLM-driven diagram generation via MCP. Updates the function registry and schema registry to use in-process implementations instead of CLI command delegation. Wires the full pipeline: CLI command invokes DiagramSelector, orchestrates generators, writes output to `zeno/architecture/`, and updates metadata.

---

## Context

### Why This Change

The CLI commands `arch generate` and `arch show` exist as stubs (logging "Not yet implemented") in `src/cli/commands/arch.ts`. The function registry entries `arch_generate` and `arch_show` in `src/integration/schema-registry.ts` delegate to these stubs via `invokeCommand`. This proposal replaces both with working implementations that connect the selector, generators, renderers, and metadata scanner into a complete pipeline.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g02rendbase0 | requires | Provides renderers and base classes used by the generation pipeline |
| #p05g03corediag0 | requires | Provides core diagram generators invoked by arch generate |
| #p05g04conddiag0 | requires | Provides conditional diagram generators invoked by arch generate |
| #p05g05selctmeta | requires | Provides DiagramSelector and ArchitectureMetadataScanner orchestrated by commands |
| #p05g06gatetmpl0 | requires | Provides gate diagram metadata used to determine which diagrams to generate |

---

## Tasks

### Task 1: Implement arch generate Command

**File(s)**: `src/cli/commands/arch.ts`
**Action**: modify

Replace the stub `generate` action with a working implementation. The command should: (1) check Graphviz availability and log a warning if unavailable, (2) load project configuration including complexity thresholds, (3) instantiate DiagramSelector and select applicable diagrams, (4) invoke each selected generator, (5) write output to `zeno/architecture/`, (6) run ArchitectureChangeDetector and report if architecture review is needed, (7) display a summary of generated diagrams with their rendering backends. Accept optional `--gate <id>` flag to generate diagrams for a specific gate only. Accept optional `--type <type>` flag to regenerate a single diagram type.

**Acceptance**:
- [ ] `zeno arch generate` invokes DiagramSelector and runs applicable generators
- [ ] Graphviz availability warning displayed when not installed
- [ ] Generated diagrams written to `zeno/architecture/`
- [ ] Summary of generated diagrams displayed after completion
- [ ] `--gate` flag scopes generation to a specific gate
- [ ] `--type` flag regenerates a single diagram type

---

### Task 2: Implement arch show Command

**File(s)**: `src/cli/commands/arch.ts`
**Action**: modify

Replace the stub `show` action with a working implementation. The command should: (1) run ArchitectureMetadataScanner to get the current index, (2) find the requested diagram type in the index, (3) read and display the diagram file content. If the type is not found, list available types from the index. Accept the diagram type as a positional argument matching the existing command signature `show <type>`.

**Acceptance**:
- [ ] `zeno arch show <type>` reads and displays the requested diagram
- [ ] Lists available diagram types when requested type not found
- [ ] Uses ArchitectureMetadataScanner for diagram discovery

---

### Task 3: Update Schema Registry to In-Process Implementations

**File(s)**: `src/integration/schema-registry.ts`
**Action**: modify

Replace the `arch_generate` and `arch_show` function implementations from CLI command delegation (`invokeCommand`) to in-process function calls. `arch_generate` should directly instantiate DiagramSelector, run generators, and return a structured result with generated diagram metadata. `arch_show` should directly call ArchitectureMetadataScanner and return diagram content. Follow the same pattern as other in-process registry functions (e.g., the gates registry functions that query the database directly).

**Acceptance**:
- [ ] `arch_generate` uses in-process implementation (no `invokeCommand`)
- [ ] `arch_show` uses in-process implementation (no `invokeCommand`)
- [ ] Both return structured `FunctionResult` objects
- [ ] Error handling follows existing registry patterns

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/cli/commands/arch.ts` | modify | Replace stub commands with working implementations |
| `src/integration/schema-registry.ts` | modify | Replace CLI delegation with in-process architecture functions |

---

## Implementation Notes

The `arch generate` command is the primary entry point for LLM-driven generation. When invoked via MCP, the LLM calls `arch_generate` which runs the selector and generators in-process. When invoked via CLI, the same logic runs through the command handler. Both paths converge on the same DiagramSelector and generator pipeline. The `--gate` and `--type` flags provide surgical control for regenerating specific diagrams without running the full pipeline.

---

## Rollback

**If rejected or failed**: Revert `src/cli/commands/arch.ts` and `src/integration/schema-registry.ts` to their previous stub implementations.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-09
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-09 | Initial version | Zeno |
