/**
 * Requirement Operations Registry
 *
 * Registers all requirement-related operations with the function registry.
 * Handles: list, show, deps, transfer
 *
 * All operations use direct in-process database access via RequirementStorage.
 * Previous implementation used invokeCommand/execSync to spawn CLI child
 * processes, which caused an infinite recursion loop (CLI -> registry ->
 * invokeCommand -> CLI -> ...) and catastrophic process accumulation.
 */

import { z } from 'zod'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { FunctionRegistry } from './function-registry.js'
import { RequirementStorage } from '../generation/requirement-storage.js'
import { getDatabase } from '../storage/database.js'
import { syncProposalsFromDisk } from '../storage/proposal-sync.js'

/**
 * Scan `zeno/proposals/` and return the set of all proposal hashes
 * that have a corresponding .md file on disk. Used by db_* maintenance actions
 * to detect rows in the proposals table that no longer have a backing file.
 */
function collectDiskHashes(proposalsDir: string): Set<string> {
  const hashes = new Set<string>()

  function walk(dir: string): void {
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
          if (entry !== 'archive') walk(full)
        } else if (entry.endsWith('.md')) {
          try {
            const content = readFileSync(full, 'utf-8')
            const match = /\*\*Hash\*\*:\s*#?([a-zA-Z0-9_-]+)/.exec(content)
            if (match?.[1]) hashes.add(match[1].trim())
          } catch { /* skip unreadable files */ }
        }
      } catch { /* skip unreadable entries */ }
    }
  }

  walk(proposalsDir)
  return hashes
}

