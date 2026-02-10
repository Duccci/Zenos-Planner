# Proposal: Gate Template Integration

**Hash**: #p05g06gatetmpl0
**Gate**: gate-05 - Architecture & Diagram Generation
**Status**: pending
**Created**: 2026-02-09

---

## Summary

Extends the gate PRD template with structured diagram metadata in the existing `### Architecture Diagrams` section, enabling per-gate diagram planning with names, types, ordering, and inter-diagram dependencies. Integrates this metadata into the gate generation algorithm so diagram plans are produced alongside requirements at gate creation time.

---

## Context

### Why This Change

Technical Decision 11 specifies that diagram names, ordering, and dependencies are defined in the gate template during gate generation. The existing gate template already has a placeholder `### Architecture Diagrams` section (line 147 of `gate-prd-template.md`), but it lacks structured metadata for parallelization and subagent tasking. This proposal upgrades that section into a machine-readable format that supports concurrent diagram generation and prepares for Gate 12 (Subagent Orchestration).

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g05selctmeta | requires | Provides DiagramSelector that determines which diagrams are planned for each gate |

---

## Tasks

### Task 1: Update Gate PRD Template Architecture Diagrams Section

**File(s)**: `templates/md-templates/gate-prd-template.md`
**Action**: modify

Replace the current `### Architecture Diagrams` section (lines 147-152) with a structured format containing a markdown table with columns: Diagram Name, Type (from the diagram type enum), Order (integer for sequencing), Dependencies (comma-separated diagram names that must complete first), and Status (pending/generated/skipped). Add a comment block explaining the parallelization semantics: diagrams with no dependencies can be generated concurrently, diagrams with dependencies must wait. Keep the existing guidance text but add the structured table and usage instructions.

**Acceptance**:
- [ ] `### Architecture Diagrams` section contains a structured markdown table
- [ ] Table includes columns: Diagram Name, Type, Order, Dependencies, Status
- [ ] Comment block explains parallelization semantics
- [ ] Backward-compatible with existing gate PRDs (new section is additive)

---

### Task 2: Integrate Diagram Metadata into Gate Generation

**File(s)**: `src/core/proposal-writer.ts`
**Action**: modify

Modify the gate PRD generation logic to populate the `### Architecture Diagrams` table when generating new gates. Use the `DiagramSelector` to determine which diagrams apply to the gate being generated. For core diagrams, always include entries. For conditional diagrams, include entries only when the selector determines the gate's complexity warrants them. Set initial status to `pending` for all entries. Compute ordering by placing independent diagrams first and dependent diagrams after their prerequisites.

**Acceptance**:
- [ ] New gate PRDs include populated Architecture Diagrams table
- [ ] Core diagrams always present with correct metadata
- [ ] Conditional diagrams included based on DiagramSelector results
- [ ] Ordering reflects dependency relationships
- [ ] All entries have initial status `pending`

---

### Task 3: Add Diagram Metadata Types

**File(s)**: `src/generation/types.ts`
**Action**: modify

Add `GateDiagramEntry` interface with fields: `name` (string), `type` (DiagramType union), `order` (number), `dependencies` (string array of diagram names), `status` ('pending' | 'generated' | 'skipped'). Add `GateDiagramPlan` interface containing `gateId` (string), `gateHash` (string), and `diagrams` (GateDiagramEntry array). These types support both the template generation and the runtime orchestration.

**Acceptance**:
- [ ] `GateDiagramEntry` interface exported with all specified fields
- [ ] `GateDiagramPlan` interface exported with gateId, gateHash, and diagrams
- [ ] Types consistent with existing patterns in the file

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `templates/md-templates/gate-prd-template.md` | modify | Upgrade Architecture Diagrams section with structured table |
| `src/core/proposal-writer.ts` | modify | Populate diagram metadata during gate generation |
| `src/generation/types.ts` | modify | Add GateDiagramEntry and GateDiagramPlan types |

---

## Implementation Notes

The ordering algorithm should use topological sort on diagram dependencies to produce valid execution order. Independent diagrams (no dependencies) share the same order level and can be generated in parallel. This is explicitly designed to enable Gate 12 (Subagent Orchestration) to assign independent diagram generation tasks to concurrent agents.

---

## Rollback

**If rejected or failed**: Revert `templates/md-templates/gate-prd-template.md` to current state. Revert additions to `src/core/proposal-writer.ts` and `src/generation/types.ts`.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-09
**Versioning**: SemVer; bump on any change (minimum: PATCH).

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-09 | Initial version | Zeno |
