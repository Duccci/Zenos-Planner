import { describe, it, expect } from 'vitest'
import { extractRequirementCandidates, validateCandidates } from '../../src/generation/requirement-patterns.js'

describe('requirement patterns', () => {
  describe('extractRequirementCandidates', () => {
    it('extracts functional requirements', () => {
      const text = 'The system must support user authentication and should provide API access.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.length).toBeGreaterThan(0)
      expect(candidates.some(c => c.type === 'functional')).toBe(true)
      expect(candidates.some(c => c.description.includes('authentication'))).toBe(true)
    })

    it('extracts non-functional requirements', () => {
      const text = 'The system must be secure and have response time under 100ms.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.some(c => c.type === 'non_functional')).toBe(true)
      expect(candidates.some(c => c.description.includes('response time'))).toBe(true)
    })

    it('extracts constraints', () => {
      const text = 'The system must comply with GDPR and work offline.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.some(c => c.type === 'constraint')).toBe(true)
      expect(candidates.some(c => c.description.includes('GDPR'))).toBe(true)
    })

    it('assigns correct priorities', () => {
      const text = 'System must be secure. It should be fast. It could be scalable.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.some(c => c.priority === 'must')).toBe(true)
      expect(candidates.some(c => c.priority === 'should')).toBe(true)
      expect(candidates.some(c => c.priority === 'could')).toBe(true)
    })

    it('provides confidence scores', () => {
      const text = 'System must support authentication.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates[0]).toHaveProperty('confidence')
      expect(candidates[0]!.confidence).toBeGreaterThan(0)
      expect(candidates[0]!.confidence).toBeLessThanOrEqual(1)
    })

    it('includes source text and metadata', () => {
      const text = 'System must be secure.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates[0]).toHaveProperty('sourceText')
      expect(candidates[0]).toHaveProperty('metadata')
      expect(candidates[0]!.metadata).toHaveProperty('pattern')
    })

    it('handles multiple sentences', () => {
      const text = 'System must be fast. It should be secure. Users need authentication.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.length).toBeGreaterThan(1)
    })

    it('sorts by confidence descending', () => {
      const text = 'System must be secure and should be fast.'

      const candidates = extractRequirementCandidates(text)

      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i - 1]!.confidence).toBeGreaterThanOrEqual(candidates[i]!.confidence)
      }
    })
  })

  describe('validateCandidates', () => {
    it('filters low-confidence candidates', () => {
      const candidates = [
        { description: 'High confidence', confidence: 0.8, type: 'functional' as const, priority: 'must' as const, sourceText: 'test' },
        { description: 'Low confidence', confidence: 0.3, type: 'functional' as const, priority: 'should' as const, sourceText: 'test' },
      ]

      const validated = validateCandidates(candidates)

      expect(validated.length).toBe(1)
      expect(validated[0]!.description).toBe('High confidence')
    })

    it('removes duplicates', () => {
      const candidates = [
        { description: 'System must be secure', confidence: 0.9, type: 'non_functional' as const, priority: 'must' as const, sourceText: 'test' },
        { description: 'System must be secure', confidence: 0.8, type: 'non_functional' as const, priority: 'must' as const, sourceText: 'test' },
      ]

      const validated = validateCandidates(candidates)

      expect(validated.length).toBe(1)
    })

    it('removes near-duplicates', () => {
      const candidates = [
        { description: 'System must be secure', confidence: 0.9, type: 'non_functional' as const, priority: 'must' as const, sourceText: 'test' },
        { description: 'System must be very secure', confidence: 0.8, type: 'non_functional' as const, priority: 'must' as const, sourceText: 'test' },
      ]

      const validated = validateCandidates(candidates)

      expect(validated.length).toBe(1)
    })
  })

  describe('pattern matching', () => {
    it('recognizes "must support" pattern', () => {
      const text = 'The system must support user login.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.some(c => c.description.includes('user login'))).toBe(true)
    })

    it('recognizes "should provide" pattern', () => {
      const text = 'It should provide REST API.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.some(c => c.description.includes('REST API'))).toBe(true)
    })

    it('recognizes performance constraints', () => {
      const text = 'Response time must be under 100ms.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.some(c => c.description.includes('100ms'))).toBe(true)
    })

    it('recognizes test coverage requirements', () => {
      const text = 'System must have 90% test coverage.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.some(c => c.description.includes('90%'))).toBe(true)
    })

    it('recognizes compliance constraints', () => {
      const text = 'Must comply with GDPR regulations.'

      const candidates = extractRequirementCandidates(text)

      expect(candidates.some(c => c.description.includes('GDPR'))).toBe(true)
    })
  })
})