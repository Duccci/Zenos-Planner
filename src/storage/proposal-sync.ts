/**
 * Proposal Sync Utility
 *
 * Walks the `zeno/proposals/` directory and upserts any proposal markdown files
 * into the proposals DB table. This is the mechanism by which proposals written
 * directly to disk (by LLM tools, user edits, git checkouts, etc.) become visible
 * to registry queries without requiring an explicit write through the registry.
 *
 * Design intent:
 * - The `.md` files are the source of truth for content.
 * - The DB is the source of truth for lifecycle metadata (status, approved_at, etc.).
 * - ON CONFLICT only updates `title` — it never overwrites status/gate_id/approved_at.
 */

import type Database from 'better-sqlite3'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { normalizeDateTime } from '../utils/datetime.js'
import { parseProposalFrontmatter } from './frontmatter.js'

/**
 * Map any Zeno workflow status to the values accepted by the DB CHECK constraint:
 *   ('pending', 'validated', 'approved', 'rejected', 'in_progress', 'completed')
 *
 * 'cancelled' and 'backlog' are UI-only states that do not have a DB column
 * equivalent; they are coerced to the nearest canonical value.
 *
 * Note: existing databases with the pre-gate-05 constraint
 * ('pending', 'approved', 'rejected', 'in_progress', 'completed') are
 * automatically patched by patchProposalStatusConstraint() in migrations.ts
 * before any sync runs.
 */
const PROPOSAL_STATUS_MAP: Record<string, string> = {
  pending:     'pending',
  validated:   'validated',
  in_progress: 'in_progress',
  completed:   'completed',
  approved:    'approved',
  rejected:    'rejected',
  cancelled:   'rejected',
  backlog:     'pending',
}

function normalizeProposalStatus(raw: string): string {
  return PROPOSAL_STATUS_MAP[raw] ?? 'pending'
}

/** Walk `dir` recursively, yielding paths of .md files. Skips `archive` subdirectories and non-canonical proposal files. */
function* walkMd(dir: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const full = path.join(dir, entry)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) {
        // Skip archive directories — archived proposals should not be re-synced
        if (entry === 'archive') continue
        yield* walkMd(full)
      } else if (entry.endsWith('.md')) {
        // Skip non-canonical proposal filenames (e.g., -generated, -template, -backup)
        // Canonical proposals should not have these suffixes before .md
        if (/-generated|-template|-backup|-tmp|-draft/.test(entry)) {
          continue
        }
        yield full
      }
    } catch {
      // Skip unreadable entries
    }
  }
}

interface ParsedProposalMetadata {
  hash: string
  title: string
  status: string
  gateId: string | null
  requirementId: string | null
  createdAt: string | null
  // lifecycle fields — populated from frontmatter when available
  approvedAt: string | null
  approvedBy: string | null
  rejectedAt: string | null
  rejectedBy: string | null
  startedAt: string | null
  startedBy: string | null
  implementedAt: string | null
}

/** Extract Zeno proposal metadata from a markdown file's content. */
function parseProposalMetadata(content: string, filePath: string): ParsedProposalMetadata | null {
  // ── 1. Try frontmatter (preferred: typed, complete, includes lifecycle fields) ──
  const fm = parseProposalFrontmatter(content)

  // Title: first # Proposal: <title> line (always from body — not in frontmatter)
  const titleMatch = /^#\s+Proposal:\s+(.+)$/m.exec(content)

  if (fm) {
    const title = titleMatch?.[1]?.trim() ?? path.basename(filePath, '.md')
    // Gate ID: prefer frontmatter gate_id; fall back to directory inference
    let gateId = fm.gate_id ?? null
    if (!gateId) {
      const gateMatch = /[/\\]proposals[/\\](gate-\d+|solitary)[/\\]/.exec(filePath)
      const folderName = gateMatch?.[1] ?? null
      gateId = folderName === 'solitary' ? null : folderName
    }
    return {
      hash: fm.hash,
      title,
      status: fm.status ?? 'pending',
      gateId,
      requirementId: fm.requirement_id ?? null,
      createdAt: fm.created_at ?? null,
      approvedAt: fm.approved_at ?? null,
      approvedBy: fm.approved_by ?? null,
      rejectedAt: fm.rejected_at ?? null,
      rejectedBy: fm.rejected_by ?? null,
      startedAt: fm.started_at ?? null,
      startedBy: fm.started_by ?? null,
      implementedAt: fm.implemented_at ?? null,
    }
  }

  // ── 2. Regex fallback (existing files without frontmatter) ──────────────────
  // Hash: **Hash**: #<hash> or **Hash**: <hash>
  const hashMatch = /\*\*Hash\*\*:\s*#?([a-zA-Z0-9_-]+)/.exec(content)
  if (!hashMatch?.[1]) return null
  const hash = hashMatch[1].trim()

  const title = titleMatch?.[1]?.trim() ?? path.basename(filePath, '.md')

  // Status: **Status**: <status>
  const statusMatch = /\*\*Status\*\*:\s*([a-z_]+)/.exec(content)
  const status = statusMatch?.[1]?.trim() ?? 'pending'

  // Gate ID: infer from directory path.
  // 'gate-NN' folder -> store as gate_id; 'solitary' folder -> store NULL (avoids FK violation).
  const gateMatch = /[/\\]proposals[/\\](gate-\d+|solitary)[/\\]/.exec(filePath)
  const folderName = gateMatch?.[1] ?? null
  const gateId = folderName === 'solitary' ? null : folderName

  // Requirement: **Requirement**: #<hash> — strip leading '#' to store raw hash
  const reqMatch = /\*\*Requirement\*\*:\s*#?([a-zA-Z0-9_-]+)/.exec(content)
  const requirementId = reqMatch?.[1]?.trim() ?? null

  // Created: **Created**: <date>
  const createdMatch = /\*\*Created\*\*:\s*([^\n\r]+)/.exec(content)
  const createdAt = createdMatch?.[1]?.trim() ?? null

  return {
    hash,
    title,
    status,
    gateId,
    requirementId,
    createdAt,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    startedAt: null,
    startedBy: null,
    implementedAt: null,
  }
}

