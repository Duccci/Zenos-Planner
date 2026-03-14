import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  runMigrations,
} from '../../src/storage/migrations.js'
import { getDatabase, closeDatabase } from '../../src/storage/database.js'

const TEST_DIR = join(tmpdir(), `.test-migrations-${Date.now()}`)

/** Copy schema.sql from the project into the temp test directory. */
async function copySchema(testDir: string): Promise<void> {
  const src = join(process.cwd(), 'src', 'storage', 'migrations', 'schema.sql')
  const dest = join(testDir, 'src', 'storage', 'migrations', 'schema.sql')
  await mkdir(join(testDir, 'src', 'storage', 'migrations'), { recursive: true })
  await copyFile(src, dest)
}

describe('migration system', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })
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

  describe('runMigrations', () => {
    it('creates all required tables on a fresh database', async () => {
      await copySchema(TEST_DIR)
      const db = getDatabase(TEST_DIR)
      await runMigrations(db, TEST_DIR)

      for (const table of ['gates', 'repositories', 'requirements', 'proposals', 'metrics_snapshots']) {
        const row = db
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
          .get(table) as { name: string } | undefined
        expect(row, `table '${table}' should exist`).toBeDefined()
      }
    })

    it('returns 1 on first apply (fresh database)', async () => {
      await copySchema(TEST_DIR)
      const db = getDatabase(TEST_DIR)
      const result = await runMigrations(db, TEST_DIR)
      expect(result).toBe(1)
    })

    it('returns 0 on subsequent apply (already initialised)', async () => {
      await copySchema(TEST_DIR)
      const db = getDatabase(TEST_DIR)
      await runMigrations(db, TEST_DIR)
      const result = await runMigrations(db, TEST_DIR)
      expect(result).toBe(0)
    })

    it('is idempotent — running twice does not throw', async () => {
      await copySchema(TEST_DIR)
      const db = getDatabase(TEST_DIR)
      await expect(runMigrations(db, TEST_DIR)).resolves.not.toThrow()
      await expect(runMigrations(db, TEST_DIR)).resolves.not.toThrow()
    })

    it('also creates requirement_gate_links table', async () => {
      await copySchema(TEST_DIR)
      const db = getDatabase(TEST_DIR)
      await runMigrations(db, TEST_DIR)

      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='requirement_gate_links'")
        .get() as { name: string } | undefined
      expect(row).toBeDefined()
    })

    it('succeeds even when no projectRoot is provided (schema is install-relative)', async () => {
      // Schema is now resolved from the Zeno installation dir, not projectRoot,
      // so runMigrations always finds it regardless of what projectRoot is passed.
      const db = getDatabase(TEST_DIR)
      await expect(runMigrations(db, TEST_DIR)).resolves.not.toThrow()
    })
  })
})
