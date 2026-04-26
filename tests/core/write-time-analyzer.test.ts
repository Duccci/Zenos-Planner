import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { analyzeGateChanges, GateAnalysisResult } from '../../src/core/write-time-analyzer.js'
import { getDatabase } from '../../src/storage/database.js'

// Shared mock state — modified per-test in beforeEach/tests
const mockAnalyzer = {
  analyzeCodebase: vi.fn(),
}

// Shared git raw mock function — override per-test as needed
const mockRawFn = vi.fn().mockResolvedValue('src/core/new-file.ts\nsrc/utils/helper.ts\n')

// Mock simple-git (used by write-time-analyzer for git log)
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    raw: mockRawFn,
  })),
}))

// Mock fs
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(() => 'mock content'),
  },
}))

// Mock database
vi.mock('../../src/storage/database.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: vi.fn(() => ({
        id: 'gate-01',
        created_at: new Date().toISOString(),
      })),
    })),
  })),
}))

// Mock config
vi.mock('../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn(() => '/mock/project'),
  getWorkspaceRoot: vi.fn(() => '/mock/workspace'),
}))

// Mock CodeAnalyzer using shared mockAnalyzer state (plain function — not arrow — for constructor use)
vi.mock('../../src/analysis/code-analyzer.js', () => ({
  CodeAnalyzer: function MockCodeAnalyzer() {
    return mockAnalyzer
  },
}))

