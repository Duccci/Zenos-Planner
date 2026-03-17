import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getDatabase, closeDatabase, initializeDatabase } from '../../src/storage/database.js'
import { getMetricsForGate } from '../../src/storage/metrics-storage.js'

const TEST_DIR = join(tmpdir(), `.test-metrics-capture-${Date.now()}`)

describe('metrics-capture', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    // Copy migration files
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

    await initializeDatabase(TEST_DIR)

    // Create a gate row for FK constraint
    const db = getDatabase(TEST_DIR)
    db.exec(`
      INSERT OR IGNORE INTO gates (id, sequence, name, status, hash)
      VALUES ('gate-01', 1, 'Test Gate', 'completed', 'hash-gate-01')
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

  it('captures and persists metrics snapshot for a gate', async () => {
    // Create a minimal .ts file in the test dir so the analyzer has something to scan
    const srcDir = join(TEST_DIR, 'src')
    await mkdir(srcDir, { recursive: true })
    await writeFile(
      join(srcDir, 'sample.ts'),
      'export function add(a: number, b: number): number { return a + b; }\n',
      'utf-8'
    )

    const { captureMetricsSnapshot } = await import('../../src/core/metrics-capture.js')
    const snapshot = await captureMetricsSnapshot('gate-01', TEST_DIR)

    expect(snapshot).toBeDefined()
    expect(snapshot!.gateId).toBe('gate-01')
    expect(snapshot!.fileCount).toBeGreaterThanOrEqual(1)
    expect(snapshot!.id).toBeGreaterThan(0)

    // Verify it was persisted
    const loaded = getMetricsForGate('gate-01', TEST_DIR)
    expect(loaded).toBeDefined()
    expect(loaded!.gateId).toBe('gate-01')
    expect(loaded!.fileCount).toBe(snapshot!.fileCount)
  })

  it('does not throw on scan failure', async () => {
    // Mock CodeAnalyzer to throw during scan
    vi.doMock('../../src/analysis/code-analyzer.js', () => ({
      CodeAnalyzer: class {
        async analyzeCodebase(): Promise<never> {
          throw new Error('Simulated scan failure')
        }
      },
    }))

    // Re-import to pick up the mock
    const { captureMetricsSnapshot } = await import('../../src/core/metrics-capture.js')
    const result = await captureMetricsSnapshot('gate-01', TEST_DIR)

    // Should return undefined, not throw
    expect(result).toBeUndefined()

    vi.doUnmock('../../src/analysis/code-analyzer.js')
  })

  it('returns undefined when analyzer returns metrics: null', async () => {
    vi.doMock('../../src/analysis/code-analyzer.js', () => ({
      CodeAnalyzer: class {
        async analyzeCodebase() {
          return {
            fileCount: 0,
            totalLOC: 0,
            metrics: null, // null metrics triggers the early-return branch
          }
        }
        getGraph() {
          return { getStats: () => ({ nodeCount: 0, edgeCount: 0 }) }
        }
      },
    }))

    const { captureMetricsSnapshot } = await import('../../src/core/metrics-capture.js')
    const result = await captureMetricsSnapshot('gate-01', TEST_DIR)

    expect(result).toBeUndefined()

    vi.doUnmock('../../src/analysis/code-analyzer.js')
  })
})
