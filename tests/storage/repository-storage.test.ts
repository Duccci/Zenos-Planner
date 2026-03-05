import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getDatabase, closeDatabase, initializeDatabase } from '../../src/storage/database.js'
import {
  saveRepository,
  getRepositoryByHash,
  listRepositories,
  updateRepository,
  deleteRepository,
} from '../../src/storage/repository-storage.js'

const TEST_DIR = join(tmpdir(), `.test-repository-storage-${Date.now()}`)

describe('repository-storage', () => {
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
  })

  afterEach(async () => {
    closeDatabase()
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('saves and retrieves a repository by hash', async () => {
    await saveRepository(
      { name: 'my-service', type: 'service', path: '/projects/my-service', hash: 'abc12345' },
      TEST_DIR
    )
    const repo = await getRepositoryByHash('abc12345', TEST_DIR)
    expect(repo).toBeDefined()
    expect(repo?.name).toBe('my-service')
    expect(repo?.type).toBe('service')
  })

  it('returns undefined for unknown hash', async () => {
    const repo = await getRepositoryByHash('doesnotexist', TEST_DIR)
    expect(repo).toBeUndefined()
  })

  it('lists all repositories', async () => {
    await saveRepository({ name: 'svc-a', type: 'service', path: '/projects/svc-a', hash: 'hash-a' }, TEST_DIR)
    await saveRepository({ name: 'lib-b', type: 'library', path: '/projects/lib-b', hash: 'hash-b' }, TEST_DIR)
    const repos = await listRepositories(undefined, TEST_DIR)
    expect(repos).toHaveLength(2)
  })

  it('filters repositories by type', async () => {
    await saveRepository({ name: 'svc-a', type: 'service', path: '/projects/svc-a', hash: 'hash-a' }, TEST_DIR)
    await saveRepository({ name: 'lib-b', type: 'library', path: '/projects/lib-b', hash: 'hash-b' }, TEST_DIR)
    const services = await listRepositories('service', TEST_DIR)
    expect(services).toHaveLength(1)
    expect(services[0]?.type).toBe('service')
  })

  it('updates repository name', async () => {
    await saveRepository({ name: 'tool-c', type: 'tool', path: '/projects/tool-c', hash: 'hash-c' }, TEST_DIR)
    await updateRepository('hash-c', { name: 'tool-c-renamed' }, TEST_DIR)
    const repo = await getRepositoryByHash('hash-c', TEST_DIR)
    expect(repo?.name).toBe('tool-c-renamed')
  })

  it('deletes a repository', async () => {
    await saveRepository({ name: 'app-d', type: 'app', path: '/projects/app-d', hash: 'hash-d' }, TEST_DIR)
    await deleteRepository('hash-d', TEST_DIR)
    const repo = await getRepositoryByHash('hash-d', TEST_DIR)
    expect(repo).toBeUndefined()
  })

  it('throws on duplicate hash', async () => {
    await saveRepository({ name: 'svc-e', type: 'service', path: '/projects/svc-e', hash: 'dup-hash' }, TEST_DIR)
    expect(() =>
      saveRepository({ name: 'svc-e2', type: 'service', path: '/projects/svc-e2', hash: 'dup-hash' }, TEST_DIR)
    ).toThrow()
  })

  it('rejects paths with .. sequences', async () => {
    expect(() =>
      saveRepository(
        { name: 'evil', type: 'service', path: '/projects/../etc/passwd', hash: 'hash-evil' },
        TEST_DIR
      )
    ).toThrow(/traversal|invalid|\.\./i)
  })

  it('round-trips metadata through JSON serialization', async () => {
    const metadata = { tags: ['backend', 'api'], version: '2.0.0' }
    await saveRepository(
      { name: 'svc-meta', type: 'service', path: '/projects/svc-meta', hash: 'hash-meta', metadata },
      TEST_DIR
    )
    const repo = await getRepositoryByHash('hash-meta', TEST_DIR)
    expect(repo?.metadata).toEqual(metadata)
  })
})
