/**
 * Requirement Storage Layer
 *
 * Handles persistence of requirements to SQLite database with content-addressed hashing.
 * Ensures idempotent storage - same requirement content always generates same hash.
 */

import Database from 'better-sqlite3'
import { getDatabase } from '../storage/database.js'
import { Requirement, RequirementType, RequirementPriority, RequirementCandidate } from './types.js'
import { generateRequirementHash, detectHashCollision } from '../utils/hash.js'
import { findProposalsReferencingRequirementSync } from './proposals-discovery.js'
import { DatabaseError } from '../utils/errors.js'
import {
  buildDependencyGraph,
  validateDependencyGraph,
  type DependencyGraph,
} from './dependency-graph.js'
import { writeRequirementsManifest, parseProjectIds } from '../storage/requirements-sync.js'

interface RequirementRow {
  id: string
  project_id: string
  gate_id: string | null
  parent_id: string | null
  /** Scope level added in migration 006 */
  level: string | null
  type: string
  priority: string
  description: string
  acceptance_criteria: string | null
  hash: string
  created_at: string
}

/**
 * Requirement storage operations
 *
 * Database presence equals approval. Implementation progress tracked
 * through Git commits and proposal completion, not database fields.
 */
export class RequirementStorage {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Map a raw database row to a Requirement domain object.
   * Handles backward-compat with pre-migration rows where level is absent.
   */
  private rowToRequirement(row: RequirementRow): Requirement {
    return {
      id: row.id,
      projectId: parseProjectIds(row.project_id),
      gateId: row.gate_id,
      parentId: row.parent_id,
      level: (row.level as import('./types.js').RequirementLevel | null) ?? 'gate',
      type: row.type as RequirementType,
      priority: row.priority as RequirementPriority,
      description: row.description,
      acceptanceCriteria: row.acceptance_criteria ?? undefined,
      hash: row.hash,
      createdAt: new Date(row.created_at),
    }
  }

