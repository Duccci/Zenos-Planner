# Proposal: CLI Commands & Function Registry Integration

**Hash**: #p05g07cliregint  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Requirement**: Automatic Diagram Generation, LLM-Accessible Architecture  
**Status**: pending  
**Created**: 2026-02-13

---

## Summary

Wires the architecture diagram system into the CLI and function registry. Implements the `zeno arch generate` and `zeno arch show <type>` commands as thin CLI wrappers that delegate to the function registry. Registers all architecture functions (generate, show, catalogue, select) in the function registry so they are accessible from both CLI and MCP.

---

## Single-Phase Requirement

All work in this proposal is independent and parallelizable. No multi-phase sequencing.

---

## Context

### Why This Change

The diagram generators, selection logic, and MCP tools are built in prior proposals, but the CLI commands remain stub implementations (logging "Not yet implemented"). This proposal replaces the stubs with working commands that delegate to the function registry, completing the user-facing integration. It also ensures all architecture operations are registered in the function registry for unified access.

### Dependencies

| Hash             | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| #p05g02rendbase0 | requires | Rendering base classes and Graphviz integration                   |
| #p05g03corediag0 | requires | Core diagram generators for `arch generate` to invoke             |
| #p05g04conddiag0 | requires | Conditional diagram generators for per-gate generation            |
| #p05g05diagselec | requires | Diagram selection logic and MCP tools for the generation pipeline |
| #p05g06gatetmpl0 | requires | Gate template integration for diagram metadata in gate PRDs       |

---

## Tasks

### Task 1: Register Architecture Functions in Function Registry

**File(s)**: `src/integration/function-registry.ts`  
**Action**: modify

Register the following functions in the function registry: `arch_generate` (generates diagrams — all core + selected conditional for a gate, or a single type), `arch_show` (reads and returns a diagram file by type), `arch_catalogue` (returns diagram type catalogue), `arch_select` (records selected diagram types for a gate). Each function delegates to the corresponding service (`DiagramSelector`, catalogue functions, file reader). Input/output schemas reference the Zod schemas from `architecture-schemas.ts`.

**Acceptance**:

- [ ] All four architecture functions registered in function registry
- [ ] Functions callable via `registry.invoke('arch_generate', args)`
- [ ] Functions return structured results matching schema definitions
- [ ] Error cases return `FunctionErrorResponse` with descriptive messages

### Task 2: Implement `zeno arch generate` CLI Command

**File(s)**: `src/cli/commands/arch.ts`  
**Action**: modify

Replace the existing stub `generate` action with a working implementation that invokes `registry.invoke('arch_generate', { gateHash, diagramType })`. Accept optional `--gate <hash>` flag to scope generation to a specific gate. Accept optional `--type <type>` flag to generate a single diagram type. Without flags, generates all core diagrams. Display progress via existing logger. Report generated files and rendering backends used.

**Acceptance**:

- [ ] `zeno arch generate` generates all core diagrams
- [ ] `zeno arch generate --gate <hash>` scopes to a gate
- [ ] `zeno arch generate --type system-overview` generates single type
- [ ] Progress and results displayed via logger
- [ ] Errors handled gracefully with user-friendly messages

### Task 3: Implement `zeno arch show <type>` CLI Command

**File(s)**: `src/cli/commands/arch.ts`  
**Action**: modify

Replace the existing stub `show` action with a working implementation that invokes `registry.invoke('arch_show', { diagramType: type })`. The function reads the corresponding file from `zeno/architecture/` and outputs its content to stdout. If the diagram file doesn't exist, print a helpful message suggesting `zeno arch generate` first. Support `--gate <hash>` flag for gate-scoped conditional diagrams.

**Acceptance**:

- [ ] `zeno arch show system-overview` displays system overview diagram
- [ ] `zeno arch show sequence --gate <hash>` shows gate-scoped sequence diagram
- [ ] Missing diagram produces helpful "not found" message
- [ ] File content printed to stdout

### Task 4: Add `zeno arch list` CLI Command

**File(s)**: `src/cli/commands/arch.ts`  
**Action**: modify

Add a `list` subcommand that invokes `registry.invoke('arch_catalogue', {})` and displays the diagram type catalogue as a formatted table. Show type, category (core/conditional), and description. Useful for LLMs and users to discover available diagram types.

**Acceptance**:

- [ ] `zeno arch list` displays all 10 diagram types
- [ ] Output formatted as readable table
- [ ] Core diagrams visually distinguished from conditional

---

## Files Affected

| File                                   | Action | Description                                                         |
| -------------------------------------- | ------ | ------------------------------------------------------------------- |
| `src/integration/function-registry.ts` | modify | Register architecture functions (generate, show, catalogue, select) |
| `src/cli/commands/arch.ts`             | modify | Implement working arch generate, show, list commands                |

---

## Implementation Notes

- Follow the existing CLI-to-registry delegation pattern used in `src/cli/commands/gates.ts` and `src/cli/commands/req.ts`.
- The `arch generate` command is the primary entry point for users/LLMs. It should be idempotent — regenerating diagrams overwrites existing files (Git provides history).
- `arch show` reads files synchronously since diagrams are small markdown files.

---

## Rollback

**If rejected or failed**: Revert `src/cli/commands/arch.ts` to stub implementations. Revert function registry additions in `src/integration/function-registry.ts`.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-13  
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date       | Summary         | Author  |
| ------- | ---------- | --------------- | ------- |
| 1.0.0   | 2026-02-13 | Initial version | Copilot |
