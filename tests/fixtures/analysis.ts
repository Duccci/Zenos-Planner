import type { AnalysisResult, CodeMetrics } from '../../src/analysis/types.js'

/**
 * Minimal stub for CodeMetrics satisfying the interface shape.
 * Uses empty Maps and zero values — sufficient for serialization tests.
 */
function makeCodeMetrics(): CodeMetrics {
  return {
    coupling: {
      modules: new Map(),
      averageInstability: 0.3,
      highCoupling: [],
    },
    complexity: {
      modules: new Map(),
      maxComplexity: 8,
      averageComplexity: 2.5,
    },
    loc: {
      files: new Map(),
      totalLines: 3800,
      totalCodeLines: 2900,
      totalBlankLines: 500,
      totalCommentLines: 400,
    },
  }
}

/**
 * Factory for AnalysisResult fixtures used across gate-06 tests.
 * Provides a representative but minimal result with no real AST content.
 */
export function createAnalysisResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    rootPath: '/projects/test-project',
    modules: new Map(),
    fileCount: 42,
    totalLOC: 3800,
    startTime: new Date('2026-03-01T00:00:00Z'),
    endTime: new Date('2026-03-01T00:01:00Z'),
    duration: 60000,
    metrics: makeCodeMetrics(),
    ...overrides,
  }
}

/**
 * Sample LLM boundary recommendation string — representative of architect-reviewer output.
 * Used as a fixture in boundary-detection tests to exercise the response parser.
 */
export const FIXTURE_BOUNDARY_RECOMMENDATION = `
## Recommended Repository Boundaries

Based on the analysis, the following boundaries are recommended:

### Boundary 1: core-engine
- **Path**: src/core
- **Type**: library
- **Rationale**: Stable domain logic with low afferent coupling (imports widely, rarely imported)

### Boundary 2: cli-interface
- **Path**: src/cli
- **Type**: app
- **Rationale**: Entry point that depends on core-engine and storage layers

### Boundary 3: storage-layer
- **Path**: src/storage
- **Type**: library
- **Rationale**: Data persistence module with stable interfaces and no outbound dependencies on CLI

No circular repository-level dependencies detected.
`
