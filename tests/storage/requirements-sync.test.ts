/**
 * Tests for requirements-sync utility
 *
 * Verifies that:
 * 1. writeRequirementsManifest serialises all DB requirements to requirements.json
 * 2. syncRequirementsFromDisk restores rows into an empty DB from the manifest
 * 3. syncRequirementsFromDisk is idempotent (repeated calls do not duplicate rows)
 * 4. Project-level (gate_id=NULL) and solitary requirements are round-tripped correctly
 * 5. syncRequirementsFromDisk is a no-op when the manifest file does not exist
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile as fsReadFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  writeRequirementsManifest,
  syncRequirementsFromDisk,
  REQUIREMENTS_MANIFEST_FILE,
  type RequirementsManifest,
} from '../../src/storage/requirements-sync.js'
import { getDatabase, closeDatabase, initializeDatabase } from '../../src/storage/database.js'

const TEST_DIR = join(tmpdir(), `.test-requirements-sync-${Date.now()}`)

/** Path to the manifest file within the test project root */
function manifestPath(): string {
  return join(TEST_DIR, 'zeno', '.zeno', REQUIREMENTS_MANIFEST_FILE)
}

/** Read and parse the manifest from disk */
async function readManifest(): Promise<RequirementsManifest> {
  const raw = await fsReadFile(manifestPath(), 'utf-8')
  return JSON.parse(raw) as RequirementsManifest
}

