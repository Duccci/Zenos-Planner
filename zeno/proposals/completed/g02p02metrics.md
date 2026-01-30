# Proposal: Implement Code Metrics and Dependency Graph

**Hash**: #g02p02metrics  
**Gate**: gate-02 - Zeno Engine & Gate Generation  
**Requirement**: #p02codeanalysis  
**Status**: completed  
**Created**: 2026-01-29  
**Implemented**: 2026-01-29  
**Archived**: 2026-01-29

---

## Summary

Implements code metrics calculation (afferent/efferent coupling, cyclomatic complexity, lines of code) and builds a dependency graph data structure from analyzed modules. The dependency graph enables analysis of code organization, detection of circular dependencies, and identification of architectural anti-patterns. These metrics inform gate generation decisions and future multi-repo detection.

---

## Context

### Requirements Context

This proposal builds on the Code Analysis Foundation by calculating metrics and creating the dependency graph that will be used by the gate generation engine. Metrics help the engine understand code complexity and inform decomposition decisions.

### Why This Change

Gate generation needs to understand existing code structure to make informed decisions about gate boundaries. Metrics like coupling, complexity, and circular dependencies reveal architectural patterns that influence how work should be decomposed. The dependency graph is a first-class artifact needed for downstream analysis.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g02p01analysis | requires | Depends on Code Analyzer to provide parsed modules and initial dependencies |
| #g02p09writeanalysis | used_by | Metrics are used by write-time analyzer for incremental gate analysis |

---

## Tasks

### Task 1: Implement Coupling Calculator

**File(s)**: `src/analysis/metrics/coupling.ts`  
**Action**: create

Calculate afferent coupling (incoming dependencies) and efferent coupling (outgoing dependencies) for each module. Build a coupling matrix showing which modules depend on which others. Identify highly coupled modules that may indicate architectural issues.

**Acceptance**:
- [x] Exports `calculateCoupling(modules: Map<string, Module>): CouplingMetrics` function
- [x] Returns afferent count (how many modules depend on this one) per module
- [x] Returns efferent count (how many modules this depends on) per module
- [x] Identifies modules with high coupling ratios

---

### Task 2: Implement Cyclomatic Complexity Calculator

**File(s)**: `src/analysis/metrics/complexity.ts`  
**Action**: create

Calculate cyclomatic complexity for each function/class by counting decision points (if, case, while, etc.). Provide aggregate complexity metrics at module and project levels. Flag modules with unusually high complexity.

**Acceptance**:
- [x] Exports `calculateComplexity(ast: File, filePath: string): ComplexityMetrics` function
- [x] Counts if/else, switch/case, for/while loops, ternary operators as decision points
- [x] Returns per-function and per-module complexity scores
- [x] Handles nested complexity correctly

---

### Task 3: Implement Line of Code Counter

**File(s)**: `src/analysis/metrics/loc.ts`  
**Action**: create

Count lines of code, blank lines, and comment lines. Provide project-wide LOC statistics useful for estimating analysis performance and gate sizing.

**Acceptance**:
- [x] Exports `countLines(filePath: string): LineMetrics` function
- [x] Returns total lines, code lines, blank lines, comment lines
- [x] Handles different line ending styles (CRLF, LF)
- [x] Fast execution for large files

---

### Task 4: Create Dependency Graph Structure

**File(s)**: `src/analysis/graph/dependency-graph.ts`  
**Action**: create

Implement a directed graph data structure representing module dependencies. Provide methods to query graph properties: find strongly connected components (circular dependencies), topological sort, transitive dependencies, and shortest path between modules.

**Acceptance**:
- [x] Exports `DependencyGraph` class with methods: `addEdge()`, `findCircular()`, `topologicalSort()`, `getTransitiveDependencies()`
- [x] Detects circular dependencies correctly
- [x] Provides topological ordering for import order analysis
- [x] Calculates transitive dependency counts

---

### Task 5: Integrate Metrics into Code Analyzer

**File(s)**: `src/analysis/code-analyzer.ts`  
**Action**: modify

Extend the CodeAnalyzer to calculate metrics after parsing all modules. Add methods to retrieve metrics and graph information. Store metrics in analysis result for downstream use.

**Acceptance**:
- [x] CodeAnalyzer.analyzeCodebase() includes metric calculation
- [x] Stores coupling, complexity, LOC in AnalysisResult
- [x] Creates and populates DependencyGraph during analysis
- [x] Metrics accessible via getMetrics() and getGraph() methods

---

### Task 6: Write Unit Tests for Metrics and Graph

**File(s)**: `tests/analysis/metrics/coupling.test.ts`, `tests/analysis/metrics/complexity.test.ts`, `tests/analysis/metrics/loc.test.ts`, `tests/analysis/graph/dependency-graph.test.ts`  
**Action**: create

Write comprehensive tests for coupling calculation, complexity measurement, LOC counting, and graph operations. Test with sample codebases including circular dependencies and high-complexity functions.

**Acceptance**:
- [x] Coupling tests: Linear dependencies, circular, hub modules
- [x] Complexity tests: Nested conditions, switch statements, loops
- [x] LOC tests: Files with various line ending styles
- [x] Graph tests: Topological sort, circular detection, transitive dependencies
- [x] Coverage meets 90% threshold for all metrics modules

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/analysis/metrics/coupling.ts` | create | Afferent/efferent coupling calculator |
| `src/analysis/metrics/complexity.ts` | create | Cyclomatic complexity calculator |
| `src/analysis/metrics/loc.ts` | create | Lines of code counter |
| `src/analysis/graph/dependency-graph.ts` | create | Directed graph implementation |
| `src/analysis/code-analyzer.ts` | modify | Integrate metrics calculation |
| `src/analysis/types.ts` | modify | Add metrics and graph type definitions |
| `tests/analysis/metrics/coupling.test.ts` | create | Coupling tests |
| `tests/analysis/metrics/complexity.test.ts` | create | Complexity tests |
| `tests/analysis/metrics/loc.test.ts` | create | LOC tests |
| `tests/analysis/graph/dependency-graph.test.ts` | create | Graph tests |

---

## Implementation Notes

- Cyclomatic complexity is 1 + count of decision points; simplify calculation by AST pattern matching
- Coupling ratio = efferent / (1 + afferent + efferent) to normalize for comparison
- Dependency graph uses adjacency list for efficient querying
- Circular dependency detection uses DFS with visited/recursion stack
- Consider memoizing expensive graph operations (transitive dependencies)

---

## Completion Summary

**Tasks Completed**: 6/6  
**Files Modified**: 10  
**Test Coverage**: 100% (73 tests passed)  
**Commits**: Implementation completed

### Artifacts Created
- `src/analysis/metrics/coupling.ts` - Afferent/efferent coupling calculator
- `src/analysis/metrics/complexity.ts` - Cyclomatic complexity calculator  
- `src/analysis/metrics/loc.ts` - Lines of code counter
- `src/analysis/graph/dependency-graph.ts` - Directed graph implementation
- `tests/analysis/metrics/coupling.test.ts` - Coupling tests
- `tests/analysis/metrics/complexity.test.ts` - Complexity tests
- `tests/analysis/metrics/loc.test.ts` - LOC tests
- `tests/analysis/graph/dependency-graph.test.ts` - Graph tests

### Quality Metrics
- Coverage: 100% (threshold: 90%)
- Security: 0 vulnerabilities
- Lint errors: 0 (threshold: <0.01%)
- Type errors: 0

---

## Rollback

If rejected or failed: Delete created files in `src/analysis/metrics/`, `src/analysis/graph/`, and related test files. Revert modifications to `code-analyzer.ts`.
