/**
 * Tests for proposal-sync utility
 *
 * Verifies that:
 * 1. Syncing the same proposal file multiple times does NOT create duplicates
 * 2. The unique hash constraint prevents duplicates at the DB level
 * 3. Lifecycle metadata is preserved across syncs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readFile as fsReadFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { syncProposalsFromDisk } from '../../src/storage/proposal-sync.js'
import { getDatabase, closeDatabase, initializeDatabase } from '../../src/storage/database.js'

const TEST_DIR = join(tmpdir(), `.test-proposal-sync-${Date.now()}`)

describe('proposal-sync', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    // Copy migrations to temp dir for initializeDatabase
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

  it('inserts proposal files from disk into DB', async () => {
    // Initialize DB
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    // Create gate (required by foreign key constraint)
    db.prepare(
      'INSERT INTO gates (id, sequence, name, status, hash) VALUES (?, ?, ?, ?, ?)'
    ).run('gate-01', 1, 'Test Gate', 'pending', 'gate01hash')

    // Create proposal markdown file
    const proposalsDir = join(TEST_DIR, 'zeno', 'proposals', 'gate-01')
    await mkdir(proposalsDir, { recursive: true })
    await writeFile(
      join(proposalsDir, 'test-proposal.md'),
      `
# Proposal: Test Feature

**Hash**: #a1b2c3d4
**Gate**: gate-01 - Test Gate
**Status**: pending
**Created**: 2026-02-18

Test content.
    `.trim()
    )

    // Run sync
    syncProposalsFromDisk(db, TEST_DIR)

    // Verify inserted
    const row = db
      .prepare('SELECT id, hash, title, status, gate_id FROM proposals WHERE hash = ?')
      .get('a1b2c3d4') as Record<string, unknown> | undefined
    expect(row).toBeDefined()
    expect(row?.hash).toBe('a1b2c3d4')
    expect(row?.title).toBe('Test Feature')
    expect(row?.status).toBe('pending')
    expect(row?.gate_id).toBe('gate-01')

    // Capture the inserted id (this is the key for duplication tests)
    const originalId = row?.id as string
    expect(originalId).toBeTruthy()
  })

  it('does NOT create duplicates on repeated syncs — ON CONFLICT preserves existing row', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    // Create gate
    db.prepare(
      'INSERT INTO gates (id, sequence, name, status, hash) VALUES (?, ?, ?, ?, ?)'
    ).run('gate-02', 2, 'Dup Test', 'pending', 'gate02hash')

    // Create proposal file
    const proposalsDir = join(TEST_DIR, 'zeno', 'proposals', 'gate-02')
    await mkdir(proposalsDir, { recursive: true })
    const proposalPath = join(proposalsDir, 'dup-test.md')
    await writeFile(
      proposalPath,
      `
# Proposal: Duplicate Test

**Hash**: #dup12345
**Gate**: gate-02 - Dup Test
**Status**: pending
**Created**: 2026-02-18

Original content.
    `.trim()
    )

    const db2 = getDatabase(TEST_DIR)

    // First sync — should insert
    syncProposalsFromDisk(db2, TEST_DIR)
    let countBefore = db2
      .prepare('SELECT COUNT(*) as cnt FROM proposals WHERE hash = ?')
      .get('dup12345') as { cnt: number }
    expect(countBefore.cnt).toBe(1)

    // Capture original id
    const originalRow = db2
      .prepare('SELECT id, title FROM proposals WHERE hash = ?')
      .get('dup12345') as { id: string; title: string }
    const originalId = originalRow.id

    // Second sync — should NOT create a duplicate; ON CONFLICT updates instead
    syncProposalsFromDisk(db2, TEST_DIR)
    let countAfter = db2
      .prepare('SELECT COUNT(*) as cnt FROM proposals WHERE hash = ?')
      .get('dup12345') as { cnt: number }
    expect(countAfter.cnt).toBe(1) // Still 1, not 2

    // Verify the original row's id was NOT replaced (proves ON CONFLICT updated, not inserted)
    const updatedRow = db2.prepare('SELECT id FROM proposals WHERE hash = ?').get('dup12345') as {
      id: string
    }
    expect(updatedRow.id).toBe(originalId) // Same id = same row
  })

  it('updates title and updated_at on repeated syncs; preserves lifecycle fields', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    // Create gate
    db.prepare(
      'INSERT INTO gates (id, sequence, name, status, hash) VALUES (?, ?, ?, ?, ?)'
    ).run('gate-03', 3, 'Lifecycle', 'pending', 'gate03hash')

    // Create initial proposal
    const proposalsDir = join(TEST_DIR, 'zeno', 'proposals', 'gate-03')
    await mkdir(proposalsDir, { recursive: true })
    const proposalPath = join(proposalsDir, 'lifecycle-test.md')
    await writeFile(
      proposalPath,
      `
# Proposal: Original Title

**Hash**: #lifecycle01
**Gate**: gate-03 - Lifecycle
**Status**: pending
**Created**: 2026-02-18

Original content.
    `.trim()
    )

    const db2 = getDatabase(TEST_DIR)
    syncProposalsFromDisk(db2, TEST_DIR)

    // Manually set status and approved_at (simulating gate progression)
    const stmt = db2.prepare('UPDATE proposals SET status = ?, approved_at = ? WHERE hash = ?')
    const now = new Date().toISOString()
    stmt.run('approved', now, 'lifecycle01')

    // Verify manually set
    let beforeResync = db2
      .prepare('SELECT status, approved_at, title FROM proposals WHERE hash = ?')
      .get('lifecycle01') as { status: string; approved_at: string; title: string }
    expect(beforeResync.status).toBe('approved')
    expect(beforeResync.approved_at).toBe(now)
    expect(beforeResync.title).toBe('Original Title')

    // Update the file (change title only)
    await writeFile(
      proposalPath,
      `
# Proposal: Updated Title

**Hash**: #lifecycle01
**Gate**: gate-03 - Lifecycle
**Status**: pending
**Created**: 2026-02-18

Updated content.
    `.trim()
    )

    // Resync
    syncProposalsFromDisk(db2, TEST_DIR)

    // Verify: title WAS updated (ON CONFLICT updates it), but status and approved_at were NOT
    // (because the ON CONFLICT clause intentionally omits them)
    let afterResync = db2
      .prepare('SELECT status, approved_at, title FROM proposals WHERE hash = ?')
      .get('lifecycle01') as { status: string; approved_at: string; title: string }
    expect(afterResync.title).toBe('Updated Title') // Changed by ON CONFLICT DO UPDATE
    expect(afterResync.status).toBe('approved') // Untouched (not in ON CONFLICT clause)
    expect(afterResync.approved_at).toBe(now) // Untouched (not in ON CONFLICT clause)
  })

  it('ignores archive/ subdirectories', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    // Create gate
    db.prepare(
      'INSERT INTO gates (id, sequence, name, status, hash) VALUES (?, ?, ?, ?, ?)'
    ).run('gate-04', 4, 'Archive Test', 'pending', 'gate04hash')

    // Create a normal proposal
    const normalDir = join(TEST_DIR, 'zeno', 'proposals', 'gate-04')
    await mkdir(normalDir, { recursive: true })
    await writeFile(
      join(normalDir, 'normal.md'),
      `
# Proposal: Normal

**Hash**: #normal001
**Gate**: gate-04
**Status**: pending
**Created**: 2026-02-18

Normal proposal.
    `.trim()
    )

    // Create an archived proposal (in archive/ subdirectory) — doesn't need gate to exist
    const archiveDir = join(TEST_DIR, 'zeno', 'proposals', 'archive', 'solitary')
    await mkdir(archiveDir, { recursive: true })
    await writeFile(
      join(archiveDir, 'archived.md'),
      `
# Proposal: Archived

**Hash**: #archive001
**Gate**: solitary
**Status**: completed
**Created**: 2026-01-18

Archived proposal.
    `.trim()
    )

    const db2 = getDatabase(TEST_DIR)
    syncProposalsFromDisk(db2, TEST_DIR)

    // Verify: normal proposal synced, archived proposal NOT synced
    const normalCount = db2
      .prepare('SELECT COUNT(*) as cnt FROM proposals WHERE hash = ?')
      .get('normal001') as { cnt: number }
    expect(normalCount.cnt).toBe(1)

    const archiveCount = db2
      .prepare('SELECT COUNT(*) as cnt FROM proposals WHERE hash = ?')
      .get('archive001') as { cnt: number }
    expect(archiveCount.cnt).toBe(0)
  })

  it('handles missing proposals dir gracefully (non-fatal)', async () => {
    await initializeDatabase(TEST_DIR)

    // Do NOT create zeno/proposals directory
    const db = getDatabase(TEST_DIR)

    // Should not throw
    expect(() => syncProposalsFromDisk(db, TEST_DIR)).not.toThrow()
  })

  it('persists requirement_id from **Requirement**: frontmatter when the requirement exists', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    // Create gate and a matching requirement
    db.prepare(
      'INSERT INTO gates (id, sequence, name, status, hash) VALUES (?, ?, ?, ?, ?)'
    ).run('gate-05', 5, 'Req Link Test', 'pending', 'gate05hash')
    db.prepare(
      'INSERT INTO requirements (id, hash, type, priority, level, source, description, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('req1234567890abcd', 'req1234567890abcd', 'functional', 'must', 'gate', 'generated', 'Test requirement', 'default-project')

    const proposalsDir = join(TEST_DIR, 'zeno', 'proposals', 'gate-05')
    await mkdir(proposalsDir, { recursive: true })
    await writeFile(
      join(proposalsDir, 'req-link.md'),
      `# Proposal: Req Link

**Hash**: #reqlink01
**Status**: pending
**Requirement**: #req1234567890abcd
**Created**: 2026-02-18

Content.
      `.trim()
    )

    syncProposalsFromDisk(db, TEST_DIR)

    const row = db
      .prepare('SELECT requirement_id FROM proposals WHERE hash = ?')
      .get('reqlink01') as { requirement_id: string | null } | undefined
    expect(row?.requirement_id).toBe('req1234567890abcd')
  })

  it('sets requirement_id to null when the referenced requirement does not exist (FK guard)', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    db.prepare(
      'INSERT INTO gates (id, sequence, name, status, hash) VALUES (?, ?, ?, ?, ?)'
    ).run('gate-06', 6, 'FK Guard Test', 'pending', 'gate06hash')

    const proposalsDir = join(TEST_DIR, 'zeno', 'proposals', 'gate-06')
    await mkdir(proposalsDir, { recursive: true })
    await writeFile(
      join(proposalsDir, 'missing-req.md'),
      `# Proposal: Missing Req

**Hash**: #missingreq1
**Status**: pending
**Requirement**: #doesnotexist0000
**Created**: 2026-02-18

Content.
      `.trim()
    )

    // Should not throw despite the referenced requirement not existing
    expect(() => syncProposalsFromDisk(db, TEST_DIR)).not.toThrow()

    const row = db
      .prepare('SELECT requirement_id FROM proposals WHERE hash = ?')
      .get('missingreq1') as { requirement_id: string | null } | undefined
    expect(row?.requirement_id).toBeNull()
  })

  it('preserves existing requirement_id across syncs when new sync has no value', async () => {
    await initializeDatabase(TEST_DIR)
    const db = getDatabase(TEST_DIR)

    db.prepare(
      'INSERT INTO gates (id, sequence, name, status, hash) VALUES (?, ?, ?, ?, ?)'
    ).run('gate-07', 7, 'Preserve Req', 'pending', 'gate07hash')
    db.prepare(
      'INSERT INTO requirements (id, hash, type, priority, level, source, description, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('preserved00000000', 'preserved00000000', 'functional', 'must', 'gate', 'generated', 'Preserved req', 'default-project')

    const proposalsDir = join(TEST_DIR, 'zeno', 'proposals', 'gate-07')
    await mkdir(proposalsDir, { recursive: true })
    const proposalPath = join(proposalsDir, 'preserve-req.md')

    // First sync — with requirement
    await writeFile(
      proposalPath,
      `# Proposal: Preserve Req

**Hash**: #preservereq1
**Status**: pending
**Requirement**: #preserved00000000
**Created**: 2026-02-18

Content.
      `.trim()
    )
    syncProposalsFromDisk(db, TEST_DIR)

    const before = db
      .prepare('SELECT requirement_id FROM proposals WHERE hash = ?')
      .get('preservereq1') as { requirement_id: string | null } | undefined
    expect(before?.requirement_id).toBe('preserved00000000')

    // Second sync — file updated, no Requirement line
    await writeFile(
      proposalPath,
      `# Proposal: Preserve Req Updated

**Hash**: #preservereq1
**Status**: pending
**Created**: 2026-02-18

Updated content with no Requirement line.
      `.trim()
    )
    syncProposalsFromDisk(db, TEST_DIR)

    // COALESCE(excluded.requirement_id, proposals.requirement_id) keeps original value
    const after = db
      .prepare('SELECT requirement_id FROM proposals WHERE hash = ?')
      .get('preservereq1') as { requirement_id: string | null } | undefined
    expect(after?.requirement_id).toBe('preserved00000000')
  })
})
