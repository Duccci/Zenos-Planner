import { describe, it, expect } from 'vitest'
import { evaluateScopeCreep } from '../../../src/mcp/validators/scope-creep-validator.js'
import type { ScopeCreepValidationContext } from '../../../src/mcp/validators/scope-creep-validator.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function ctx(overrides: Partial<ScopeCreepValidationContext> = {}): ScopeCreepValidationContext {
  return {
    artifactType: 'proposal',
    title: 'Test Proposal',
    objectives: 'Add a new feature to the API endpoint.',
    implementationContent: 'Implement the new endpoint handler.',
    ...overrides,
  }
}

// ── Guard conditions ──────────────────────────────────────────────────────────

describe('evaluateScopeCreep — guard conditions', () => {
  it('returns allowed when objectives is empty', () => {
    const result = evaluateScopeCreep(ctx({ objectives: '' }))
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
    expect(result.warnings).toBeUndefined()
  })

  it('returns allowed when implementationContent is empty', () => {
    const result = evaluateScopeCreep(ctx({ implementationContent: '' }))
    expect(result.allowed).toBe(true)
  })

  it('returns allowed when both are whitespace-only', () => {
    const result = evaluateScopeCreep(ctx({ objectives: '   ', implementationContent: '\t\n' }))
    expect(result.allowed).toBe(true)
  })
})

// ── Silent pass (no signals) ──────────────────────────────────────────────────

describe('evaluateScopeCreep — silent pass', () => {
  it('returns allowed with no errors or warnings for clean implementation', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Add pagination to the user list endpoint.',
        implementationContent:
          'Add offset and limit params to the query. Update the controller to pass them through.',
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
    expect(result.warnings).toBeUndefined()
  })
})

// ── Out-of-scope hard violations ─────────────────────────────────────────────

describe('evaluateScopeCreep — out-of-scope violations', () => {
  it('blocks when an out-of-scope item appears verbatim in the implementation', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Add validation to the login form.',
        implementationContent:
          'Add validation to the login form. Also migrate the database to PostgreSQL.',
        outOfScopeItems: ['migrate the database to PostgreSQL'],
      })
    )
    expect(result.allowed).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0]).toContain('Out of Scope')
    expect(result.errors?.[0]).toContain('migrate the database to PostgreSQL')
  })

  it('allows when out-of-scope item does NOT appear in the implementation', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Add pagination.',
        implementationContent: 'Add pagination to the list view.',
        outOfScopeItems: ['redesign the entire database schema'],
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('skips short out-of-scope items (< 5 chars)', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Add sort.',
        implementationContent: 'Add sort button to table.',
        outOfScopeItems: ['foo'],
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('reports multiple out-of-scope violations', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Improve the UI layout.',
        implementationContent:
          'Improve the UI layout. Also rewrite the auth module and overhaul the cache layer.',
        outOfScopeItems: ['rewrite the auth module', 'overhaul the cache layer'],
      })
    )
    expect(result.allowed).toBe(false)
    expect(result.errors).toHaveLength(2)
  })
})

// ── Scope-expansion signal warnings ──────────────────────────────────────────

describe('evaluateScopeCreep — expansion signal warnings', () => {
  it('warns when a scope-expanding verb appears in implementation but not in objectives', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Add a new configuration option for retry count.',
        implementationContent:
          'Add the new option, then refactor the entire retry module to make it cleaner.',
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings?.[0]).toContain('scope drift')
  })

  it('does not warn when expansion verb is present in objectives too', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Refactor the retry module to support configurable count.',
        implementationContent:
          'Refactor the retry module. Add configurable count option. Update tests.',
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeUndefined()
  })

  it('warns on redesign signal', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Fix the broken auth token handler.',
        implementationContent: 'Fix token handler. Redesign the entire auth flow for clarity.',
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
  })

  it('warns on migrate signal', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Add a new API endpoint.',
        implementationContent:
          'Add the new endpoint. Migrate all existing endpoints to the new router.',
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
  })

  it('warns on optimize signal absent from objectives', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Add user profile page.',
        implementationContent: 'Add profile page. Optimize all database queries while there.',
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
  })

  it('produces no warning when implementation has no expansion signals at all', () => {
    const result = evaluateScopeCreep(
      ctx({
        objectives: 'Add CSV export button.',
        implementationContent: 'Add export button to toolbar. Wire up download handler.',
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeUndefined()
  })
})

// ── Gate artifact type ────────────────────────────────────────────────────────

describe('evaluateScopeCreep — gate artifact type', () => {
  it('works identically for gate artifact type', () => {
    const result = evaluateScopeCreep(
      ctx({
        artifactType: 'gate',
        title: 'Gate 05: Diagram Generation',
        objectives: 'Generate architecture diagrams from repository metadata.',
        implementationContent:
          'Generate diagrams from metadata. Overhaul the entire file system abstraction.',
      })
    )
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
  })
})
