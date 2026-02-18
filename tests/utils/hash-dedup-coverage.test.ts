import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectHashCollision } from '../../src/utils/hash.js'

describe('hash deduplication coverage', () => {
  it('should return base hash when no collision exists', () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
      }),
    } as never

    const result = detectHashCollision(db, 'abc12345', {})
    expect(result).toBe('abc12345')
  })

  it('should append _v1 when exact hash exists and no versions exist', () => {
    const get = vi.fn().mockReturnValue({ hash: 'abc12345' }) // exact exists
    const all = vi.fn().mockReturnValue([]) // no versions

    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce({ get }) // SELECT 1 for exact
        .mockReturnValueOnce({ all }), // SELECT hash LIKE
    } as never

    const result = detectHashCollision(db, 'abc12345', {})
    expect(result).toBe('abc12345_v1')
  })

  it('should increment version when previous versions exist', () => {
    const get = vi.fn().mockReturnValue({ hash: 'abc12345' }) // exact exists
    const all = vi.fn().mockReturnValue([
      { hash: 'abc12345_v1' },
      { hash: 'abc12345_v3' },
      { hash: 'abc12345_v2' },
    ])

    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce({ get })
        .mockReturnValueOnce({ all }),
    } as never

    const result = detectHashCollision(db, 'abc12345', {})
    expect(result).toBe('abc12345_v4')
  })

  it('should return base hash on DB error', () => {
    const db = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('DB error')
      }),
    } as never

    const result = detectHashCollision(db, 'abc12345', {})
    expect(result).toBe('abc12345')
  })
})
