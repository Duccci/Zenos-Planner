/**
 * Requirement Storage Layer
 *
 * Handles persistence of requirements to SQLite database with content-addressed hashing.
 * Ensures idempotent storage - same requirement content always generates same hash.
 */

import Database from 'better-sqlite3'
import { getDatabase } from '../storage/database.js'
import {
  Requirement,
  RequirementType,
  RequirementPriority,
  RequirementLevel,
  RequirementSource,
  RequirementCandidate,
} from './types.js'
import { generateRequirementHash, detectHashCollision } from '../utils/hash.js'
import { findProposalsReferencingRequirementSync } from './proposals-discovery.js'
import { DatabaseError } from '../utils/errors.js'
import {
  buildDependencyGraph,
  validateDependencyGraph,
  type DependencyGraph,
} from './dependency-graph.js'

interface RequirementRow {
  id: string
  gate_id: string | null
  parent_id: string | null
  project_requirement_id: string | null
  type: string
  priority: string
  level: string
  source: string
  description: string
  acceptance_criteria: string | null
  hash: string
  status?: string | null
  source_gate_id: string | null
  created_at: string
  updated_at?: string | null
}

/**
 * Requirement storage operations
 *
 * NOTE: Database schema migrations that remove the `status` column and perform
 * cleanup (e.g., `hash_registry` reconciliation) are scheduled for execution
 * during Gate 04 as the authoritative cleanup step for requirements ASoT.
 */
