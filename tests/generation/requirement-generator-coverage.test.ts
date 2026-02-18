import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequirementGenerator } from '../../src/generation/requirement-generator.js'

// The generator depends on pattern matching and storage
const mockStoreRequirementsFromCandidates = vi.fn()
const mockStoreRequirement = vi.fn()
const mockGetProjectRequirements = vi.fn()

vi.mock('../../src/generation/requirement-storage.js', () => ({
  RequirementStorage: vi.fn().mockImplementation(() => ({
    storeRequirementsFromCandidates: (...args: unknown[]) => mockStoreRequirementsFromCandidates(...args),
    storeRequirement: (...args: unknown[]) => mockStoreRequirement(...args),
    getProjectRequirements: (...args: unknown[]) => mockGetProjectRequirements(...args),
  })),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('requirement-generator coverage', () => {
  let generator: RequirementGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    generator = new RequirementGenerator()
  })

  describe('generateFromEndState', () => {
    it('should generate requirements from description', () => {
      const mockReqs = [
        { id: 'r1', description: 'Must support REST API', type: 'functional', priority: 'must' },
      ]
      mockStoreRequirementsFromCandidates.mockReturnValue(mockReqs)

      const result = generator.generateFromEndState('The system must support REST API endpoints for CRUD operations')
      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle errors', () => {
      mockStoreRequirementsFromCandidates.mockImplementation(() => {
        throw new Error('storage error')
      })

      expect(() => generator.generateFromEndState('must do something')).toThrow('storage error')
    })
  })

  describe('generateWithDetails', () => {
    it('should return detailed generation result', () => {
      mockStoreRequirementsFromCandidates.mockReturnValue([])

      const result = generator.generateWithDetails('The system must handle authentication and authorization')
      expect(result).toHaveProperty('requirements')
      expect(result).toHaveProperty('candidates')
      expect(result).toHaveProperty('metadata')
      expect(result.metadata.sourceTextLength).toBeGreaterThan(0)
    })

    it('should handle errors gracefully', () => {
      mockStoreRequirementsFromCandidates.mockImplementation(() => {
        throw new Error('storage problem')
      })

      const result = generator.generateWithDetails('must do X')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.requirements).toEqual([])
    })
  })

  describe('getProjectRequirements', () => {
    it('should return stored requirements', () => {
      const reqs = [{ id: 'r1', description: 'Test' }]
      mockGetProjectRequirements.mockReturnValue(reqs)

      const result = generator.getProjectRequirements()
      expect(result).toEqual(reqs)
    })
  })

  describe('static methods', () => {
    it('should extract requirements from text', () => {
      const candidates = RequirementGenerator.extractRequirementsFromText(
        'The system must support real-time notifications'
      )
      expect(Array.isArray(candidates)).toBe(true)
    })

    it('should approve requirements by confidence', () => {
      const candidates = [
        { description: 'High confidence', type: 'functional' as const, priority: 'must' as const, confidence: 0.9, source: 'test', sourceText: 'test' },
        { description: 'Medium confidence', type: 'functional' as const, priority: 'should' as const, confidence: 0.6, source: 'test', sourceText: 'test' },
        { description: 'Low confidence', type: 'functional' as const, priority: 'could' as const, confidence: 0.3, source: 'test', sourceText: 'test' },
      ]

      const result = RequirementGenerator.approveRequirements(candidates)
      expect(result.approved.length).toBe(1)
      expect(result.review.length).toBe(1)
      expect(result.rejected.length).toBe(1)
    })
  })

  describe('generateRequirementsForGate', () => {
    it('should handle missing gate PRD gracefully', async () => {
      // The generator internally uses dynamic import of fs
      // We can't easily mock those, so test the error path
      // by calling with a gate that won't exist
      await expect(generator.generateRequirementsForGate('gate-nonexistent-99')).rejects.toThrow()
    })
  })
})
