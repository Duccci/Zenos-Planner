import { describe, it, expect } from 'vitest'
import {
  validateScope,
  validateTestFileScope,
  validateMarkdownOnly,
  validateNoZenoSpecificFileNames,
  TEST_FILE_PATTERNS,
} from '../../../src/mcp/validators/scope-validator.js'

describe('validateNoZenoSpecificFileNames', () => {
  it('rejects gate identifiers in test file names', () => {
    const result = validateNoZenoSpecificFileNames([
      'tests/auth/gate-03-auth-flow.test.ts',
      'tests/auth/gate_12_session.test.ts',
    ])

    expect(result.allowed).toBe(false)
    expect(result.errors?.[0]).toContain('gate-03')
    expect(result.errors?.[0]).toContain('gate_12')
    expect(result.errors?.[0]).toContain('functionality under test')
  })

  it('allows domain names that use gate without a gate identifier', () => {
    const result = validateNoZenoSpecificFileNames([
      'src/core/gate-validator.ts',
      'tests/core/gate-validator.test.ts',
    ])

    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('is enforced by validateScope for declared and modified files', () => {
    const result = validateScope({
      filesAffected: ['src/auth/gate_12_session.ts'],
      filesModified: ['src/auth/gate_12_session.ts'],
    })

    expect(result.allowed).toBe(false)
    expect(result.errors?.some((error) => error.includes('gate_12_session.ts'))).toBe(true)
    expect(result.errors?.some((error) => error.includes('Zeno planning metadata'))).toBe(true)
  })
})

describe('validateTestFileScope', () => {
  describe('gate-tied proposals (isSolitary=false)', () => {
    it('passes when no test files in filesAffected', () => {
      const result = validateTestFileScope(
        ['src/mcp/tools/proposal-tools.ts', 'src/mcp/schemas/proposal-action-schemas.ts'],
        false
      )
      expect(result.allowed).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('passes with empty filesAffected', () => {
      const result = validateTestFileScope([], false)
      expect(result.allowed).toBe(true)
    })

    it('rejects when filesAffected contains a .test.ts file', () => {
      const result = validateTestFileScope(
        ['src/myfeature.ts', 'tests/mcp/myfeature.test.ts'],
        false
      )
      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('myfeature.test.ts')
    })

    it('rejects when filesAffected contains a .spec.ts file', () => {
      const result = validateTestFileScope(
        ['src/feature.ts', 'src/feature.spec.ts'],
        false
      )
      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('feature.spec.ts')
    })

    it('rejects when filesAffected contains tests/ directory file', () => {
      const result = validateTestFileScope(
        ['src/util.ts', 'tests/unit/util.test.ts'],
        false
      )
      expect(result.allowed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('rejects .test.tsx and .spec.tsx patterns', () => {
      const tsxTest = validateTestFileScope(['src/Component.test.tsx'], false)
      expect(tsxTest.allowed).toBe(false)

      const tsxSpec = validateTestFileScope(['src/Component.spec.tsx'], false)
      expect(tsxSpec.allowed).toBe(false)
    })

    it('error message explains the rule', () => {
      const result = validateTestFileScope(['tests/mytest.test.ts'], false)
      expect(result.errors![0]).toContain('Gate-tied proposals must not include test files')
    })
  })

  describe('solitary proposals (isSolitary=true)', () => {
    it('passes when filesAffected includes test files', () => {
      const result = validateTestFileScope(
        ['src/mcp/feature.ts', 'tests/mcp/feature.test.ts'],
        true
      )
      expect(result.allowed).toBe(true)
      expect(result.warnings).toBeUndefined()
    })

    it('returns warning when no test files in filesAffected', () => {
      const result = validateTestFileScope(
        ['src/mcp/feature.ts', 'src/mcp/helpers.ts'],
        true
      )
      expect(result.allowed).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('Solitary proposal')
    })

    it('returns warning for empty filesAffected', () => {
      const result = validateTestFileScope([], true)
      expect(result.allowed).toBe(true)
      expect(result.warnings).toBeDefined()
    })

    it('does not warn when .spec.ts file is present', () => {
      const result = validateTestFileScope(
        ['src/module.ts', 'src/module.spec.ts'],
        true
      )
      expect(result.allowed).toBe(true)
      expect(result.warnings).toBeUndefined()
    })
  })

  describe('TEST_FILE_PATTERNS export', () => {
    it('exports a non-empty patterns array', () => {
      expect(Array.isArray(TEST_FILE_PATTERNS)).toBe(true)
      expect(TEST_FILE_PATTERNS.length).toBeGreaterThan(0)
    })

    it('includes .test.ts and .spec.ts patterns', () => {
      expect(TEST_FILE_PATTERNS.some((p) => p.includes('.test.ts'))).toBe(true)
      expect(TEST_FILE_PATTERNS.some((p) => p.includes('.spec.ts'))).toBe(true)
    })
  })
})

describe('validateMarkdownOnly', () => {
  it('passes when all filesAffected are .md files', () => {
    const result = validateMarkdownOnly([
      'zeno/gates/gate-03-api-layer.md',
      'zeno/proposals/gate-03/prop-01.md',
    ])
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('passes with empty filesAffected', () => {
    const result = validateMarkdownOnly([])
    expect(result.allowed).toBe(true)
  })

  it('rejects when any file is not .md', () => {
    const result = validateMarkdownOnly([
      'zeno/gates/gate-03.md',
      'src/mcp/tools/gate-tools.ts',
    ])
    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors![0]).toContain('gate-tools.ts')
  })

  it('rejects .json files', () => {
    const result = validateMarkdownOnly(['zeno/config.json'])
    expect(result.allowed).toBe(false)
  })

  it('rejects .ts files', () => {
    const result = validateMarkdownOnly(['src/mcp/tools/proposal-tools.ts'])
    expect(result.allowed).toBe(false)
  })

  it('is case-insensitive for .MD extension', () => {
    const result = validateMarkdownOnly(['docs/README.MD', 'docs/guide.md'])
    expect(result.allowed).toBe(true)
  })

  it('error message lists all non-markdown files', () => {
    const result = validateMarkdownOnly([
      'gate.md',
      'src/feature.ts',
      'config.json',
    ])
    expect(result.allowed).toBe(false)
    expect(result.errors![0]).toContain('feature.ts')
    expect(result.errors![0]).toContain('config.json')
  })

  it('rejects mixed list leaving explanation', () => {
    const result = validateMarkdownOnly(['plan.md', 'implementation.ts'])
    expect(result.allowed).toBe(false)
    expect(result.errors![0]).toContain('Generation actions must only produce markdown')
  })
})