export class RequirementStorage {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
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
    level: RequirementLevel = 'project',
    source: RequirementSource = 'generated',
    gateId?: string,
    acceptanceCriteria?: string,
    parentId?: string,
    projectRequirementId?: string
  ): Requirement {
    // Generate deterministic base hash from semantic content
    const baseHash: string = generateRequirementHash({
      type,
      priority,
      description,
      acceptanceCriteria: acceptanceCriteria?.trim(),
    })

    // Detect collisions and compute final hash (may be versioned)
    const finalHash: string = detectHashCollision(this.db, baseHash, {
      type,
      priority,
      description,
      acceptanceCriteria: acceptanceCriteria?.trim(),
    })

    // If an exact match exists (same content), return it
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
        id, gate_id, parent_id, project_requirement_id, type, priority,
        level, source, description, acceptance_criteria, hash, status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Use a transaction to ensure atomicity
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
        gateId ?? null,
        parentId ?? null,
        projectRequirementId ?? null,
        type,
        priority,
        level,
        source,
        description.trim(),
        acceptanceCriteria?.trim() ?? null,
        finalHash,
        'pending',
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

      return {
        id,
        gateId: gateId ?? null,
        parentId: parentId ?? null,
        projectRequirementId: projectRequirementId ?? null,
        type,
        priority,
        level,
        source,
        description: description.trim(),
        acceptanceCriteria: acceptanceCriteria?.trim(),
        hash: finalHash,
        status: 'pending' as const,
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
  storeRequirementsFromCandidates(
    candidates: RequirementCandidate[],
    level: RequirementLevel = 'project',
    source: RequirementSource = 'generated',
    gateId?: string
  ): Requirement[] {
    const requirements: Requirement[] = []

    for (const candidate of candidates) {
      // Only store high-confidence candidates
      if (candidate.confidence >= 0.6) {
        try {
          const requirement = this.storeRequirement(
            candidate.description,
            candidate.type,
            candidate.priority,
            level,
            source,
            gateId,
            undefined, // acceptance criteria
            undefined, // parent
            undefined // project requirement
          )
          requirements.push(requirement)
        } catch (err: unknown) {
          // Log but continue with other requirements
          const e: Error = err instanceof Error ? err : new Error(String(err))
          console.warn(`Failed to store requirement: ${candidate.description}`, e)
        }
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
        SELECT id, gate_id, parent_id, project_requirement_id, type, priority,
               level, source, description, acceptance_criteria, hash, status,
               source_gate_id, created_at, updated_at
        FROM requirements
        WHERE hash = ?
      `

      let stmt = this.db.prepare(exactQuery)
      let row = stmt.get(hash) as RequirementRow | undefined

      // If not found and a base hash (16 hex) was provided, look for a versioned hash
      if (!row && /^[a-f0-9]{16}$/i.test(hash)) {
        const likeQuery = `
          SELECT id, gate_id, parent_id, project_requirement_id, type, priority,
                 level, source, description, acceptance_criteria, hash,
                 source_gate_id, created_at
          FROM requirements
          WHERE hash LIKE ?
          ORDER BY created_at DESC
          LIMIT 1
        `
        stmt = this.db.prepare(likeQuery)
        row = stmt.get(`${hash}_v%`) as RequirementRow | undefined
      }

      if (!row) return null

      return {
        id: row.id,
        gateId: row.gate_id,
        parentId: row.parent_id,
        projectRequirementId: row.project_requirement_id,
        type: row.type as RequirementType,
        priority: row.priority as RequirementPriority,
        level: row.level as RequirementLevel,
        source: row.source as RequirementSource,
        description: row.description,
        acceptanceCriteria: row.acceptance_criteria ?? undefined,
        hash: row.hash,
        status: row.status ?? undefined,
        sourceGateId: row.source_gate_id ?? undefined,
        createdAt: new Date(row.created_at),
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      }
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
   * Get all project-level requirements
   */
  getProjectRequirements(projectId?: string): Requirement[] {
    try {
      let query = `
        SELECT r.id, r.gate_id, r.parent_id, r.project_requirement_id, r.type, r.priority,
               r.level, r.source, r.description, r.acceptance_criteria, r.hash, r.status,
               r.source_gate_id, r.created_at, r.updated_at
        FROM requirements r
        WHERE r.level = 'project'
      `
      const params: unknown[] = []

      if (projectId) {
        // If we had project_id in requirements, we could filter by it
        // For now, assume all project requirements are global
      }

      query += ' ORDER BY r.created_at'

      const stmt = this.db.prepare(query)
      const rows = stmt.all(...params) as RequirementRow[]

      return rows.map((row: RequirementRow) => ({
        id: row.id,
        gateId: row.gate_id,
        parentId: row.parent_id,
        projectRequirementId: row.project_requirement_id,
        type: row.type as RequirementType,
        priority: row.priority as RequirementPriority,
        level: row.level as RequirementLevel,
        source: row.source as RequirementSource,
        description: row.description,
        acceptanceCriteria: row.acceptance_criteria ?? undefined,
        hash: row.hash,
        status: row.status ?? undefined,
        sourceGateId: row.source_gate_id ?? undefined,
        createdAt: new Date(row.created_at),
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      }))
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
        SELECT id, gate_id, parent_id, project_requirement_id, type, priority,
               level, source, description, acceptance_criteria, hash, source_gate_id, created_at
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

      const requirements: Requirement[] = rows.map((row) => ({
        id: row.id,
        gateId: row.gate_id,
        parentId: row.parent_id,
        projectRequirementId: row.project_requirement_id,
        type: row.type as RequirementType,
        priority: row.priority as RequirementPriority,
        level: row.level as RequirementLevel,
        source: row.source as RequirementSource,
        description: row.description,
        acceptanceCriteria: row.acceptance_criteria ?? undefined,
        hash: row.hash,
        createdAt: new Date(row.created_at),
      }))

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
   * Get requirements by level ('project' | 'gate')
   */
  getRequirementsByLevel(level: RequirementLevel): Requirement[] {
    try {
      const stmt = this.db.prepare(`
        SELECT id, gate_id, parent_id, project_requirement_id, type, priority,
               level, source, description, acceptance_criteria, hash, status,
               source_gate_id, created_at, updated_at
        FROM requirements
        WHERE level = ?
        ORDER BY created_at
      `)

      const rows = stmt.all(level) as RequirementRow[]

      return rows.map((row) => ({
        id: row.id,
        gateId: row.gate_id,
        parentId: row.parent_id,
        projectRequirementId: row.project_requirement_id,
        type: row.type as RequirementType,
        priority: row.priority as RequirementPriority,
        level: row.level as RequirementLevel,
        source: row.source as RequirementSource,
        description: row.description,
        acceptanceCriteria: row.acceptance_criteria ?? undefined,
        hash: row.hash,
        status: row.status ?? undefined,
        sourceGateId: row.source_gate_id ?? undefined,
        createdAt: new Date(row.created_at),
      }))
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to get requirements by level',
        'DB_REQUIREMENTS_BY_LEVEL_FAILED',
        { level },
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
        SELECT id, gate_id, parent_id, project_requirement_id, type, priority,
               level, source, description, acceptance_criteria, hash, status,
               source_gate_id, created_at, updated_at
        FROM requirements
        WHERE parent_id = ?
        ORDER BY created_at
      `)

      const rows = stmt.all(parent.id) as RequirementRow[]

      return rows.map((row) => ({
        id: row.id,
        gateId: row.gate_id,
        parentId: row.parent_id,
        projectRequirementId: row.project_requirement_id,
        type: row.type as RequirementType,
        priority: row.priority as RequirementPriority,
        level: row.level as RequirementLevel,
        source: row.source as RequirementSource,
        description: row.description,
        acceptanceCriteria: row.acceptance_criteria ?? undefined,
        hash: row.hash,
        status: row.status ?? undefined,
        sourceGateId: row.source_gate_id ?? undefined,
        createdAt: new Date(row.created_at),
      }))
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
          SELECT id, gate_id, parent_id, project_requirement_id, type, priority,
                 level, source, description, acceptance_criteria, hash, status,
                 source_gate_id, created_at, updated_at
          FROM requirements
          WHERE id = ?
        `
          )
          .get(parentId) as RequirementRow | undefined

        if (!parentRow) break

        const parent: Requirement = {
          id: parentRow.id,
          gateId: parentRow.gate_id,
          parentId: parentRow.parent_id,
          projectRequirementId: parentRow.project_requirement_id,
          type: parentRow.type as RequirementType,
          priority: parentRow.priority as RequirementPriority,
          level: parentRow.level as RequirementLevel,
          source: parentRow.source as RequirementSource,
          description: parentRow.description,
          acceptanceCriteria: parentRow.acceptance_criteria ?? undefined,
          hash: parentRow.hash,
          status: parentRow.status ?? undefined,
          sourceGateId: parentRow.source_gate_id ?? undefined,
          createdAt: new Date(parentRow.created_at),
          updatedAt: parentRow.updated_at ? new Date(parentRow.updated_at) : undefined,
        }

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
   * Update requirement with validation and circular dependency prevention
   */
  updateRequirement(hash: string, updates: Partial<Requirement>): Requirement {
    try {
      const existing = this.getRequirementByHash(hash)
      if (!existing) {
        throw new DatabaseError('Requirement not found', 'DB_REQUIREMENT_NOT_FOUND', { hash })
      }

      // Enum validations
      const validTypes = ['functional', 'non_functional', 'constraint']
      const validPriorities = ['must', 'should', 'could', 'wont']
      const validLevels = ['project', 'gate']

      if (updates.type && !validTypes.includes(updates.type)) {
        throw new DatabaseError('Invalid requirement type', 'DB_REQUIREMENT_INVALID_TYPE', {
          type: updates.type,
        })
      }
      if (updates.priority && !validPriorities.includes(updates.priority)) {
        throw new DatabaseError('Invalid requirement priority', 'DB_REQUIREMENT_INVALID_PRIORITY', {
          priority: updates.priority,
        })
      }
      if (updates.level && !validLevels.includes(updates.level)) {
        throw new DatabaseError('Invalid requirement level', 'DB_REQUIREMENT_INVALID_LEVEL', {
          level: updates.level,
        })
      }

      // Prevent circular dependencies if changing parent
      if (updates.parentId) {
        if (updates.parentId === existing.id) {
          throw new DatabaseError('Cannot set parent to self', 'DB_REQUIREMENT_CIRCULAR_PARENT', {
            hash,
          })
        }

        // Get ancestors of the candidate parent; if existing.id is present, it would create a cycle
        const parentAncestors: { id: string; parentId: string | null; hash: string }[] = []
        let cursorId = updates.parentId
        while (cursorId) {
          const row = this.db
            .prepare('SELECT id, parent_id, hash FROM requirements WHERE id = ?')
            .get(cursorId) as { id: string; parent_id: string | null; hash: string } | undefined
          if (!row) break
          parentAncestors.push({ id: row.id, parentId: row.parent_id, hash: row.hash })
          cursorId = row.parent_id
        }

        if (parentAncestors.some((a) => a.id === existing.id)) {
          throw new DatabaseError(
            'Circular dependency detected',
            'DB_REQUIREMENT_CIRCULAR_DETECTED',
            { hash }
          )
        }
      }

      const fields: string[] = []
      const params: unknown[] = []

      if (updates.description) {
        fields.push('description = ?')
        params.push(updates.description)
      }
      if (updates.type) {
        fields.push('type = ?')
        params.push(updates.type)
      }
      if (updates.priority) {
        fields.push('priority = ?')
        params.push(updates.priority)
      }
      if (updates.level) {
        fields.push('level = ?')
        params.push(updates.level)
      }
      if (typeof updates.gateId !== 'undefined') {
        fields.push('gate_id = ?')
        params.push(updates.gateId ?? null)
      }
      if (typeof updates.parentId !== 'undefined') {
        fields.push('parent_id = ?')
        params.push(updates.parentId ?? null)
      }
      if (typeof updates.acceptanceCriteria !== 'undefined') {
        fields.push('acceptance_criteria = ?')
        params.push(updates.acceptanceCriteria ?? null)
      }

      if (fields.length === 0) return existing

      // Always update updated_at
      fields.push('updated_at = ?')
      params.push(new Date().toISOString())

      const sql = `UPDATE requirements SET ${fields.join(', ')} WHERE id = ?`
      params.push(existing.id)

      const updateTx = this.db.transaction(() => {
        const stmt = this.db.prepare(sql)
        stmt.run(...params)
      })

      updateTx()

      const updated = this.getRequirementByHash(hash)
      if (!updated)
        throw new DatabaseError(
          'Failed to retrieve updated requirement',
          'DB_REQUIREMENT_RETRIEVE_FAILED',
          { hash }
        )
      return updated
    } catch (err: unknown) {
      if (err instanceof DatabaseError) throw err
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to update requirement',
        'DB_REQUIREMENT_UPDATE_FAILED',
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
   * Update requirement status (e.g., pending -> implemented -> tested)
   * Returns number of rows changed.
   */
  updateRequirementStatus(hash: string, status: 'pending' | 'implemented' | 'tested'): number {
    if (!['pending', 'implemented', 'tested'].includes(status)) {
      throw new Error('Invalid status')
    }

    try {
      const stmt = this.db.prepare('UPDATE requirements SET status = ? WHERE hash = ?')
      const result = stmt.run(status, hash)
      // better-sqlite3 returns changes on statement
      return (result as { changes?: number }).changes ?? 0
    } catch (err: unknown) {
      const e: Error = err instanceof Error ? err : new Error(String(err))
      throw new DatabaseError(
        'Failed to update requirement status',
        'DB_REQUIREMENT_STATUS_UPDATE_FAILED',
        { hash, status },
        e
      )
    }
  }

  /**
   * Transfer a requirement (and its descendants) to a new gate.
   * Sets `gate_id = targetGateId`, `source = 'transferred'`, and records previous gate in `source_gate_id`.
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
      const now = new Date().toISOString()

      const getChildrenStmt = this.db.prepare('SELECT id FROM requirements WHERE parent_id = ?')
      const updateStmt = this.db.prepare(
        'UPDATE requirements SET gate_id = ?, source = ?, source_gate_id = ?, updated_at = ? WHERE id = ?'
      )

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
          updateStmt.run(targetGateId, 'transferred', previousGate, now, id)
        }
      })

      transferTx()

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
        transferredAt: now,
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
}
