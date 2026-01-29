import { describe, it, expect } from 'vitest'
import { parseSemver, bumpSemver } from '../../src/utils/version.js'

describe('version utilities', () => {
  describe('parseSemver', () => {
    it('parses valid semver', () => {
      expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    })

    it('rejects invalid semver', () => {
      expect(() => parseSemver('1.2')).toThrow()
      expect(() => parseSemver('1.2.3.4')).toThrow()
      expect(() => parseSemver('v1.2.3')).toThrow()
    })
  })

  describe('bumpSemver', () => {
    it('bumps patch', () => {
      expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4')
    })

    it('bumps minor and resets patch', () => {
      expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0')
    })

    it('bumps major and resets minor and patch', () => {
      expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0')
    })
  })
})

