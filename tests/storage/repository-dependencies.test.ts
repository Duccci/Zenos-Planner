import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getDatabase, closeDatabase, initializeDatabase } from '../../src/storage/database.js'
import {
  addRepoDependency,
  getRepoDependencies,
  removeRepoDependency,
  getRepoDependencyGraph,
  detectCircularDependencies,
} from '../../src/storage/repository-dependencies.js'
import { saveRepository } from '../../src/storage/repository-storage.js'

const TEST_DIR = join(tmpdir(), `.test-repository-deps-${Date.now()}`)

async function seedRepositories(dir: string): Promise<void> {
  await saveRepository({ name: 'repo-a', type: 'service', path: '/projects/repo-a', hash: 'hash-a' }, dir)
  await saveRepository({ name: 'repo-b', type: 'service', path: '/projects/repo-b', hash: 'hash-b' }, dir)
  await saveRepository({ name: 'repo-c', type: 'library', path: '/projects/repo-c', hash: 'hash-c' }, dir)
  await saveRepository({ name: 'repo-d', type: 'tool', path: '/projects/repo-d', hash: 'hash-d' }, dir)
}

describe('repository-dependencies', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })

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
    const db = getDatabase(TEST_DIR)
    db.exec('PRAGMA foreign_keys = ON')

    await seedRepositories(TEST_DIR)
  })

  afterEach(async () => {
    closeDatabase()
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it.skip('adds and retrieves a dependency', async () => { // @red
    await addRepoDependency('hash-a', 'hash-b', 'imports', undefined, TEST_DIR)
    const deps = await getRepoDependencies('hash-a', TEST_DIR)
    expect(deps).toHaveLength(1)
    expect(deps[0]?.targetRepoHash).toBe('hash-b')
  })

  it.skip('removes a dependency', async () => { // @red
    await addRepoDependency('hash-a', 'hash-b', 'imports', undefined, TEST_DIR)
    await removeRepoDependency('hash-a', 'hash-b', 'imports', TEST_DIR)
    const deps = await getRepoDependencies('hash-a', TEST_DIR)
    expect(deps).toHaveLength(0)
  })

  it.skip('returns full dependency graph with nodes and edges', async () => { // @red
    await addRepoDependency('hash-a', 'hash-b', 'imports', undefined, TEST_DIR)
    await addRepoDependency('hash-b', 'hash-c', 'references', undefined, TEST_DIR)
    const graph = await getRepoDependencyGraph(TEST_DIR)
    expect(graph.edges.length).toBeGreaterThanOrEqual(2)
    expect(graph.repositories.length).toBeGreaterThanOrEqual(2)
  })

  it.skip('detects circular dependency of length 2 (A→B→A)', async () => { // @red
    await addRepoDependency('hash-a', 'hash-b', 'imports', undefined, TEST_DIR)
    await addRepoDependency('hash-b', 'hash-a', 'imports', undefined, TEST_DIR)
    const cycles = await detectCircularDependencies(TEST_DIR)
    expect(cycles.length).toBeGreaterThan(0)
    const flat = cycles.flat()
    expect(flat).toContain('hash-a')
    expect(flat).toContain('hash-b')
  })

  it.skip('detects circular dependency of length 3 (A→B→C→A)', async () => { // @red
    await addRepoDependency('hash-a', 'hash-b', 'imports', undefined, TEST_DIR)
    await addRepoDependency('hash-b', 'hash-c', 'imports', undefined, TEST_DIR)
    await addRepoDependency('hash-c', 'hash-a', 'imports', undefined, TEST_DIR)
    const cycles = await detectCircularDependencies(TEST_DIR)
    expect(cycles.length).toBeGreaterThan(0)
    const flat = cycles.flat()
    expect(flat).toContain('hash-a')
    expect(flat).toContain('hash-c')
  })

  it.skip('returns no cycles when graph is acyclic', async () => { // @red
    await addRepoDependency('hash-a', 'hash-b', 'imports', undefined, TEST_DIR)
    await addRepoDependency('hash-b', 'hash-c', 'imports', undefined, TEST_DIR)
    const cycles = await detectCircularDependencies(TEST_DIR)
    expect(cycles).toHaveLength(0)
  })

  it.skip('enforces FK constraint on non-existent source repo', async () => { // @red
    await expect(
      addRepoDependency('nonexistent-hash', 'hash-b', 'imports', undefined, TEST_DIR)
    ).rejects.toThrow()
  })

  it.skip('returns transitive edges visible in the graph', async () => { // @red
    await addRepoDependency('hash-a', 'hash-b', 'imports', undefined, TEST_DIR)
    await addRepoDependency('hash-b', 'hash-c', 'imports', undefined, TEST_DIR)
    const graph = await getRepoDependencyGraph(TEST_DIR)
    const fromA = graph.edges.filter(e => e.from === 'hash-a')
    const fromB = graph.edges.filter(e => e.from === 'hash-b')
    expect(fromA.length).toBeGreaterThanOrEqual(1)
    expect(fromB.length).toBeGreaterThanOrEqual(1)
  })
})
