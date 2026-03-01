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
import type { DependencyNode } from '../generation/dependency-graph.js'
import type { RequirementType, RequirementPriority } from '../generation/types.js'
import { getDatabase } from '../storage/database.js'
import { syncProposalsFromDisk } from '../storage/proposal-sync.js'
import { logger } from '../utils/logger.js'

// Valid type and priority values for validation
const VALID_TYPES = new Set<string>(['functional', 'non_functional', 'constraint'])
const VALID_PRIORITIES = new Set<string>(['must', 'should', 'could', 'wont'])

/**
 * Parsed requirement entry from a gate markdown table row.
 *
 * The `source` field indicates which template subsection the requirement
 * was parsed from:
 *   - `'project'`  — from "### Project Requirements (Attributed to This Gate)"
 *   - `'inherited'` — from "### Inherited/Transferred Requirements"
 *
 * Inherited requirements carry `sourceGateId` extracted from the
 * "Source Gate" column so they can be associated with their origin gate
 * rather than duplicated under the current gate.
 */
export interface ParsedGateRequirement {
  hash: string
  description: string
  type: RequirementType
  priority: RequirementPriority
  source: 'project' | 'inherited'
  sourceGateId?: string
}

/**
 * Find a gate markdown file synchronously by gateId.
 * Scans `zeno/gates/` for a file matching `<gateId>.md` or `<gateId>-*.md`.
 */
function findGateFileSync(gateId: string, projectRoot?: string): string | null {
  const gatesDir = path.join(projectRoot ?? process.cwd(), 'zeno', 'gates')
  let entries: string[]
  try {
    entries = readdirSync(gatesDir)
  } catch {
    return null
  }
  const match = entries.find((e) => e === `${gateId}.md` || e.startsWith(`${gateId}-`))
  return match ? path.join(gatesDir, match) : null
}

/**
 * Parse a single markdown table row into cells.
 * Handles pipe-delimited rows like `|#hash|Name|type|priority|notes|`.
 */
