import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import {
  getAppliedMigrations,
  getMigrationStatus,
  runMigrations,
} from '../../src/storage/migrations.js'
import { getDatabase, closeDatabase } from '../../src/storage/database.js'

const TEST_DIR = join(tmpdir(), `.test-migrations-${Date.now()}`)

describe('migration system', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })
    await mkdir(join(TEST_DIR, 'src', 'storage', 'migrations'), { recursive: true })
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

  describe('getAppliedMigrations', () => {
    it('returns empty array for new database', () => {
      const db = getDatabase(TEST_DIR)
      const migrations = getAppliedMigrations(db)
      expect(migrations).toEqual([])
    })

    it('creates migrations table if missing', () => {
      const db = getDatabase(TEST_DIR)
      getAppliedMigrations(db)

      const tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'")
        .get() as { name: string } | undefined

      expect(tableExists).toBeDefined()
    })
  })

  describe('getMigrationStatus', () => {
    it('identifies pending migrations', async () => {
      // Create a migration file
      await writeFile(
        join(TEST_DIR, 'src', 'storage', 'migrations', '001_test.sql'),
        'CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY);',
        'utf-8'
      )

      const db = getDatabase(TEST_DIR)
      const status = await getMigrationStatus(db, TEST_DIR)

      expect(status.applied).toEqual([])
      expect(status.pending).toContain('001_test.sql')
    })

    it('identifies applied migrations', async () => {
      // Create and apply a migration
      await writeFile(
        join(TEST_DIR, 'src', 'storage', 'migrations', '001_test.sql'),
        'CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY);',
        'utf-8'
      )

      const db = getDatabase(TEST_DIR)
      await runMigrations(db, TEST_DIR)

      const status = await getMigrationStatus(db, TEST_DIR)
      expect(status.applied.length).toBe(1)
      expect(status.pending).toEqual([])
    })
  })

  describe('runMigrations', () => {
    it('applies pending migrations in order', async () => {
      // Create multiple migrations
      await writeFile(
        join(TEST_DIR, 'src', 'storage', 'migrations', '001_first.sql'),
        'CREATE TABLE IF NOT EXISTS first_table (id TEXT PRIMARY KEY);',
        'utf-8'
      )
      await writeFile(
        join(TEST_DIR, 'src', 'storage', 'migrations', '002_second.sql'),
        'CREATE TABLE IF NOT EXISTS second_table (id TEXT PRIMARY KEY);',
        'utf-8'
      )

      const db = getDatabase(TEST_DIR)
      const applied = await runMigrations(db, TEST_DIR)

      expect(applied).toBe(2)

      // Verify tables created
      const firstTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='first_table'")
        .get() as { name: string } | undefined
      const secondTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='second_table'")
        .get() as { name: string } | undefined

      expect(firstTable).toBeDefined()
      expect(secondTable).toBeDefined()
    })

    it('records applied migrations', async () => {
      await writeFile(
        join(TEST_DIR, 'src', 'storage', 'migrations', '001_test.sql'),
        'CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY);',
        'utf-8'
      )

      const db = getDatabase(TEST_DIR)
      await runMigrations(db, TEST_DIR)

      const applied = getAppliedMigrations(db)
      expect(applied.length).toBe(1)
      expect(applied[0]?.name).toBe('001_test.sql')
    })

    it('returns 0 when no pending migrations', async () => {
      const db = getDatabase(TEST_DIR)
      const applied = await runMigrations(db, TEST_DIR)
      expect(applied).toBe(0)
    })

    it('applies migrations in numeric order', async () => {
      // Create migrations out of order
      await writeFile(
        join(TEST_DIR, 'src', 'storage', 'migrations', '002_second.sql'),
        'CREATE TABLE IF NOT EXISTS second_table (id TEXT PRIMARY KEY);',
        'utf-8'
      )
      await writeFile(
        join(TEST_DIR, 'src', 'storage', 'migrations', '001_first.sql'),
        'CREATE TABLE IF NOT EXISTS first_table (id TEXT PRIMARY KEY);',
        'utf-8'
      )

      const db = getDatabase(TEST_DIR)
      await runMigrations(db, TEST_DIR)

      const applied = getAppliedMigrations(db)
      expect(applied[0]?.name).toBe('001_first.sql')
      expect(applied[1]?.name).toBe('002_second.sql')
    })

    it('runs migrations in transaction', async () => {
      // Create a migration that will fail
      await writeFile(
        join(TEST_DIR, 'src', 'storage', 'migrations', '001_bad.sql'),
        'CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY);\nINVALID SQL SYNTAX;',
        'utf-8'
      )

      const db = getDatabase(TEST_DIR)

      await expect(runMigrations(db, TEST_DIR)).rejects.toThrow()

      // Verify migration was not recorded
      const applied = getAppliedMigrations(db)
      expect(applied.length).toBe(0)
    })
  })
})

