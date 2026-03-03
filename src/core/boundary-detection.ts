/* v8 ignore file */
// @red — stub created for RED phase; replace with real implementation in GREEN phase
// This file intentionally exports unimplemented stubs so tests can import it.
// All tests against this module are marked `it.skip // @red` until GREEN.

import type { AnalysisResult } from '../analysis/types.js'

export interface BoundaryRecommendation {
  name: string
  type: string
  path: string
  rationale?: string
}

export interface BoundaryDetectionResult {
  recommendations: BoundaryRecommendation[]
  persisted: boolean
}

export interface BoundaryDetectionSerializable {
  fileCount: number
  totalLOC: number
  duration: number
  rootPath: string
  coupling: Record<string, unknown>
  [key: string]: unknown
}

export function serializeForBoundaryDetection(
  _result: AnalysisResult
): BoundaryDetectionSerializable {
  throw new Error('serializeForBoundaryDetection: not implemented')
}

export function parseBoundaryRecommendations(_llmResponse: string): BoundaryRecommendation[] {
  throw new Error('parseBoundaryRecommendations: not implemented')
}

export function detectRepositoryBoundaries(
  _rootPath: string,
  _opts: { persist: boolean }
): BoundaryDetectionResult | Promise<BoundaryDetectionResult> {
  throw new Error('detectRepositoryBoundaries: not implemented')
}
