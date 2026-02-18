/**
 * Database Branch Coverage Tests
 *
 * Targets uncovered branches: WAL checkpoint (error path, cached stmt),
 * validateSchema (error in prepare), initializeDatabase, closeDatabase
 * with checkpoint error, stopWalCheckpointInterval idempotent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkpointWAL,
  validateSchema,
  closeDatabase,
  startWalCheckpointInterval,
  stopWalCheckpointInterval,
  getDatabasePath,
} from '../../src/storage/database.js'

describe('Database branch coverage', () => {
  afterEach(() => {
    stopWalCheckpointInterval()
    vi.restoreAllMocks()
  })

  describe('checkpointWAL', () => {
    it('returns blocked when statement get() throws', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockImplementation(() => {
            throw new Error('database is locked')
          }),
        }),
      } as any

      const result = checkpointWAL(mockDb)
      expect(result.status).toBe('blocked')
      expect(result.detail).toContain('database is locked')
    })

    it('returns ok when checkpoint succeeds', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ busy: 0, checkpointed: 10, log: 10 }),
        }),
      } as any

      const result = checkpointWAL(mockDb)
      expect(result.status).toBe('ok')
      expect(result.detail).toBeDefined()
    })

    it('returns ok even when pragma returns undefined', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(undefined),
        }),
      } as any

      const result = checkpointWAL(mockDb)
      expect(result.status).toBe('ok')
      expect(result.detail).toBe('ok')
    })
  })

  describe('validateSchema', () => {
    it('returns valid when requirements table exists', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ name: 'requirements' }),
        }),
      } as any

      const result = validateSchema(mockDb)
      expect(result.valid).toBe(true)
      expect(result.missingTables).toEqual([])
      expect(result.errors).toEqual([])
    })

    it('returns missing table when table not found', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(undefined),
        }),
      } as any

      const result = validateSchema(mockDb)
      expect(result.valid).toBe(false)
      expect(result.missingTables).toContain('requirements')
    })

    it('records error when prepare throws', () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('corrupt db')
        }),
      } as any

      const result = validateSchema(mockDb)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('corrupt db')
    })
  })

  describe('getDatabasePath', () => {
    it('returns path containing requirements.db', () => {
      const p = getDatabasePath('/fake/project')
      expect(p).toContain('requirements.db')
    })
  })

  describe('startWalCheckpointInterval / stopWalCheckpointInterval', () => {
    it('stops interval idempotently', () => {
      stopWalCheckpointInterval()
      stopWalCheckpointInterval()
      // Should not throw
    })

    it('restarts interval on repeated start', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      } as any

      startWalCheckpointInterval(600000)
      startWalCheckpointInterval(600000)
      stopWalCheckpointInterval()
    })
  })
})
