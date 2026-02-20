import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getDatabase,
  closeDatabase,
  getDatabasePath,
  initializeDatabase,
  validateSchema,
  checkpointWAL,
  startWalCheckpointInterval,
  stopWalCheckpointInterval,
} from '../../src/storage/database.js'

const TEST_DIR = join(tmpdir(), `.test-db-utils-${Date.now()}`)

describe('database utilities', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    // Provide migrations in the temp project root so initializeDatabase can run.
    const migrationsDir = join(TEST_DIR, 'src', 'storage', 'migrations')
    await mkdir(migrationsDir, { recursive: true })
    const projectMigrationsDir = join(process.cwd(), 'src', 'storage', 'migrations')
    try {
      const { readdir } = await import('node:fs/promises')
      const files = await readdir(projectMigrationsDir)
      for (const file of files) {
        if (!file.endsWith('.sql')) continue
        const content = await readFile(join(projectMigrationsDir, file), 'utf-8')
        await writeFile(join(migrationsDir, file), content, 'utf-8')
      }
    } catch {
      // If migrations are unavailable, tests that require migrations may fail;
      // this setup keeps the suite self-contained when migrations exist.
    }
  })

  afterEach(async () => {
    try {
      closeDatabase()
    } catch {
      // Ignore close errors
    }
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  })

  describe('getDatabase', () => {
    it('creates database file if missing', () => {
      const db = getDatabase(TEST_DIR)
      expect(db).toBeDefined()

      const dbPath = getDatabasePath(TEST_DIR)
      expect(existsSync(dbPath)).toBe(true)
    })

    it('returns singleton instance', () => {
      const db1 = getDatabase(TEST_DIR)
      const db2 = getDatabase(TEST_DIR)
      expect(db1).toBe(db2)
    })

    it('enables WAL mode', () => {
      const db = getDatabase(TEST_DIR)
      const journalMode = db.pragma('journal_mode', { simple: true }) as string
      expect(journalMode).toBe('wal')
    })

    it('enables foreign keys', () => {
      const db = getDatabase(TEST_DIR)
      const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number
      expect(foreignKeys).toBe(1)
    })
  })

  describe('closeDatabase', () => {
    it('closes database connection', () => {
      const db = getDatabase(TEST_DIR)
      closeDatabase()

      // Attempting to use closed database should throw
      expect(() => {
        db.prepare('SELECT 1').get()
      }).toThrow()
    })

    it('resets singleton to null', () => {
      getDatabase(TEST_DIR)
      closeDatabase()

      // Next call should create new instance
      const db2 = getDatabase(TEST_DIR)
      expect(db2).toBeDefined()
    })
  })

  describe('getDatabasePath', () => {
    it('returns path to requirements.db in zeno/.zeno directory', () => {
      const path = getDatabasePath(TEST_DIR)
      expect(path).toContain('zeno')
      expect(path).toContain('.zeno')
      expect(path).toContain('requirements.db')
    })
  })

  describe('validateSchema', () => {
    it('returns invalid for empty database', () => {
      const db = getDatabase(TEST_DIR)
      const result = validateSchema(db)

      expect(result.valid).toBe(false)
      expect(result.missingTables.length).toBeGreaterThan(0)
    })

    it('returns valid after migrations', async () => {
      await initializeDatabase(TEST_DIR)
      const db = getDatabase(TEST_DIR)
      const result = validateSchema(db)

      expect(result.valid).toBe(true)
      expect(result.missingTables).toEqual([])
      expect(result.errors).toEqual([])
    })
  })

  describe('initializeDatabase', () => {
    it('creates zeno/.zeno directory if missing', async () => {
      await initializeDatabase(TEST_DIR)

      const zenoDir = join(TEST_DIR, 'zeno', '.zeno')
      expect(existsSync(zenoDir)).toBe(true)
    })

    it('creates database file', async () => {
      await initializeDatabase(TEST_DIR)

      const dbPath = getDatabasePath(TEST_DIR)
      expect(existsSync(dbPath)).toBe(true)
    })

    it('runs migrations', async () => {
      const result = await initializeDatabase(TEST_DIR)
      expect(result.migrationsApplied).toBeGreaterThan(0)
    })

    it('validates schema after initialization', async () => {
      const result = await initializeDatabase(TEST_DIR)
      expect(result.tablesCreated).toBeGreaterThan(0)
    })

    it('returns created=true on first run', async () => {
      const result = await initializeDatabase(TEST_DIR)
      expect(result.created).toBe(true)
    })

    it('returns created=false on subsequent runs', async () => {
      await initializeDatabase(TEST_DIR)
      closeDatabase()

      const result = await initializeDatabase(TEST_DIR)
      expect(result.created).toBe(false)
    })
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

  describe('validateSchema - error paths', () => {
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

  describe('WAL checkpoint interval', () => {
    afterEach(() => {
      stopWalCheckpointInterval()
    })

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
