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
  validateRedTestCoverage,
  validateCleanupTestFileReuse,
  inferRoleFromFilename,
  type TestFirstValidationContext,
  type ProposalGateSibling,
  type RedTestCoverageContext,
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
          role: 'feature',
          isGateTied: false,
          filesAffected: [],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })
    })

    describe('missing role field', () => {
      it('should error when gate-tied proposal has no role (undefined)', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: undefined,
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/missing a \*\*Roles\*\* field/)
      })

      it('should not error when solitary proposal has no role', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: undefined,
          isGateTied: false,
          filesAffected: ['src/feature.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })
    })

    describe('testing role', () => {
      it('should allow testing with only test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'testing',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts', 'tests/feature.spec.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })

      it('should reject testing with implementation files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'testing',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/non-test files/)
      })

      it('should reject testing with no test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'testing',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/must include test files/)
      })

      it('should allow testing with empty files affected', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'testing',
          isGateTied: true,
          filesAffected: [],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })
    })

    describe('feature role', () => {
      it('should allow feature with only implementation files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'feature',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/handler.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })

      it('should reject feature with test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'feature',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/must not contain test files/)
      })

      it('should warn on feature with no files affected', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'feature',
          isGateTied: true,
          filesAffected: [],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.[0]).toMatch(/no files in Files Affected/)
      })
    })

    describe('cleanup role', () => {
      it('should allow cleanup with only test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'cleanup',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts', 'tests/feature.spec.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.errors).toBeUndefined()
      })

      it('should reject cleanup with implementation files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'cleanup',
          isGateTied: true,
          filesAffected: ['src/feature.ts', 'src/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/non-test files/)
      })

      it('should reject cleanup with no test files', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'cleanup',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.[0]).toMatch(/must include test files/)
      })

      it('should warn cleanup that does not mention removing skip calls', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'cleanup',
          isGateTied: true,
          filesAffected: ['tests/feature.test.ts'],
          content: '## Summary\nVerify all tests pass after implementation.\n\n## Tasks\n- [ ] Run full test suite',
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors?.some((e) => /skip/i.test(e))).toBe(true)
      })

      it('should not warn cleanup that mentions it.skip removal', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'cleanup',
          isGateTied: true,
          filesAffected: ['tests/feature.test.ts'],
          content: '## Tasks\n- [ ] Remove `it.skip` calls added in the RED phase',
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.warnings?.some((w) => /skip/i.test(w))).toBeFalsy()
      })

      it('should not warn cleanup that mentions skip.it removal', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'cleanup',
          isGateTied: true,
          filesAffected: ['tests/feature.test.ts'],
          content: '## Tasks\n- [ ] Remove skip.it markers from test suite',
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.warnings?.some((w) => /skip/i.test(w))).toBeFalsy()
      })

      it('should not warn cleanup when content is not provided', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#abc123',
          role: 'cleanup',
          isGateTied: true,
          filesAffected: ['tests/feature.test.ts'],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
        expect(result.warnings?.some((w) => /skip/i.test(w))).toBeFalsy()
      })
    })

    describe('gate-level structure validation', () => {
      it('should validate gate with proper structure', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'feature',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#testing1',
              role: 'testing',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#impl1',
              role: 'feature',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#testing2',
              role: 'testing',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })

      it('should reject gate without testing proposal', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'feature',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#impl1',
              role: 'feature',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#cleanup1',
              role: 'cleanup',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.some((w) => w.includes('testing'))).toBe(true)
      })

      it('should warn gate without testing proposal (renamed from test-cleanup)', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#impl1',
          role: 'feature',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#testing1',
              role: 'testing',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#impl1',
              role: 'feature',
              createdAt: '2026-01-01T11:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        // Should warn (no cleanup/final testing), but allow the gate to proceed
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.some((w) => w.includes('testing'))).toBe(true)
      })

      it('should warn on multiple testing proposals', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#testing3',
          role: 'testing',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts'],
          gateProposals: [
            {
              hash: '#testing1',
              role: 'testing',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#testing2',
              role: 'testing',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#testing3',
              role: 'testing',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.warnings).toBeDefined()
        expect(result.warnings?.some((w) => w.includes('testing proposals'))).toBe(true)
      })

      it('should allow feature and cleanup when there is testing proposal', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#feature1',
          role: 'feature',
          isGateTied: true,
          filesAffected: ['src/feature.ts'],
          gateProposals: [
            {
              hash: '#testing1',
              role: 'testing',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#feature1',
              role: 'feature',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#cleanup1',
              role: 'cleanup',
              createdAt: '2026-01-01T12:00:00Z',
            },
          ],
        }

        const result = validateTestFirstPattern(context)
        expect(result.allowed).toBe(true)
      })
      
      it('should validate proper test-first gate structure', () => {
        const context: TestFirstValidationContext = {
          proposalHash: '#testing1',
          role: 'testing',
          isGateTied: true,
          filesAffected: ['src/feature.test.ts'],
          gateProposals: [
            {
              hash: '#testing1',
              role: 'testing',
              createdAt: '2026-01-01T10:00:00Z',
            },
            {
              hash: '#feature1',
              role: 'feature',
              createdAt: '2026-01-01T11:00:00Z',
            },
            {
              hash: '#feature2',
              role: 'feature',
              createdAt: '2026-01-01T12:00:00Z',
            },
            {
              hash: '#testing2',
              role: 'testing',
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
          role: 'testing',
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
          hash: '#testing1',
          role: 'testing',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#feature1',
          role: 'feature',
          createdAt: '2026-01-01T11:00:00Z',
        },
        {
          hash: '#testing2',
          role: 'testing',
          createdAt: '2026-01-01T12:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.allowed).toBe(true)
    })

    it('should warn on missing testing proposal', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#feature1',
          role: 'feature',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#feature2',
          role: 'feature',
          createdAt: '2026-01-01T11:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.[0]).toMatch(/no testing/)
    })

    it('should warn on too few testing proposals', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#testing1',
          role: 'testing',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#feature1',
          role: 'feature',
          createdAt: '2026-01-01T11:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.some((w) => w.includes('testing'))).toBe(true)
    })

    it('should allow multiple testing proposals (typical RED/GREEN pattern)', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#testing1',
          role: 'testing',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#feature1',
          role: 'feature',
          createdAt: '2026-01-01T11:00:00Z',
        },
        {
          hash: '#testing2',
          role: 'testing',
          createdAt: '2026-01-01T12:00:00Z',
        },
      ]

      const result = validateGateLevelTestFirst(proposals)
      expect(result.allowed).toBe(true)
    })

    it('should sort proposals by createdAt before validation', () => {
      const proposals: ProposalGateSibling[] = [
        {
          hash: '#feature1',
          role: 'feature',
          createdAt: '2026-01-01T11:00:00Z',
        },
        {
          hash: '#testing1',
          role: 'testing',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          hash: '#testing2',
          role: 'testing',
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
        role: 'testing',
        isGateTied: true,
        filesAffected: ['src/feature.test.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    it('should recognize .spec.ts files', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['src/feature.spec.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    it('should recognize __tests__ directory files', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['src/__tests__/feature.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    it('should recognize tests/ directory files', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['tests/feature.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    it('should recognize files under the src/ root', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'test-suite',
        isGateTied: true,
        filesAffected: ['src/feature.test.ts'],
      }

      const result = validateTestFirstPattern(context)
      expect(result.allowed).toBe(true)
    })

    // Python conventions
    it('should recognize test_foo.py (Python prefix)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['tests/test_feature.py'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    it('should recognize foo_test.py (Python suffix)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['src/feature_test.py'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    // Go conventions
    it('should recognize foo_test.go (Go)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['pkg/feature_test.go'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    // Java/Kotlin conventions
    it('should recognize FooTest.java (Java)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['src/test/java/FeatureTest.java'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    it('should recognize FooTests.kt (Kotlin plural)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['src/test/kotlin/FeatureTests.kt'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    it('should recognize src/test/ directory (Maven)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['src/test/java/com/example/Feature.java'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    // Ruby conventions
    it('should recognize foo_spec.rb (Ruby)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['spec/feature_spec.rb'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    it('should recognize spec/ directory (Ruby)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['spec/models/user.rb'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    // Rust conventions
    it('should recognize tests/ directory (Rust integration tests)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['tests/integration.rs'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    // C# conventions
    it('should recognize FooSpec.cs (C# spec)', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'testing',
        isGateTied: true,
        filesAffected: ['src/FeatureSpec.cs'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
    })

    // Non-test files should not be classified as test files
    it('should not classify normal source files as test files', () => {
      const context: TestFirstValidationContext = {
        proposalHash: '#abc123',
        role: 'feature',
        isGateTied: true,
        filesAffected: ['src/feature.ts', 'src/utils/helper.py', 'pkg/service.go'],
      }
      expect(validateTestFirstPattern(context).allowed).toBe(true)
      expect(validateTestFirstPattern(context).errors).toBeUndefined()
    })
  })
})

describe('validateRedTestCoverage', () => {
  it('allows when there are no sibling proposals', () => {
    const ctx: RedTestCoverageContext = {
      proposalHash: 'red001',
      redTestFiles: ['tests/core/foo.test.ts'],
      implementationProposals: [],
    }
    const result = validateRedTestCoverage(ctx)
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('allows when every impl file has a matching test file', () => {
    const ctx: RedTestCoverageContext = {
      proposalHash: 'red001',
      redTestFiles: ['tests/core/foo.test.ts', 'tests/core/bar.test.ts'],
      implementationProposals: [
        { hash: 'impl001', filesAffected: ['src/core/foo.ts', 'src/core/bar.ts'] },
      ],
    }
    const result = validateRedTestCoverage(ctx)
    expect(result.allowed).toBe(true)
  })

  it('fails when an impl file has no matching test file', () => {
    const ctx: RedTestCoverageContext = {
      proposalHash: 'red001',
      redTestFiles: ['tests/core/foo.test.ts'],
      implementationProposals: [
        { hash: 'impl001', filesAffected: ['src/core/foo.ts', 'src/core/bar.ts'] },
      ],
    }
    const result = validateRedTestCoverage(ctx)
    expect(result.allowed).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0]).toContain('bar.ts')
    expect(result.errors![0]).toContain('impl001')
  })

  it('fails for multiple uncovered files across multiple sibling proposals', () => {
    const ctx: RedTestCoverageContext = {
      proposalHash: 'red001',
      redTestFiles: ['tests/core/foo.test.ts'],
      implementationProposals: [
        { hash: 'impl001', filesAffected: ['src/core/foo.ts', 'src/core/bar.ts'] },
        { hash: 'impl002', filesAffected: ['src/core/baz.ts'] },
      ],
    }
    const result = validateRedTestCoverage(ctx)
    expect(result.allowed).toBe(false)
    expect(result.errors![0]).toContain('2 implementation')
    expect(result.errors![0]).toContain('bar.ts')
    expect(result.errors![0]).toContain('baz.ts')
  })

  it('ignores test files in sibling proposals (only checks impl files)', () => {
    const ctx: RedTestCoverageContext = {
      proposalHash: 'red001',
      redTestFiles: ['tests/core/foo.test.ts'],
      implementationProposals: [
        { hash: 'impl001', filesAffected: ['tests/core/extra.test.ts', 'src/core/foo.ts'] },
      ],
    }
    const result = validateRedTestCoverage(ctx)
    // tests/core/extra.test.ts is a test file ΓÇö ignored; src/core/foo.ts is covered
    expect(result.allowed).toBe(true)
  })

  it('matches by basename regardless of directory depth', () => {
    const ctx: RedTestCoverageContext = {
      proposalHash: 'red001',
      redTestFiles: ['tests/deep/nested/my-module.test.ts'],
      implementationProposals: [
        { hash: 'impl001', filesAffected: ['src/very/deep/path/my-module.ts'] },
      ],
    }
    const result = validateRedTestCoverage(ctx)
    expect(result.allowed).toBe(true)
  })

  it('handles spec files as valid test coverage', () => {
    const ctx: RedTestCoverageContext = {
      proposalHash: 'red001',
      redTestFiles: ['tests/core/foo.spec.ts'],
      implementationProposals: [
        { hash: 'impl001', filesAffected: ['src/core/foo.ts'] },
      ],
    }
    const result = validateRedTestCoverage(ctx)
    expect(result.allowed).toBe(true)
  })

  it('allows when sibling proposals have no files_affected', () => {
    const ctx: RedTestCoverageContext = {
      proposalHash: 'red001',
      redTestFiles: [],
      implementationProposals: [{ hash: 'impl001', filesAffected: [] }],
    }
    const result = validateRedTestCoverage(ctx)
    expect(result.allowed).toBe(true)
  })
})

describe('inferRoleFromFilename', () => {
  it('returns testing for red-prefixed filename', () => {
    expect(inferRoleFromFilename('zeno/proposals/gate-07/01-red--test-suite.md')).toBe('testing')
  })

  it('returns cleanup for green-prefixed filename', () => {
    expect(inferRoleFromFilename('zeno/proposals/gate-07/05-green--test-verification.md')).toBe('cleanup')
  })

  it('returns feature for numbered filename without red/green', () => {
    expect(inferRoleFromFilename('zeno/proposals/gate-07/02-parallel-sets.md')).toBe('feature')
  })

  it('is case-insensitive', () => {
    expect(inferRoleFromFilename('03-RED--something.md')).toBe('testing')
    expect(inferRoleFromFilename('04-GREEN--something.md')).toBe('cleanup')
  })

  it('returns undefined for undefined input', () => {
    expect(inferRoleFromFilename(undefined)).toBeUndefined()
  })

  it('returns undefined for filename without number prefix', () => {
    expect(inferRoleFromFilename('random-proposal.md')).toBeUndefined()
  })

  it('handles Windows-style paths', () => {
    expect(inferRoleFromFilename('zeno\\proposals\\gate-07\\01-red--test.md')).toBe('testing')
  })
})

describe('validateCleanupTestFileReuse', () => {
  const makeSibling = (hash: string, role: string, filesAffected?: string[]): ProposalGateSibling => ({
    hash,
    role,
    createdAt: new Date().toISOString(),
    filesAffected,
  })

  it('allows cleanup that only references test files from the testing proposal', () => {
    const gateProposals = [
      makeSibling('red001', 'testing', ['tests/core/my-module.test.ts', 'tests/core/other.test.ts']),
      makeSibling('feat001', 'feature', ['src/core/my-module.ts']),
    ]
    const result = validateCleanupTestFileReuse(
      ['tests/core/my-module.test.ts', 'tests/core/other.test.ts'],
      gateProposals
    )
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('allows cleanup that is a subset of RED test files', () => {
    const gateProposals = [
      makeSibling('red001', 'testing', ['tests/core/a.test.ts', 'tests/core/b.test.ts']),
    ]
    const result = validateCleanupTestFileReuse(['tests/core/a.test.ts'], gateProposals)
    expect(result.allowed).toBe(true)
  })

  it('rejects cleanup that introduces a new test file not in RED proposal', () => {
    const gateProposals = [
      makeSibling('red001', 'testing', ['tests/core/my-module.test.ts']),
      makeSibling('feat001', 'feature', ['src/core/my-module.ts']),
    ]
    const result = validateCleanupTestFileReuse(
      ['tests/core/my-module.test.ts', 'tests/core/new-extra.test.ts'],
      gateProposals
    )
    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toMatch(/not established by the gate.*testing proposal/)
    expect(result.errors?.[0]).toMatch(/new-extra.test.ts/)
  })

  it('rejects cleanup with entirely new test files (none from RED)', () => {
    const gateProposals = [
      makeSibling('red001', 'testing', ['tests/core/old.test.ts']),
    ]
    const result = validateCleanupTestFileReuse(['tests/core/brand-new.test.ts'], gateProposals)
    expect(result.allowed).toBe(false)
    expect(result.errors?.[0]).toMatch(/brand-new.test.ts/)
  })

  it('skips check when no testing sibling exists', () => {
    const gateProposals = [
      makeSibling('feat001', 'feature', ['src/core/my-module.ts']),
    ]
    const result = validateCleanupTestFileReuse(['tests/core/any.test.ts'], gateProposals)
    expect(result.allowed).toBe(true)
  })

  it('skips check when testing sibling has no filesAffected', () => {
    const gateProposals = [
      makeSibling('red001', 'testing', undefined),
    ]
    const result = validateCleanupTestFileReuse(['tests/core/any.test.ts'], gateProposals)
    expect(result.allowed).toBe(true)
  })

  it('skips check when testing sibling has empty filesAffected', () => {
    const gateProposals = [
      makeSibling('red001', 'testing', []),
    ]
    const result = validateCleanupTestFileReuse(['tests/core/any.test.ts'], gateProposals)
    expect(result.allowed).toBe(true)
  })

  it('ignores impl files in cleanup filesAffected (only test files are checked)', () => {
    // This scenario should not happen (cleanup must not have impl files, caught elsewhere),
    // but the reuse check should only care about test files.
    const gateProposals = [
      makeSibling('red001', 'testing', ['tests/core/my.test.ts']),
    ]
    const result = validateCleanupTestFileReuse(
      ['tests/core/my.test.ts', 'src/core/some-impl.ts'],
      gateProposals
    )
    expect(result.allowed).toBe(true)
  })

  it('allows empty cleanup filesAffected', () => {
    const gateProposals = [
      makeSibling('red001', 'testing', ['tests/core/my.test.ts']),
    ]
    const result = validateCleanupTestFileReuse([], gateProposals)
    expect(result.allowed).toBe(true)
  })
})
