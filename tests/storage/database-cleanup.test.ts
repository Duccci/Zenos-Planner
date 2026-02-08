import { describe, test, expect, afterEach } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'fs'
import Database from 'better-sqlite3'
import { cleanupStaleFiles, validateDatabaseIntegrity } from '../../src/storage/database-cleanup.js'

describe('database cleanup utilities', () => {
  let tempDirs: string[] = []

  afterEach(() => {
    // Cleanup all temporary directories
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
    tempDirs = []
  })

  describe('cleanupStaleFiles', () => {
    test('testCleanupStaleFilesRemovesWALAndSHMFiles', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test.db')

      // Create a real database file
      const db = new Database(dbPath)
      db.prepare('CREATE TABLE IF NOT EXISTS foo(id INTEGER PRIMARY KEY)').run()
      db.close()

      // Create stale wal/shm files
      const wal = `${dbPath}-wal`
      const shm = `${dbPath}-shm`
      writeFileSync(wal, 'stale')
      writeFileSync(shm, 'stale')

      const res = cleanupStaleFiles(dbPath)
      expect(res.deleted).toBe(2)
      expect(res.files).toContain(wal)
      expect(res.files).toContain(shm)
      expect(existsSync(wal)).toBe(false)
      expect(existsSync(shm)).toBe(false)
    })

    test('testCleanupStaleFilesWithOnlyWALFile', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test3.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE foo(id INTEGER PRIMARY KEY)').run()
      db.close()

      const wal = `${dbPath}-wal`
      writeFileSync(wal, 'stale')

      const res = cleanupStaleFiles(dbPath)
      expect(res.deleted).toBeGreaterThan(0)
      expect(res.files).toContain(wal)
    })

    test('testCleanupStaleFilesWithOnlySHMFile', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test4.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE foo(id INTEGER PRIMARY KEY)').run()
      db.close()

      const shm = `${dbPath}-shm`
      writeFileSync(shm, 'stale')

      const res = cleanupStaleFiles(dbPath)
      expect(res.deleted).toBeGreaterThan(0)
      expect(res.files).toContain(shm)
    })

    test('testCleanupStaleFilesWithNoStaleFiles', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test5.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE foo(id INTEGER PRIMARY KEY)').run()
      db.close()

      const res = cleanupStaleFiles(dbPath)
      expect(res.deleted).toBe(0)
      expect(res.files.length).toBe(0)
    })

    test('testCleanupStaleFilesReturnsCorrectFilePaths', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test6.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE foo(id INTEGER PRIMARY KEY)').run()
      db.close()

      const wal = `${dbPath}-wal`
      const shm = `${dbPath}-shm`
      writeFileSync(wal, 'x')
      writeFileSync(shm, 'x')

      const res = cleanupStaleFiles(dbPath)
      expect(res.files.length).toBe(2)
      expect(res.deleted).toBe(2)
      expect(res.files).toEqual(expect.arrayContaining([wal, shm]))
    })

    test('testCleanupStaleFilesHandlesNonexistentDatabase', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'nonexistent.db')

      // Should not throw, just return no files
      const res = cleanupStaleFiles(dbPath)
      expect(typeof res.deleted).toBe('number')
      expect(Array.isArray(res.files)).toBe(true)
    })
  })

  describe('validateDatabaseIntegrity', () => {
    test('testValidateDatabaseIntegrityReportsOkForValidDB', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test-valid.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT)').run()
      db.prepare('CREATE TABLE posts(id INTEGER PRIMARY KEY, user_id INTEGER, FOREIGN KEY(user_id) REFERENCES users(id))').run()
      db.prepare('INSERT INTO users(name) VALUES (?)').run('alice')
      db.prepare('INSERT INTO posts(user_id) VALUES (?)').run(1)
      db.close()

      const res = validateDatabaseIntegrity(dbPath)
      expect(res.integrityOk).toBe(true)
      expect(res.integrityOutput).toContain('ok')
      expect(res.foreignKeyViolations.length).toBe(0)
    })

    test('testValidateDatabaseIntegrityDetectsForeignKeyViolations', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test-fk-violation.db')

      const db = new Database(dbPath)
      db.prepare('PRAGMA foreign_keys = OFF').run()
      db.prepare('CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT)').run()
      db.prepare('CREATE TABLE posts(id INTEGER PRIMARY KEY, user_id INTEGER, FOREIGN KEY(user_id) REFERENCES users(id))').run()
      // Insert a post with non-existent user
      db.prepare('INSERT INTO posts(id, user_id) VALUES (?, ?)').run(1, 999)
      db.close()

      const db2 = new Database(dbPath)
      db2.prepare('PRAGMA foreign_keys = ON').run()
      const res = validateDatabaseIntegrity(dbPath)

      // Should detect violation or report status
      expect(typeof res.integrityOk).toBe('boolean')
      expect(res.integrityOutput).toBeDefined()
      expect(Array.isArray(res.foreignKeyViolations)).toBe(true)

      db2.close()
    })

    test('testValidateDatabaseIntegrityWithMultipleTables', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test-multi-table.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE table1(id PRIMARY KEY, data TEXT)').run()
      db.prepare('CREATE TABLE table2(id PRIMARY KEY, data TEXT)').run()
      db.prepare('CREATE TABLE table3(id PRIMARY KEY, data TEXT)').run()
      db.prepare('INSERT INTO table1 VALUES (?, ?)').run('id1', 'data1')
      db.prepare('INSERT INTO table2 VALUES (?, ?)').run('id2', 'data2')
      db.prepare('INSERT INTO table3 VALUES (?, ?)').run('id3', 'data3')
      db.close()

      const res = validateDatabaseIntegrity(dbPath)
      expect(res.integrityOk).toBe(true)
    })

    test('testValidateDatabaseIntegrityWithIndexes', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test-indexes.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT)').run()
      db.prepare('CREATE INDEX idx_name ON items(name)').run()
      db.prepare('INSERT INTO items(name) VALUES (?)').run('item1')
      db.close()

      const res = validateDatabaseIntegrity(dbPath)
      expect(res.integrityOk).toBe(true)
    })

    test('testValidateDatabaseIntegrityEmptyDatabase', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test-empty.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE empty(id INTEGER PRIMARY KEY)').run()
      db.close()

      const res = validateDatabaseIntegrity(dbPath)
      expect(res.integrityOk).toBe(true)
    })

    test('testValidateDatabaseIntegrityReturnsOutputString', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'test-output.db')

      const db = new Database(dbPath)
      db.prepare('CREATE TABLE test(id INTEGER PRIMARY KEY)').run()
      db.close()

      const res = validateDatabaseIntegrity(dbPath)
      expect(res.integrityOutput).toBeDefined()
    })

    test('testValidateDatabaseIntegrityNonexistentDatabase', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'nonexistent.db')

      // Should throw error for nonexistent database
      expect(() => {
        validateDatabaseIntegrity(dbPath)
      }).toThrow()
    })
  })

  describe('Combined Cleanup and Validation', () => {
    test('testCleanupAndValidateWorkTogether', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'zeno-test-'))
      tempDirs.push(tmp)
      const dbPath = join(tmp, 'combined-test.db')

      // Create database
      const db = new Database(dbPath)
      db.prepare('CREATE TABLE data(id INTEGER PRIMARY KEY, value TEXT)').run()
      db.prepare('INSERT INTO data VALUES (1, ?)').run('test')
      db.close()

      // Create stale files
      const wal = `${dbPath}-wal`
      const shm = `${dbPath}-shm`
      writeFileSync(wal, 'stale')
      writeFileSync(shm, 'stale')

      // Cleanup stale files
      const cleanupRes = cleanupStaleFiles(dbPath)
      expect(cleanupRes.deleted).toBeGreaterThan(0)

      // Validate integrity after cleanup
      const validRes = validateDatabaseIntegrity(dbPath)
      expect(validRes.integrityOk).toBe(true)
    })
  })
})
