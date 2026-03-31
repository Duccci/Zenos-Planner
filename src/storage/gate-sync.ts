/**
 * Gate Sync Utility
 *
 * Walks `zeno/gates/*.md` and upserts gate rows into the `gates` SQLite table,
 * enabling `zeno registry rebuild` to reconstruct gate metadata from the
 * version-controlled markdown files when the database has been wiped.
 *
 * Parsing strategy (frontmatter-first, regex fallback):
 *   1. If the file has a `---\nzeno:\n  id: …\n---` frontmatter block, that is
 *      the authoritative source (all required fields present and typed).
 *   2. Otherwise the function falls back to parsing bold inline fields
 *      (`**Hash**: #g06multirepo`, `**Status**: pending`, etc.) from the body —
 *      the same format used by existing gate markdown files.
 *
 * Upsert semantics:
 *   - `INSERT OR IGNORE` — existing rows (id, hash) are never overwritten.
 *     The database is authoritative for lifecycle state once it exists.  This
 *     function only fills in rows that are _missing_ (fresh DB clone).
 *
 * DB status normalization:
 *   The `gates.status` column only accepts ('pending','in_progress','completed',
 *   'rejected').  Statuses that live exclusively in project.json
 *   ('validated', 'backlog', 'cancelled') are mapped to nearest DB equivalents.
 */

import type Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { normalizeDateTime } from '../utils/datetime.js'
import { parseGateFrontmatter } from './frontmatter.js'
import { getZenoGitDir, getZenoDir } from '../utils/config.js'

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedGateMeta {
  id: string
  name: string
  sequence: number
  status: string
  hash: string
  projectId: string
  createdAt: string | null
  completedAt: string | null
  dependsOn: string | null // JSON-stringified array
}

/** DB-safe subset of gate status values. */
const DB_STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  validated: 'validated',  // DB now supports 'validated'; previously mapped to 'pending'
  in_progress: 'in_progress',
  completed: 'completed',
  rejected: 'rejected',
  cancelled: 'rejected',   // cancelled mapped closest to rejected
  backlog: 'pending',      // backlog mapped to pending
}

function normalizeStatus(raw: string): string {
  return DB_STATUS_MAP[raw] ?? 'pending'
}

// ─────────────────────────────────────────────────────────────────────────────
// Body-field fallback parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract gate metadata from the body of a gate markdown file using the
 * conventional bold-field format (`**Field**: value`).
 *
 * Returns `null` when the minimum required fields (id, name, hash) cannot be
 * determined.
 */
