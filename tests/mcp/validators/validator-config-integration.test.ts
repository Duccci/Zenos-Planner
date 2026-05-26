import { describe, it, expect } from 'vitest'
import {
  validateQuality,
  type QualityValidationContext,
} from '../../../src/mcp/validators/quality-validator.js'
import {
  validateApplyPhase,
  type ApplyPhaseValidationContext,
} from '../../../src/mcp/validators/apply-phase-validator.js'
import {
  validateScope,
  type ScopeValidationContext,
} from '../../../src/mcp/validators/scope-validator.js'
import {
  validateDependencies,
  type DependencyValidationContext,
} from '../../../src/mcp/validators/dependency-validator.js'

describe('Validator Config Integration', () => {
  const mockConfig = {
    qualityThresholds: {
      codeCoverage: 90,
      typeCheckingErrors: 0,
      lintingErrorRate: 0.01,
      securityVulnerabilities: 0,
    },
    git: {
      commitFormat: 'feat: {subject}',
      remote: 'origin',
      version: '1.0.0',
    },
    version: '1.0.0',
  }

  describe('Quality Validator', () => {
    it('uses config coverage threshold', async () => {
      const context: QualityValidationContext = {
        metrics: { coverage: 85 },
        config: mockConfig,
      }

      const result = await validateQuality(context)
      expect(result.allowed).toBe(false)
      expect(result.errors?.[0]).toContain('Code coverage 85.0% is below threshold 90%')
    })

    it('passes when coverage meets threshold', async () => {
      const context: QualityValidationContext = {
        metrics: { coverage: 95 },
        config: mockConfig,
      }

      const result = await validateQuality(context)
      expect(result.allowed).toBe(true)
    })

    it('uses config lint error rate threshold', async () => {
      const context: QualityValidationContext = {
        metrics: { lintErrors: 5, totalLines: 200 }, // 2.5% rate
        config: mockConfig,
      }

      const result = await validateQuality(context)
      expect(result.allowed).toBe(false)
      expect(result.errors?.some((e) => e.includes('Lint error rate'))).toBe(true)
    })

    it('uses config security vulnerability threshold', async () => {
      const context: QualityValidationContext = {
        metrics: { securityIssues: 1 },
        config: mockConfig,
      }

      const result = await validateQuality(context)
      expect(result.allowed).toBe(false)
      expect(result.errors?.[0]).toContain('Security vulnerabilities (1) exceed threshold 0')
    })

    it('handles missing config gracefully', async () => {
      const context: QualityValidationContext = {
        metrics: { coverage: 50 },
        config: {} as any,
      }

      // Should not crash, may warn but allow
      const result = await validateQuality(context)
      expect(result).toBeDefined()
    })
  })

  describe('Apply Phase Validator', () => {
    it('blocks git operations during apply phase', () => {
      const context: ApplyPhaseValidationContext = {
        proposalHash: '#test',
        filesAffected: ['src/file.ts'],
        filesModified: [],
        gitOperations: ['git commit -m "test"'],
        config: mockConfig,
      }

      const result = validateApplyPhase(context)
      expect(result.allowed).toBe(false)
      expect(result.errors?.[0]).toContain('Git operations detected during apply phase')
    })

    it('validates scope using files affected', () => {
      const context: ApplyPhaseValidationContext = {
        proposalHash: '#test',
        filesAffected: ['src/auth.ts'],
        filesModified: ['src/auth.ts', 'src/utils.ts'], // Extra file
        gitOperations: [],
        config: mockConfig,
      }

      const result = validateApplyPhase(context)
      expect(result.allowed).toBe(false)
      expect(result.errors?.[0]).toContain('Files modified outside of declared scope')
    })

    it('blocks Zeno gate identifiers in modified file names', () => {
      const context: ApplyPhaseValidationContext = {
        proposalHash: '#test',
        filesAffected: ['tests/auth/gate-04-auth-flow.test.ts'],
        filesModified: ['tests/auth/gate-04-auth-flow.test.ts'],
        gitOperations: [],
        config: mockConfig,
      }

      const result = validateApplyPhase(context)
      expect(result.allowed).toBe(false)
      expect(result.errors?.some((error) => error.includes('gate-04-auth-flow.test.ts'))).toBe(true)
    })

    it('uses quality thresholds from config', () => {
      const context: ApplyPhaseValidationContext = {
        proposalHash: '#test',
        filesAffected: ['src/file.ts'],
        filesModified: ['src/file.ts'],
        gitOperations: [],
        qualityMetrics: { coverage: 80 },
        config: mockConfig,
      }

      const result = validateApplyPhase(context)
      expect(result.errors).toContain('Code coverage 80% is below threshold 90%')
    })
  })

  describe('Scope Validator', () => {
    it('allows test files when flag is set', () => {
      const context: ScopeValidationContext = {
        filesAffected: ['src/main.ts'],
        filesModified: ['src/main.ts', 'src/main.test.ts'],
        allowTestFiles: true,
      }

      const result = validateScope(context)
      expect(result.allowed).toBe(true)
    })

    it('warns about undeclared test files', () => {
      const context: ScopeValidationContext = {
        filesAffected: ['src/main.ts'],
        filesModified: ['src/main.ts', 'src/main.test.ts'],
        allowTestFiles: false,
      }

      const result = validateScope(context)
      expect(result.allowed).toBe(false) // Test files blocked when allowTestFiles=false
      expect(result.errors?.[0]).toContain('File modified outside of declared scope')
    })
  })

  describe('Dependency Validator', () => {
    it('detects circular dependencies', () => {
      const allNodes = new Map([
        ['#a', { hash: '#a', dependencies: ['#b'] }],
        ['#b', { hash: '#b', dependencies: ['#a'] }],
      ])

      const context: DependencyValidationContext = {
        node: { hash: '#a', dependencies: ['#b'] },
        allNodes,
      }

      const result = validateDependencies(context)
      expect(result.allowed).toBe(false)
      expect(result.errors?.some((e) => e.includes('Circular dependency'))).toBe(true)
    })

    it('validates gate ordering', () => {
      const allNodes = new Map([
        ['gate-01', { hash: 'gate-01', dependencies: [], gateId: 'gate-01', gateSequence: 1 }],
        [
          'gate-02',
          { hash: 'gate-02', dependencies: ['gate-01'], gateId: 'gate-02', gateSequence: 2 },
        ],
      ])

      const context: DependencyValidationContext = {
        node: { hash: 'gate-03', dependencies: ['gate-02'], gateId: 'gate-03', gateSequence: 3 },
        allNodes,
      }

      const result = validateDependencies(context)
      expect(result.allowed).toBe(true)
    })

    it('blocks dependencies on later gates', () => {
      const allNodes = new Map([
        ['gate-01', { hash: 'gate-01', dependencies: [], gateId: 'gate-01', gateSequence: 1 }],
        ['gate-03', { hash: 'gate-03', dependencies: [], gateId: 'gate-03', gateSequence: 3 }],
      ])

      const context: DependencyValidationContext = {
        node: { hash: 'gate-02', dependencies: ['gate-03'], gateId: 'gate-02', gateSequence: 2 },
        allNodes,
      }

      const result = validateDependencies(context)
      expect(result.allowed).toBe(false)
      expect(result.errors?.some((e) => e.includes('later gate'))).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('handles missing config fields gracefully', async () => {
      const incompleteConfig = { qualityThresholds: {} }

      const context: QualityValidationContext = {
        metrics: { coverage: 50 },
        config: incompleteConfig as any,
      }

      // Should not crash
      const result = await validateQuality(context)
      expect(result).toBeDefined()
    })

    it('handles empty validator inputs', () => {
      const context: ScopeValidationContext = {
        filesAffected: [],
        filesModified: [],
      }

      const result = validateScope(context)
      expect(result.allowed).toBe(true)
    })

    it('handles null/undefined metrics', async () => {
      const context: QualityValidationContext = {
        metrics: {},
        config: mockConfig,
      }

      const result = await validateQuality(context)
      expect(result.allowed).toBe(true)
    })
  })
})
