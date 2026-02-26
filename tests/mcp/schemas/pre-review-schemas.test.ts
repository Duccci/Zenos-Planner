import { describe, it, expect } from 'vitest'
import { PreReviewSchema, ScopeExpansionSchema } from '../../../src/mcp/schemas/pre-review-schemas.js'

describe('PreReviewSchema', () => {
  describe('apply phase', () => {
    const validApply = {
      phase: 'apply' as const,
      openQuestionsResolved: true,
      questionsFound: [],
      filesVerified: true,
      assumptionsDocumented: [],
      blockersIdentified: [],
    }

    it('accepts valid apply-phase input', () => {
      expect(() => PreReviewSchema.parse(validApply)).not.toThrow()
    })

    it('accepts apply-phase with assumptions and blockers documented', () => {
      const input = {
        ...validApply,
        assumptionsDocumented: ['Assumes DB schema exists'],
        blockersIdentified: ['s20260224skill01 still pending'],
      }
      expect(() => PreReviewSchema.parse(input)).not.toThrow()
    })

    it('rejects apply phase missing filesVerified', () => {
      const input = { ...validApply }
      delete (input as Partial<typeof input>).filesVerified
      const result = PreReviewSchema.safeParse(input)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('filesVerified')
      }
    })

    it('rejects when openQuestionsResolved=true but questionsFound is non-empty', () => {
      const input = {
        ...validApply,
        openQuestionsResolved: true,
        questionsFound: ['What is the expected response format?'],
      }
      const result = PreReviewSchema.safeParse(input)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('questionsFound')
      }
    })

    it('accepts when openQuestionsResolved=false with unresolved questions', () => {
      const input = {
        ...validApply,
        openQuestionsResolved: false,
        questionsFound: ['Unclear: what does "complete" mean here?'],
      }
      expect(() => PreReviewSchema.parse(input)).not.toThrow()
    })

    it('accepts apply phase with filesVerified=false (handler enforces, not schema)', () => {
      const input = { ...validApply, filesVerified: false }
      expect(() => PreReviewSchema.parse(input)).not.toThrow()
    })

    it('ignores generate-only fields when present in apply phase (no cross-contamination error)', () => {
      // Schema does not reject unknown generate-phase fields; handler ignores them
      const input = { ...validApply, gateReviewed: true, requirementsVerified: true, vagueRequirements: [] }
      expect(() => PreReviewSchema.parse(input)).not.toThrow()
    })
  })

  describe('generate phase', () => {
    const validGenerate = {
      phase: 'generate' as const,
      openQuestionsResolved: true,
      questionsFound: [],
      gateReviewed: true,
      requirementsVerified: true,
      vagueRequirements: [],
      assumptionsDocumented: [],
      blockersIdentified: [],
    }

    it('accepts valid generate-phase input', () => {
      expect(() => PreReviewSchema.parse(validGenerate)).not.toThrow()
    })

    it('rejects generate phase missing gateReviewed', () => {
      const input = { ...validGenerate }
      delete (input as Partial<typeof input>).gateReviewed
      const result = PreReviewSchema.safeParse(input)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('gateReviewed')
      }
    })

    it('rejects generate phase missing requirementsVerified', () => {
      const input = { ...validGenerate }
      delete (input as Partial<typeof input>).requirementsVerified
      const result = PreReviewSchema.safeParse(input)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('requirementsVerified')
      }
    })

    it('rejects when requirementsVerified=true but vagueRequirements is non-empty', () => {
      const input = {
        ...validGenerate,
        requirementsVerified: true,
        vagueRequirements: ['R3 acceptance criteria is unclear'],
      }
      const result = PreReviewSchema.safeParse(input)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('vagueRequirements')
      }
    })

    it('accepts generate phase when requirementsVerified=false with vague requirements', () => {
      const input = {
        ...validGenerate,
        requirementsVerified: false,
        vagueRequirements: ['R3 acceptance criteria is unclear'],
      }
      expect(() => PreReviewSchema.parse(input)).not.toThrow()
    })

    it('accepts generate phase with blockers (non-blocking)', () => {
      const input = { ...validGenerate, blockersIdentified: ['Gate-03 dependency is incomplete'] }
      expect(() => PreReviewSchema.parse(input)).not.toThrow()
    })
  })

  describe('invalid inputs', () => {
    it('rejects invalid phase value', () => {
      const result = PreReviewSchema.safeParse({
        phase: 'review',
        openQuestionsResolved: true,
        questionsFound: [],
        assumptionsDocumented: [],
        blockersIdentified: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing required fields', () => {
      const result = PreReviewSchema.safeParse({ phase: 'apply' })
      expect(result.success).toBe(false)
    })
  })
})

describe('ScopeExpansionSchema', () => {
  it('accepts valid scope expansion', () => {
    expect(() =>
      ScopeExpansionSchema.parse({
        filesAdded: ['src/mcp/new-helper.ts', 'tests/mcp/new-helper.test.ts'],
        justification: 'Required helper for new validation logic that did not exist yet',
      })
    ).not.toThrow()
  })

  it('accepts empty filesAdded', () => {
    expect(() =>
      ScopeExpansionSchema.parse({
        filesAdded: [],
        justification: 'No new files needed, documenting scope check result',
      })
    ).not.toThrow()
  })

  it('rejects missing justification', () => {
    const result = ScopeExpansionSchema.safeParse({ filesAdded: ['src/foo.ts'] })
    expect(result.success).toBe(false)
  })

  it('rejects empty justification string', () => {
    const result = ScopeExpansionSchema.safeParse({ filesAdded: [], justification: '' })
    expect(result.success).toBe(false)
  })
})
