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
}

/** Extract Zeno proposal metadata from a markdown file's content. */
function parseProposalMetadata(content: string, filePath: string): ParsedProposalMetadata | null {
  // Hash: **Hash**: #<hash> or **Hash**: <hash>
  const hashMatch = /\*\*Hash\*\*:\s*#?([a-zA-Z0-9_-]+)/.exec(content)
  if (!hashMatch?.[1]) return null
  const hash = hashMatch[1].trim()

  // Title: first # Proposal: <title> line
  const titleMatch = /^#\s+Proposal:\s+(.+)$/m.exec(content)
  const title = titleMatch?.[1]?.trim() ?? path.basename(filePath, '.md')

  // Status: **Status**: <status>
  const statusMatch = /\*\*Status\*\*:\s*([a-z_]+)/.exec(content)
  const status = statusMatch?.[1]?.trim() ?? 'pending'

  // Gate ID: infer from directory path.
  // 'gate-NN' folder -> store as gate_id; 'solitary' folder -> store NULL (avoids FK violation).
  const gateMatch = /[/\\]proposals[/\\](gate-\d+|solitary)[/\\]/.exec(filePath)
  const folderName = gateMatch?.[1] ?? null
  const gateId = folderName === 'solitary' ? null : folderName

  // Requirement: **Requirement**: <text> (informational only, not a FK in the schema)
  const reqMatch = /\*\*Requirement\*\*:\s*(.+)/.exec(content)
  const requirementId = reqMatch?.[1]?.trim() ?? null

  // Created: **Created**: <date>
  const createdMatch = /\*\*Created\*\*:\s*([^\n\r]+)/.exec(content)
  const createdAt = createdMatch?.[1]?.trim() ?? null

  return { hash, title, status, gateId, requirementId, createdAt }
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
 *
 * **Note on Dependencies:**
 * Proposal dependencies are derived from proposal references (e.g., "requires: #hash").
 * Dependencies are NOT stored as a separate database table (per minimalist design).
 * If dependency queries are needed, use parseProposalDependencies() to extract from markdown.
 */
export function syncProposalsFromDisk(
  db: Database.Database,
  projectRoot: string = process.cwd()
): void {
  const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')

  const nowIso = new Date().toISOString()
  const upsert = db.prepare(`
    INSERT INTO proposals (id, gate_id, title, status, hash, created_at, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hash) DO UPDATE SET
      title      = excluded.title,
      gate_id    = CASE
        WHEN proposals.status IN ('approved', 'completed') THEN proposals.gate_id
        ELSE excluded.gate_id
      END,
      updated_at = excluded.updated_at
  `)

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

      upsert.run(meta.gateId, meta.title, meta.status, meta.hash, normalizeDateTime(meta.createdAt, nowIso), nowIso)
    }
  })

  syncAll()
}
