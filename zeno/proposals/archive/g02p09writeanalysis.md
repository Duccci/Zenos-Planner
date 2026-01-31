# Proposal: Implement Write-Time Analysis Integration for Greenfield Projects

**Hash**: #g02p09writeanalysis  
**Gate**: gate-02 - Zeno Engine & Gate Generation  
**Requirement**: #p02writeanalysis  
**Status**: completed  
**Implemented**: 2026-01-30  
**Archived**: 2026-01-30  
**Archived By**: system  
**Created**: 2026-01-29

---

## Summary

Implements write-time analysis integration that auto-triggers code analysis when developers complete a gate (`zeno gates complete <gate-id>`). This enables greenfield projects to benefit from the same deterministic architectural analysis as brownfield projects. Incremental analysis captures only files changed in the current gate, storing metrics in project metadata. Optional `zeno gates regenerate --from-analysis` command enables data-driven future gate generation based on real code metrics instead of purely theoretical decomposition.

---

## Context

### Requirements Context

This proposal implements the Write-Time Analysis Integration requirement (#p02writeanalysis) by creating a feedback loop for greenfield projects. As code is written and gates complete, Zeno analyzes the actual implementation to inform future gate generation. This bridges vision-driven initial gates with data-driven adaptive gates.

### Why This Change

Greenfield projects currently benefit from vision-driven gate generation but lack the deterministic architectural analysis available to brownfield projects. By analyzing code after each gate, greenfield projects get:
- Coupling detection between newly written modules
- Complexity tracking showing which modules are hard to maintain
- Circular dependency detection revealing architectural issues
- Adaptive gate regeneration for future work based on actual code metrics

**Use Case**: Developer completes Gate 1 (Core Infrastructure). Before starting Gate 2, `zeno gates complete` auto-analyzes what was built, detects high coupling in authentication module, and (optionally) regenerates Gate 2 with refactoring suggestions based on actual code structure.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g02p02metrics | requires | Metrics and dependency graph calculation (coupling, complexity, LOC, circular deps) |
| #g02p06cli | requires | `zeno gates complete` command to add analysis hook |

---

## Tasks

### Task 1: Implement Incremental Analysis Engine

**File(s)**: `src/core/write-time-analyzer.ts`  
**Action**: create

Create an incremental analysis module that analyzes only files changed in the current gate (using git diff). Reuse existing code analyzer but scope to current gate changes. Store metrics incrementally without rescanning entire codebase.

**Acceptance**:
- [x] Exports `analyzeGateChanges(gateId: string): GateAnalysisResult` function
- [x] Uses git to identify files changed since gate start
- [x] Only parses changed files to extract new dependencies
- [x] Merges new metrics with existing project metrics
- [x] Performance: <30 seconds for typical gate (100+ files changed)
- [x] Handles files added, modified, and deleted

---

### Task 2: Create Gate Completion Analysis Hook

**File(s)**: `src/cli/commands/gates.ts`  
**Action**: modify

Add optional analysis step to `zeno gates complete <gate-id>` command. After validating gate completion, ask user if they want to run write-time analysis. If yes, call incremental analyzer and store results.

**Acceptance**:
- [x] `zeno gates complete` prompts: "Analyze code changes for this gate? (y/n)"
- [x] If yes, runs incremental analysis with progress indicator
- [x] Shows summary of new metrics (coupling hotspots, complexity, circular deps)
- [x] Stores analysis in project metadata
- [x] Provides option to regenerate future gates from analysis
- [x] Handles analysis errors gracefully

---

### Task 3: Update Project Metadata with Analyzed Metrics

**File(s)**: `src/storage/database.ts`  
**Action**: modify

Extend project `start_state` metadata to store cumulative code metrics from gate completions. Update schema if needed to track analysis results per gate. Enable querying "what code metrics exist after Gate N?"

**Acceptance**:
- [x] Project table stores `analyzed_state` (JSON with metrics after each gate completion)
- [x] Gates table stores `analysis_results` (JSON with metrics from when gate completed)
- [x] Metrics include: coupling matrix, complexity distribution, LOC stats, circular deps
- [x] Can query historical metrics: "how did coupling change from Gate 1 to Gate 2?"
- [x] Database migration handles existing projects

---

### Task 4: Implement Optional Gate Regeneration from Analysis

**File(s)**: `src/core/gate-generator.ts`  
**Action**: modify

Add `regenerateGatesFromAnalysis()` method that uses analyzed code metrics to regenerate future gates. Compare theoretical decomposition (original) with data-driven decomposition (based on metrics) and suggest adjustments.

**Acceptance**:
- [x] Exports `regenerateGatesFromAnalysis(fromGateId: string): RegenerationSuggestions` function
- [x] Uses coupling metrics to suggest repository boundaries
- [x] Uses complexity metrics to suggest refactoring gates before feature gates
- [x] Uses circular dependencies to suggest architectural cleanup
- [x] Returns side-by-side comparison: original plan vs. data-informed plan
- [x] Human must approve any gate regeneration

---

### Task 5: Implement zeno gates regenerate --from-analysis Command

**File(s)**: `src/cli/commands/gates.ts`  
**Action**: modify

Add new `zeno gates regenerate --from-analysis` command that triggers gate regeneration based on analyzed metrics. Shows proposed changes, requires human confirmation before updating gate plan.

**Acceptance**:
- [x] New command: `zeno gates regenerate --from-analysis`
- [x] Gathers all analysis data from completed gates
- [x] Generates new gate sequence based on metrics
- [x] Displays side-by-side: current plan vs. new plan
- [x] Shows reasoning: "Detected high coupling in auth module - recommending refactor gate"
- [x] Requires explicit user confirmation to apply changes
- [x] Creates audit trail documenting regeneration decision

---

### Task 6: Document Write-Time Analysis Workflow

**File(s)**: `src/integration/llm-layer.ts`, `zeno/AGENTS.md`  
**Action**: modify

Document the write-time analysis workflow for AI assistants:
- How to trigger analysis on gate completion
- How to interpret analysis results (coupling hotspots, complexity metrics)
- How to use analysis data for adaptive gate regeneration
- When to recommend regeneration vs. proceeding with original plan
- How analysis informs implementation decisions for future gates

**Acceptance**:
- [x] AGENTS.md documents write-time analysis workflow
- [x] Shows example: Gate 1 → analyze → regenerate Gate 2 based on data
- [x] Documents decision points: "when should we regenerate vs. proceed?"
- [x] Explains metrics interpretation (what high coupling means, etc.)
- [x] Provides guidance on whether regeneration improves plan or adds scope

---

### Task 7: Write Integration Tests for Write-Time Analysis

**File(s)**: `tests/core/write-time-analyzer.test.ts`  
**Action**: create

Write tests simulating greenfield project workflow:
1. Create Gate 1 with feature implementation
2. Complete Gate 1 → trigger analysis
3. Verify metrics captured correctly
4. Regenerate Gate 2 from analysis
5. Verify regenerated gates incorporate metrics insights

**Acceptance**:
- [x] Test: Incremental analysis only scans changed files
- [x] Test: Coupling metrics capture new dependencies correctly
- [x] Test: High coupling detected and flagged in results
- [x] Test: Circular dependencies identified in analyzed code
- [x] Test: Gate regeneration produces different plan based on metrics
- [x] Test: Human approval required before applying regeneration
- [x] Coverage meets 90% threshold for write-time analyzer module
- [x] Integration test simulates full greenfield workflow (Gate 1 → analyze → regenerate Gate 2)

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/core/write-time-analyzer.ts` | create | Incremental analysis engine for gate changes |
| `src/cli/commands/gates.ts` | modify | Add analysis hook to `gates complete`, new `gates regenerate` command |
| `src/storage/database.ts` | modify | Store analyzed metrics in project metadata |
| `src/core/gate-generator.ts` | modify | Add data-driven gate regeneration logic |
| `zeno/AGENTS.md` | modify | Document write-time analysis workflow |
| `tests/core/write-time-analyzer.test.ts` | create | Integration tests for write-time analysis |
| `tests/integration/gate-completion-analysis.test.ts` | create | End-to-end gate completion → analysis → regeneration |

---

## Implementation Notes

- Incremental analysis uses git diff to identify changed files, filters to .ts/.tsx/.js/.jsx
- Merging new metrics with existing requires careful handling of coupling matrices (new modules must be added to matrix)
- Gate regeneration should preserve manually approved gate customizations
- Analysis results should include confidence scores (e.g., "high coupling detected with 0.92 confidence")
- Consider caching analysis results to avoid redundant scans of unchanged files
- Regeneration is optional - users can proceed with original gate plan if analysis suggests changes

---

## Completion Summary

**Tasks Completed**: 7/7  
**Files Modified**: 7  
**Test Coverage**: 90%+  
**Commits**: -  

### Artifacts Created
- `src/core/write-time-analyzer.ts` - Incremental analysis engine for gate changes
- `src/cli/commands/gates.ts` - Add analysis hook to gates complete, new gates regenerate command
- `src/storage/database.ts` - Store analyzed metrics in project metadata
- `src/core/gate-generator.ts` - Add data-driven gate regeneration logic
- `zeno/AGENTS.md` - Document write-time analysis workflow
- `tests/core/write-time-analyzer.test.ts` - Integration tests for write-time analysis
- `tests/integration/gate-completion-analysis.test.ts` - End-to-end gate completion → analysis → regeneration

### Quality Metrics
- Coverage: 90% minimum
- Security Vulnerabilities: 0 allowed
- Linting Error Rate: <0.01%
- Type Checking: 0 TypeScript errors (strict mode)

## Rollback

If rejected or failed: Delete `write-time-analyzer.ts` and related test files. Revert modifications to `gates.ts`, `database.ts`, `gate-generator.ts`, and `AGENTS.md`. Remove analysis hook from gate completion workflow.
