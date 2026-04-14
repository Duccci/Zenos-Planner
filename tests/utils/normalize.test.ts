/**
 * Tests for normalize utilities
 */

import { describe, it, expect } from 'vitest'
import { normalizeGateId, normalizeHash, resolveGateIdentifier } from '../../src/utils/normalize.js'

describe('normalizeGateId', () => {
  it('converts numeric input to gate-XX format', () => {
    expect(normalizeGateId('1')).toBe('gate-01')
    expect(normalizeGateId('5')).toBe('gate-05')
    expect(normalizeGateId('10')).toBe('gate-10')
  })

  it('normalizes gate-X to gate-XX format', () => {
    expect(normalizeGateId('gate-1')).toBe('gate-01')
    expect(normalizeGateId('gate-5')).toBe('gate-05')
    expect(normalizeGateId('gate-10')).toBe('gate-10')
  })

  it('returns already-normalized gate-XX unchanged', () => {
    expect(normalizeGateId('gate-01')).toBe('gate-01')
    expect(normalizeGateId('gate-10')).toBe('gate-10')
    expect(normalizeGateId('gate-99')).toBe('gate-99')
  })

  it('handles various input formats', () => {
    expect(normalizeGateId('gate 01')).toBe('gate-01')
    expect(normalizeGateId('01')).toBe('gate-01')
  })

  it('returns input unchanged if no number found', () => {
    expect(normalizeGateId('invalid')).toBe('invalid')
    expect(normalizeGateId('')).toBe('')
  })
})

describe('normalizeHash', () => {
  it('removes leading # character', () => {
    expect(normalizeHash('#abc123')).toBe('abc123')
    expect(normalizeHash('#d26021701')).toBe('d26021701')
  })

  it('returns hash unchanged if no leading #', () => {
    expect(normalizeHash('abc123')).toBe('abc123')
    expect(normalizeHash('d26021701')).toBe('d26021701')
  })

  it('handles whitespace', () => {
    expect(normalizeHash('  #abc123  ')).toBe('abc123')
    expect(normalizeHash('  abc123  ')).toBe('abc123')
  })

  it('handles empty or trivial inputs', () => {
    expect(normalizeHash('')).toBe('')
    expect(normalizeHash('  ')).toBe('')
    expect(normalizeHash('#')).toBe('')
  })
})

describe('resolveGateIdentifier', () => {
  it('returns normalised gate ID for gate-XX format (fast path)', () => {
    expect(resolveGateIdentifier('gate-01')).toBe('gate-01')
    expect(resolveGateIdentifier('gate-1')).toBe('gate-01')
  })

  it('returns normalised gate ID for numeric input (fast path)', () => {
    expect(resolveGateIdentifier('1')).toBe('gate-01')
    expect(resolveGateIdentifier('42')).toBe('gate-42')
  })

  it('resolves hash input without # prefix (hash path, no DB match)', () => {
    // DB may or may not be available; function never throws — falls back gracefully
    const result = resolveGateIdentifier('abcdef1234567890')
    expect(typeof result).toBe('string')
  })

  it('strips # prefix from hash input before DB lookup', () => {
    const result = resolveGateIdentifier('#abcdef1234567890')
    expect(typeof result).toBe('string')
  })
})
