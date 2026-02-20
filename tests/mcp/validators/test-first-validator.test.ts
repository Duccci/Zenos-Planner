/**
 * Tests for test-first-validator
 *
 * Validates the Test-First Gate Pattern enforcement:
 * - test-suite: first proposal with only test files
 * - implementation: middle proposals with only implementation files
 * - test-cleanup: last proposal with only test files
 * - solitary: self-contained proposals with tests
 */

import { describe, it, expect } from 'vitest'
import {
  validateTestFirstPattern,
  validateGateLevelTestFirst,
  type TestFirstValidationContext,
  type ProposalGateSibling,
} from '../../../src/mcp/validators/test-first-validator.js'

describe('test-first-validator', () => {
  describe('validateTestFirstPattern', () => {
    describe('solitary proposals', () => {
      it('should allow solitary proposals without gate context', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'solitary',
          isGateTied: false,
          filesAffected: ['src/feature.ts', 'src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })

      it('should skip all checks for solitary proposals', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'implementation',
          isGateTied: false,
          filesAffected: [],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })
    })

    describe('test-suite role', () => {
      it('should allow test-suite with only test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-suite',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts', 'tests/feature.spec.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })

      it('should reject test-suite with implementation files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-suite',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/non-test files/)
      })

      it('should reject test-suite with no test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-suite',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/must include test files/)
      })

      it('should allow test-suite with empty files affected', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-suite',
          isGateTied: true,
          filesAffected: [],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })
    })

    describe('implementation role', () => {
      it('should allow implementation with only implementation files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'implementation',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/handler.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })

      it('should reject implementation with test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'implementation',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/must not contain test files/)
      })

      it('should warn on implementation with no files affected', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'implementation',
          isGateTied: true,
          filesAffected: [],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.[0]).toMatch(/no files in Files Affected/)
      })
    })

    describe('test-cleanup role', () => {
      it('should allow test-cleanup with only test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-cleanup',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts', 'tests/feature.spec.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })

      it('should reject test-cleanup with implementation files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-cleanup',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/non-test files/)
      })

      it('should reject test-cleanup with no test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-cleanup',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/must include test files/)
      })
    })

    describe('missing or invalid role', () => {
      it('should warn on missing role for gate-tied proposal', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: undefined,
          isGateTied: true,
          filesAffected: ['src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.[0]).toMatch(/missing a \*\*Role\*\* field/)
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

    describe('gate-level structure validation', () => {
      it('should validate gate with proper structure', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'implementation',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#test-suite',
              role: 'test-suite',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#impl1',
              role: 'implementation',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#test-cleanup',
              role: 'test-cleanup',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })

      it('should reject gate without test-suite', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'implementation',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#impl1',
              role: 'implementation',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#test-cleanup',
              role: 'test-cleanup',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.[0]).toMatch(/no test-suite proposal/)
      })

      it('should reject gate without test-cleanup', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'implementation',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#test-suite',
              role: 'test-suite',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#impl1',
              role: 'implementation',
              createdAt: '2026-01-01T11:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.[0]).toMatch(/no test-cleanup proposal/)
      })

      it('should reject gate with multiple test-suite proposals', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#ts2',
          role: 'test-suite',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts'],
          gateProposals: [
            {
              hash: '#ts1',
              role: 'test-suite',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#ts2',
              role: 'test-suite',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#test-cleanup',
              role: 'test-cleanup',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/2 test-suite proposals/)
      })

      it('should reject gate with multiple test-cleanup proposals', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#tc2',
          role: 'test-cleanup',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts'],
          gateProposals: [
            {
              hash: '#test-suite',
              role: 'test-suite',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#tc1',
              role: 'test-cleanup',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#tc2',
              role: 'test-cleanup',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/2 test-cleanup proposals/)
      })

      it('should reject gate where first proposal is not test-suite', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'implementation',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#impl1',
              role: 'implementation',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#test-suite',
              role: 'test-suite',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#test-cleanup',
              role: 'test-cleanup',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/first proposal.*should be "test-suite"/)
      })

      it('should reject gate where last proposal is not test-cleanup', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'implementation',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#test-suite',
              role: 'test-suite',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#impl1',
              role: 'implementation',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#impl2',
              role: 'implementation',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.some((w) => w.includes('no test-cleanup'))).toBe(true)
      })

      it('should reject gate with implementation before test-suite', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'implementation',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#impl1',
              role: 'implementation',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#test-suite',
              role: 'test-suite',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#test-cleanup',
              role: 'test-cleanup',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        // The error is triggered because first proposal must be test-suite
        expect(result.errors?.[0]).toMatch(/first proposal.*should be "test-suite"/)
      })

      it('should validate proper test-first gate structure', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#test-suite',
          role: 'test-suite',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts'],
          gateProposals: [
            {
              hash: '#test-suite',
              role: 'test-suite',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#impl1',
              role: 'implementation',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#impl2',
              role: 'implementation',
              createdAt: '2026-01-01T12:00:00Z',
            },
            {
              hash: '#test-cleanup',
              role: 'test-cleanup',
              createdAt: '2026-01-01T13:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })

      it('should skip gate-level checks when gateProposals is empty', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-suite',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts'],
          gateProposals: [],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })

      it('should skip gate-level checks when gateProposals is undefined', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'test-suite',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })
    })

    describe('solitary proposal warnings', () => {
      it('should allow solitary proposal without any checks', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'solitary',
          isGateTied: false,
          filesAffected: ['src/feature.ts', 'src/handler.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
        expect(result.warnings).toBeUndefined()
      })

      it('should warn when gate-tied solitary has no test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'solitary',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/handler.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.[0]).toMatch(/no test files/)
      })

      it('should allow solitary proposal with only config files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'solitary',
          isGateTied: true,
          filesAffected: ['config.json', 'package.json'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })
    })
  })

  describe('validateGateLevelTestFirst', () => {
    it('should pass empty proposal list', () => {
      const result = validateGateLevelTestFirst([])
      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should pass gate with proper structure', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#test-suite',
          role: 'test-suite',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#impl1',
          role: 'implementation',
          createdAt: '2026-01-01T11:00:00Z',
        },
        {
          hash: '#test-cleanup',
          role: 'test-cleanup',
          createdAt: '2026-01-01T12:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.allowed).toBe(true)
    })

    it('should warn on missing test-suite', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#impl1',
          role: 'implementation',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#impl2',
          role: 'implementation',
          createdAt: '2026-01-01T11:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.[0]).toMatch(/no test-suite/)
    })

    it('should warn on missing test-cleanup', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#test-suite',
          role: 'test-suite',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#impl1',
          role: 'implementation',
          createdAt: '2026-01-01T11:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.[0]).toMatch(/no test-cleanup/)
    })

    it('should reject multiple test-suite proposals', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#ts1',
          role: 'test-suite',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#ts2',
          role: 'test-suite',
          createdAt: '2026-01-01T11:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]).toMatch(/2 test-suite/)
    })

    it('should sort proposals by createdAt before validation', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#impl1',
          role: 'implementation',
          createdAt: '2026-01-01T11:00:00Z',
        },
        {
          hash: '#test-suite',
          role: 'test-suite',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#test-cleanup',
          role: 'test-cleanup',
          createdAt: '2026-01-01T12:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.allowed).toBe(true)
    })
  })

  describe('test file detection', () => {
    it('should recognize .test.ts files', () => {
      // Indirect test via role consistency check
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'test-suite',
        isGateTied: true,
        filesAffected: ['src/feature.test.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    it('should recognize .spec.ts files', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'test-suite',
        isGateTied: true,
        filesAffected: ['src/feature.spec.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    it('should recognize __tests__ directory files', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'test-suite',
        isGateTied: true,
        filesAffected: ['src/__tests__/feature.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    it('should recognize tests/ directory files', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'test-suite',
        isGateTied: true,
        filesAffected: ['tests/feature.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    it('should handle Windows-style paths', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'test-suite',
        isGateTied: true,
        filesAffected: ['src\\feature.test.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })
  })
})
