# Proposal: Conditional Diagram Generators

**Hash**: #p05g04conddiag0
**Gate**: gate-05 - Architecture & Diagram Generation
**Status**: pending
**Created**: 2026-02-09

---

## Summary

Implements the 5 conditional diagram generators: 3 gate-level (sequence, component, package) and 2 infrastructure-level (deployment, network). These generators are only invoked when complexity metrics or infrastructure detection triggers them, and they produce per-gate scoped diagrams following the naming convention from Technical Decision 11.

---

## Context

### Why This Change

Gate 05 specifies conditional diagrams that are generated per-gate when complexity or infrastructure focus warrants them. Unlike core diagrams which apply project-wide, these are scoped to individual gates and use the naming convention `[type]-[gate-hash]-[descriptor].md`. The separation from core generators keeps the mandatory baseline clean while allowing rich documentation for complex gates.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g02rendbase0 | requires | Provides DiagramGeneratorBase, renderers, and DiagramContext |
| #p05g01complxcf0 | requires | Provides complexity analysis to determine when conditional generators should fire |

---

## Tasks

### Task 1: Implement Sequence Diagram Generator

**File(s)**: `src/generation/diagrams/sequence-diagram-generator.ts`
**Action**: create

Create `SequenceDiagramGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `sequence-diagram-template`, accept a gate ID and use-case descriptor, and produce a sequence diagram showing temporal interactions between components for complex workflows. Output file pattern: `zeno/architecture/sequence-[gate-hash]-[descriptor].md`. Use Mermaid `sequenceDiagram` syntax for simple sequences, DOT for complex multi-participant sequences.

**Acceptance**:
- [ ] `SequenceDiagramGenerator` extends `DiagramGeneratorBase`
- [ ] Accepts gate ID and use-case descriptor parameters
- [ ] Produces output following naming convention from Technical Decision 11
- [ ] Uses complexity analyzer to select rendering backend

---

### Task 2: Implement Component Diagram Generator

**File(s)**: `src/generation/diagrams/component-diagram-generator.ts`
**Action**: create

Create `ComponentDiagramGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `component-diagram-template`, accept a gate ID and component name, and produce a detailed module structure diagram showing internal interfaces, dependencies, and data flow within a component. Output file pattern: `zeno/architecture/component-[gate-hash]-[name].md`.

**Acceptance**:
- [ ] `ComponentDiagramGenerator` extends `DiagramGeneratorBase`
- [ ] Accepts gate ID and component name parameters
- [ ] Produces detailed module structure for the specified component
- [ ] Follows per-gate naming convention

---

### Task 3: Implement Package Diagram Generator

**File(s)**: `src/generation/diagrams/package-diagram-generator.ts`
**Action**: create

Create `PackageDiagramGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `package-diagram-template`, accept a gate ID, and produce a diagram showing code organization, module boundaries, and inter-package dependencies relevant to that gate's scope. Output file pattern: `zeno/architecture/package-[gate-hash].md`.

**Acceptance**:
- [ ] `PackageDiagramGenerator` extends `DiagramGeneratorBase`
- [ ] Shows module boundaries and inter-package dependencies
- [ ] Scoped to files and modules relevant to the specified gate

---

### Task 4: Implement Deployment Diagram Generator

**File(s)**: `src/generation/diagrams/deployment-diagram-generator.ts`
**Action**: create

Create `DeploymentDiagramGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `deployment-diagram-template`, accept a gate ID, and produce a diagram showing runtime infrastructure, deployment topology, and environment configurations. Only generated for gates flagged as infrastructure-focused. Output file pattern: `zeno/architecture/deployment-[gate-hash].md`.

**Acceptance**:
- [ ] `DeploymentDiagramGenerator` extends `DiagramGeneratorBase`
- [ ] Shows runtime infrastructure and deployment topology
- [ ] Only invoked for infrastructure-focused gates

---

### Task 5: Implement Network Diagram Generator

**File(s)**: `src/generation/diagrams/network-diagram-generator.ts`
**Action**: create

Create `NetworkDiagramGenerator` extending `DiagramGeneratorBase`. Implement `generate` to load `network-diagram-template`, accept a gate ID, and produce a diagram showing network topology, communication patterns, and service mesh/API boundaries. Only generated for gates with networking or service communication focus. Output file pattern: `zeno/architecture/network-[gate-hash].md`.

**Acceptance**:
- [ ] `NetworkDiagramGenerator` extends `DiagramGeneratorBase`
- [ ] Shows network topology and communication patterns
- [ ] Only invoked for networking/service-focused gates

---

### Task 6: Update Diagrams Module Index

**File(s)**: `src/generation/diagrams/index.ts`
**Action**: modify

Add exports for all 5 conditional generators. Export a `CONDITIONAL_DIAGRAM_GENERATORS` array (gate-level) and `INFRASTRUCTURE_DIAGRAM_GENERATORS` array (infrastructure-level). Export `ConditionalDiagramType` and `InfrastructureDiagramType` string literal union types. Export an `ALL_DIAGRAM_GENERATORS` array combining core, conditional, and infrastructure generators.

**Acceptance**:
- [ ] All 5 conditional generators re-exported
- [ ] `CONDITIONAL_DIAGRAM_GENERATORS` and `INFRASTRUCTURE_DIAGRAM_GENERATORS` arrays exported
- [ ] `ALL_DIAGRAM_GENERATORS` combines all generator arrays
- [ ] Type unions exported for each category

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/generation/diagrams/sequence-diagram-generator.ts` | create | Sequence diagram generator (gate-level, conditional) |
| `src/generation/diagrams/component-diagram-generator.ts` | create | Component diagram generator (gate-level, conditional) |
| `src/generation/diagrams/package-diagram-generator.ts` | create | Package diagram generator (gate-level, conditional) |
| `src/generation/diagrams/deployment-diagram-generator.ts` | create | Deployment diagram generator (infrastructure, conditional) |
| `src/generation/diagrams/network-diagram-generator.ts` | create | Network diagram generator (infrastructure, conditional) |
| `src/generation/diagrams/index.ts` | modify | Add conditional generator exports and registry arrays |

---

## Implementation Notes

Conditional generators follow the same pattern as core generators but with two key differences: they accept a gate ID to scope their output, and they use the naming convention `[type]-[gate-hash]-[descriptor].md` from Technical Decision 11. The infrastructure generators should check gate metadata (type, objectives, keywords) to determine if they apply, but the actual triggering decision lives in the DiagramSelector (proposal 05).

---

## Rollback

**If rejected or failed**: Delete the 5 new generator files. Revert `src/generation/diagrams/index.ts` to core-only exports from proposal 03.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-09
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-09 | Initial version | Zeno |
