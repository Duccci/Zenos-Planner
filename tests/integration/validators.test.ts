/**
 * Integration tests for Zeno workflow validators
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { validateDependencies } from '../../src/mcp/validators/dependency-validator.js'
import { validateScope } from '../../src/mcp/validators/scope-validator.js'
import { validateQuality } from '../../src/mcp/validators/quality-validator.js'
import { validateApplyPhase } from '../../src/mcp/validators/apply-phase-validator.js'
import type { ZenoConfig } from '../../src/utils/config.js'

const mockConfig: ZenoConfig = {
  projectId: 'test-project',
  projectName: 'Test Project',
  description: 'Test project description',
  qualityThresholds: {
    codeCoverage: 90,
    typeCheckingErrors: 0,
    lintingErrorRate: 0.01,
    securityVulnerabilities: 0,
  },
  gateFrequency: 'monthly' as const,
}

describe('Dependency Validator', () => {
  it('should pass validation for valid dependencies', () => {
    const allNodes = new Map([
      ['#dep1', { hash: '#dep1', dependencies: [], gateSequence: 1 }],
      ['#dep2', { hash: '#dep2', dependencies: [], gateSequence: 2 }],
    ])

    const result = validateDependencies({
      node: {
        hash: '#new',
        dependencies: ['#dep1', '#dep2'],
        gateSequence: 3,
      },
      allNodes,
    })

    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should detect circular dependencies', () => {
    const allNodes = new Map([
      ['#a', { hash: '#a', dependencies: ['#b'] }],
      ['#b', { hash: '#b', dependencies: ['#c'] }],
      ['#c', { hash: '#c', dependencies: ['#a'] }],
    ])

    const result = validateDependencies({
      node: { hash: '#a', dependencies: ['#b'] },
      allNodes,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('Circular dependency detected')
  })

  it('should reject dependencies from later gates', () => {
    const allNodes = new Map([['#future', { hash: '#future', dependencies: [], gateSequence: 5 }]])

    const result = validateDependencies({
      node: {
        hash: '#current',
        dependencies: ['#future'],
        gateSequence: 3,
      },
      allNodes,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('later gate')
  })

  it('should warn about missing dependencies', () => {
    const allNodes = new Map()

    const result = validateDependencies({
      node: {
        hash: '#current',
        dependencies: ['#missing'],
      },
      allNodes,
    })

    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings?.[0]).toContain('not found')
  })
})

describe('Scope Validator', () => {
  it('should pass when all modified files are in scope', () => {
    const result = validateScope({
      filesAffected: ['src/auth/middleware.ts', 'src/auth/types.ts'],
      filesModified: ['src/auth/middleware.ts', 'src/auth/types.ts'],
    })

    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should reject files modified outside scope', () => {
    const result = validateScope({
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts', 'src/utils/extra.ts'],
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('outside of declared scope')
  })

  it('should allow test files by default', () => {
    const result = validateScope({
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts', 'src/auth/middleware.test.ts'],
      allowTestFiles: true,
    })

    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
  })

  it('should reject test files when allowTestFiles is false', () => {
    const result = validateScope({
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts', 'src/auth/middleware.test.ts'],
      allowTestFiles: false,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('should warn about declared but unmodified files', () => {
    const result = validateScope({
      filesAffected: ['src/auth/middleware.ts', 'src/auth/types.ts'],
      filesModified: ['src/auth/middleware.ts'],
    })

    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings?.[0]).toContain('declared in "Files Affected" but not modified')
  })

  it('should normalize paths for cross-platform comparison', () => {
    const result = validateScope({
      filesAffected: ['src\\auth\\middleware.ts'],
      filesModified: ['src/auth/middleware.ts'],
    })

    expect(result.allowed).toBe(true)
  })

  it('should reject wildcard patterns in Files Affected', () => {
    const result = validateScope({
      filesAffected: ['src/mcp/tools/*.ts'],
      filesModified: ['src/mcp/tools/gate-tools.ts'],
    })

    expect(result.allowed).toBe(false)
    expect(result.errors?.[0]).toContain('Wildcard not allowed')
  })

  it('should reject directory-only references in Files Affected', () => {
    const result = validateScope({
      filesAffected: ['src/mcp/tools/'],
      filesModified: ['src/mcp/tools/gate-tools.ts'],
    })

    expect(result.allowed).toBe(false)
    expect(result.errors?.[0]).toContain('Directory reference not allowed')
  })
})

describe('Quality Validator', () => {
  it('should pass when all thresholds are met', async () => {
    const result = await validateQuality({
      metrics: {
        coverage: 95,
        lintErrors: 5,
        totalLines: 1000,
        securityIssues: 0,
      },
      config: mockConfig,
    })

    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should fail on low code coverage', async () => {
    const result = await validateQuality({
      metrics: { coverage: 85 },
      config: mockConfig,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('Code coverage')
  })

  it('should fail on security vulnerabilities', async () => {
    const result = await validateQuality({
      metrics: { securityIssues: 2 },
      config: mockConfig,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('Security vulnerabilities')
  })

  it('should calculate lint error rate correctly', async () => {
    const result = await validateQuality({
      metrics: {
        lintErrors: 50,
        totalLines: 1000, // 50/1000 = 5% error rate
      },
      config: mockConfig,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('Lint error rate')
  })

  it('should warn when coverage not measured', async () => {
    const result = await validateQuality({
      metrics: {},
      config: mockConfig,
    })

    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings?.[0]).toContain('Code coverage not measured')
  })
})

describe('Apply Phase Validator', () => {
  it('should pass when all constraints are met', () => {
    const result = validateApplyPhase({
      proposalHash: '#abc123',
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts'],
      gitOperations: [],
      qualityMetrics: {
        coverage: 95,
        lintErrors: 0,
        securityIssues: 0,
      },
      config: mockConfig,
    })

    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should reject git operations during apply phase', () => {
    const result = validateApplyPhase({
      proposalHash: '#abc123',
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts'],
      gitOperations: ['git commit -m "test"', 'git push'],
      config: mockConfig,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('Git operations detected')
  })

  it('should reject files modified outside scope', () => {
    const result = validateApplyPhase({
      proposalHash: '#abc123',
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts', 'src/utils/extra.ts'],
      gitOperations: [],
      config: mockConfig,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('outside of declared scope')
  })

  it('should block on quality threshold issues', () => {
    const result = validateApplyPhase({
      proposalHash: '#abc123',
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts'],
      gitOperations: [],
      qualityMetrics: {
        coverage: 85, // Below threshold
      },
      config: mockConfig,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('Code coverage')
  })

  it('should fail on security vulnerabilities', () => {
    const result = validateApplyPhase({
      proposalHash: '#abc123',
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts'],
      gitOperations: [],
      qualityMetrics: {
        securityIssues: 3,
      },
      config: mockConfig,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('Security vulnerabilities')
  })

  it('should enforce multiple constraints simultaneously', () => {
    const result = validateApplyPhase({
      proposalHash: '#abc123',
      filesAffected: ['src/auth/middleware.ts'],
      filesModified: ['src/auth/middleware.ts', 'src/utils/extra.ts'],
      gitOperations: ['git commit'],
      qualityMetrics: {
        securityIssues: 2,
      },
      config: mockConfig,
    })

    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.length).toBeGreaterThanOrEqual(2) // Multiple errors
  })
})
