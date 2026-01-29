import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  fullHash,
  shortHash,
  hashObject,
  hashFile,
  isValidHash,
  formatHashRef,
  parseHashRef,
} from '../../src/utils/hash.js'

const TEST_DIR = join(process.cwd(), '.test-temp-hash-utils')

describe('hash utilities', () => {
  describe('fullHash', () => {
    it('returns 64-character hex string', () => {
      const hash = fullHash('test content')
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('is deterministic (same input = same output)', () => {
      const hash1 = fullHash('identical content')
      const hash2 = fullHash('identical content')
      expect(hash1).toBe(hash2)
    })

    it('produces different hashes for different content', () => {
      const hash1 = fullHash('content a')
      const hash2 = fullHash('content b')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('shortHash', () => {
    it('returns 16-character hex string', () => {
      const hash = shortHash('test content')
      expect(hash).toHaveLength(16)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('is prefix of fullHash', () => {
      const short = shortHash('test')
      const full = fullHash('test')
      expect(full.startsWith(short)).toBe(true)
    })

    it('is deterministic', () => {
      const hash1 = shortHash('same')
      const hash2 = shortHash('same')
      expect(hash1).toBe(hash2)
    })
  })

  describe('hashObject', () => {
    it('returns 16-character hex string', () => {
      const hash = hashObject({ key: 'value' })
      expect(hash).toHaveLength(16)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('is deterministic regardless of property order', () => {
      const hash1 = hashObject({ a: 1, b: 2 })
      const hash2 = hashObject({ b: 2, a: 1 })
      expect(hash1).toBe(hash2)
    })

    it('produces different hashes for different objects', () => {
      const hash1 = hashObject({ x: 1 })
      const hash2 = hashObject({ x: 2 })
      expect(hash1).not.toBe(hash2)
    })

    it('handles nested objects with sorted keys', () => {
      const hash1 = hashObject({ outer: { z: 1, a: 2 } })
      const hash2 = hashObject({ outer: { a: 2, z: 1 } })
      expect(hash1).toBe(hash2)
    })

    it('handles arrays (order preserved)', () => {
      const hash1 = hashObject({ arr: [1, 2, 3] })
      const hash2 = hashObject({ arr: [3, 2, 1] })
      expect(hash1).not.toBe(hash2)
    })

    it('handles null values', () => {
      const hash = hashObject({ key: null })
      expect(hash).toHaveLength(16)
    })
  })

  describe('hashFile', () => {
    beforeEach(async () => {
      await mkdir(TEST_DIR, { recursive: true })
    })

    afterEach(async () => {
      if (existsSync(TEST_DIR)) {
        await rm(TEST_DIR, { recursive: true, force: true })
      }
    })

    it('returns 16-character hex string', async () => {
      const filePath = join(TEST_DIR, 'test.txt')
      await writeFile(filePath, 'file content', 'utf-8')

      const hash = await hashFile(filePath)
      expect(hash).toHaveLength(16)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('is deterministic for same file content', async () => {
      const filePath = join(TEST_DIR, 'test.txt')
      await writeFile(filePath, 'same content', 'utf-8')

      const hash1 = await hashFile(filePath)
      const hash2 = await hashFile(filePath)
      expect(hash1).toBe(hash2)
    })

    it('throws HashError for nonexistent file', async () => {
      const filePath = join(TEST_DIR, 'nonexistent.txt')

      await expect(hashFile(filePath)).rejects.toThrow('Failed to hash file')
    })
  })

  describe('isValidHash', () => {
    it('returns true for valid 16-char hex', () => {
      expect(isValidHash('abcdef0123456789')).toBe(true)
    })

    it('returns true for uppercase hex', () => {
      expect(isValidHash('ABCDEF0123456789')).toBe(true)
    })

    it('returns false for wrong length', () => {
      expect(isValidHash('abc123')).toBe(false)
      expect(isValidHash('abcdef01234567890')).toBe(false)
    })

    it('returns false for non-hex characters', () => {
      expect(isValidHash('ghijklmnopqrstuv')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isValidHash('')).toBe(false)
    })

    it('returns false for non-string', () => {
      expect(isValidHash(123 as unknown as string)).toBe(false)
      expect(isValidHash(null as unknown as string)).toBe(false)
    })
  })

  describe('formatHashRef', () => {
    it('adds # prefix to hash', () => {
      expect(formatHashRef('abcdef0123456789')).toBe('#abcdef0123456789')
    })

    it('does not double prefix', () => {
      expect(formatHashRef('#abcdef0123456789')).toBe('#abcdef0123456789')
    })
  })

  describe('parseHashRef', () => {
    it('extracts hash from # prefixed reference', () => {
      expect(parseHashRef('#abcdef0123456789')).toBe('abcdef0123456789')
    })

    it('extracts hash without prefix', () => {
      expect(parseHashRef('abcdef0123456789')).toBe('abcdef0123456789')
    })

    it('returns null for invalid hash', () => {
      expect(parseHashRef('#invalid')).toBeNull()
      expect(parseHashRef('')).toBeNull()
    })

    it('returns null for non-string', () => {
      expect(parseHashRef(123 as unknown as string)).toBeNull()
    })
  })
})

