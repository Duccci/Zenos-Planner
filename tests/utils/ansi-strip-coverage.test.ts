import { describe, it, expect } from 'vitest'
import { stripAnsi, stripAnsiObject } from '../../src/utils/ansi-strip.js'

describe('ansi-strip coverage', () => {
  describe('stripAnsi', () => {
    it('should strip color escape codes', () => {
      expect(stripAnsi('\x1b[31mred text\x1b[0m')).toBe('red text')
    })

    it('should strip bold escape codes', () => {
      expect(stripAnsi('\x1b[1mbold\x1b[0m')).toBe('bold')
    })

    it('should return plain text unchanged', () => {
      expect(stripAnsi('hello world')).toBe('hello world')
    })

    it('should handle empty string', () => {
      expect(stripAnsi('')).toBe('')
    })

    it('should strip multiple escape codes', () => {
      const input = '\x1b[32mgreen\x1b[0m \x1b[34mblue\x1b[0m'
      expect(stripAnsi(input)).toBe('green blue')
    })
  })

  describe('stripAnsiObject', () => {
    it('should strip ANSI from string values', () => {
      const result = stripAnsiObject({
        name: '\x1b[31mRed\x1b[0m',
        status: '\x1b[32mOK\x1b[0m',
      })

      expect(result).toEqual({ name: 'Red', status: 'OK' })
    })

    it('should pass through non-string values', () => {
      const result = stripAnsiObject({
        count: 42 as unknown,
        active: true as unknown,
        data: null as unknown,
      })

      expect(result).toEqual({ count: 42, active: true, data: null })
    })

    it('should handle empty object', () => {
      expect(stripAnsiObject({})).toEqual({})
    })

    it('should handle mixed values', () => {
      const result = stripAnsiObject({
        label: '\x1b[1mBold\x1b[0m',
        num: 10 as unknown,
        plain: 'no ansi',
      })

      expect(result).toEqual({ label: 'Bold', num: 10, plain: 'no ansi' })
    })
  })
})