  /**
   * Store a requirement in the database.
   * Generates hash deterministically from content.
   * Idempotent - same content won't create duplicates.
   */
  storeRequirement(
    description: string,
    type: RequirementType,
    priority: RequirementPriority,
    projectId: string | string[] = 'default-project',
    gateId?: string,
    acceptanceCriteria?: string,
    parentId?: string,
    level: import('./types.js').RequirementLevel = 'gate'
  ): Requirement {
    // Generate deterministic base hash from semantic content
    const baseHash: string = generateRequirementHash({
      type,
      priority,
      description,
      acceptanceCriteria: acceptanceCriteria?.trim(),
    })

    // Check if exact content already exists
    const existingExact = this.getRequirementByHash(baseHash)
    if (existingExact) {
      // Verify content matches (in case of hash collision)
      if (
        existingExact.type === type &&
        existingExact.priority === priority &&
        existingExact.description === description.trim() &&
        (existingExact.acceptanceCriteria ?? undefined) ===
          (acceptanceCriteria?.trim() ?? undefined)
      ) {
        return existingExact
      }
    }

    // Detect collisions and compute final hash (may be versioned)
    const finalHash: string = detectHashCollision(this.db, baseHash, {
      type,
      priority,
      description,
      acceptanceCriteria: acceptanceCriteria?.trim(),
    })

    // If the final hash already exists (shouldn't happen but safety check), return it
    const existing = this.getRequirementByHash(finalHash)
    if (existing) {
      return existing
    }

    // Use finalHash as id for simplicity
    const id: string = finalHash

    const now = new Date().toISOString()

    // Prepared statements for validation and insert
    const selectParentStmt = this.db.prepare('SELECT id FROM requirements WHERE id = ?')
    const insertStmt = this.db.prepare(`
      INSERT INTO requirements (
        id, project_id, gate_id, parent_id, level,
        type, priority, description, acceptance_criteria, hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Use a transaction to ensure atomicity
    const projectIds: string[] = Array.isArray(projectId) ? projectId : [projectId]
    const projectIdSerialized = JSON.stringify(projectIds)

    const insertTx = this.db.transaction(() => {
      // Validate parent exists if provided
      if (parentId) {
        const parentRow = selectParentStmt.get(parentId)
        if (!parentRow) {
          throw new DatabaseError(
            'Parent requirement does not exist',
            'DB_REQUIREMENT_PARENT_NOT_FOUND',
            { parentId }
          )
        }
      }

      insertStmt.run(
        id,
        projectIdSerialized,
        gateId ?? null,
        parentId ?? null,
        level,
        type,
        priority,
        description.trim(),
        acceptanceCriteria?.trim() ?? null,
        finalHash,
        now
      )

      // Validate that the new requirement doesn't introduce cycles
      const graph = this.buildRequirementGraph()
      const validationErrors = validateDependencyGraph(graph)
      if (validationErrors.length > 0) {
        // Include cycle details in error for debugging
        throw new DatabaseError(
          `Dependency graph validation failed: ${validationErrors.join('; ')}`,
          'DB_REQUIREMENT_GRAPH_VALIDATION_FAILED',
          { errors: validationErrors }
        )
      }
    })

    try {
      insertTx()
      writeRequirementsManifest(this.db)

      return {
        id,
        projectId: projectIds,
        gateId: gateId ?? null,
        parentId: parentId ?? null,
        level,
        type,
        priority,
        description: description.trim(),
        acceptanceCriteria: acceptanceCriteria?.trim(),
        hash: finalHash,
        createdAt: new Date(now),
      }
    } catch (err: unknown) {
      // If validation raised a specific DatabaseError, rethrow it to preserve context
      if (err instanceof DatabaseError && err.code === 'DB_REQUIREMENT_GRAPH_VALIDATION_FAILED') {
        throw err
      }

      const e: Error = err instanceof Error ? err : new Error(String(err))
      const errHash =
        typeof finalHash !== 'undefined'
          ? finalHash
          : typeof baseHash !== 'undefined'
            ? baseHash
            : null
      throw new DatabaseError(
        'Failed to store requirement',
        'DB_REQUIREMENT_STORE_FAILED',
        { hash: errHash, description: description.substring(0, 100) },
        e
      )
    }
  }

  /**
   * Store multiple requirements from candidates
   */
  /**
   * Store multiple requirements from candidates
   */
  storeRequirementsFromCandidates(
    candidates: RequirementCandidate[],
    projectId = 'default-project',
    gateId?: string
  ): Requirement[] {
    const requirements: Requirement[] = []

    for (const candidate of candidates) {
      // Only store high-confidence candidates
      if (candidate.confidence >= 0.6) {
        const requirement = this.storeRequirement(
          candidate.description,
          candidate.type,
          candidate.priority,
          projectId,
          gateId,
          undefined // acceptance criteria
        )
        requirements.push(requirement)
      }
    }

    return requirements
  }

  /**
   * Get requirement by hash
   */
  getRequirementByHash(hash: string): Requirement | null {
    try {
      // Try exact match first (supports base or versioned hashes)
      const exactQuery = `
        SELECT id, project_id, gate_id, parent_id, level, type, priority, description, acceptance_criteria, hash, created_at
        FROM requirements
        WHERE hash = ?
      `

      let stmt = this.db.prepare(exactQuery)
      let row = stmt.get(hash) as RequirementRow | undefined

      // If not found and a base hash (16 hex) was provided, look for a versioned hash
      if (!row && /^[a-f0-9]{16}$/i.test(hash)) {
        const likeQuery = `
          SELECT id, project_id, gate_id, parent_id, level, type, priority, description, acceptance_criteria, hash, created_at
          FROM requirements
          WHERE hash LIKE ?
          ORDER BY created_at DESC
          LIMIT 1
        `
        stmt = this.db.prepare(likeQuery)
        row = stmt.get(`${hash}_v%`) as RequirementRow | undefined
      }

      if (!row) return null

      return this.rowToRequirement(row)
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to get requirement by hash',
        'DB_REQUIREMENT_GET_FAILED',
        { hash },
        e
      )
    }
  }

  /**
   * Search requirements by keyword across description and acceptance criteria
   */
  searchRequirements(
    query: string,
    opts: { gateId?: string; type?: string; skip?: number; take?: number } = {}
  ): { requirements: Requirement[]; total: number } {
    try {
      const { gateId, type, skip = 0, take = 50 } = opts
      const like = `%${query}%`
      const params: unknown[] = [like, like]

      let sql = `
        SELECT id, project_id, gate_id, parent_id, level, type, priority, description, acceptance_criteria, hash, created_at
        FROM requirements
        WHERE (description LIKE ? OR acceptance_criteria LIKE ?)
      `

      if (gateId) {
        sql += ' AND gate_id = ?'
        params.push(gateId)
      }
      if (type) {
        sql += ' AND type = ?'
        params.push(type)
      }

      // Count total matches before pagination
      const countStmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM (${sql})`)
      const { cnt } = countStmt.get(...params) as { cnt: number }

      sql += ' ORDER BY created_at LIMIT ? OFFSET ?'
      params.push(take, skip)

      const rows = this.db.prepare(sql).all(...params) as RequirementRow[]

      return {
        requirements: rows.map((row) => this.rowToRequirement(row)),
        total: cnt,
      }
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to search requirements',
        'DB_REQUIREMENTS_SEARCH_FAILED',
        { query },
        e
      )
    }
  }

  /**
   * Get all project-level requirements (gate_id is null)
   */
  getProjectRequirements(projectId?: string): Requirement[] {
    try {
      let query = `
        SELECT id, project_id, gate_id, parent_id, level, type, priority, description, acceptance_criteria, hash, created_at
        FROM requirements
        WHERE gate_id IS NULL
      `
      const params: unknown[] = []

      if (projectId) {
        query += ` AND EXISTS (
          SELECT 1 FROM json_each(project_id) WHERE value = ?
        )`
        params.push(projectId)
      }

      query += ' ORDER BY created_at'

      const stmt = this.db.prepare(query)
      const rows = stmt.all(...params) as RequirementRow[]

      return rows.map((row: RequirementRow) => this.rowToRequirement(row))
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to get project requirements',
        'DB_PROJECT_REQUIREMENTS_GET_FAILED',
        { projectId },
        e
      )
    }
  }

  /**
   * Build a dependency graph of requirements optionally filtered by gate
   */
  buildRequirementGraph(gateId?: string): DependencyGraph {
    try {
      let query = `
        SELECT id, project_id, gate_id, parent_id, level, type, priority, description, acceptance_criteria, hash, created_at
        FROM requirements
      `
      const params: unknown[] = []

      if (gateId) {
        query += ' WHERE gate_id = ?'
        params.push(gateId)
      }

      query += ' ORDER BY created_at'

      const stmt = this.db.prepare(query)
      const rows = stmt.all(...params) as RequirementRow[]

      const requirements: Requirement[] = rows.map((row) => this.rowToRequirement(row))

      return buildDependencyGraph(requirements)
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to build requirement graph',
        'DB_REQUIREMENT_GRAPH_BUILD_FAILED',
        { gateId },
        e
      )
    }
  }

  /**
   * Get direct children of a requirement identified by hash
   */
  getRequirementChildren(parentHash: string): Requirement[] {
    try {
      const parent = this.getRequirementByHash(parentHash)
      if (!parent) return []

      const stmt = this.db.prepare(`
        SELECT id, project_id, gate_id, parent_id, level, type, priority, description, acceptance_criteria, hash, created_at
        FROM requirements
        WHERE parent_id = ?
        ORDER BY created_at
      `)

      const rows = stmt.all(parent.id) as RequirementRow[]

      return rows.map((row) => this.rowToRequirement(row))
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to get requirement children',
        'DB_REQUIREMENT_CHILDREN_GET_FAILED',
        { parentHash },
        e
      )
    }
  }

  /**
   * Get ancestors (parent chain) for a requirement identified by hash
   */
  getRequirementAncestors(hash: string): Requirement[] {
    try {
      const result: Requirement[] = []
      let current = this.getRequirementByHash(hash)
      while (current?.parentId) {
        const parentId = current.parentId

        const parentRow = this.db
          .prepare(
            `
          SELECT id, project_id, gate_id, parent_id, level, type, priority, description, acceptance_criteria, hash, created_at
          FROM requirements
          WHERE id = ?
        `
          )
          .get(parentId) as RequirementRow | undefined

        if (!parentRow) break

        const parent: Requirement = this.rowToRequirement(parentRow)

        result.push(parent)
        current = parent
      }

      return result
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to get requirement ancestors',
        'DB_REQUIREMENT_ANCESTORS_FAILED',
        { hash },
        e
      )
    }
  }

  /**
   * Delete requirement by hash with optional cascade
   */
  deleteRequirement(hash: string, cascade = false): void {
    try {
      const target = this.getRequirementByHash(hash)
      if (!target) return

      const getChildrenStmt = this.db.prepare('SELECT id FROM requirements WHERE parent_id = ?')

      const deleteTx = this.db.transaction(() => {
        // If children exist and cascade is false, throw
        const children = getChildrenStmt.all(target.id) as { id: string }[]
        if (children.length > 0 && !cascade) {
          throw new DatabaseError(
            'Cannot delete requirement with children without cascade',
            'DB_REQUIREMENT_DELETE_HAS_CHILDREN',
            { hash }
          )
        }

        // If cascade, collect all descendant ids and delete them
        if (cascade) {
          const toDelete = new Set<string>()
          const stack = [target.id]
          while (stack.length > 0) {
            const currentId = stack.pop()
            if (!currentId) break
            toDelete.add(currentId)
            const childRows = getChildrenStmt.all(currentId) as { id: string }[]
            for (const c of childRows) stack.push(c.id)
          }

          const placeholders = Array.from(toDelete)
            .map(() => '?')
            .join(', ')
          const deleteStmt = this.db.prepare(
            `DELETE FROM requirements WHERE id IN (${placeholders})`
          )
          deleteStmt.run(...Array.from(toDelete))
        } else {
          const deleteStmt = this.db.prepare('DELETE FROM requirements WHERE id = ?')
          deleteStmt.run(target.id)
        }
      })

      deleteTx()
      writeRequirementsManifest(this.db)
    } catch (err: unknown) {
      if (err instanceof DatabaseError) throw err
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to delete requirement',
        'DB_REQUIREMENT_DELETE_FAILED',
        { hash, cascade },
        e
      )
    }
  }

  /**
   * Transfer a requirement (and its descendants) to a new gate.
   * Sets `gate_id = targetGateId` and `source = 'transferred'`.
   */
  transferRequirement(
    hash: string,
    targetGateId: string
  ): {
    hash: string
    previousGateId: string | null
    newGateId: string
    transferredAt: string
    affectedProposals: string[]
  } {
    try {
      const targetReq = this.getRequirementByHash(hash)
      if (!targetReq) {
        throw new DatabaseError('Requirement not found', 'DB_REQUIREMENT_NOT_FOUND', { hash })
      }

      // Validate gate exists in gates table
      const gateRow = this.db.prepare('SELECT id FROM gates WHERE id = ?').get(targetGateId) as
        | { id: string }
        | undefined
      if (!gateRow) {
        throw new DatabaseError('Target gate not found', 'DB_GATE_NOT_FOUND', {
          gateId: targetGateId,
        })
      }

      const previousGate = targetReq.gateId ?? null

      const getChildrenStmt = this.db.prepare('SELECT id FROM requirements WHERE parent_id = ?')
      const updateStmt = this.db.prepare('UPDATE requirements SET gate_id = ? WHERE id = ?')

      const transferTx = this.db.transaction(() => {
        // Collect all descendant ids (including the root)
        const toUpdate = new Set<string>()
        const stack = [targetReq.id]
        while (stack.length > 0) {
          const cur = stack.pop()
          if (!cur) break
          toUpdate.add(cur)
          const childRows = getChildrenStmt.all(cur) as { id: string }[]
          for (const c of childRows) stack.push(c.id)
        }

        for (const id of Array.from(toUpdate)) {
          // Move to target gate
          updateStmt.run(targetGateId, id)
        }
      })

      transferTx()
      writeRequirementsManifest(this.db)

      // Determine affected proposals by scanning proposal files for references to this requirement hash
      let affectedProposals: string[] = []
      try {
        // Use sync variant to avoid making this API async (keeps callers simple)
        affectedProposals = findProposalsReferencingRequirementSync(process.cwd(), targetReq.hash)
      } catch (err: unknown) {
        // If proposals lookup fails, log and continue with empty list (non-fatal)
        const e: Error = err instanceof Error ? err : new Error(String(err))
        console.warn('Failed to determine affected proposals during transfer', e)
        affectedProposals = []
      }

      return {
        hash: targetReq.hash,
        previousGateId: previousGate,
        newGateId: targetGateId,
        transferredAt: new Date().toISOString(),
        affectedProposals,
      }
    } catch (err: unknown) {
      if (err instanceof DatabaseError) throw err
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to transfer requirement',
        'DB_REQUIREMENT_TRANSFER_FAILED',
        { hash, targetGateId },
        e
      )
    }
  }

  // --------------------------------------------------------------------------
  // Cross-gate requirement dependencies (gate_dependencies table)
  // --------------------------------------------------------------------------

  /**
   * Explicitly link an existing requirement to a gate for cross-gate reuse.
   * Idempotent — calling multiple times with the same pair is safe.
   *
   * Use this when a gate needs to reference a requirement defined in another
   * gate without transferring ownership. Creates a row in gate_dependencies.
   */
  linkRequirementToGate(requirementId: string, gateId: string): void {
    try {
      this.db
        .prepare(`
          INSERT OR IGNORE INTO gate_dependencies (requirement_id, gate_id)
          VALUES (?, ?)
        `)
        .run(requirementId, gateId)
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to link requirement to gate',
        'DB_REQUIREMENT_LINK_FAILED',
        { requirementId, gateId },
        e
      )
    }
  }

  /**
   * Return all gate IDs that explicitly reference a requirement via gate_dependencies.
   * Does NOT include the gate that owns the requirement (gate_id column).
   */
  getLinkedGates(requirementId: string): string[] {
    try {
      interface LinkRow { gate_id: string }
      const rows = this.db
        .prepare('SELECT gate_id FROM gate_dependencies WHERE requirement_id = ? ORDER BY linked_at')
        .all(requirementId) as LinkRow[]
      return rows.map((r) => r.gate_id)
    } catch {
      return []
    }
  }

  /**
   * Return all requirements that have been explicitly linked to this gate
   * (i.e., reused from other gates). Does NOT return requirements where gate_id = gateId.
   */
  getGateLinkedRequirements(gateId: string): Requirement[] {
    try {
      const rows = this.db
        .prepare(`
          SELECT r.id, r.project_id, r.gate_id, r.parent_id,
                 r.level,
                 r.type, r.priority, r.description, r.acceptance_criteria,
                 r.hash, r.created_at
          FROM requirements r
          JOIN gate_dependencies l ON l.requirement_id = r.id
          WHERE l.gate_id = ?
          ORDER BY l.linked_at
        `)
        .all(gateId) as RequirementRow[]
      return rows.map((row) => this.rowToRequirement(row))
    } catch {
      return []
    }
  }

  /**
   * Return requirements whose level = 'project'.
   * These are PRD-level cross-cutting requirements that should be traced
   * across all gates.
   */
  getProjectLevelRequirements(projectId?: string): Requirement[] {
    try {
      const conditions: string[] = ["level = 'project'"]
      const params: unknown[] = []
      if (projectId) {
        conditions.push(`EXISTS (SELECT 1 FROM json_each(project_id) WHERE value = ?)`)
        params.push(projectId)
      }
      const rows = this.db
        .prepare(`
          SELECT id, project_id, gate_id, parent_id, level, type, priority, description, acceptance_criteria, hash, created_at
          FROM requirements
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at
        `)
        .all(...params) as RequirementRow[]
      return rows.map((row) => this.rowToRequirement(row))
    } catch {
      return []
    }
  }

  /**
   * Return all gates that reference a requirement, combining:
   *   - The owner gate (requirements.gate_id)
   *   - All gates that linked it explicitly (gate_dependencies)
   *
   * This is the core of the traceability chain: given a requirement hash,
   * answer "which gates work on this?"
   */
  getRequirementReferencingGates(requirementHash: string): { gateId: string; role: 'owner' | 'linked' }[] {
    try {
      const req = this.getRequirementByHash(requirementHash)
      if (!req) return []

      const result: { gateId: string; role: 'owner' | 'linked' }[] = []
      if (req.gateId) result.push({ gateId: req.gateId, role: 'owner' })

      const linkedGates = this.getLinkedGates(req.id)
      for (const g of linkedGates) {
        if (g !== req.gateId) result.push({ gateId: g, role: 'linked' })
      }
      return result
    } catch {
      return []
    }
  }
}
