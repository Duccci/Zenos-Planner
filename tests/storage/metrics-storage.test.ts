import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getDatabase, closeDatabase, initializeDatabase } from '../../src/storage/database.js'
import {
  saveMetricsSnapshot,
  getMetricsForGate,
  getAllMetricsSnapshots,
  getRecentMetricsSnapshots,
} from '../../src/storage/metrics-storage.js'
import type { MetricsSnapshot } from '../../src/storage/metrics-storage.js'

const TEST_DIR = join(tmpdir(), `.test-metrics-storage-${Date.now()}`)

function makeSnapshot(gateId: string, overrides?: Partial<MetricsSnapshot>): MetricsSnapshot {
  return {
    gateId,
    fileCount: 100,
    totalLoc: 5000,
    codeLines: 3800,
    blankLines: 700,
    commentLines: 500,
    avgInstability: 0.42,
    highCouplingCount: 2,
    maxComplexity: 15,
    avgComplexity: 3.2,
    graphNodes: 30,
    graphEdges: 45,
    cycleCount: 1,
    maxDepth: 4,
    scanDurationMs: 850,
    ...overrides,
  }
}

describe('metrics-storage', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    // Copy migration files so initializeDatabase can run
    const migrationsDir = join(TEST_DIR, 'src', 'storage', 'migrations')
    await mkdir(migrationsDir, { recursive: true })
    const projectMigrationsDir = join(process.cwd(), 'src', 'storage', 'migrations')
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(projectMigrationsDir)
    for (const file of files) {
      if (!file.endsWith('.sql')) continue
      const content = await readFile(join(projectMigrationsDir, file), 'utf-8')
      await writeFile(join(migrationsDir, file), content, 'utf-8')
    }

    // Initialize database with all migrations
    await initializeDatabase(TEST_DIR)

    // Create a gate row so the FK constraint is satisfied
    const db = getDatabase(TEST_DIR)
    db.exec(`
      INSERT OR IGNORE INTO gates (id, sequence, name, status, hash)
      VALUES ('gate-01', 1, 'Test Gate 1', 'completed', 'hash-gate-01'),
             ('gate-02', 2, 'Test Gate 2', 'completed', 'hash-gate-02'),
             ('gate-03', 3, 'Test Gate 3', 'completed', 'hash-gate-03')
    `)
  })

  afterEach(async () => {
    try {
      closeDatabase()
    } catch {
      // Ignore
    }
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  })

  describe('saveMetricsSnapshot', () => {
    it('inserts a snapshot and returns the row id', () => {
      const snapshot = makeSnapshot('gate-01')
      const id = saveMetricsSnapshot(snapshot, TEST_DIR)
      expect(id).toBeGreaterThan(0)
    })

    it('stores all scalar fields correctly', () => {
      const snapshot = makeSnapshot('gate-01', {
        fileCount: 42,
        totalLoc: 1234,
        codeLines: 900,
        blankLines: 200,
        commentLines: 134,
        avgInstability: 0.55,
        highCouplingCount: 3,
        maxComplexity: 20,
        avgComplexity: 4.5,
        graphNodes: 10,
        graphEdges: 15,
        cycleCount: 2,
        maxDepth: 6,
        scanDurationMs: 1200,
      })

      saveMetricsSnapshot(snapshot, TEST_DIR)
      const loaded = getMetricsForGate('gate-01', TEST_DIR)

      expect(loaded).toBeDefined()
      expect(loaded!.fileCount).toBe(42)
      expect(loaded!.totalLoc).toBe(1234)
      expect(loaded!.codeLines).toBe(900)
      expect(loaded!.blankLines).toBe(200)
      expect(loaded!.commentLines).toBe(134)
      expect(loaded!.avgInstability).toBeCloseTo(0.55)
      expect(loaded!.highCouplingCount).toBe(3)
      expect(loaded!.maxComplexity).toBe(20)
      expect(loaded!.avgComplexity).toBeCloseTo(4.5)
      expect(loaded!.graphNodes).toBe(10)
      expect(loaded!.graphEdges).toBe(15)
      expect(loaded!.cycleCount).toBe(2)
      expect(loaded!.maxDepth).toBe(6)
      expect(loaded!.scanDurationMs).toBe(1200)
      expect(loaded!.createdAt).toBeDefined()
    })
  })

  describe('getMetricsForGate', () => {
    it('returns undefined for unknown gate', () => {
      const result = getMetricsForGate('gate-nonexistent', TEST_DIR)
      expect(result).toBeUndefined()
    })

    it('returns the most recent snapshot when multiple exist', () => {
      saveMetricsSnapshot(makeSnapshot('gate-01', { fileCount: 10 }), TEST_DIR)
      saveMetricsSnapshot(makeSnapshot('gate-01', { fileCount: 20 }), TEST_DIR)

      const result = getMetricsForGate('gate-01', TEST_DIR)
      expect(result).toBeDefined()
      expect(result!.fileCount).toBe(20)
    })
  })

  describe('getAllMetricsSnapshots', () => {
    it('returns empty array when no snapshots exist', () => {
      const results = getAllMetricsSnapshots(TEST_DIR)
      expect(results).toEqual([])
    })

    it('returns snapshots ordered oldest-first', () => {
      saveMetricsSnapshot(makeSnapshot('gate-01'), TEST_DIR)
      saveMetricsSnapshot(makeSnapshot('gate-02'), TEST_DIR)
      saveMetricsSnapshot(makeSnapshot('gate-03'), TEST_DIR)

      const results = getAllMetricsSnapshots(TEST_DIR)
      expect(results).toHaveLength(3)
      expect(results[0]!.gateId).toBe('gate-01')
      expect(results[2]!.gateId).toBe('gate-03')
    })
  })

  describe('getRecentMetricsSnapshots', () => {
    it('returns limited number of snapshots', () => {
      saveMetricsSnapshot(makeSnapshot('gate-01'), TEST_DIR)
      saveMetricsSnapshot(makeSnapshot('gate-02'), TEST_DIR)
      saveMetricsSnapshot(makeSnapshot('gate-03'), TEST_DIR)

      const results = getRecentMetricsSnapshots(2, TEST_DIR)
      expect(results).toHaveLength(2)
      // Newest-first
      expect(results[0]!.gateId).toBe('gate-03')
      expect(results[1]!.gateId).toBe('gate-02')
    })

    it('defaults to 5 when no limit specified', () => {
      saveMetricsSnapshot(makeSnapshot('gate-01'), TEST_DIR)
      saveMetricsSnapshot(makeSnapshot('gate-02'), TEST_DIR)

      const results = getRecentMetricsSnapshots(undefined, TEST_DIR)
      expect(results).toHaveLength(2) // Only 2 exist, limit is 5
    })
  })

  describe('without projectRoot (uses global db singleton)', () => {
    // After initializeDatabase(TEST_DIR) in beforeEach, getDatabase() returns the same instance.
    // These tests cover the `projectRoot ? getDatabase(projectRoot) : getDatabase()` false branches.

    it('saveMetricsSnapshot works without projectRoot (uses cached db)', () => {
      const snapshot = makeSnapshot('gate-01')
      const id = saveMetricsSnapshot(snapshot) // no projectRoot
      expect(id).toBeGreaterThan(0)
    })

    it('getMetricsForGate works without projectRoot', () => {
      saveMetricsSnapshot(makeSnapshot('gate-01'), TEST_DIR)
      const result = getMetricsForGate('gate-01') // no projectRoot
      expect(result).toBeDefined()
      expect(result!.gateId).toBe('gate-01')
    })

    it('getAllMetricsSnapshots works without projectRoot', () => {
      saveMetricsSnapshot(makeSnapshot('gate-01'), TEST_DIR)
      const results = getAllMetricsSnapshots() // no projectRoot
      expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it('getRecentMetricsSnapshots works without projectRoot', () => {
      saveMetricsSnapshot(makeSnapshot('gate-01'), TEST_DIR)
      saveMetricsSnapshot(makeSnapshot('gate-02'), TEST_DIR)
      const results = getRecentMetricsSnapshots(5) // no projectRoot
      expect(results.length).toBeGreaterThanOrEqual(1)
    })
  })
})
