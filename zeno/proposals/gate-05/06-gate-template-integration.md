# Proposal: Gate Template Integration

**Hash**: #p05g06gatetmpl0  
**Gate**: #g05archdiag - Architecture & Diagram Generation  
**Requirement**: Automatic Diagram Generation, Smart Diagram Selection  
**Status**: pending  
**Created**: 2026-02-13

---

## Summary

Integrates architecture diagram metadata into the gate PRD template and gate generation flow. Adds an `## Architecture Diagrams` section to the gate PRD template listing applicable diagrams with name, type, and order. Implements gate structure change detection that notifies the LLM via MCP when gates are created, reordered, or rescoped, triggering architecture review.

---

## Single-Phase Requirement

All work in this proposal is independent and parallelizable. No multi-phase sequencing.

---

## Context

### Why This Change

Gate PRDs need to declare which architecture diagrams apply to each gate, enabling the LLM to generate them alongside requirements. Gate structure changes (adding, removing, reordering gates) must propagate to architecture artifacts so diagrams stay current. This proposal connects the gate generation flow to the diagram system.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #p05g05diagselec | requires | Diagram catalogue and selection logic for populating gate template diagram section |

---

## Tasks

### Task 1: Add Architecture Diagrams Section to Gate PRD Template

**File(s)**: `templates/md-templates/gate-prd-template.md`  
**Action**: modify

Add an `## Architecture Diagrams` section between the existing `## Requirements` and `## Technical Decisions` sections. The section contains a table with columns: `Name` (diagram display name), `Type` (DiagramType value), `Order` (integer for generation sequence), `Status` (pending/generated). Include a placeholder comment instructing the LLM to populate this section based on the diagram catalogue. Add a note that core diagrams (system-overview, data-flow, gate-lifecycle, gate-roadmap, context) are always included, and conditional diagrams should be selected based on the gate's scope.

**Acceptance**:
- [ ] Template includes `## Architecture Diagrams` section
- [ ] Table structure has Name, Type, Order, Status columns
- [ ] Instructional comment present for LLM guidance
- [ ] Core diagrams listed as always-included
- [ ] Section positioned between Requirements and Technical Decisions

### Task 2: Update Gate Generation to Include Diagram Metadata

**File(s)**: `src/generation/gate-writer.ts`  
**Action**: modify

Extend the gate writing logic to populate the `## Architecture Diagrams` section when generating a gate PRD. Always include the five core diagram entries with sequential order numbers. Leave conditional diagram rows empty with a comment that the LLM will select additional diagrams via `arch_select` MCP tool during gate start. The gate writer reads diagram names from the `DIAGRAM_CATALOGUE` constant.

**Acceptance**:
- [ ] Generated gate PRDs include Architecture Diagrams section
- [ ] Five core diagrams pre-populated in the table
- [ ] Conditional diagram slots left for LLM selection
- [ ] Order numbers assigned sequentially

### Task 3: Implement Gate Structure Change Detection

**File(s)**: `src/generation/gate-change-detector.ts`  
**Action**: create

Implement `GateChangeDetector` class with: `detectChanges(previousGates: GateMetadata[], currentGates: GateMetadata[]): GateChangeEvent[]` that compares gate lists and produces change events for: `gate_added`, `gate_removed`, `gate_reordered`, `gate_rescoped`. Define `GateChangeEvent` interface with: `type`, `gateHash`, `gateName`, `details` (human-readable description). Implement `shouldTriggerArchReview(events: GateChangeEvent[]): boolean` that returns `true` if any event type warrants architecture diagram review (all types except minor metadata changes).

**Acceptance**:
- [ ] Detects gate additions correctly
- [ ] Detects gate removals correctly
- [ ] Detects gate reordering correctly
- [ ] `shouldTriggerArchReview()` returns true for structural changes
- [ ] Change events include descriptive details

### Task 4: Integrate Change Detection into Gate Lifecycle

**File(s)**: `src/core/gate-generation.ts`  
**Action**: modify

After gate generation or gate completion, invoke `GateChangeDetector.detectChanges()` to compare the previous gate list (from `project-overview.json`) with the newly generated list. If `shouldTriggerArchReview()` returns `true`, emit an architecture review notification via the MCP notification mechanism (or log a structured message that the MCP server can surface to the LLM). The notification includes the change events and a suggestion to run `arch_generate`.

**Acceptance**:
- [ ] Gate generation triggers change detection
- [ ] Architecture review notification emitted for structural changes
- [ ] Notification includes change event details
- [ ] Non-structural changes do not trigger notification

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `templates/md-templates/gate-prd-template.md` | modify | Add Architecture Diagrams section to gate PRD template |
| `src/generation/gate-writer.ts` | modify | Populate diagram section during gate PRD generation |
| `src/generation/gate-change-detector.ts` | create | Gate structure change detection and architecture review triggers |
| `src/core/gate-generation.ts` | modify | Integrate change detection into gate lifecycle |

---

## Implementation Notes

- Gate change detection compares gate hashes and sequence numbers. A change in the hash set indicates adds/removes; a change in ordering indicates resequencing.
- The architecture review notification is informational — the LLM decides whether to act on it by calling `arch_generate`.
- The gate PRD template change is backward-compatible: existing gate PRDs without the section remain valid.

---

## Rollback

**If rejected or failed**: Revert `templates/md-templates/gate-prd-template.md` and `src/generation/gate-writer.ts`. Delete `src/generation/gate-change-detector.ts`. Revert `src/core/gate-generation.ts`.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-13  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-13 | Initial version | Copilot |