function parseTableRow(line: string): string[] {
  // Strip leading/trailing pipe and whitespace, then split by pipe
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * Template subsection identifiers recognised by the parser.
 *
 * The gate PRD template defines three subsections under `## Requirements`:
 *   1. `### Project Requirements (Attributed to This Gate)` — project-level reqs mapped to this gate
 *   2. `### Gate-Specific Requirements` — generated at gate-start, never contains a parseable table
 *   3. `### Inherited/Transferred Requirements` — reqs from other gates that this gate depends on
 */
type TemplateSubsection = 'project' | 'gate-specific' | 'inherited' | 'unknown'

/**
 * Classify a `### ` heading line into a known template subsection.
 */
function classifySubsection(heading: string): TemplateSubsection {
  const lower = heading.toLowerCase()
  if (lower.includes('project requirements')) return 'project'
  if (lower.includes('gate-specific')) return 'gate-specific'
  if (lower.includes('inherited') || lower.includes('transferred')) return 'inherited'
  return 'unknown'
}

/**
 * Parse requirement entries from gate markdown content.
 *
 * Leverages the gate PRD template structure to differentiate between:
 *   - **Project requirements** (attributed to this gate) — have Type and Priority columns
 *   - **Inherited/transferred requirements** — have Source Gate and Relationship columns;
 *     type/priority default to functional/must since those columns are absent
 *
 * The parser tracks the current `###` subsection heading and tags each
 * parsed requirement with `source` and optional `sourceGateId`.
 *
 * Each table is expected to have a header row and separator row before data rows.
 * Only rows with valid 16-char hex hashes are extracted.
 */
export function parseGateRequirementsFromMarkdown(content: string): ParsedGateRequirement[] {
  const results: ParsedGateRequirement[] = []
  const seenHashes = new Set<string>()

  // Match the entire ## Requirements section (up to next ## or end-of-file)
  const reqSectionMatch = /^## Requirements\s*$/m.exec(content)
  if (!reqSectionMatch) return results

  const startIdx = reqSectionMatch.index + reqSectionMatch[0].length
  // Find the next top-level ## heading (not ###)
  const nextSectionMatch = /\n## (?!#)/g
  nextSectionMatch.lastIndex = startIdx
  const nextSection = nextSectionMatch.exec(content)
  const reqSection = nextSection
    ? content.slice(startIdx, nextSection.index)
    : content.slice(startIdx)

  const lines = reqSection.split('\n')

  // State machine to parse tables within the section
  let inTable = false
  let headerCells: string[] = []
  let hashCol = -1
  let nameCol = -1
  let typeCol = -1
  let priorityCol = -1
  let sourceGateCol = -1

  // Track current ### subsection from the gate template
  let currentSubsection: TemplateSubsection = 'unknown'

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect ### subsection headings (template-defined structure)
    if (trimmed.startsWith('### ')) {
      currentSubsection = classifySubsection(trimmed)
      // Reset table state at subsection boundary
      inTable = false
      headerCells = []
      hashCol = nameCol = typeCol = priorityCol = sourceGateCol = -1
      continue
    }

    // Skip gate-specific subsection entirely (no parseable tables)
    if (currentSubsection === 'gate-specific') continue

    // Detect table header row (contains pipes and appears to be a header)
    if (!inTable && trimmed.startsWith('|') && trimmed.includes('Hash')) {
      headerCells = parseTableRow(trimmed)
      // Map column indices by header name (case-insensitive)
      hashCol = headerCells.findIndex((c) => /^hash$/i.test(c))
      nameCol = headerCells.findIndex((c) => /^(name|title)$/i.test(c))
      typeCol = headerCells.findIndex((c) => /^type$/i.test(c))
      priorityCol = headerCells.findIndex((c) => /^priority$/i.test(c))
      sourceGateCol = headerCells.findIndex((c) => /^source\s*gate$/i.test(c))
      inTable = hashCol !== -1 && nameCol !== -1
      continue
    }

    // Skip separator row (e.g., |---|---|---|---|---|)
    if (inTable && /^\|[\s-|]+\|$/.test(trimmed)) {
      continue
    }

    // End of current table (non-pipe line or new heading)
    if (inTable && (!trimmed.startsWith('|') || trimmed.startsWith('###') || trimmed.startsWith('## '))) {
      inTable = false
      headerCells = []
      hashCol = nameCol = typeCol = priorityCol = sourceGateCol = -1
      // Don't skip — the line might start a new subsection or table header
      if (trimmed.startsWith('### ')) {
        currentSubsection = classifySubsection(trimmed)
      } else if (trimmed.startsWith('|') && trimmed.includes('Hash')) {
        headerCells = parseTableRow(trimmed)
        hashCol = headerCells.findIndex((c) => /^hash$/i.test(c))
        nameCol = headerCells.findIndex((c) => /^(name|title)$/i.test(c))
        typeCol = headerCells.findIndex((c) => /^type$/i.test(c))
        priorityCol = headerCells.findIndex((c) => /^priority$/i.test(c))
        sourceGateCol = headerCells.findIndex((c) => /^source\s*gate$/i.test(c))
        inTable = hashCol !== -1 && nameCol !== -1
      }
      continue
    }

    // Parse data row
    if (inTable && trimmed.startsWith('|')) {
      const cells = parseTableRow(trimmed)
      const rawHash = cells[hashCol] ?? ''

      // Extract 16-char hex hash from the cell (strip leading #)
      const hashMatch = /#?([a-f0-9]{16})\b/i.exec(rawHash)
      if (!hashMatch?.[1]) continue

      const hash: string = hashMatch[1]
      if (seenHashes.has(hash)) continue
      seenHashes.add(hash)

      const description: string = (cells[nameCol] ?? '').trim()
      if (!description) continue

      // Extract type, defaulting to 'functional' if column missing or invalid
      const rawType = typeCol >= 0 ? (cells[typeCol] ?? '').trim().toLowerCase() : ''
      const type: RequirementType = VALID_TYPES.has(rawType)
        ? (rawType as RequirementType)
        : 'functional'

      // Extract priority, defaulting to 'must' if column missing or invalid
      const rawPriority = priorityCol >= 0 ? (cells[priorityCol] ?? '').trim().toLowerCase() : ''
      const priority: RequirementPriority = VALID_PRIORITIES.has(rawPriority)
        ? (rawPriority as RequirementPriority)
        : 'must'

      // Determine source from template subsection context
      const source: 'project' | 'inherited' =
        currentSubsection === 'inherited' ? 'inherited' : 'project'

      // Extract source gate for inherited requirements
      let sourceGateId: string | undefined
      if (source === 'inherited' && sourceGateCol >= 0) {
        const rawGate = (cells[sourceGateCol] ?? '').trim()
        if (rawGate && rawGate !== '#[hash]' && rawGate.length > 0) {
          sourceGateId = rawGate
        }
      }

      results.push({ hash, description, type, priority, source, sourceGateId })
    }
  }

  return results
}

/**
 * Result of syncing a gate's markdown requirements into the database.
 */
interface SyncResult {
  /** Number of project requirements stored or already present under this gate */
  inserted: number
  /** Hashes of inherited requirements found in the markdown (from other gates) */
  inheritedHashes: string[]
}

/**
 * Attempt to sync requirements from a gate's markdown file into the database.
 *
 * Leverages the gate PRD template structure to handle two kinds of requirements:
 *
 *   1. **Project requirements** (attributed to this gate) — stored with the
 *      current gateId. If an identical requirement already exists in the DB,
 *      the idempotent `storeRequirement` call returns the existing row.
 *
 *   2. **Inherited/transferred requirements** — these originate from a different
 *      gate (identified by `sourceGateId` from the "Source Gate" column). They
 *      are **not** duplicated under the current gate. If they already exist in
 *      the DB they are left untouched; if they don't exist they are stored with
 *      their source gate's ID. Their hashes are returned in `inheritedHashes`
 *      so the caller can include them in query results.
 *
 * @returns SyncResult with insertion count and inherited hash list
 */
