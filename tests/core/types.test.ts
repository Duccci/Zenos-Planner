import { describe, it, expect } from 'vitest'
import type { ProposalRole } from '../../src/core/types.js'
import {
  validateTestFirstPattern,
  type TestFirstValidationContext,
} from '../../src/mcp/validators/test-first-validator.js'

// ---------------------------------------------------------------------------
// ProposalRole — type constraints
// ---------------------------------------------------------------------------
describe('ProposalRole', () => {
  it('should accept all five valid role values', () => {
    const roles: ProposalRole[] = ['testing', 'feature', 'cleanup', 'documentation', 'solitary']
    expect(roles).toHaveLength(5)
    expect(roles.includes('testing')).toBe(true)
    expect(roles.includes('feature')).toBe(true)
    expect(roles.includes('cleanup')).toBe(true)
    expect(roles.includes('documentation')).toBe(true)
    expect(roles.includes('solitary')).toBe(true)
  })

  it('should reject invalid role values at the type level', () => {
    // @ts-expect-error 'RED' is not a valid ProposalRole
    const bad1: ProposalRole = 'RED'
    // @ts-expect-error 'GREEN' is not a valid ProposalRole
    const bad2: ProposalRole = 'GREEN'
    // @ts-expect-error 'implementation' is not a valid ProposalRole
    const bad3: ProposalRole = 'implementation'
    // Runtime values are still accessible (type guard is compile-time only)
    expect(bad1).toBe('RED')
    expect(bad2).toBe('GREEN')
    expect(bad3).toBe('implementation')
  })

  it('should allow ProposalMetadata to accept roles: ProposalRole[]', () => {
    const meta = {
      hash: 'abc123',
      filename: '01-feature.md',
      path: '/p/01-feature.md',
      type: 'gate-tied' as const,
      status: 'pending',
      summary: 'A feature proposal',
      roles: ['feature', 'testing'] as ProposalRole[],
    }
    expect(meta.roles).toContain('feature')
    expect(meta.roles).toContain('testing')
  })
})

// ---------------------------------------------------------------------------
// ProposalRole — validation behaviour (moved from test-first-validator.test.ts)
// ---------------------------------------------------------------------------
describe('ProposalRole — validation behaviour', () => {
  it('should error on missing role for gate-tied proposal', () => {
    const context: TestFirstValidationContext = {
      proposalHash: '#abc123',
      role: undefined,
      isGateTied: true,
      filesAffected: ['src/feature.test.ts'],
    }

    const result = validateTestFirstPattern(context)
    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toMatch(/missing a \*\*Roles\*\* field/)
  })

  it('should allow missing role for solitary proposal', () => {
    const context: TestFirstValidationContext = {
      proposalHash: '#abc123',
      role: undefined,
      isGateTied: false,
      filesAffected: ['src/feature.ts'],
    }

    const result = validateTestFirstPattern(context)
    expect(result.allowed).toBe(true)
  })

  it('should warn on unknown role', () => {
    const context: TestFirstValidationContext = {
      proposalHash: '#abc123',
      role: 'unknown-role',
      isGateTied: true,
      filesAffected: [],
    }

    const result = validateTestFirstPattern(context)
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings?.[0]).toMatch(/Unknown proposal role/)
  })
})
