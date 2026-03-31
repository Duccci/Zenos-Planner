/**
 * Requirements Sync Utility
 *
 * Two-way sync between the version-controlled requirements manifest
 * (`zeno/.zeno/requirements.json`) and the gitignored SQLite registry.
 *
 *  writeRequirementsManifest  DB  → JSON  (called after any requirement mutation)
 *  syncRequirementsFromDisk   JSON → DB   (called on database init / registry rebuild)
 *
 * Design intent:
 * - `requirements.json` is the persistent source of truth, version-controlled
 *   alongside proposals, gates and config.
 * - The DB is a queryable projection that is fully rebuiltable from the manifest.
 * - `syncRequirementsFromDisk` uses INSERT OR IGNORE so existing DB rows are
 *   never overwritten by stale manifest data — the DB is authoritative for rows
 *   that already exist; the manifest only fills in rows that are missing.
 *
 * Primary beneficiaries:
 *  - Project-level requirements (level='project', gate_id=NULL) — no gate PRD
 *    to regenerate them from.
 *  - Solitary-proposal requirements (gate_id=NULL) — proposal markdown is
 *    archived/removed after approval, severing the only other disk trace.
 */

import type Database from 'better-sqlite3'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { getZenoDir } from '../utils/config.js'
import { logger } from '../utils/logger.js'

export const REQUIREMENTS_MANIFEST_FILE = 'requirements.json'

export interface RequirementManifestEntry {
  id: string
  projectId: string[]
  gateId: string | null
  parentId: string | null
  level: string
  type: string
  priority: string
  description: string
  acceptanceCriteria: string | null
  hash: string
  source: string
  createdAt: string
}

export interface RequirementsManifest {
  version: 1
  updatedAt: string
  requirements: RequirementManifestEntry[]
}

interface RequirementDbRow {
  id: string
  project_id: string
  gate_id: string | null
  parent_id: string | null
  level: string | null
  type: string
  priority: string
  description: string
  acceptance_criteria: string | null
  hash: string
  source: string | null
  created_at: string
}

function getManifestPath(projectRoot: string): string {
  return path.join(getZenoDir(projectRoot), REQUIREMENTS_MANIFEST_FILE)
}

/**
 * Parse the raw DB project_id TEXT field into a string array.
 * Handles both the new JSON-array format and the legacy plain-string format
 * (e.g. 'default-project' → ['default-project']).
 */
export function parseProjectIds(raw: string | null | undefined): string[] {
  if (!raw) return ['default-project']
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed
    }
  } catch {
    // Not valid JSON — treat as a legacy plain string
  }
  return [raw]
}

/**
 * Write all requirements from the DB to `zeno/.zeno/requirements.json`.
 *
 * Called after any requirement create / update / delete / transfer so the
 * manifest always reflects the current state of the DB.  Non-fatal — any
 * I/O error is swallowed with a console.warn so it never breaks user-facing
 * write operations.
 */
export function writeRequirementsManifest(
  db: Database.Database,
  projectRoot: string = process.cwd()
): void {
  try {
    // Only persist project-level requirements; gate-level requirements are
    // stored in gate markdown files and rebuilt by the registry-rebuild command.
    const rows = db
      .prepare(
        `SELECT id, project_id, gate_id, parent_id,
                level, type, priority,
                description, acceptance_criteria, hash, source, created_at
         FROM requirements
         WHERE level = 'project'
         ORDER BY created_at`
      )
      .all() as RequirementDbRow[]

    const manifest: RequirementsManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      requirements: rows.map((r) => ({
        id: r.id,
        projectId: parseProjectIds(r.project_id),
        gateId: r.gate_id,
        parentId: r.parent_id,
level: r.level ?? 'gate',
        type: r.type,
        priority: r.priority,
        description: r.description,
        acceptanceCriteria: r.acceptance_criteria,
        hash: r.hash,
        source: r.source ?? 'generated',
        createdAt: r.created_at,
      })),
    }

    mkdirSync(getZenoDir(projectRoot), { recursive: true })
    writeFileSync(getManifestPath(projectRoot), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  } catch (err) {
    console.warn(
      `[requirements-sync] Failed to write requirements manifest: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Read `zeno/.zeno/requirements.json` and upsert its rows into the DB.
 *
 * Uses INSERT OR IGNORE so:
 * - Fresh DB (after wipe): all rows from manifest are restored.
 * - Existing DB:            already-present rows are left untouched; any rows
 *                           missing from the DB (e.g., partially restored) are
 *                           filled in.
 *
 * Gate FK behaviour: if the referenced gate does not yet exist in the DB, the
 * INSERT OR IGNORE fails silently for that row (FK constraint).  Project-level
 * and solitary requirements (gate_id=NULL) are always restored successfully.
 * Gate-level requirements are restored once the owning gate is present, e.g.
 * after running `zeno registry rebuild` when gates have been reloaded.
 *
 * Non-fatal: any error is swallowed so it never breaks startup.
 */
export interface SyncRequirementsResult {
  manifestPath: string
  found: boolean
  inManifest: number
  synced: number
}

export function syncRequirementsFromDisk(
  db: Database.Database,
  projectRoot: string = process.cwd()
): SyncRequirementsResult {
  const manifestPath = getManifestPath(projectRoot)
  logger.debug(`[requirements-sync] Reading manifest from: ${manifestPath}`)

  let manifest: RequirementsManifest
  try {
    const raw = readFileSync(manifestPath, 'utf-8')
    manifest = JSON.parse(raw) as RequirementsManifest
  } catch (err) {
    logger.debug(
      `[requirements-sync] Manifest not found or unreadable at ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`
    )
    return { manifestPath, found: false, inManifest: 0, synced: 0 }
  }

  if (!Array.isArray(manifest.requirements) || manifest.requirements.length === 0) {
    logger.debug(`[requirements-sync] Manifest is empty at ${manifestPath}`)
    return { manifestPath, found: true, inManifest: 0, synced: 0 }
  }

  const inManifest = manifest.requirements.length

  // Requirements are stored ordered by created_at; parents always come before
  // children since storeRequirement validates parent existence before insert.
  const insert = db.prepare(
    `INSERT OR IGNORE INTO requirements (
       id, project_id, gate_id, parent_id,
       level, type, priority,
       description, acceptance_criteria, hash, source, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  let synced = 0
  const syncAll = db.transaction(() => {
    for (const r of manifest.requirements) {
      const result = insert.run(
        r.id,
        JSON.stringify(Array.isArray(r.projectId) ? r.projectId : [r.projectId]),
        r.gateId ?? null,
        r.parentId ?? null,
        r.level,
        r.type,
        r.priority,
        r.description,
        r.acceptanceCriteria ?? null,
        r.hash,
        r.source,
        r.createdAt,
        r.createdAt // updated_at = created_at on restore
      )
      if (result.changes > 0) synced++
    }
  })

  // Disable FK checks outside the transaction — SQLite ignores pragma changes
  // inside BEGIN/COMMIT. Manifest may reference archived gates not in the DB.
  db.pragma('foreign_keys = OFF')
  try {
    syncAll()
  } catch (err) {
    logger.warn(
      `[requirements-sync] Failed to sync requirements from manifest: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    db.pragma('foreign_keys = ON')
  }

  return { manifestPath, found: true, inManifest, synced }
}