function syncGateRequirementsFromMarkdown(
  storage: RequirementStorage,
  gateId: string,
  projectRoot?: string
): SyncResult {
  const empty: SyncResult = { inserted: 0, inheritedHashes: [] }

  const gateFile = findGateFileSync(gateId, projectRoot)
  if (!gateFile) {
    logger.warn(`syncGateRequirementsFromMarkdown: gate file not found for ${gateId}`)
    return empty
  }

  let content: string
  try {
    content = readFileSync(gateFile, 'utf-8')
  } catch {
    logger.warn(`syncGateRequirementsFromMarkdown: failed to read ${gateFile}`)
    return empty
  }

  const parsed = parseGateRequirementsFromMarkdown(content)
  if (parsed.length === 0) {
    logger.info(`syncGateRequirementsFromMarkdown: no parseable requirements in ${gateFile}`)
    return empty
  }

  let inserted = 0
  const inheritedHashes: string[] = []

  for (const req of parsed) {
    try {
      if (req.source === 'inherited') {
        // Inherited requirement — belongs to its source gate, not this one.
        // Track the hash so the caller can include it in results.
        inheritedHashes.push(req.hash)

        const existing = storage.getRequirementByHash(req.hash)
        if (existing) {
          // Already in DB under its source gate — do NOT duplicate
          continue
        }

        // Not yet in DB — store under the source gate's ID (or null if unknown)
        storage.storeRequirement(
          req.description,
          req.type,
          req.priority,
          'default-project',
          req.sourceGateId ?? undefined,
          undefined, // acceptance criteria
          undefined  // parent id
        )
        continue
      }

      // Project requirement — attributed to this gate
      const existing = storage.getRequirementByHash(req.hash)
      if (existing) {
        inserted++
        continue
      }

      storage.storeRequirement(
        req.description,
        req.type,
        req.priority,
        'default-project',
        gateId,
        undefined, // acceptance criteria
        undefined  // parent id
      )
      inserted++
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      logger.warn(`syncGateRequirementsFromMarkdown: failed to store requirement "${req.description.substring(0, 60)}": ${errMsg}`)
    }
  }

  logger.info(`syncGateRequirementsFromMarkdown: synced ${String(inserted)} project + ${String(inheritedHashes.length)} inherited requirements for ${gateId} from ${gateFile}`)
  return { inserted, inheritedHashes }
}

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
          let graph = storage.buildRequirementGraph(payload.gateId)
          let allRequirements = Array.from(graph.nodes.values())

          // Track inherited requirement hashes from the markdown fallback
          let inheritedHashes: string[] = []

          // Fallback: if no requirements found for a specific gate,
          // try parsing the gate markdown file and seeding the DB
          if (allRequirements.length === 0 && payload.gateId) {
            const syncResult = syncGateRequirementsFromMarkdown(storage, payload.gateId)
            inheritedHashes = syncResult.inheritedHashes

            if (syncResult.inserted > 0) {
              // Re-query after seeding project requirements
              graph = storage.buildRequirementGraph(payload.gateId)
              allRequirements = Array.from(graph.nodes.values())
            }
          }

          // Resolve inherited requirements by hash and merge into results.
          // Inherited reqs live under their source gate in the DB, so
          // buildRequirementGraph(currentGateId) won't include them.
          // We look each one up individually and append, deduplicating by hash.
          const seenHashes = new Set(allRequirements.map((n) => n.hash))
          for (const inheritedHash of inheritedHashes) {
            if (seenHashes.has(inheritedHash)) continue
            const req = storage.getRequirementByHash(inheritedHash)
            if (req) {
              seenHashes.add(req.hash)
              const nodeType = VALID_TYPES.has(req.type) ? (req.type as DependencyNode['type']) : 'functional'
              const nodePriority = VALID_PRIORITIES.has(req.priority) ? (req.priority as DependencyNode['priority']) : 'must'
              allRequirements.push({
                hash: req.hash,
                id: req.hash,
                title: req.description,
                type: nodeType,
                priority: nodePriority,
                gateId: req.gateId ?? 'gate-00',
                parent: req.parentId ?? undefined,
                children: [],
                depth: 0,
              })
            }
          }

          if (allRequirements.length === 0 && payload.gateId) {
            return {
              requirements: [],
              error: `No requirements registered in the database for ${payload.gateId} and no parseable requirement tables found in the gate markdown file. Ensure the gate PRD contains a "## Requirements" section with markdown tables whose rows include valid 16-character hex hashes (e.g. |#4bc74e36854c4221|Description|type|priority|...|).`,
            }
          }

          const now = new Date().toISOString()

          return {
            requirements: allRequirements.map((n) => ({
              hash: n.hash,
              title: n.title,
              type: n.type,
              priority: n.priority,
              gateId: n.gateId ?? 'gate-00',
              created: now,
            })),
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
