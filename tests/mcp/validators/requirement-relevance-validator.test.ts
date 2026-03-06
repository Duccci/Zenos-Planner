/**
 * Tests for requirement-relevance-validator
 *
 * Validates that the requirement linked to a proposal is relevant:
 * - Gate alignment: requirement must belong to the same gate (or be project-level)
 * - Agent review: always surfaces a qualitative review item for the LLM
 */

import { describe, it, expect } from 'vitest'
import {
  validateRequirementRelevance,
  type RequirementRelevanceContext,
  type LinkedRequirement,
} from '../../../src/mcp/validators/requirement-relevance-validator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides: Partial<LinkedRequirement> = {}): LinkedRequirement {
  return {
    hash: 'a1b2c3d4e5f60001',
    id: 'req-gate-06-001',
    gate_id: 'gate-06',
    description: 'Implement boundary detection serialization service with per-directory metrics',
    ...overrides,
  }
}

function makeCtx(overrides: Partial<RequirementRelevanceContext> = {}): RequirementRelevanceContext {
  return {
    proposalHash: '#abc12345',
    proposalGateId: 'gate-06',
    isSolitary: false,
    requirement: makeReq(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Gate alignment
// ---------------------------------------------------------------------------

describe('validateRequirementRelevance', () => {
  describe('gate alignment', () => {
    it('allows requirement from the same gate', () => {
      const result = validateRequirementRelevance(makeCtx())

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('blocks requirement from a different gate', () => {
      const result = validateRequirementRelevance(
        makeCtx({ requirement: makeReq({ gate_id: 'gate-03' }) })
      )

      expect(result.allowed).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0]).toMatch(/belongs to gate "gate-03"/)
      expect(result.errors?.[0]).toMatch(/this proposal is in gate "gate-06"/)
    })

    it('allows project-level requirement (gate_id = null)', () => {
      const result = validateRequirementRelevance(
        makeCtx({ requirement: makeReq({ gate_id: null }) })
      )

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('skips gate alignment for solitary proposals', () => {
      // Solitary proposals can reference requirements from any gate
      const result = validateRequirementRelevance(
        makeCtx({
          isSolitary: true,
          proposalGateId: undefined,
          requirement: makeReq({ gate_id: 'gate-01' }),
        })
      )

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('skips gate alignment when proposalGateId is undefined', () => {
      const result = validateRequirementRelevance(
        makeCtx({
          isSolitary: false,
          proposalGateId: undefined,
          requirement: makeReq({ gate_id: 'gate-02' }),
        })
      )

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Agent review items
  // -------------------------------------------------------------------------

  describe('agentReview', () => {
    it('always surfaces an agentReview item', () => {
      const result = validateRequirementRelevance(makeCtx())

      expect(result.agentReview).toBeDefined()
      expect(result.agentReview).toHaveLength(1)
    })

    it('includes the requirement id in the agentReview prompt', () => {
      const result = validateRequirementRelevance(
        makeCtx({ requirement: makeReq({ id: 'req-gate-06-special' }) })
      )

      expect(result.agentReview?.[0]).toMatch(/req-gate-06-special/)
    })

    it('includes a hash prefix in the agentReview prompt', () => {
      const result = validateRequirementRelevance(
        makeCtx({ requirement: makeReq({ hash: 'deadbeef12345678' }) })
      )

      expect(result.agentReview?.[0]).toMatch(/#deadbeef/)
    })

    it('truncates long requirement descriptions to ~140 characters', () => {
      const longDesc = 'A'.repeat(200)
      const result = validateRequirementRelevance(
        makeCtx({ requirement: makeReq({ description: longDesc }) })
      )

      const review = result.agentReview?.[0] ?? ''
      // The description snippet in the prompt should end with an ellipsis
      expect(review).toMatch(/…/)
    })

    it('includes proposal summary in the agentReview prompt when provided', () => {
      const result = validateRequirementRelevance(
        makeCtx({ proposalSummary: 'Implements the core serialization layer' })
      )

      expect(result.agentReview?.[0]).toMatch(/Implements the core serialization layer/)
    })

    it('includes task descriptions in the agentReview prompt when provided', () => {
      const result = validateRequirementRelevance(
        makeCtx({ proposalTaskDescriptions: ['Extend serializeForBoundaryDetection'] })
      )

      expect(result.agentReview?.[0]).toMatch(/Extend serializeForBoundaryDetection/)
    })

    it('prefers task descriptions over summary in the agentReview prompt', () => {
      const result = validateRequirementRelevance(
        makeCtx({
          proposalSummary: 'The summary text',
          proposalTaskDescriptions: ['Task one description'],
        })
      )

      const review = result.agentReview?.[0] ?? ''
      expect(review).toMatch(/Task one description/)
      // Summary should NOT appear when tasks are present
      expect(review).not.toMatch(/The summary text/)
    })

    it('surfaces agentReview even when gate alignment check fails', () => {
      const result = validateRequirementRelevance(
        makeCtx({ requirement: makeReq({ gate_id: 'gate-01' }) })
      )

      expect(result.allowed).toBe(false)
      expect(result.agentReview).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('falls back to hash prefix in label when id is empty', () => {
      const result = validateRequirementRelevance(
        makeCtx({ requirement: makeReq({ id: '', hash: 'f00dbabe99998888' }) })
      )

      // With empty id, the hash prefix is used as label
      expect(result.agentReview?.[0]).toMatch(/f00dbabe/)
    })

    it('replaces newlines in description with spaces in the agentReview prompt', () => {
      const result = validateRequirementRelevance(
        makeCtx({ requirement: makeReq({ description: 'Line one\nLine two\nLine three' }) })
      )

      expect(result.agentReview?.[0]).not.toMatch(/\n/)
    })
  })
})