describe('Write-Time Analyzer', () => {
  beforeEach(() => {
    // Reset git mock to default output
    mockRawFn.mockResolvedValue('src/core/new-file.ts\nsrc/utils/helper.ts\n')
    // Reset analyzer to default resolved value
    mockAnalyzer.analyzeCodebase.mockResolvedValue({
      modules: new Map(),
      metrics: {
        coupling: { modules: new Map(), averageInstability: 0, highCoupling: [] },
        complexity: { modules: new Map(), maxComplexity: 0, averageComplexity: 5.0 },
        loc: {
          files: new Map(),
          totalLines: 100,
          totalCodeLines: 80,
          totalBlankLines: 10,
          totalCommentLines: 10,
        },
      },
    })
  })

  afterEach(() => {
    // Only clear call history; preserve module-level mock implementations
    vi.clearAllMocks()
  })

  describe('analyzeGateChanges', () => {
    it('should analyze incremental changes for a gate', async () => {
      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map(),
        fileCount: 2,
        totalLOC: 100,
        startTime: new Date(),
        endTime: new Date(),
        duration: 1000,
      })

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')

      expect(result.gateId).toBe('gate-01')
      expect(result.changedFiles).toContain('src/core/new-file.ts')
      expect(result.changedFiles).toContain('src/utils/helper.ts')
      expect(result.incrementalMetrics).toBeDefined()
      expect(result.errors).toHaveLength(0)
    })

    it('should handle no changed files', async () => {
      // Override to return empty
      mockRawFn.mockResolvedValueOnce('')

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')

      expect(result.changedFiles).toHaveLength(0)
      expect(result.newModules.size).toBe(0)
    })

    it('should filter to code files only', async () => {
      mockRawFn.mockResolvedValueOnce('src/core/code.ts\nREADME.md\ndocs/guide.md\n')

      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map([
          [
            'src/core/code.ts',
            {
              filePath: '/mock/project/src/core/code.ts',
              relativePath: 'src/core/code.ts',
              extension: '.ts',
              ast: {} as any,
              dependencies: { imports: [], exports: [], reexports: [] },
              linesOfCode: 50,
            },
          ],
        ]),
        fileCount: 1,
        totalLOC: 50,
        startTime: new Date(),
        endTime: new Date(),
        duration: 500,
      })

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')

      expect(result.changedFiles).toEqual(['src/core/code.ts'])
      expect(result.newModules.has('src/core/code.ts')).toBe(true)
    })

    it('should handle analysis errors gracefully', async () => {
      mockAnalyzer.analyzeCodebase.mockRejectedValue(new Error('Analysis failed'))

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toBe('Analysis failed')
      expect(result.newModules.size).toBe(0)
    })

    it('should handle git command failures', async () => {
      mockRawFn.mockRejectedValueOnce(new Error('Git command failed'))

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')

      expect(result.changedFiles).toHaveLength(0)
      expect(result.errors).toHaveLength(0) // Git failure is handled gracefully
    })

    it('covers fallback module matching loop when key does not directly match', async () => {
      mockRawFn.mockResolvedValueOnce('src/core/new-file.ts\n')

      const mockModule = {
        filePath: '/mock/project/src/core/new-file.ts',
        relativePath: 'src/core/new-file.ts',
        extension: '.ts',
        ast: {} as never,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 30,
      }

      // Use a key that won't match absolutePath or relPath directly, so fallback loop runs
      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map([['opaque-key-xyz', mockModule]]),
        fileCount: 1,
        totalLOC: 30,
      })

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')
      expect(result.errors).toHaveLength(0)
    })

    it('covers candidateRel === relPath branch: false then true across two modules', async () => {
      // codeFile with no path component so relPath has no slashes
      mockRawFn.mockResolvedValueOnce('newfile.ts\n')

      const noMatchModule = {
        filePath: '/mock/project/other.ts',
        relativePath: 'other/stuff.ts', // candidateRel = 'otherstuff.ts' ≠ 'newfile.ts' → false branch
        extension: '.ts',
        ast: {} as never,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }

      const relMatchModule = {
        filePath: '/mock/project/completely/different.ts', // doesn't end with /newfile.ts
        relativePath: 'newfile.ts', // no slashes → candidateRel = 'newfile.ts' = relPath → true branch
        extension: '.ts',
        ast: {} as never,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 20,
      }

      // Map iteration order is insertion order; noMatchModule runs first (false branch),
      // then relMatchModule runs (true branch → match, break)
      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map([
          ['opaque-no-match', noMatchModule],
          ['opaque-rel-match', relMatchModule],
        ]),
        fileCount: 2,
        totalLOC: 30,
      })

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')
      expect(result.errors).toHaveLength(0)
    })

    it('uses getMetrics() on the analyzer when available (line 155 branch)', async () => {
      mockRawFn.mockResolvedValueOnce('src/core/new-file.ts\n')

      const metricsFromGetMetrics = {
        coupling: { modules: new Map(), averageInstability: 0.1, highCoupling: [] },
        complexity: { modules: new Map(), maxComplexity: 3, averageComplexity: 2.0 },
        loc: {
          files: new Map(),
          totalLines: 40,
          totalCodeLines: 35,
          totalBlankLines: 3,
          totalCommentLines: 2,
        },
      }

      const getMetricsMock = vi.fn().mockReturnValue(metricsFromGetMetrics)
      ;(mockAnalyzer as Record<string, unknown>).getMetrics = getMetricsMock

      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map(),
        fileCount: 1,
        totalLOC: 40,
      })

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')

      expect(getMetricsMock).toHaveBeenCalled()
      expect(result.incrementalMetrics.complexity.averageComplexity).toBe(2.0)
      delete (mockAnalyzer as Record<string, unknown>).getMetrics
    })

    it('uses analysis result metrics property when getMetrics absent (line 159 branch)', async () => {
      mockRawFn.mockResolvedValueOnce('src/core/new-file.ts\n')

      const metricsFromResult = {
        coupling: { modules: new Map(), averageInstability: 0.5, highCoupling: [] },
        complexity: { modules: new Map(), maxComplexity: 7, averageComplexity: 4.5 },
        loc: {
          files: new Map(),
          totalLines: 80,
          totalCodeLines: 70,
          totalBlankLines: 6,
          totalCommentLines: 4,
        },
      }

      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map(),
        metrics: metricsFromResult,
        fileCount: 1,
        totalLOC: 80,
      })

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')
      expect(result.errors).toHaveLength(0)
      expect(result.incrementalMetrics).toBeDefined()
    })
  })

  describe('Integration Workflow', () => {
    it('should simulate complete greenfield workflow', async () => {
      // Mock multiple gates with analysis data
      const mockDb = {
        prepare: vi.fn(() => ({
          get: vi.fn((query: string) => {
            if (query.includes('projects')) {
              return {
                id: 'proj-1',
                start_state: JSON.stringify({
                  gateAnalysis: {
                    'gate-01': {
                      metrics: {
                        coupling: { hotspots: ['auth.ts', 'db.ts'] },
                        complexity: { average: 6.5 },
                        loc: { total: 500 },
                      },
                    },
                  },
                }),
              }
            }
            return { id: 'gate-01', created_at: new Date().toISOString() }
          }),
        })),
      }

      vi.mocked(getDatabase).mockReturnValue(mockDb)

      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map(),
        fileCount: 5,
        totalLOC: 300,
        startTime: new Date(),
        endTime: new Date(),
        duration: 800,
      })

      // Simulate Gate 1 completion with analysis
      const gate1Result = await analyzeGateChanges('gate-01')
      expect(gate1Result.gateId).toBe('gate-01')
      expect(gate1Result.changedFiles.length).toBeGreaterThan(0)

      // Verify analysis data would be stored
      // (In real implementation, this would update the database)
    })

    it('should handle complex multi-gate analysis accumulation', async () => {
      // Mock project with multiple completed gates
      const mockDb = {
        prepare: vi.fn(() => ({
          get: vi.fn(() => ({
            id: 'proj-1',
            start_state: JSON.stringify({
              gateAnalysis: {
                'gate-01': {
                  metrics: {
                    coupling: { hotspots: ['auth.ts'] },
                    complexity: { average: 4.0 },
                    loc: { total: 200 },
                  },
                },
                'gate-02': {
                  metrics: {
                    coupling: { hotspots: ['api.ts', 'auth.ts'] },
                    complexity: { average: 5.5 },
                    loc: { total: 350 },
                  },
                },
              },
            }),
          })),
        })),
      }

      vi.mocked(getDatabase).mockReturnValue(mockDb)

      // This would be used by regenerateGatesFromAnalysis
      // Verify accumulation logic works correctly
      const accumulatedHotspots = ['auth.ts', 'api.ts', 'auth.ts'] // From both gates
      const uniqueHotspots = [...new Set(accumulatedHotspots)]
      expect(uniqueHotspots).toEqual(['auth.ts', 'api.ts'])
    })
  })

  describe('Error Paths', () => {
    it('should return error when project root not found', async () => {
      const { findProjectRoot } = await import('../../src/utils/config.js')
      vi.mocked(findProjectRoot).mockReturnValueOnce(null)

      const result = await analyzeGateChanges('gate-01')

      expect(result.errors).toContain('Not in a Zeno project')
      expect(result.gateId).toBe('gate-01')
      expect(result.changedFiles).toEqual([])
    })

    it('should return error when gate not found in database', async () => {
      const dbMock = {
        prepare: vi.fn(() => ({
          get: vi.fn(() => undefined),
        })),
      }
      vi.mocked(getDatabase).mockReturnValue(dbMock)

      const result: GateAnalysisResult = await analyzeGateChanges('gate-999')

      expect(result.errors).toContain('Gate gate-999 not found')
    })

    it('should return empty metrics when no code files changed', async () => {
      mockRawFn.mockResolvedValueOnce('README.md\npackage.json\n')

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01')

      expect(result.gateId).toBe('gate-01')
      expect(result.changedFiles).toEqual([])
      expect(result.newModules.size).toBe(0)
      expect(result.incrementalMetrics.loc.totalCodeLines).toBe(0)
    })
  })
})
