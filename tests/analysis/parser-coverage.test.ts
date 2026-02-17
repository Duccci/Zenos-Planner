/**
 * Parser Coverage Tests
 *
 * Tests for parser functions to improve coverage of file parsing
 */

import { describe, it, expect } from 'vitest'
import { isParseable } from '../../src/analysis/parser.js'

describe('Parser Functions', () => {
  describe('isParseable', () => {
    it('should return true for TypeScript files', () => {
      expect(isParseable('file.ts')).toBe(true)
    })

    it('should return true for JavaScript files', () => {
      expect(isParseable('file.js')).toBe(true)
    })

    it('should return true for TSX files', () => {
      expect(isParseable('component.tsx')).toBe(true)
    })

    it('should return true for JSX files', () => {
      expect(isParseable('component.jsx')).toBe(true)
    })

    it('should return false for unsupported file types', () => {
      expect(isParseable('file.txt')).toBe(false)
    })

    it('should return false for CSS files', () => {
      expect(isParseable('style.css')).toBe(false)
    })

    it('should return false for JSON files', () => {
      expect(isParseable('config.json')).toBe(false)
    })

    it('should handle file paths with directories', () => {
      expect(isParseable('/src/components/Button.tsx')).toBe(true)
    })

    it('should handle Windows file paths', () => {
      expect(isParseable('C:\\Users\\test\\file.ts')).toBe(true)
    })

    it('should be case-insensitive for extensions', () => {
      // isParseable uses toLowerCase() so uppercase extensions are supported
      expect(isParseable('file.TS')).toBe(true)
    })

    it('should return false for files without extension', () => {
      expect(isParseable('Makefile')).toBe(false)
    })

    it('should return false for hidden files without extension', () => {
      expect(isParseable('.gitignore')).toBe(false)
    })
  })
})
