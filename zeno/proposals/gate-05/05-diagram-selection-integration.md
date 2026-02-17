# Proposal: Diagram Selection Logic & Integration

**Hash**: #p05g05diagselec  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Requirement**: Smart Diagram Selection, LLM-Accessible Architecture  
**Status**: pending  
**Created**: 2026-02-13

---

## Summary

Implements the diagram selection system that exposes a diagram type catalogue via MCP tools, enabling the LLM to select which additional diagrams to generate per-gate. Builds the `DiagramSelector` service that coordinates generator instantiation based on LLM selections, and exposes MCP tools for diagram type listing and selection.

---

## Single-Phase Requirement

All work in this proposal is independent and parallelizable. No multi-phase sequencing.

---

## Context

### Why This Change

Gate 05 uses LLM-driven diagram selection instead of algorithmic complexity detection. The LLM needs MCP tools to: (1) discover available diagram types with descriptions of when each is useful, (2) select which additional diagrams to generate for a gate, and (3) request explicit diagram type generation. This proposal creates the service layer and MCP tool integration that makes this workflow possible.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g01complxcf0 | requires | Diagram type enum and category definitions |
| #p05g03corediag0 | requires | Core diagram generators that are always instantiated |
| #p05g04conddiag0 | requires | Conditional diagram generators instantiated on LLM selection |

---

## Tasks

### Task 1: Implement Diagram Type Catalogue

**File(s)**: `src/generation/diagram-catalogue.ts`  
**Action**: create

Define a `DIAGRAM_CATALOGUE` constant: an array of objects, one per `DiagramType`, each containing: `type` (DiagramType enum value), `category` ('core' | 'conditional'), `name` (human-readable name), `description` (1-2 sentence purpose), `whenUseful` (guidance for when the LLM should select this type), `templatePath` (path to architecture template). Core diagrams are marked as `alwaysGenerated: true`. Conditional diagrams have `alwaysGenerated: false`. Export a `getCatalogue()` function returning the full catalogue, and `getCatalogueByCategory(category)` for filtered retrieval.

**Acceptance**:
- [ ] All 10 diagram types represented in catalogue
- [ ] Each entry has type, category, name, description, whenUseful, templatePath
- [ ] Core diagrams marked `alwaysGenerated: true`
- [ ] Conditional diagrams marked `alwaysGenerated: false`
- [ ] `getCatalogue()` and `getCatalogueByCategory()` return correct subsets

### Task 2: Implement DiagramSelector Service

**File(s)**: `src/generation/diagram-selector.ts`  
**Action**: create

Implement `DiagramSelector` class with: `selectCoreDiagrams(): DiagramGeneratorBase[]` that returns instances of all five core generators. `selectConditionalDiagrams(selectedTypes: DiagramType[], gateHash: string, descriptors?: Record<DiagramType, string>): DiagramGeneratorBase[]` that instantiates only the conditional generators for the types the LLM selected, passing gate hash and descriptors for filename scoping. `selectAll(selectedTypes: DiagramType[], gateHash: string): DiagramGeneratorBase[]` that combines core + conditional selections. Constructor accepts `ComplexityThresholds` for passing to generators.

**Acceptance**:
- [ ] `selectCoreDiagrams()` returns exactly 5 core generator instances
- [ ] `selectConditionalDiagrams()` returns only generators for selected types
- [ ] Invalid diagram types rejected with descriptive error
- [ ] Gate hash passed through for per-gate filename scoping

### Task 3: Create Architecture MCP Tool Schemas

**File(s)**: `src/mcp/schemas/architecture-schemas.ts`  
**Action**: create

Define Zod schemas for architecture MCP tools: `ArchDiagramCatalogueOutputSchema` (array of catalogue entries), `ArchDiagramSelectInputSchema` (gateHash: string, diagramTypes: string array, descriptors: optional record), `ArchDiagramGenerateInputSchema` (gateHash: optional string, diagramType: optional string for single generation), `ArchDiagramShowInputSchema` (diagramType: string). Register tool metadata in `ToolRegistry` for: `arch_catalogue`, `arch_select`, `arch_generate`, `arch_show`.

**Acceptance**:
- [ ] All schemas validate correct input/output shapes
- [ ] Schemas registered in ToolRegistry with descriptions
- [ ] `arch_select` accepts array of diagram type strings
- [ ] `arch_generate` supports both full and single-diagram generation

### Task 4: Implement Architecture MCP Tool Handlers

**File(s)**: `src/mcp/tools/architecture-tools.ts`  
**Action**: create

Implement `architectureHandlers(registry: FunctionRegistry)` factory function following the pattern in `template-tools.ts`. Implement handlers for: `arch_catalogue` (returns full diagram type catalogue), `arch_select` (accepts gate hash and selected types, instantiates generators via DiagramSelector, returns confirmation), `arch_generate` (triggers diagram generation for all selected types or a single type), `arch_show` (reads and returns a diagram file from `zeno/architecture/`). Each handler returns `CallToolResult` with `structuredContent`.

**Acceptance**:
- [ ] `arch_catalogue` returns all 10 diagram types with metadata
- [ ] `arch_select` validates diagram types against catalogue
- [ ] `arch_generate` invokes generators and writes output files
- [ ] `arch_show` reads diagram file and returns content
- [ ] Error handling follows existing MCP error pattern

### Task 5: Register Architecture Handlers in MCP Tools Index

**File(s)**: `src/mcp/tools/index.ts`  
**Action**: modify

Import `architectureHandlers` from `./architecture-tools.js` and add it to the `handlerFactories` array so architecture MCP tools are registered at server startup.

**Acceptance**:
- [ ] Architecture handlers imported and added to factory list
- [ ] Architecture tools registered on MCP server startup
- [ ] No import errors or circular dependencies

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/diagram-catalogue.ts` | create | Diagram type catalogue with metadata and selection guidance |
| `src/generation/diagram-selector.ts` | create | DiagramSelector service for coordinating generator instantiation |
| `src/mcp/schemas/architecture-schemas.ts` | create | Zod schemas for architecture MCP tools |
| `src/mcp/tools/architecture-tools.ts` | create | MCP tool handlers for architecture operations |
| `src/mcp/tools/index.ts` | modify | Register architecture handlers in MCP tool registration |

---

## Implementation Notes

- The `arch_catalogue` tool is the entry point for LLM-driven selection. The LLM reads the catalogue, reviews the gate PRD, and calls `arch_select` with its choices.
- `arch_generate` can be called with no arguments to generate all core diagrams plus previously selected conditional diagrams, or with a specific `diagramType` for single-diagram regeneration.
- Follow the handler factory pattern from `template-tools.ts` for consistency.

---

## Rollback

**If rejected or failed**: Delete `src/generation/diagram-catalogue.ts`, `src/generation/diagram-selector.ts`, `src/mcp/schemas/architecture-schemas.ts`, `src/mcp/tools/architecture-tools.ts`. Revert `src/mcp/tools/index.ts`.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-13  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-13 | Initial version | Copilot |
