# Proposal: Conditional Diagram Generators

**Hash**: #p05g04conddiag0  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Requirement**: Smart Diagram Selection, Scalable Visualization  
**Status**: pending  
**Created**: 2026-02-13

---

## Summary

Implements the five conditional diagram generators (sequence, component, package, deployment, network) that are generated per-gate when the LLM selects them via MCP tools. Each generator extends `DiagramGeneratorBase` and supports per-gate scoping with the naming convention `[type]-[gate-hash]-[descriptor].md`.

---

## Single-Phase Requirement

All five generators are independent and can be implemented in parallel. No sequencing required between them.

---

## Context

### Why This Change

While core diagrams cover every project, complex gates benefit from additional diagram types. Sequence diagrams clarify temporal workflows, component diagrams detail module internals, package diagrams show code organization, deployment diagrams map infrastructure, and network diagrams map communication topology. The LLM selects which of these to generate per-gate based on the gate PRD context.

### Dependencies

| Hash             | Type     | Description                                                |
| ---------------- | -------- | ---------------------------------------------------------- |
| #p05g02rendbase0 | requires | Rendering base classes, Mermaid/Graphviz renderers         |
| #p05g01complxcf0 | requires | Complexity types and backend selection for Mermaid vs. DOT |

---

## Tasks

### Task 1: Implement Sequence Diagram Generator

**File(s)**: `src/generation/diagram-generators/sequence-diagram-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.Sequence`, `getCategory()` to return `'conditional'`. Accept a `descriptor` parameter (use case name) for per-gate scoping. Implement `generateContent()` to produce Mermaid `sequenceDiagram` syntax showing temporal interactions between actors and components. Template loaded from `templates/architecture-templates/sequence-diagram-template.md`. Output path: `zeno/architecture/sequence-[gate-hash]-[descriptor].md`.

**Acceptance**:

- [ ] Generates valid Mermaid sequenceDiagram syntax
- [ ] Supports per-gate scoping with gate hash and descriptor in filename
- [ ] Shows participants, messages, and alt/opt blocks
- [ ] Output follows sequence-diagram-template.md structure

### Task 2: Implement Component Diagram Generator

**File(s)**: `src/generation/diagram-generators/component-diagram-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.Component`, `getCategory()` to return `'conditional'`. Accept a `componentName` parameter for scoping. Implement `generateContent()` to produce Mermaid or DOT syntax showing detailed module structure with interfaces, internal components, and provided/required ports. Template loaded from `templates/architecture-templates/component-diagram-template.md`. Output path: `zeno/architecture/component-[gate-hash]-[name].md`.

**Acceptance**:

- [ ] Generates valid Mermaid or DOT syntax for component details
- [ ] Shows internal structure, interfaces, and dependencies
- [ ] Per-gate scoping in filename
- [ ] Output follows component-diagram-template.md structure

### Task 3: Implement Package Diagram Generator

**File(s)**: `src/generation/diagram-generators/package-diagram-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.Package`, `getCategory()` to return `'conditional'`. Implement `generateContent()` to produce Mermaid or DOT syntax showing code organization: packages/modules, their public APIs, and inter-package dependencies. Template loaded from `templates/architecture-templates/package-diagram-template.md`. Output path: `zeno/architecture/packages-[gate-hash].md` or `zeno/architecture/packages.md` for project-wide.

**Acceptance**:

- [ ] Generates valid Mermaid or DOT syntax for package/module structure
- [ ] Shows module boundaries and dependency arrows
- [ ] Public API surfaces identified per module
- [ ] Output follows package-diagram-template.md structure

### Task 4: Implement Deployment Diagram Generator

**File(s)**: `src/generation/diagram-generators/deployment-diagram-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.Deployment`, `getCategory()` to return `'conditional'`. Implement `generateContent()` to produce DOT syntax (deployment diagrams are typically complex) showing runtime infrastructure: nodes, containers, artifacts, and communication channels. Template loaded from `templates/architecture-templates/deployment-diagram-template.md`. Output path: `zeno/architecture/deployment-[gate-hash].md`.

**Acceptance**:

- [ ] Generates valid DOT syntax for deployment topology
- [ ] Shows infrastructure nodes, containers, and artifacts
- [ ] Communication channels labeled with protocols
- [ ] Output follows deployment-diagram-template.md structure

### Task 5: Implement Network Diagram Generator

**File(s)**: `src/generation/diagram-generators/network-diagram-generator.ts`  
**Action**: create

Extend `DiagramGeneratorBase`. Override `getType()` to return `DiagramType.Network`, `getCategory()` to return `'conditional'`. Implement `generateContent()` to produce DOT syntax showing network topology: subnets, load balancers, firewalls, services, and communication patterns. Template loaded from `templates/architecture-templates/network-diagram-template.md`. Output path: `zeno/architecture/network-[gate-hash].md`.

**Acceptance**:

- [ ] Generates valid DOT syntax for network topology
- [ ] Shows network boundaries, services, and protocols
- [ ] Security boundaries (firewalls, DMZ) identified
- [ ] Output follows network-diagram-template.md structure

### Task 6: Add Conditional Generators to Barrel Export

**File(s)**: `src/generation/diagram-generators/index.ts`  
**Action**: modify

Add exports for all five conditional generators: `SequenceDiagramGenerator`, `ComponentDiagramGenerator`, `PackageDiagramGenerator`, `DeploymentDiagramGenerator`, `NetworkDiagramGenerator`. Export a `CONDITIONAL_GENERATORS` array listing all conditional generator classes. Export an `ALL_GENERATORS` array combining `CORE_GENERATORS` and `CONDITIONAL_GENERATORS`.

**Acceptance**:

- [ ] All five conditional generators importable from barrel
- [ ] `CONDITIONAL_GENERATORS` and `ALL_GENERATORS` arrays exported
- [ ] No circular dependency issues

---

## Files Affected

| File                                                                | Action | Description                                             |
| ------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `src/generation/diagram-generators/sequence-diagram-generator.ts`   | create | Sequence diagram generator (temporal interactions)      |
| `src/generation/diagram-generators/component-diagram-generator.ts`  | create | Component diagram generator (detailed module structure) |
| `src/generation/diagram-generators/package-diagram-generator.ts`    | create | Package diagram generator (code organization)           |
| `src/generation/diagram-generators/deployment-diagram-generator.ts` | create | Deployment diagram generator (infrastructure topology)  |
| `src/generation/diagram-generators/network-diagram-generator.ts`    | create | Network diagram generator (network topology)            |
| `src/generation/diagram-generators/index.ts`                        | modify | Add conditional generators to barrel export             |

---

## Implementation Notes

- Conditional generators accept optional `descriptor`/`componentName` parameters for per-gate filename scoping using the convention `[type]-[gate-hash]-[descriptor].md`.
- Deployment and network diagrams default to DOT rendering since they typically exceed the Mermaid complexity threshold.
- Sequence diagrams almost always use Mermaid since `sequenceDiagram` is one of Mermaid's strongest diagram types.

---

## Rollback

**If rejected or failed**: Delete the five new generator files. Revert changes to `src/generation/diagram-generators/index.ts`.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-13  
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date       | Summary         | Author  |
| ------- | ---------- | --------------- | ------- |
| 1.0.0   | 2026-02-13 | Initial version | Copilot |
