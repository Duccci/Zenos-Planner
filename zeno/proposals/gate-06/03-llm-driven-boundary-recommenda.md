# Proposal: LLM-Driven Boundary Recommendation

**Hash**: #0c081a5a  
**Gate**: gate-06 - Multi-Repo & Subproject Detection  
**Requirement**: #10a621a3715172ae  
**Status**: pending  
**Created**: 2026-03-01

---

## Summary

Implements the hybrid boundary detection service that serializes Gate 02's `CodeAnalyzer` output into a stable JSON schema and orchestrates invocation of the `architect-reviewer` subagent for repository boundary recommendations. Returns advisory-only recommendations without auto-persisting boundaries — human confirmation via `repos adjust` is required.

---

## Proposal Type

**GREEN**

- **GREEN**: Implementation phase following RED tests. Includes guardrails to verify no new tests added.

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%
- **Lines to Cover**: ~120 (serializer, boundary detection service, subagent invocation)
- **Target Coverage**: 120 × 0.90 = 108 lines must be tested

---

## Context

### Why This Change

Gate 06 requires a hybrid `detect` workflow: `CodeAnalyzer` produces structured codebase metrics which are serialized and fed to the `architect-reviewer` subagent for boundary recommendations. This proposal implements the serialization layer and detection service orchestration. Boundaries are advisory only; persistence requires human action via `repos adjust`.

### Dependencies

| Hash | Type | Description |
| ---- | ---- | ----------- |
| #c5e27b7d | requires | RED test suite defines acceptance tests for boundary detection |
| #1f01eca0 | requires | Repository storage CRUD needed for persisting confirmed boundaries |

---

## Tasks

### Task 1: Implement CodeAnalyzer output serializer

**Phase**: GREEN  
**File(s)**: `src/core/boundary-detection.ts`  
**Action**: create

Create a `serializeAnalysisForBoundaryDetection(result: AnalysisResult)` function that transforms the raw `AnalysisResult` into a stable JSON schema suitable for LLM consumption. Extract only structured metrics: file counts per directory, LOC per directory, coupling scores from `CouplingMetrics`, dependency graph edges (source → target), and import/export topology. Explicitly exclude raw AST data and file contents to prevent data leakage. Define `BoundaryAnalysisInput` interface for the serialized output.

**Acceptance**:

- [ ] Serialized output includes coupling scores, LOC, dependency edges, file counts
- [ ] Raw AST data and file contents are excluded
- [ ] `BoundaryAnalysisInput` interface is exported and documented
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

### Task 2: Implement boundary detection service with subagent invocation

**Phase**: GREEN  
**File(s)**: `src/core/boundary-detection.ts`  
**Action**: modify

Add `detectBoundaries(rootPath: string, options?: DetectOptions)` function that orchestrates the full workflow: (1) invoke `CodeAnalyzer.analyzeCodebase(rootPath)`, (2) serialize via `serializeAnalysisForBoundaryDetection`, (3) invoke the architect-reviewer subagent with the serialized metrics and a structured prompt requesting boundary recommendations, (4) parse the subagent response into `ReposDetectOutput` matching the existing Zod schema. The subagent invocation should be abstracted behind a `BoundaryAnalyzer` interface to allow mocking in tests.

**Acceptance**:

- [ ] `detectBoundaries` orchestrates the full CodeAnalyzer → serialize → subagent flow
- [ ] Subagent invocation is behind `BoundaryAnalyzer` interface (injectable, mockable)
- [ ] Return type matches `ReposDetectOutputSchema`
- [ ] Error handling covers CodeAnalyzer failure and subagent timeout/error
- [ ] Recommendations are returned without auto-persistence
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/core/boundary-detection.ts` | GREEN | create | Boundary detection service with serializer and subagent orchestration |

---

## Implementation Notes

The `BoundaryAnalyzer` interface should define a single `analyze(input: BoundaryAnalysisInput): Promise<ReposDetectOutput>` method. The default implementation invokes the architect-reviewer subagent. Tests inject a mock implementation. The subagent prompt should reference the stable field names from `BoundaryAnalysisInput` so the architect-reviewer can deterministically parse the input.

---

## Rollback

**If rejected or failed**: Delete `src/core/boundary-detection.ts`. No existing code modified.

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-03-01  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Owner**: zeno  
**Reviewers**: zeno

### Change Log

| Version | Date       | Summary         | Author |
| ------- | ---------- | --------------- | ------ |
| 1.0.0   | 2026-03-01 | Initial version | zeno   |