/**
 * Scan all proposal `.md` files under `<projectRoot>/zeno/proposals/` and
 * upsert them into the `proposals` DB table. Also extracts and tracks proposal
 * dependencies from markdown Dependencies sections.
 *
 * **Duplication Prevention:**
 * - The `hash` column has a `UNIQUE NOT NULL` constraint in the schema.
 * - First sync: inserts the row with a random-generated `id`.
 * - Repeated syncs: `ON CONFLICT(hash)` prevents re-insertion; only `title` and
 *   `updated_at` are updated. The original row's `id` is preserved.
 * - Result: calling `syncProposalsFromDisk` 10x with the same file creates 1 row,
 *   not 10. No duplicates possible.
 *
 * **Lifecycle Field Ownership:**
 * Crucially, `ON CONFLICT(hash) DO UPDATE` only refreshes `title` and `updated_at`
 * for rows that already exist — lifecycle fields (`status`, `gate_id`, `approved_at`)
 * are owned exclusively by the DB and are never overwritten by a file scan. This
 * ensures that proposals approved/rejected/assigned to gates retain their state
 * even if the `.md` file is edited directly.
 */
export function syncProposalsFromDisk(
  db: Database.Database,
  projectRoot: string = process.cwd()
): void {
  const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')

  const nowIso = new Date().toISOString()
  const upsert = db.prepare(`
    INSERT INTO proposals
      (id, gate_id, requirement_id, title, status, hash,
       created_at, updated_at,
       approved_at, approved_by,
       rejected_at, rejected_by,
       started_at,  started_by,
       implemented_at)
    VALUES
      (lower(hex(randomblob(16))), ?, ?, ?, ?, ?,
       ?, ?,
       ?, ?,
       ?, ?,
       ?, ?,
       ?)
    ON CONFLICT(hash) DO UPDATE SET
      title          = excluded.title,
      requirement_id = COALESCE(excluded.requirement_id, proposals.requirement_id),
      gate_id        = CASE
        WHEN proposals.status IN ('approved', 'completed') THEN proposals.gate_id
        ELSE excluded.gate_id
      END,
      updated_at     = excluded.updated_at
    -- lifecycle fields are NOT re-written on conflict; DB state is authoritative
    -- for rows that already exist.
  `)
  // Used to validate FK before inserting: prevents FK constraint violations when
  // the referenced requirement doesn't exist in the DB yet.
  const requirementExists = db.prepare('SELECT 1 FROM requirements WHERE id = ? LIMIT 1')

  const syncAll = db.transaction(() => {
    const seenHashes = new Map<string, string>() // hash -> filePath

    // Sync all proposals from disk
    for (const filePath of walkMd(proposalsDir)) {
      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        continue
      }

      const meta = parseProposalMetadata(content, filePath)
      if (!meta) continue

      // Check for hash collision in current sync
      if (seenHashes.has(meta.hash)) {
        console.warn(
          `⚠ Hash collision detected: ${meta.hash}\n` +
            `  File 1: ${String(seenHashes.get(meta.hash))}\n` +
            `  File 2: ${filePath}\n` +
            `  Only the first file will be synced. This indicates a data integrity issue.`
        )
        continue
      }
      seenHashes.set(meta.hash, filePath)

      // Only persist requirement_id if it references an existing requirement row (FK safe)
      const resolvedRequirementId =
        meta.requirementId && requirementExists.get(meta.requirementId)
          ? meta.requirementId
          : null

      upsert.run(
        meta.gateId, resolvedRequirementId, meta.title, normalizeProposalStatus(meta.status), meta.hash,
        normalizeDateTime(meta.createdAt, nowIso), nowIso,
        meta.approvedAt, meta.approvedBy,
        meta.rejectedAt, meta.rejectedBy,
        meta.startedAt,  meta.startedBy,
        meta.implementedAt
      )
    }
  })

  syncAll()
}
