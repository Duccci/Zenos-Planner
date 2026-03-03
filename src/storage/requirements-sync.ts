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

export const REQUIREMENTS_MANIFEST_FILE = 'requirements.json'

export interface RequirementManifestEntry {
  id: string
  projectId: string
  gateId: string | null
  parentId: string | null
  projectRequirementId: string | null
  level: string
  sourceGateId: string | null
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
  project_requirement_id: string | null
  level: string | null
  source_gate_id: string | null
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
    const rows = db
      .prepare(
        `SELECT id, project_id, gate_id, parent_id, project_requirement_id,
                level, source_gate_id, type, priority,
                description, acceptance_criteria, hash, source, created_at
         FROM requirements
         ORDER BY created_at`
      )
      .all() as RequirementDbRow[]

    const manifest: RequirementsManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      requirements: rows.map((r) => ({
        id: r.id,
        projectId: r.project_id,
        gateId: r.gate_id,
        parentId: r.parent_id,
        projectRequirementId: r.project_requirement_id,
        level: r.level ?? 'gate',
        sourceGateId: r.source_gate_id,
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
export function syncRequirementsFromDisk(
  db: Database.Database,
  projectRoot: string = process.cwd()
): void {
  const manifestPath = getManifestPath(projectRoot)

  let manifest: RequirementsManifest
  try {
    const raw = readFileSync(manifestPath, 'utf-8')
    manifest = JSON.parse(raw) as RequirementsManifest
  } catch {
    // File does not exist yet — nothing to sync
    return
  }

  if (!Array.isArray(manifest.requirements) || manifest.requirements.length === 0) {
    return
  }

  // Requirements are stored ordered by created_at; parents always come before
  // children since storeRequirement validates parent existence before insert.
  const insert = db.prepare(
    `INSERT OR IGNORE INTO requirements (
       id, project_id, gate_id, parent_id, project_requirement_id,
       level, source_gate_id, type, priority,
       description, acceptance_criteria, hash, source, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const syncAll = db.transaction(() => {
    for (const r of manifest.requirements) {
      insert.run(
        r.id,
        r.projectId,
        r.gateId ?? null,
        r.parentId ?? null,
        r.projectRequirementId ?? null,
        r.level,
        r.sourceGateId ?? null,
        r.type,
        r.priority,
        r.description,
        r.acceptanceCriteria ?? null,
        r.hash,
        r.source,
        r.createdAt,
        r.createdAt // updated_at = created_at on restore
      )
    }
  })

  try {
    syncAll()
  } catch (err) {
    console.warn(
      `[requirements-sync] Failed to sync requirements from manifest: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
