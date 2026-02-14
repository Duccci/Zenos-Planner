# Proposal: Diagram Selection & Architecture Metadata

**Hash**: #p05g05selctmet0
**Gate**: gate-05 - Architecture & Diagram Generation
**Status**: pending
**Created**: 2026-02-09

---

## Summary

Implements the DiagramSelector that determines which diagrams to generate based on project type and gate complexity, the architecture metadata scanner that indexes `zeno/architecture/` at runtime, and the gate structure change detection that triggers architecture review notifications. This is the orchestration layer connecting generators to project state.

---

## Context

### Why This Change

Technical Decisions 2, 9, and 10 specify intelligent diagram selection driven by LLM/user data via MCP, with metadata derived from folder scanning rather than a persistent database. The DiagramSelector bridges project context to generator invocation, while the metadata scanner makes the current architecture state queryable by MCP tools and CLI commands.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g01complxcf0 | requires | Provides ComplexityConfig and complexity analysis functions |
| #p05g03corediag0 | requires | Provides core diagram generators that the selector orchestrates |
| #p05g04conddiag0 | requires | Provides conditional diagram generators that the selector triggers based on complexity |

---

## Tasks

### Task 1: Implement Diagram Selector

**File(s)**: `src/generation/diagram-selector.ts`
**Action**: create

Create `DiagramSelector` class with methods: `selectDiagrams(context: DiagramContext, config: ComplexityConfig): DiagramSelectionResult` that returns which generators to invoke based on project type and gate complexity. The selector always includes the 5 core generators. For conditional generators, it analyzes each gate's complexity (element count, nesting depth) using the ComplexityAnalyzer and includes gate-level generators when thresholds are exceeded. Infrastructure generators are included when gate metadata keywords indicate infrastructure focus (deploy, network, infrastructure, container, kubernetes, cloud). The `DiagramSelectionResult` should contain `coreDiagrams`, `gateLevelDiagrams` (per-gate map), and `infrastructureDiagrams` (per-gate map). Project type detection is LLM/user-driven: the selector accepts project type as input (from MCP context or config), not auto-detected from filesystem.

**Acceptance**:
- [ ] `DiagramSelector` always includes 5 core generators in selection
- [ ] Gate-level generators triggered when complexity exceeds configurable thresholds
- [ ] Infrastructure generators triggered by gate metadata keyword analysis
- [ ] Project type accepted as input parameter (LLM/user-driven)
- [ ] `DiagramSelectionResult` contains typed per-gate diagram maps

---

### Task 2: Implement Architecture Metadata Scanner

**File(s)**: `src/generation/architecture-metadata.ts`
**Action**: create

Create `ArchitectureMetadataScanner` class with method `scan(architecturePath: string): ArchitectureIndex` that reads all markdown files in the specified directory, parses frontmatter/headers (title, generated date, status from the markdown pattern seen in existing architecture docs), and returns a runtime index. The `ArchitectureIndex` interface contains entries with: `diagramType` (derived from filename), `gateHash` (parsed from filename if gate-scoped), `filePath`, and `lastModified` (filesystem timestamp). This scanner is the implementation of Technical Decision 10 (no persistent metadata, folder scanning only).

**Acceptance**:
- [ ] Scans `zeno/architecture/` directory for all `.md` files
- [ ] Parses diagram type from filename (system-overview, data-flow, sequence-*, etc.)
- [ ] Extracts gate hash from filename for gate-scoped diagrams
- [ ] Returns typed `ArchitectureIndex` with all specified fields
- [ ] Handles empty directory gracefully (returns empty index)

---

### Task 3: Implement Gate Structure Change Detection

**File(s)**: `src/generation/architecture-change-detector.ts`
**Action**: create

Create `ArchitectureChangeDetector` class with method `detectChanges(currentGates: GateInfo[], previousIndex: ArchitectureIndex): ChangeDetectionResult` that compares current gate structure against the existing architecture index. Returns a result indicating: new gates not yet represented in diagrams, removed gates with orphaned diagrams, and gates whose complexity has changed enough to warrant different diagram types. The `ChangeDetectionResult` includes a `needsReview: boolean` flag and a `changes` array describing what changed. When `needsReview` is true, the CLI or MCP layer emits a notification.

**Acceptance**:
- [ ] Detects new gates without corresponding architecture diagrams
- [ ] Detects orphaned diagrams for removed gates
- [ ] Returns `needsReview` flag when architecture may be stale
- [ ] Returns structured change descriptions for notification

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/diagram-selector.ts` | create | Diagram selection logic based on project type and gate complexity |
| `src/generation/architecture-metadata.ts` | create | Runtime folder scanner for architecture metadata index |
| `src/generation/architecture-change-detector.ts` | create | Gate structure change detection for architecture review triggers |

---

## Implementation Notes

The selector is deliberately input-driven rather than auto-detecting project type. Technical Decision 9 specifies LLM/user-driven data: the MCP template exposure gives the LLM tools to determine what models are needed. The selector receives that determination as input rather than reimplementing detection logic. The metadata scanner should use `fs.readdirSync` and `fs.statSync` for synchronous scanning (consistent with the existing file utility patterns in `src/utils/file.ts`).

---

## Rollback

**If rejected or failed**: Delete the 3 new files. No other modules depend on these yet.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-09
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-09 | Initial version | Zeno |