describe('requirements-sync', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    // Mirror the migrations directory so initializeDatabase can run
    const migrationsDir = join(TEST_DIR, 'src', 'storage', 'migrations')
    await mkdir(migrationsDir, { recursive: true })
    const projectMigrationsDir = join(process.cwd(), 'src', 'storage', 'migrations')
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(projectMigrationsDir)
    for (const file of files) {
      if (!file.endsWith('.sql')) continue
      const content = await fsReadFile(join(projectMigrationsDir, file), 'utf-8')
      await writeFile(join(migrationsDir, file), content, 'utf-8')
    }
  })

  afterEach(async () => {
    try {
      closeDatabase()
    } catch {
      // ignore
    }
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  })

  // ---------------------------------------------------------------------------
  // writeRequirementsManifest
  // ---------------------------------------------------------------------------

  it('creates requirements.json with all DB requirements', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO requirements (id, hash, type, priority, level, source, description, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('req-001', 'hash001', 'functional', 'must', 'project', 'generated', 'First requirement', 'default-project', now, now)

    writeRequirementsManifest(db, TEST_DIR)

    expect(existsSync(manifestPath())).toBe(true)

    const manifest = await readManifest()
    expect(manifest.version).toBe(1)
    expect(manifest.requirements).toHaveLength(1)
    expect(manifest.requirements[0]).toMatchObject({
      id: 'req-001',
      hash: 'hash001',
      type: 'functional',
      priority: 'must',
      level: 'project',
      description: 'First requirement',
      gateId: null,
    })
  })

  it('writes an empty requirements array when DB has no rows', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    writeRequirementsManifest(db, TEST_DIR)

    const manifest = await readManifest()
    expect(manifest.requirements).toHaveLength(0)
  })

  it('overwrites existing manifest on subsequent writes', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO requirements (id, hash, type, priority, level, source, description, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('req-A', 'hashA', 'functional', 'must', 'project', 'generated', 'Req A', 'default-project', now, now)

    writeRequirementsManifest(db, TEST_DIR)
    const first = await readManifest()
    expect(first.requirements).toHaveLength(1)

    db.prepare(
      `INSERT INTO requirements (id, hash, type, priority, level, source, description, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('req-B', 'hashB', 'constraint', 'should', 'project', 'generated', 'Req B', 'default-project', now, now)

    writeRequirementsManifest(db, TEST_DIR)
    const second = await readManifest()
    expect(second.requirements).toHaveLength(2)
  })

  // ---------------------------------------------------------------------------
  // syncRequirementsFromDisk
  // ---------------------------------------------------------------------------

  it('restores requirements from manifest into an empty DB', async () => {
    // Seed a manifest manually
    const manifest: RequirementsManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      requirements: [
        {
          id: 'restore-001',
          projectId: 'default-project',
          gateId: null,
          parentId: null,
          projectRequirementId: null,
          level: 'project',
          sourceGateId: null,
          type: 'functional',
          priority: 'must',
          description: 'Restored from manifest',
          acceptanceCriteria: null,
          hash: 'restore001hash',
          source: 'generated',
          createdAt: new Date().toISOString(),
        },
      ],
    }

    await mkdir(join(TEST_DIR, 'zeno', '.zeno'), { recursive: true })
    await writeFile(manifestPath(), JSON.stringify(manifest, null, 2), 'utf-8')

    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    syncRequirementsFromDisk(db, TEST_DIR)

    const row = db
      .prepare('SELECT id, description, level, gate_id FROM requirements WHERE id = ?')
      .get('restore-001') as { id: string; description: string; level: string; gate_id: string | null } | undefined

    expect(row).toBeDefined()
    expect(row?.description).toBe('Restored from manifest')
    expect(row?.level).toBe('project')
    expect(row?.gate_id).toBeNull()
  })

  it('is idempotent — repeated syncs do not duplicate rows', async () => {
    const manifest: RequirementsManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      requirements: [
        {
          id: 'idempotent-001',
          projectId: 'default-project',
          gateId: null,
          parentId: null,
          projectRequirementId: null,
          level: 'project',
          sourceGateId: null,
          type: 'functional',
          priority: 'must',
          description: 'Should not duplicate',
          acceptanceCriteria: null,
          hash: 'idempotent001hash',
          source: 'generated',
          createdAt: new Date().toISOString(),
        },
      ],
    }

    await mkdir(join(TEST_DIR, 'zeno', '.zeno'), { recursive: true })
    await writeFile(manifestPath(), JSON.stringify(manifest, null, 2), 'utf-8')

    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    syncRequirementsFromDisk(db, TEST_DIR)
    syncRequirementsFromDisk(db, TEST_DIR)
    syncRequirementsFromDisk(db, TEST_DIR)

    const count = (
      db.prepare('SELECT COUNT(*) as c FROM requirements').get() as { c: number }
    ).c

    expect(count).toBe(1)
  })

  it('does not overwrite existing DB rows', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO requirements (id, hash, type, priority, level, source, description, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('existing-001', 'existhash001', 'functional', 'must', 'project', 'generated', 'Original description', 'default-project', now, now)

    // Manifest has same id but different description
    const manifest: RequirementsManifest = {
      version: 1,
      updatedAt: now,
      requirements: [
        {
          id: 'existing-001',
          projectId: 'default-project',
          gateId: null,
          parentId: null,
          projectRequirementId: null,
          level: 'project',
          sourceGateId: null,
          type: 'functional',
          priority: 'must',
          description: 'Override attempt — should be ignored',
          acceptanceCriteria: null,
          hash: 'existhash001',
          source: 'generated',
          createdAt: now,
        },
      ],
    }

    await mkdir(join(TEST_DIR, 'zeno', '.zeno'), { recursive: true })
    await writeFile(manifestPath(), JSON.stringify(manifest, null, 2), 'utf-8')

    syncRequirementsFromDisk(db, TEST_DIR)

    const row = db
      .prepare('SELECT description FROM requirements WHERE id = ?')
      .get('existing-001') as { description: string } | undefined

    // Original DB value is preserved
    expect(row?.description).toBe('Original description')
  })

  it('is a no-op when manifest does not exist', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    // No manifest written — should not throw
    expect(() => syncRequirementsFromDisk(db, TEST_DIR)).not.toThrow()

    const count = (
      db.prepare('SELECT COUNT(*) as c FROM requirements').get() as { c: number }
    ).c
    expect(count).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Round-trip: write → wipe DB → sync back
  // ---------------------------------------------------------------------------

  it('round-trips project-level and solitary requirements after DB wipe', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    const now = new Date().toISOString()

    // Project-level requirement (gate_id = NULL, level = 'project')
    db.prepare(
      `INSERT INTO requirements (id, hash, type, priority, level, source, description, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('proj-req-001', 'projhash001', 'functional', 'must', 'project', 'generated', 'Project level req', 'default-project', now, now)

    // Solitary-proposal requirement (gate_id = NULL, level = 'gate')
    db.prepare(
      `INSERT INTO requirements (id, hash, type, priority, level, source, description, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('solitary-req-001', 'solitaryhash001', 'non_functional', 'should', 'gate', 'generated', 'Solitary proposal req', 'default-project', now, now)

    // Write manifest
    writeRequirementsManifest(db, TEST_DIR)

    // Simulate DB wipe: delete both rows
    db.prepare('DELETE FROM requirements').run()
    expect(
      (db.prepare('SELECT COUNT(*) as c FROM requirements').get() as { c: number }).c
    ).toBe(0)

    // Restore from manifest
    syncRequirementsFromDisk(db, TEST_DIR)

    const rows = db
      .prepare('SELECT id, description, level, gate_id FROM requirements ORDER BY id')
      .all() as { id: string; description: string; level: string; gate_id: string | null }[]

    expect(rows).toHaveLength(2)

    const projRow = rows.find((r) => r.id === 'proj-req-001')
    expect(projRow?.description).toBe('Project level req')
    expect(projRow?.level).toBe('project')
    expect(projRow?.gate_id).toBeNull()

    const solRow = rows.find((r) => r.id === 'solitary-req-001')
    expect(solRow?.description).toBe('Solitary proposal req')
    expect(solRow?.gate_id).toBeNull()
  })
})
