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

**Role**: implementation

---

## Coverage & Estimates

### Target Coverage

- **Coverage Threshold**: 90%
- **Lines to Cover**: ~120 (serializer, boundary detection service, subagent invocation)
- **Target Coverage**: 120 × 0.90 = 108 lines must be tested

---

## Single-Phase Requirement

All tasks in this proposal are GREEN phase only. No new test files may be added; test coverage is defined exclusively by the sibling RED test-suite proposal (`#c5e27b7d`).

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

### Task 1: Extend `serializeForBoundaryDetection` with per-directory metrics

**Phase**: GREEN
**File(s)**: `src/core/boundary-detection.ts`
**Action**: modify

Extend the existing `serializeForBoundaryDetection(result: AnalysisResult): BoundaryDetectionSerializable` function to include per-directory file counts, per-directory LOC, dependency graph edges (source → target), and import/export topology. `BoundaryDetectionSerializable` already excludes raw AST data and file contents; extend it with explicit typed properties for `directoryFileCounts`, `directoryLOC`, and `dependencyEdges` rather than relying on the catch-all index signature.

**Acceptance**:

- [ ] `BoundaryDetectionSerializable` has explicit typed properties: `directoryFileCounts: Record<string, number>`, `directoryLOC: Record<string, number>`, `dependencyEdges: Array<{ source: string; target: string }>`
- [ ] `serializeForBoundaryDetection` populates those fields from `AnalysisResult`
- [ ] Raw AST data and file contents remain excluded
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

### Task 2: Wire subagent invocation into `detectRepositoryBoundaries`

**Phase**: GREEN
**File(s)**: `src/core/boundary-detection.ts`
**Action**: modify

Add a `BoundaryAnalyzer` interface (`analyze(input: BoundaryDetectionSerializable): Promise<BoundaryRecommendation[]>`) that abstracts subagent invocation. Refactor `detectRepositoryBoundaries(rootPath: string, opts: { persist: boolean })` to accept an optional `analyzer?: BoundaryAnalyzer` parameter (defaults to an `ArchitectReviewerBoundaryAnalyzer` implementation that invokes the architect-reviewer subagent with a structured prompt). The orchestration order is: (1) `CodeAnalyzer.analyzeCodebase(rootPath)`, (2) `serializeForBoundaryDetection`, (3) `analyzer.analyze(serialized)`, (4) populate `BoundaryDetectionResult.recommendations`. Error handling must cover `CodeAnalyzer` failure and analyzer timeout/rejection. Recommendations are returned without auto-persistence regardless of `opts.persist` (persistence handled by downstream storage layer).

**Acceptance**:

- [ ] `BoundaryAnalyzer` interface is exported from `src/core/boundary-detection.ts`
- [ ] `detectRepositoryBoundaries` accepts optional `analyzer?: BoundaryAnalyzer` and uses it for subagent calls
- [ ] Default `ArchitectReviewerBoundaryAnalyzer` invokes the architect-reviewer subagent with serialized metrics
- [ ] Error handling covers `CodeAnalyzer` failure and analyzer rejection (propagates typed errors)
- [ ] `BoundaryDetectionResult.recommendations` is populated from analyzer output
- [ ] Recommendations are not auto-persisted
- [ ] All RED tests pass
- [ ] Guardrails verified (no new tests)

---

## Files Affected

| File | Phase | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/core/boundary-detection.ts` | GREEN | modify | Extend serializer with per-directory metrics; add `BoundaryAnalyzer` interface; wire subagent invocation into `detectRepositoryBoundaries` |

---

## Implementation Notes

`BoundaryAnalyzer` defines a single `analyze(input: BoundaryDetectionSerializable): Promise<BoundaryRecommendation[]>` method. The production implementation (`ArchitectReviewerBoundaryAnalyzer`) constructs a structured prompt referencing the stable field names of `BoundaryDetectionSerializable` (e.g. `coupling`, `directoryLOC`, `dependencyEdges`) so the architect-reviewer subagent can deterministically parse the input. Tests inject a mock `BoundaryAnalyzer` that returns fixture data. The existing `parseBoundaryRecommendations(llmResponse: string)` helper can be used by the default implementation to parse the subagent's freeform response into `BoundaryRecommendation[]`.

---

## Rollback

**If rejected or failed**: Run `git checkout HEAD -- src/core/boundary-detection.ts` to restore the pre-proposal state of the file. No other files are touched by this proposal, so no further rollback steps are needed. The sibling RED test suite (`#c5e27b7d`) remains valid against the restored file — its tests target the interfaces and functions present before this change.

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