export function registerRequirementsOps(registry: FunctionRegistry): void {
  // Unified requirement action handler: list | show | deps | transfer
  registry.register(
    'req_action',
    (params) => {
      const validated = z.object({ action: z.string(), payload: z.any().optional() }).parse(params)
      const storage = new RequirementStorage()

      switch (validated.action) {
        case 'list': {
          const payload = z
            .object({
              gateId: z.string().optional(),
              project: z.boolean().optional(),
            })
            .parse(validated.payload ?? {})

          if (payload.project) {
            const reqs = storage.getProjectRequirements()
            return {
              requirements: reqs.map((r) => ({
                hash: r.hash,
                title: r.description,
                type: r.type,
                priority: r.priority,
                gateId: r.gateId ?? 'gate-00',
                created: (r.createdAt as Date | undefined)?.toISOString() ?? new Date().toISOString(),
              })),
            }
          }

          // Use buildRequirementGraph which returns nodes as a Map<string, DependencyNode>
          const graph = storage.buildRequirementGraph(payload.gateId)
          const now = new Date().toISOString()
          const allRequirements = Array.from(graph.nodes.values()).map((n) => ({
            hash: n.hash,
            title: n.title,
            type: n.type,
            priority: n.priority,
            gateId: n.gateId ?? 'gate-00',
            created: now,
          }))

          return {
            requirements: allRequirements,
          }
        }

        case 'show': {
          const payload = z.object({ hash: z.string() }).parse(validated.payload ?? {})
          const req = storage.getRequirementByHash(payload.hash)
          if (!req) {
            return { requirement: null, children: [], ancestors: [] }
          }
          const children = storage.getRequirementChildren(payload.hash)
          const ancestors = storage.getRequirementAncestors(payload.hash)
          return {
            requirement: {
              hash: req.hash,
              title: req.description,
              description: req.description,
              type: req.type,
              gateId: req.gateId ?? 'gate-00',
              priority: req.priority,
              acceptance: req.acceptanceCriteria
                ? [{ criteria: req.acceptanceCriteria, completed: false }]
                : undefined,
              childRequirements: children.map((c) => ({ hash: c.hash, title: c.description })),
              parentRequirement: ancestors[0]
                ? { hash: ancestors[0].hash, title: ancestors[0].description }
                : undefined,
              created: (req.createdAt as Date | undefined)?.toISOString() ?? new Date().toISOString(),
            },
            children,
            ancestors,
          }
        }

        case 'deps': {
          const payload = z.object({ hash: z.string() }).parse(validated.payload ?? {})
          const req = storage.getRequirementByHash(payload.hash)
          if (!req) {
            return { graph: null }
          }
          const graph = storage.buildRequirementGraph(req.gateId ?? undefined)
          return {
            graph: {
              root: req.hash,
              nodes: Array.from(graph.nodes.values()),
              edges: graph.edges,
            },
          }
        }

        case 'transfer': {
          const payload = z
            .object({ hash: z.string(), gateId: z.string() })
            .parse(validated.payload ?? {})
          const result = storage.transferRequirement(payload.hash, payload.gateId)
          return result
        }

        case 'search': {
          const payload = z
            .object({
              query: z.string().min(1),
              gateId: z.string().optional(),
              type: z.string().optional(),
            })
            .parse(validated.payload ?? {})
          const { requirements, total } = storage.searchRequirements(payload.query, {
            gateId: payload.gateId,
            type: payload.type,
            skip: 0,
            take: 9999,
          })
          return {
            requirements: requirements.map((r) => ({
              hash: r.hash,
              title: r.description,
              type: r.type,
              priority: r.priority,
              gateId: r.gateId ?? 'gate-00',
              created: (r.createdAt as Date | undefined)?.toISOString() ?? new Date().toISOString(),
            })),
            total,
          }
        }

        case 'db_status': {
          const db = getDatabase()
          const proposalsDir = path.join(process.cwd(), 'zeno', 'proposals')
          const diskHashes = collectDiskHashes(proposalsDir)

          interface StatusRow { hash: string; status: string; gate_id: string | null }
          const allRows = db
            .prepare('SELECT hash, status, gate_id FROM proposals')
            .all() as StatusRow[]

          const orphaned = allRows.filter((r) => !diskHashes.has(r.hash))

          const byStatus: Record<string, number> = {}
          for (const row of allRows) {
            byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
          }

          return {
            total: allRows.length,
            onDisk: diskHashes.size,
            orphaned: orphaned.length,
            orphanedHashes: orphaned.map((r) => r.hash),
            byStatus,
            message:
              orphaned.length > 0
                ? `${String(orphaned.length)} orphaned DB row(s) found. Run req_action { action: "purge_orphans" } to clean up.`
                : 'Database proposals table is consistent with disk.',
          }
        }

        case 'db_sync': {
          const db = getDatabase()
          const projectRoot = process.cwd()
          const proposalsDir = path.join(projectRoot, 'zeno', 'proposals')

          const before = (
            db.prepare('SELECT COUNT(*) as count FROM proposals').get() as { count: number }
          ).count

          syncProposalsFromDisk(db, projectRoot)

          const afterSync = (
            db.prepare('SELECT COUNT(*) as count FROM proposals').get() as { count: number }
          ).count
          const added = afterSync - before

          // Purge orphans after sync
          const diskHashes = collectDiskHashes(proposalsDir)
          const allHashes = db
            .prepare('SELECT hash FROM proposals')
            .all() as { hash: string }[]
          const orphaned = allHashes
            .filter((r) => !diskHashes.has(r.hash))
            .map((r) => r.hash)

          const del = db.prepare('DELETE FROM proposals WHERE hash = ?')
          for (const hash of orphaned) del.run(hash)

          const after = (
            db.prepare('SELECT COUNT(*) as count FROM proposals').get() as { count: number }
          ).count

          return {
            before,
            after,
            added,
            orphansRemoved: orphaned.length,
            removedHashes: orphaned,
            message: `Sync complete: ${String(added)} added, ${String(orphaned.length)} orphans removed. DB now has ${String(after)} proposals.`,
          }
        }

        case 'purge_orphans': {
          const payload = z
            .object({
              gateId: z.string().optional(),
              solitary: z.boolean().optional(),
              dryRun: z.boolean().default(false),
            })
            .refine(
              (v) => !(v.gateId && v.solitary),
              { message: 'gateId and solitary are mutually exclusive' }
            )
            .parse(validated.payload ?? {})

          const db = getDatabase()
          const proposalsDir = path.join(process.cwd(), 'zeno', 'proposals')
          const diskHashes = collectDiskHashes(proposalsDir)

          interface ProposalRow { hash: string; gate_id: string | null; title: string; status: string }

          // Build scoped query: all | by gate | solitary-only
          let query = 'SELECT hash, gate_id, title, status FROM proposals'
          const queryParams: (string | null)[] = []
          if (payload.solitary) {
            query += ' WHERE gate_id IS NULL'
          } else if (payload.gateId) {
            query += ' WHERE gate_id = ?'
            queryParams.push(payload.gateId)
          }

          const rows = db.prepare(query).all(...queryParams) as ProposalRow[]
          const orphaned = rows.filter((r) => !diskHashes.has(r.hash))

          if (!payload.dryRun) {
            const del = db.prepare('DELETE FROM proposals WHERE hash = ?')
            for (const row of orphaned) del.run(row.hash)
          }

          const scopeLabel = payload.solitary
            ? 'solitary proposals'
            : payload.gateId ?? 'all proposals'

          return {
            removed: payload.dryRun ? 0 : orphaned.length,
            dryRun: payload.dryRun,
            gateId: payload.gateId ?? null,
            solitary: Boolean(payload.solitary),
            orphans: orphaned.map((r) => ({
              hash: r.hash,
              title: r.title,
              status: r.status,
              gateId: r.gate_id,
            })),
            message: payload.dryRun
              ? `Dry run (${scopeLabel}): ${String(orphaned.length)} orphaned row(s) would be removed.`
              : `Removed ${String(orphaned.length)} orphaned row(s) from ${scopeLabel}.`,
          }
        }

        case 'reset_gate': {
          const payload = z.object({ gateId: z.string() }).parse(validated.payload ?? {})

          const db = getDatabase()
          const result = db
            .prepare('DELETE FROM proposals WHERE gate_id = ?')
            .run(payload.gateId)
          const deletedCount = result.changes

          syncProposalsFromDisk(db, process.cwd())

          const resyncedCount = (
            db
              .prepare('SELECT COUNT(*) as count FROM proposals WHERE gate_id = ?')
              .get(payload.gateId) as { count: number }
          ).count

          return {
            gateId: payload.gateId,
            deletedCount,
            resyncedCount,
            message: `Reset ${payload.gateId}: deleted ${String(deletedCount)} rows, resynced ${String(resyncedCount)} proposals from disk.`,
          }
        }

        default:
          throw new Error(`Unknown req_action: ${validated.action}`)
      }
    },
    {
      description: 'Unified requirement action (list|show|deps|transfer|search)',
      parameters: [
        { name: 'action', type: 'string', description: 'Action to perform', required: true },
        {
          name: 'payload',
          type: 'object',
          description: 'Action-specific payload',
          required: false,
        },
      ],
      returnType: 'any',
      schema: z.object({ action: z.string(), payload: z.any().optional() }),
    }
  )
}
