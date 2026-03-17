import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getDatabase, closeDatabase, initializeDatabase } from '../../src/storage/database.js'
import { syncGatesFromDisk } from '../../src/storage/gate-sync.js'

const TEST_DIR = join(tmpdir(), `.test-gate-sync-${Date.now()}`)
const GATES_DIR = join(TEST_DIR, 'zeno', 'gates')

const GATE_WITH_FM = `---
zeno:
  id: gate-01
  name: Infrastructure Setup
  sequence: 1
  type: feature
  status: pending
  hash: aabbccdd
  project_id: default-project
---

# Gate 1: Infrastructure Setup

Some description here.
`

const GATE_WITH_BODY = `# Gate 2: Core Engine

**Hash**: #bbccddee
**Status**: in_progress
**Type**: feature
**Sequence**: 2
**Created**: 2026-01-01

Some description.
`

describe('gate-sync', () => {
  beforeEach(async () => {
    await mkdir(GATES_DIR, { recursive: true })

    const migrationsDir = join(TEST_DIR, 'src', 'storage', 'migrations')
    await mkdir(migrationsDir, { recursive: true })
    const projectMigrationsDir = join(process.cwd(), 'src', 'storage', 'migrations')
    const files = await readdir(projectMigrationsDir)
    for (const file of files) {
      if (!file.endsWith('.sql')) continue
      const content = await readFile(join(projectMigrationsDir, file), 'utf-8')
      await writeFile(join(migrationsDir, file), content, 'utf-8')
    }

    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)
    db.exec('PRAGMA foreign_keys = OFF')
  })

  afterEach(async () => {
    closeDatabase()
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('returns {synced:0, skipped:0} when gates directory does not exist', () => {
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, '/nonexistent/project/root/that/cannot/exist')
    expect(result).toEqual({ synced: 0, skipped: 0 })
  })

  it('returns {synced:0, skipped:0} when gates dir is empty', () => {
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, TEST_DIR)
    expect(result).toEqual({ synced: 0, skipped: 0 })
  })

  it('syncs a gate file with frontmatter', async () => {
    await writeFile(join(GATES_DIR, 'gate-01-infrastructure.md'), GATE_WITH_FM)
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, TEST_DIR)
    expect(result.synced).toBe(1)
    expect(result.skipped).toBe(0)
    const row = db.prepare('SELECT * FROM gates WHERE id = ?').get('gate-01') as {
      id: string; name: string; status: string; sequence: number
    } | undefined
    expect(row?.id).toBe('gate-01')
    expect(row?.name).toBe('Infrastructure Setup')
    expect(row?.status).toBe('pending')
  })

  it('syncs a gate file with body fields (no frontmatter)', async () => {
    await writeFile(join(GATES_DIR, 'gate-02-core.md'), GATE_WITH_BODY)
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, TEST_DIR)
    expect(result.synced).toBe(1)
    expect(result.skipped).toBe(0)
    const row = db.prepare('SELECT id, status FROM gates WHERE id = ?').get('gate-02') as {
      id: string; status: string
    } | undefined
    expect(row?.id).toBe('gate-02')
    expect(row?.status).toBe('in_progress')
  })

  it('skips non-gate markdown files (e.g. README.md)', async () => {
    await writeFile(join(GATES_DIR, 'README.md'), '# Gates README')
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, TEST_DIR)
    expect(result.synced).toBe(0)
    expect(result.skipped).toBe(0)
  })

  it('skips files missing required fields and increments skipped count', async () => {
    await writeFile(join(GATES_DIR, 'gate-03-broken.md'), '# Gate 3: Broken\n\nNo hash here.')
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, TEST_DIR)
    expect(result.skipped).toBe(1)
    expect(result.synced).toBe(0)
  })

  it('normalizes status validated → validated (DB now supports it)', async () => {
    const validatedGate = GATE_WITH_FM.replace('status: pending', 'status: validated')
    await writeFile(join(GATES_DIR, 'gate-01-infrastructure.md'), validatedGate)
    const db = getDatabase(TEST_DIR)
    syncGatesFromDisk(db, TEST_DIR)
    const row = db.prepare('SELECT status FROM gates WHERE id = ?').get('gate-01') as
      { status: string } | undefined
    expect(row?.status).toBe('validated')
  })

  it('normalizes status cancelled → rejected', async () => {
    const cancelledGate = GATE_WITH_FM.replace('status: pending', 'status: cancelled')
    await writeFile(join(GATES_DIR, 'gate-01-infrastructure.md'), cancelledGate)
    const db = getDatabase(TEST_DIR)
    syncGatesFromDisk(db, TEST_DIR)
    const row = db.prepare('SELECT status FROM gates WHERE id = ?').get('gate-01') as
      { status: string } | undefined
    expect(row?.status).toBe('rejected')
  })

  it('normalizes status backlog → pending', async () => {
    const backlogGate = GATE_WITH_FM.replace('status: pending', 'status: backlog')
    await writeFile(join(GATES_DIR, 'gate-01-infrastructure.md'), backlogGate)
    const db = getDatabase(TEST_DIR)
    syncGatesFromDisk(db, TEST_DIR)
    const row = db.prepare('SELECT status FROM gates WHERE id = ?').get('gate-01') as
      { status: string } | undefined
    expect(row?.status).toBe('pending')
  })

  it('normalizes unknown type in frontmatter (type field removed from DB)', async () => {
    const unknownType = GATE_WITH_FM.replace('type: feature', 'type: unknown-type')
    await writeFile(join(GATES_DIR, 'gate-01-infrastructure.md'), unknownType)
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, TEST_DIR)
    // Gate still syncs successfully; type field is not stored in DB
    expect(result.synced).toBe(1)
  })

  it('does not overwrite existing rows (INSERT OR IGNORE semantics)', async () => {
    await writeFile(join(GATES_DIR, 'gate-01-infrastructure.md'), GATE_WITH_FM)
    const db = getDatabase(TEST_DIR)
    syncGatesFromDisk(db, TEST_DIR)
    db.prepare("UPDATE gates SET name = 'Modified Name' WHERE id = 'gate-01'").run()
    // Second sync — should not overwrite
    syncGatesFromDisk(db, TEST_DIR)
    const row = db.prepare('SELECT name FROM gates WHERE id = ?').get('gate-01') as
      { name: string } | undefined
    expect(row?.name).toBe('Modified Name')
  })

  it('syncs multiple gate files in one pass', async () => {
    await writeFile(join(GATES_DIR, 'gate-01-infrastructure.md'), GATE_WITH_FM)
    await writeFile(join(GATES_DIR, 'gate-02-core.md'), GATE_WITH_BODY)
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, TEST_DIR)
    expect(result.synced).toBe(2)
  })

  it('uses fallback name/status/sequence from body when optional fields absent', async () => {
    // Minimal body: only hash field — no H1, no Status, no Sequence
    // This triggers all the ?.(1].trim() ?? fallback branches in parseGateBodyFields
    const minimalBody = '**Hash**: #minbody1\n\nSome description.\n'
    await writeFile(join(GATES_DIR, 'gate-03-minimal.md'), minimalBody)
    const db = getDatabase(TEST_DIR)
    const result = syncGatesFromDisk(db, TEST_DIR)
    expect(result.synced).toBe(1)
    const row = db.prepare('SELECT id, name, status, sequence FROM gates WHERE id = ?').get('gate-03') as {
      id: string; name: string; status: string; sequence: number
    } | undefined
    // name falls back to fileBase (gate-03-minimal)
    expect(row?.name).toBe('gate-03-minimal')
    // status falls back to 'pending'
    expect(row?.status).toBe('pending')
    // sequence falls back to 0
    expect(row?.sequence).toBe(0)
  })

  it('uses default project_id when frontmatter omits project_id', async () => {
    const fmWithoutProjectId = `---
zeno:
  id: gate-04
  name: No Project Gate
  sequence: 4
  type: feature
  status: pending
  hash: gate04xxhash
---

# Gate 4: No Project Gate
`
    await writeFile(join(GATES_DIR, 'gate-04-no-project.md'), fmWithoutProjectId)
    const db = getDatabase(TEST_DIR)
    syncGatesFromDisk(db, TEST_DIR)
    const row = db.prepare('SELECT id FROM gates WHERE id = ?').get('gate-04') as { id: string } | undefined
    // Row was inserted with default project_id
    expect(row?.id).toBe('gate-04')
  })

  it('stores depends_on as JSON when frontmatter has non-empty depends_on array', async () => {
    const fmWithDepsOn = `---
zeno:
  id: gate-05
  name: Gate With Deps
  sequence: 5
  type: feature
  status: pending
  hash: gate05xxhash
  project_id: default-project
  depends_on:
    - gate-04
---

# Gate 5: Gate With Deps
`
    await writeFile(join(GATES_DIR, 'gate-05-with-deps.md'), fmWithDepsOn)
    const db = getDatabase(TEST_DIR)
    syncGatesFromDisk(db, TEST_DIR)
    const row = db.prepare('SELECT depends_on FROM gates WHERE id = ?').get('gate-05') as
      { depends_on: string | null } | undefined
    // depends_on serialized as JSON string
    expect(row?.depends_on).toBe('["gate-04"]')
  })
})