function parseGateBodyFields(content: string, filePath: string): ParsedGateMeta | null {
  // Derive gate id from filename: gate-06-... → gate-06
  const fileBase = path.basename(filePath, '.md')
  const idMatch = /^(gate-\d+)/.exec(fileBase)
  if (!idMatch?.[1]) return null
  const id = idMatch[1]

  // Name: first H1 heading, strip optional "Gate XX: " prefix
  const h1Match = /^#\s+(?:Gate\s+\d+:\s+)?(.+)$/m.exec(content)
  const name = h1Match?.[1]?.trim() ?? fileBase

  // Hash: strip leading #.  Fall back to gate id when the field is absent
  // (some consolidated archive files omit **Hash**).
  const hashMatch = /\*\*Hash\*\*:\s*#?([a-zA-Z0-9_-]+)/.exec(content)
  const hash = hashMatch?.[1]?.trim() ?? id

  // Status
  const statusMatch = /\*\*Status\*\*:\s*([a-z_]+)/.exec(content)
  const status = statusMatch?.[1]?.trim() ?? 'pending'

  // Sequence: "6 of 12" → 6.  Fall back to number in gate id (gate-03 → 3).
  const seqMatch = /\*\*Sequence\*\*:\s*(\d+)/.exec(content)
  const idSeq = /gate-(\d+)/.exec(id)?.[1]
  const sequence = seqMatch?.[1]
    ? parseInt(seqMatch[1], 10)
    : idSeq ? parseInt(idSeq, 10) : 0

  // Created / Completed
  const createdMatch = /\*\*Created\*\*:\s*([^\n\r]+)/.exec(content)
  const completedMatch = /\*\*Completed\*\*:\s*([^\n\r]+)/.exec(content)
  const completedAt = completedMatch?.[1]?.trim() ?? null
  const createdAt = createdMatch?.[1]?.trim() ?? completedAt

  return {
    id,
    name,
    sequence,
    status,
    hash,
    projectId: 'default-project',
    createdAt,
    completedAt,
    dependsOn: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncGatesResult {
  synced: number
  skipped: number
}

/**
 * Scan all gate markdown files under `<projectRoot>/zeno/gates/` and insert
 * any missing rows into the `gates` SQLite table.
 *
 * Existing rows are left untouched (`INSERT OR IGNORE`).
 */
export function syncGatesFromDisk(
  db: Database.Database,
  projectRoot: string = process.cwd()
): SyncGatesResult {
  const gatesDir = path.join(getZenoGitDir(projectRoot), 'gates')

  let files: string[]
  try {
    const topLevel = readdirSync(gatesDir).filter(
      (f) => f.endsWith('.md') && /^gate-\d+/.test(f)
    )
    // Also scan archive/ subdirectory for completed gates
    const archiveDir = path.join(gatesDir, 'archive')
    let archiveFiles: string[] = []
    try {
      archiveFiles = readdirSync(archiveDir)
        .filter((f) => f.endsWith('.md') && /^gate-\d+/.test(f))
        .map((f) => path.join('archive', f))
    } catch {
      // archive/ may not exist — not an error
    }
    files = [...topLevel, ...archiveFiles]
  } catch {
    return { synced: 0, skipped: 0 }
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO gates
      (id, project_id, sequence, name, status, hash, created_at, depends_on)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  let synced = 0
  let skipped = 0

  const runAll = db.transaction(() => {
    for (const file of files) {
      const filePath = path.join(gatesDir, file)

      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        skipped++
        continue
      }

      // Prefer frontmatter; fall back to body-field parsing
      let meta: ParsedGateMeta | null

      const fm = parseGateFrontmatter(content)
      if (fm) {
        meta = {
          id: fm.id,
          name: fm.name,
          sequence: fm.sequence,
          status: fm.status,
          hash: fm.hash,
          projectId: fm.project_id ?? 'default-project',
          createdAt: fm.created_at ?? null,
          completedAt: fm.completed_at ?? null,
          dependsOn:
            fm.depends_on && fm.depends_on.length > 0
              ? JSON.stringify(fm.depends_on)
              : null,
        }
      } else {
        meta = parseGateBodyFields(content, filePath)
      }

      if (!meta) {
        skipped++
        continue
      }

      const dbStatus = normalizeStatus(meta.status)

      const result = insert.run(
        meta.id,
        meta.projectId,
        meta.sequence,
        meta.name,
        dbStatus,
        meta.hash,
        normalizeDateTime(meta.createdAt, now),
        meta.dependsOn
      )

      if (result.changes > 0) synced++
      else skipped++
    }
  })

  runAll()

  return { synced, skipped }
}

/**
 * Seed the DB from planned gate entries in project.json.
 *
 * Called during `zeno registry rebuild` (and on DB init) to restore gates that
 * were registered with gate_plan but whose PRD markdown files have not been
 * generated yet — so syncGatesFromDisk() cannot find them.
 *
 * Uses `INSERT OR IGNORE` so existing rows are never overwritten.
 */
export function syncPlannedGatesFromState(
  db: Database.Database,
  projectRoot: string = process.cwd()
): SyncGatesResult {
  const projectPath = path.join(getZenoDir(projectRoot), 'project.json')

  let projectContent: string
  try {
    projectContent = readFileSync(projectPath, 'utf-8')
  } catch {
    return { synced: 0, skipped: 0 }  // project.json not present — nothing to do
  }

  let project: { gates?: unknown[] }
  try {
    project = JSON.parse(projectContent) as { gates?: unknown[] }
  } catch {
    return { synced: 0, skipped: 0 }
  }

  const gates = project.gates ?? []
  if (gates.length === 0) return { synced: 0, skipped: 0 }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO gates
      (id, project_id, sequence, name, description, status, hash, created_at, prd_generated_at)
    VALUES
      (?, 'default-project', ?, ?, ?, 'pending', ?, ?, NULL)
  `)

  const now = new Date().toISOString()
  let synced = 0
  let skipped = 0

  const runAll = db.transaction(() => {
    for (const raw of gates) {
      const g = raw as {
        id?: string
        sequence?: number
        name?: string
        goal?: string
        hash?: string
        status?: string
        prdGenerated?: boolean
      }

      // Only seed pending/validated gates without PRDs — completed/in_progress gates
      // and gates with PRDs are handled by syncGatesFromDisk.
      if (!g.id || !g.name || !g.hash) {
        skipped++
        continue
      }

      if (g.status === 'completed' || g.status === 'in_progress') {
        skipped++
        continue
      }

      // Skip gates whose PRD has already been generated — syncGatesFromDisk handles those
      if (g.prdGenerated) {
        skipped++
        continue
      }

      const result = insert.run(
        g.id,
        g.sequence ?? 0,
        g.name,
        g.goal ?? null,
        g.hash,
        now
      )
      if (result.changes > 0) synced++
      else skipped++
    }
  })

  runAll()

  return { synced, skipped }
}
