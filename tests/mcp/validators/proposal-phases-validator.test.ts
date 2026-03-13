/**
 * Tests for proposal-phases-validator
 *
 * Validates that the proposal phases validator correctly detects multi-phased proposals
 * and prevents proposals with multiple implementation phases.
 */

import { describe, it, expect } from 'vitest'
import { validateProposalPhases } from '../../../src/mcp/validators/proposal-phases-validator.js'

describe('proposal-phases-validator', () => {
  describe('validateProposalPhases', () => {
    it('should pass for single-phase proposals', () => {
      const result = validateProposalPhases({
        title: 'Add authentication middleware',
        summary: 'Implement JWT-based authentication for all API endpoints.',
        taskDescriptions: [
          'Implement JWT validation in middleware',
          'Add authentication tests',
        ],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should reject proposals with explicit phase numbering', () => {
      const result = validateProposalPhases({
        title: 'Multi-phase refactoring',
        summary: 'Phase 1: Create interfaces, Phase 2: Implement handlers',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]).toMatch(/multi-phase language/i)
    })

    it('should reject proposals with stage numbering', () => {
      const result = validateProposalPhases({
        title: 'Database migration',
        summary: 'Stage 1: Create new schema, Stage 2: Migrate data, Stage 3: Cleanup old tables',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should reject proposals with sequential flow language', () => {
      const result = validateProposalPhases({
        title: 'Implement feature',
        summary: '',
        taskDescriptions: [
          'First, create the API endpoints, then implement the business logic, and finally add error handling',
        ],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]).toMatch(/multi-phase language/i)
    })

    it('should reject proposals with deferred work language', () => {
      const result = validateProposalPhases({
        title: 'Implement caching',
        summary: 'Add caching to data layer. Performance optimization will be deferred to a future phase.',
        implementationNotes: 'We will implement monitoring and alerts later.',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should reject proposals with temporal deferral', () => {
      const result = validateProposalPhases({
        title: 'Add logging',
        summary: 'Implement basic logging. Advanced filtering will be implemented later after initial deployment.',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should accept proposals with many independent tasks', () => {
      const result = validateProposalPhases({
        title: 'Large implementation',
        summary: 'Implement multiple independent features.',
        taskDescriptions: [
          'Implement feature A',
          'Implement feature B',
          'Implement feature C',
          'Implement feature D',
          'Implement feature E',
          'Add tests for all features',
        ],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
      expect(result.warnings).toBeUndefined()
    })

    it('should accept proposals with sequential dependencies via language', () => {
      const result = validateProposalPhases({
        title: 'Implement feature',
        summary: 'This proposal unlocks the next phase of development',
        taskDescriptions: [
          'Implement core functionality',
          'Add comprehensive tests',
        ],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should detect phase indicators in task names', () => {
      const result = validateProposalPhases({
        title: 'Feature implementation',
        summary: 'Implement a new feature',
        taskDescriptions: [
          'Phase 1: Create foundation classes',
          'Phase 2: Implement business logic',
        ],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should accept tasks with "test" in the name', () => {
      const result = validateProposalPhases({
        title: 'Feature implementation',
        summary: 'Implement a feature with comprehensive testing',
        taskDescriptions: [
          'Implement feature',
          'Test coverage for new feature',
          'Test edge cases',
        ],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should provide helpful error messages', () => {
      const result = validateProposalPhases({
        title: 'Multi-step implementation',
        summary: 'Phase 1 implementation of features X, then Phase 2 implementation of feature Y',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      // Check that error message contains key guidance
      expect(result.errors?.some((e: string) => e.includes('Multi-phased proposals') || e.includes('multiple'))).toBe(true)
      expect(result.errors?.some((e: string) => e.includes('separate proposal'))).toBe(true)
      expect(result.errors?.some((e: string) => e.toLowerCase().includes('dependenc'))).toBe(true)
    })

    it('should handle empty proposals gracefully', () => {
      const result = validateProposalPhases({
        title: 'Simple change',
        summary: '',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should correctly handle rollback section in validation', () => {
      const result = validateProposalPhases({
        title: 'Safe refactoring',
        summary: 'Refactor authentication service',
        rollback: 'Revert file to previous version if tests fail',
        taskDescriptions: ['Refactor authentication service', 'Add tests'],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should reject proposals mentioning future gates', () => {
      const result = validateProposalPhases({
        title: 'Initial implementation',
        summary: 'Implement feature stub for now, full implementation in a future gate.',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should reject proposals with "then" separating major tasks', () => {
      const result = validateProposalPhases({
        title: 'Database changes',
        summary: 'Update database structure and data',
        taskDescriptions: [
          'Create new database schema, then migrate existing data, then add validation',
        ],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should handle case-insensitive phase detection', () => {
      const result = validateProposalPhases({
        title: 'Multi-phased work',
        summary: 'PHASE 1 of the implementation, Phase 2 will follow',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should accept algorithm descriptions with sequential steps', () => {
      const result = validateProposalPhases({
        title: 'Implement data processing',
        summary: 'Add a data processing algorithm that parses input, then validates it, then transforms it.',
        taskDescriptions: [
          'Implement the processing algorithm',
          'Add unit tests',
        ],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should accept workflow descriptions with multiple steps', () => {
      const result = validateProposalPhases({
        title: 'Add request handler',
        summary: 'Implement HTTP request handler that receives input, then processes the request, then returns response.',
        implementationNotes: 'The workflow executes: validate data, then apply business logic, then serialize response.',
        taskDescriptions: [
          'Add request handler middleware',
          'Add error handling',
        ],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should accept data transformation pipeline descriptions', () => {
      const result = validateProposalPhases({
        title: 'Add CSV import',
        summary: 'Add CSV import functionality that reads file, then parses data, then validates records, then stores in database.',
        taskDescriptions: [
          'Implement CSV parser',
          'Add validation logic',
          'Update database schema if needed',
        ],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should reject when multiple separate deliverables are listed with "then"', () => {
      const result = validateProposalPhases({
        title: 'Multi-step feature',
        summary: 'Create authentication service, then integrate with API, then add user management.',
        taskDescriptions: [],
      })

      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should accept same data being transformed multiple times', () => {
      const result = validateProposalPhases({
        title: 'Add request pipeline',
        summary: 'Add middleware that receives the request, then validates the request, then processes the request, then returns the response.',
        taskDescriptions: [
          'Implement middleware',
          'Add tests',
        ],
      })

      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })
  })
})
