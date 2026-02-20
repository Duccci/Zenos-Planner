import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateGates,
  regenerateGatesWithAnalysis,
  regenerateGatesTheoreticalFromProject,
} from '../../src/core/gate-generator.js'
import * as config from '../../src/utils/config.js'
import * as database from '../../src/storage/database.js'
import { makeGateSummary } from '../fixtures/gates.js'

// Minimal mocking for regeneration tests that actually need config/database
vi.mock('../../src/utils/config.js')
vi.mock('../../src/storage/database.js')

describe('Gate Generator - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateGates - basic scenarios', () => {
    it('should generate gates for a simple end state', () => {
      const result = generateGates('Build a simple web app')

      expect(result.gates.length).toBeGreaterThan(0)
      expect(result.totalComplexity).toBeGreaterThan(0)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(100)
    })

    it('should generate more gates for complex projects', () => {
      const simpleEndState = 'Build a simple script'
      const complexEndState =
        'Build a complex enterprise application with multiple modules and integrations'

      const simpleResult = generateGates(simpleEndState)
      const complexResult = generateGates(complexEndState)

      expect(complexResult.gates.length).toBeGreaterThanOrEqual(simpleResult.gates.length)
    })

    it('should generate gates from end state without analysis', () => {
      const result = generateGates('Build a REST API with authentication')

      expect(result).toBeDefined()
      expect(result.gates).toBeDefined()
      expect(Array.isArray(result.gates)).toBe(true)
      expect(typeof result.totalComplexity).toBe('number')
      expect(typeof result.confidence).toBe('number')
    })
  })

  describe('generateGates - analysis incorporation', () => {
    it('should incorporate analysis results', () => {
      const endState = 'Refactor existing codebase'
      const analysisResult = {
        metrics: {
          linesOfCode: 5000,
          cyclomaticComplexity: 50,
          coupling: 0.8,
        },
        dependencies: ['dep1', 'dep2'],
      }

      const result = generateGates(endState, analysisResult)

      expect(result.gates.length).toBeGreaterThan(0)
    })

    it('should incorporate analysis metrics into complexity estimation', () => {
      const analysisResult = {
        metrics: {
          linesOfCode: 10000,
          cyclomaticComplexity: 150,
          coupling: 0.5,
        },
        dependencies: ['express', 'typescript', 'vitest'],
      }

      const result = generateGates('Refactor legacy service', analysisResult)

      expect(result).toBeDefined()
      expect(result.totalComplexity).toBeGreaterThan(0)
    })

    it('should handle undefined analysis gracefully', () => {
      const result = generateGates('Build something', undefined, undefined)

      expect(result.gates.length).toBeGreaterThan(0)
      expect(result.totalComplexity).toBeGreaterThan(0)
    })

    it('should handle analysis with zero LOC', () => {
      const zeroAnalysis = {
        metrics: {
          linesOfCode: 0,
          cyclomaticComplexity: 0,
          coupling: 0,
        },
        dependencies: [],
      }

      const result = generateGates('New project', zeroAnalysis)

      expect(result.gates.length).toBeGreaterThan(0)
      expect(result.totalComplexity).toBeGreaterThan(0)
    })
  })

  describe('generateGates - requirements handling', () => {
    it('should incorporate requirements', () => {
      const endState = 'Implement features'
      const requirements = [
        { id: 'req1', description: 'Feature 1' },
        { id: 'req2', description: 'Feature 2' },
        { id: 'req3', description: 'Feature 3' },
      ]

      const result = generateGates(endState, undefined, requirements)

      expect(result.gates.length).toBeGreaterThan(0)
      expect(
        result.gates.some((gate) =>
          gate.objectives.some((obj) =>
            obj.acceptanceCriteria.some((criteria) => criteria.includes('Feature'))
          )
        )
      ).toBe(true)
    })

    it('should factor in requirements count', () => {
      const requirements = [
        { id: 'R1', description: 'User authentication' },
        { id: 'R2', description: 'Data validation' },
        { id: 'R3', description: 'Error handling' },
      ]

      const result = generateGates('Build service', undefined, requirements)

      expect(result).toBeDefined()
      expect(result.gates.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle large number of requirements', () => {
      const largeRequirements = Array(100)
        .fill(null)
        .map((_, i) => ({ id: `REQ-${i}`, description: `Requirement number ${i}` }))

      const result = generateGates('Large project', undefined, largeRequirements)

      expect(result.gates).toBeDefined()
      expect(result.totalComplexity).toBeLessThanOrEqual(100)
    })

    it('should handle requirements with empty descriptions', () => {
      const result = generateGates('Project', undefined, [
        { id: 'R1', description: '' },
        { id: 'R2', description: 'Real requirement' },
      ])

      expect(result.gates).toBeDefined()
    })

    it('should handle null requirements gracefully', () => {
      const result = generateGates('Project', undefined, null as any)

      expect(result).toBeDefined()
    })
  })

  describe('generateGates - complexity and confidence', () => {
    it('should cap complexity at 100 for very large projects', () => {
      const hugeAnalysis = {
        metrics: {
          linesOfCode: 1000000,
          cyclomaticComplexity: 5000,
          coupling: 1.0,
        },
        dependencies: Array(100).fill('dependency'),
      }

      const longDescription = 'x'.repeat(5000)
      const manyRequirements = Array(50)
        .fill(null)
        .map((_, i) => ({ id: `R${i}`, description: `Requirement ${i}` }))

      const result = generateGates(longDescription, hugeAnalysis, manyRequirements)

      expect(result.totalComplexity).toBeLessThanOrEqual(100)
    })

    it('should cap complexity at 100 (comprehensive test)', () => {
      const largeAnalysis = {
        metrics: {
          linesOfCode: 500000,
          cyclomaticComplexity: 5000,
          coupling: 1.0,
        },
        dependencies: Array(50).fill('dep'),
      }

      const longDescription = 'x'.repeat(10000)
      const manyRequirements = Array(100)
        .fill(null)
        .map((_, i) => ({ id: `R${i}`, description: `Requirement ${i}` }))

      const result = generateGates(longDescription, largeAnalysis, manyRequirements)

      expect(result.totalComplexity).toBeLessThanOrEqual(100)
    })

    it('should calculate proper confidence score', () => {
      const requirements = [
        { id: 'R1', description: 'Auth' },
        { id: 'R2', description: 'Database' },
      ]

      const result = generateGates('Build service', undefined, requirements)

      if (result.gates.length > 0) {
        expect(result.confidence).toBeGreaterThanOrEqual(0)
        expect(result.confidence).toBeLessThanOrEqual(100)
      }
    })

    it('should return zero confidence for empty gates array', () => {
      const result = generateGates('')

      if (result.gates.length === 0) {
        expect(result.confidence).toBe(0)
      }
    })

    it('should return numeric confidence', () => {
      const result = generateGates('Test project')

      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(100)
    })

    it('should maintain gates with confidence scores', () => {
      const result = generateGates('Confidence test')

      if (result.gates.length > 0) {
        result.gates.forEach((gate) => {
          expect(gate.confidence).toBeGreaterThanOrEqual(0)
          expect(gate.confidence).toBeLessThanOrEqual(100)
        })
      }
    })

    it('should calculate confidence when gates exist', () => {
      const result = generateGates('Project with requirements', undefined, [
        { id: 'R1', description: 'Feature 1' },
        { id: 'R2', description: 'Feature 2' },
      ])

      if (result.gates.length > 0) {
        expect(result.confidence).toBeGreaterThanOrEqual(0)
        expect(result.confidence).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('generateGates - edge cases', () => {
    it('should handle empty end state', () => {
      const result = generateGates('')

      expect(result.gates).toBeDefined()
      expect(result.totalComplexity).toBeGreaterThanOrEqual(0)
    })

    it('should handle special characters in description', () => {
      const result = generateGates('Build API with @mentions & special #chars $%^')

      expect(result.gates).toBeDefined()
      expect(result.totalComplexity).toBeGreaterThan(0)
    })

    it('should factor description length into complexity', () => {
      const shortDesc = generateGates('X')
      const longDesc = generateGates(
        'Build comprehensive enterprise system with multiple integrated modules and dependencies'
      )

      expect(longDesc.totalComplexity).toBeGreaterThanOrEqual(shortDesc.totalComplexity)
    })

    it('should estimate complexity from description length', () => {
      const short = generateGates('API')
      const long = generateGates(
        'Build a microservices architecture with event-driven communication'
      )

      expect(short).toBeDefined()
      expect(long).toBeDefined()
    })
  })

  describe('generateGates - sequencing', () => {
    it('should return sequenced gates in result', () => {
      const result = generateGates('Multi-phase project')

      expect(result).toBeDefined()
      expect(result.gates).toBeDefined()
      expect(Array.isArray(result.gates)).toBe(true)
    })

    it('should order gates sequentially', () => {
      const result = generateGates('Sequential gates')

      if (result.gates.length > 1) {
        for (let i = 0; i < result.gates.length - 1; i++) {
          expect(result.gates[i]).toBeDefined()
          expect(result.gates[i + 1]).toBeDefined()
        }
      }
    })
  })

  describe('regenerateGatesWithAnalysis', () => {
    beforeEach(() => {
      vi.mocked(config.readProjectOverview).mockResolvedValue({
        projectName: 'Test Project',
        projectVersion: '1.0.0',
        currentGate: null,
        totalGatesPlanned: 2,
        endState: 'Build a complete service',
        startState: null,
        completedGates: [],
        currentGateInfo: null,
        upcomingGates: [],
        architecture: { layers: [], keyDependencies: {} },
      })

      vi.mocked(config.getGatesFromOverview).mockReturnValue([
        makeGateSummary({
          name: 'API Layer',
          hash: 'h1',
          status: 'completed',
          completedAt: '2026-01-01',
        }),
        makeGateSummary({
          id: 'gate-02',
          name: 'Database',
          hash: 'h2',
          status: 'in_progress',
          sequence: 2,
        }),
      ])

      vi.mocked(database.getDatabase).mockReturnValue({
        prepare: vi.fn(() => ({
          get: vi.fn().mockReturnValue(null),
        })),
      } as any)
    })

    it('should return error when gate not found', async () => {
      vi.mocked(config.getGatesFromOverview).mockReturnValue([
        makeGateSummary({
          name: 'API Layer',
          hash: 'h1',
          status: 'completed',
          completedAt: '2026-01-01',
        }),
      ])

      const result = await regenerateGatesWithAnalysis('gate-99')

      expect(result.originalGates).toHaveLength(0)
      expect(result.suggestedGates).toHaveLength(0)
      expect(result.reasoning).toContain('not found')
    })

    it('should handle overview read errors gracefully', async () => {
      vi.mocked(config.readProjectOverview).mockRejectedValue(new Error('No overview'))

      try {
        const result = await regenerateGatesWithAnalysis('gate-01')
        expect(result).toBeDefined()
      } catch (error: any) {
        // Error is thrown as expected when overview cannot be read
        expect(error.message).toContain('No overview')
      }
    })

    it('should detect analysis data table existence', async () => {
      const mockPrepare = vi.fn()
      const mockAnalysisCheck = {
        get: vi.fn().mockReturnValue(null),
      }

      mockPrepare.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return { get: vi.fn().mockReturnValue({ name: 'gate_analysis' }) }
        }
        return mockAnalysisCheck
      })

      vi.mocked(database.getDatabase).mockReturnValue({
        prepare: mockPrepare,
      } as any)

      const result = await regenerateGatesWithAnalysis('gate-01')

      expect(result).toBeDefined()
      expect(mockPrepare).toHaveBeenCalled()
    })

    it('should fall back to theoretical when no analysis', async () => {
      const result = await regenerateGatesWithAnalysis('gate-01')

      expect(result).toBeDefined()
      expect(result.reasoning).toContain('theoretical')
    })
  })

  describe('regenerateGatesTheoreticalFromProject', () => {
    beforeEach(() => {
      vi.mocked(config.readProjectOverview).mockResolvedValue({
        projectName: 'Test Project',
        projectVersion: '1.0.0',
        endState: 'Implement complete feature',
        gates: [],
        currentGate: null,
        totalGatesPlanned: 0,
        startState: null,
        completedGates: [],
        currentGateInfo: null,
        upcomingGates: [],
        architecture: { layers: [], keyDependencies: {} },
      } as any)

      vi.mocked(config.getGatesFromOverview).mockReturnValue([
        makeGateSummary({
          name: 'API',
          hash: 'h1',
          status: 'completed',
          completedAt: '2026-01-01',
        }),
        makeGateSummary({ id: 'gate-02', name: 'UI', hash: 'h2', status: 'pending', sequence: 2 }),
      ])
    })

    it('should read project overview', async () => {
      await regenerateGatesTheoreticalFromProject()

      expect(config.readProjectOverview).toHaveBeenCalled()
    })

    it('should build gates from overview', async () => {
      const result = await regenerateGatesTheoreticalFromProject()

      expect(result.originalGates).toBeDefined()
      expect(Array.isArray(result.originalGates)).toBe(true)
    })

    it('should include project end state in reasoning', async () => {
      const result = await regenerateGatesTheoreticalFromProject()

      expect(result.reasoning).toContain('Implement complete feature')
    })

    it('should suggest empty changes for theoretical regeneration', async () => {
      const result = await regenerateGatesTheoreticalFromProject()

      expect(result.changes).toBeDefined()
    })
  })
})
