import { describe, it, expect } from 'vitest'
import { normalizeDateTime, nowISO } from '../../src/utils/datetime.js'

describe('normalizeDateTime', () => {
  it('passes through a string already in ISO 8601 T-format', () => {
    expect(normalizeDateTime('2026-02-10T07:41:05Z')).toBe('2026-02-10T07:41:05Z')
  })

  it('passes through ISO 8601 with milliseconds', () => {
    expect(normalizeDateTime('2026-02-10T07:41:05.123Z')).toBe('2026-02-10T07:41:05.123Z')
  })

  it('converts SQLite space-separated format to ISO 8601', () => {
    expect(normalizeDateTime('2026-02-10 07:41:05')).toBe('2026-02-10T07:41:05Z')
  })

  it('converts date-only string to ISO 8601 with midnight time', () => {
    expect(normalizeDateTime('2026-02-13')).toBe('2026-02-13T00:00:00Z')
  })

  it('falls back to new Date().toISOString() for an unparseable string', () => {
    const result = normalizeDateTime('not-a-date')
    // Returns current time ISO string — just validate it is ISO shaped
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('converts a human-readable date string via JS Date parsing', () => {
    // 'Feb 10, 2026' passes all three regexes as false, then falls through to JS Date
    const result = normalizeDateTime('Feb 10, 2026')
    expect(result).toContain('2026')
  })

  it('uses fallback when value is null', () => {
    const result = normalizeDateTime(null, '2026-01-01T00:00:00Z')
    expect(result).toBe('2026-01-01T00:00:00Z')
  })

  it('uses fallback when value is undefined', () => {
    const result = normalizeDateTime(undefined, '2026-03-15T12:00:00Z')
    expect(result).toBe('2026-03-15T12:00:00Z')
  })

  it('generates current time when both value and fallback are absent', () => {
    const before = Date.now()
    const result = normalizeDateTime(null)
    const after = Date.now()

    const resultMs = new Date(result).getTime()
    expect(resultMs).toBeGreaterThanOrEqual(before)
    expect(resultMs).toBeLessThanOrEqual(after)
  })
})

describe('nowISO', () => {
  it('returns a valid ISO 8601 timestamp', () => {
    const before = Date.now()
    const result = nowISO()
    const after = Date.now()

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(new Date(result).getTime()).toBeGreaterThanOrEqual(before)
    expect(new Date(result).getTime()).toBeLessThanOrEqual(after)
  })
})
