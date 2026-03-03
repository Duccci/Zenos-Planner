import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAnalysisResult, FIXTURE_BOUNDARY_RECOMMENDATION } from '../fixtures/analysis.js'
import {
  serializeForBoundaryDetection,
  parseBoundaryRecommendations,
  detectRepositoryBoundaries,
} from '../../src/core/boundary-detection.js'

const mockAnalyzeCodebase = vi.fn()

vi.mock('../../src/analysis/code-analyzer.js', () => ({
  CodeAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeCodebase: mockAnalyzeCodebase,
  })),
}))

describe('boundary-detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.skip('serializes AnalysisResult to a stable JSON schema', () => { // @red
    const result = createAnalysisResult()
    const serialized = serializeForBoundaryDetection(result)

    expect(typeof serialized).toBe('object')
    expect(serialized).toHaveProperty('fileCount')
    expect(serialized).toHaveProperty('totalLOC')
    expect(serialized).toHaveProperty('duration')
    expect(serialized).toHaveProperty('rootPath')
  })

  it.skip('includes coupling, LOC, and file counts in serialized output', () => { // @red
    const result = createAnalysisResult({ fileCount: 55, totalLOC: 4200 })
    const serialized = serializeForBoundaryDetection(result)

    expect(serialized.fileCount).toBe(55)
    expect(serialized.totalLOC).toBe(4200)
    // Must include dependency/coupling-related data, not raw AST
    expect(serialized).not.toHaveProperty('modules')
    expect(serialized).toHaveProperty('coupling')
  })

  it.skip('does not include raw AST in serialized output', () => { // @red
    const result = createAnalysisResult()
    const serialized = serializeForBoundaryDetection(result)

    // Raw AST objects should not be serialized
    expect(serialized).not.toHaveProperty('ast')
    expect(JSON.stringify(serialized)).not.toContain('"ast"')
  })

  it.skip('parses boundary recommendations from fixture LLM response string', () => { // @red
    const recommendations = parseBoundaryRecommendations(FIXTURE_BOUNDARY_RECOMMENDATION)

    expect(Array.isArray(recommendations)).toBe(true)
    expect(recommendations.length).toBeGreaterThanOrEqual(3)
    expect(recommendations[0]).toHaveProperty('name')
    expect(recommendations[0]).toHaveProperty('type')
    expect(recommendations[0]).toHaveProperty('path')
  })

  it.skip('returns recommendations as advisory (not persisted)', async () => { // @red
    mockAnalyzeCodebase.mockResolvedValue(createAnalysisResult())

    const result = await detectRepositoryBoundaries('/projects/test', { persist: false })
    expect(result.recommendations).toBeDefined()
    expect(Array.isArray(result.recommendations)).toBe(true)
    // Should NOT have side effects — no DB writes
    expect(result.persisted).toBe(false)
  })

  it.skip('handles CodeAnalyzer failure gracefully', async () => { // @red
    mockAnalyzeCodebase.mockRejectedValue(new Error('Analysis failed'))

    await expect(
      detectRepositoryBoundaries('/projects/test', { persist: false })
    ).rejects.toThrow('Analysis failed')
  })

  it.skip('handles empty analysis result (zero files)', async () => { // @red
    mockAnalyzeCodebase.mockResolvedValue(
      createAnalysisResult({ fileCount: 0, totalLOC: 0, modules: new Map() })
    )

    const result = await detectRepositoryBoundaries('/projects/test', { persist: false })
    expect(result.recommendations).toBeDefined()
    expect(result.recommendations).toHaveLength(0)
  })
})
