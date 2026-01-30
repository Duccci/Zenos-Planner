/**
 * Requirement Storage Layer
 *
 * Handles persistence of requirements to SQLite database with content-addressed hashing.
 * Ensures idempotent storage - same requirement content always generates same hash.
 */

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
  status: string
  source_gate_id: string | null
  created_at: string
}

/**
 * Requirement storage operations
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
    // Generate deterministic hash from core content
    const hashContent = {
      description: description.trim(),
      type,
      priority,
      level,
      source,
      acceptanceCriteria: acceptanceCriteria?.trim(),
    }
    const hash = shortHash(JSON.stringify(hashContent))

    // Check if requirement already exists
    const existing = this.getRequirementByHash(hash)
    if (existing) {
      return existing
    }

    // Generate unique ID (could be same as hash for simplicity)
    const id = hash

    const now = new Date().toISOString()

    try {
      const stmt = this.db.prepare(`
        INSERT INTO requirements (
          id, gate_id, parent_id, project_requirement_id, type, priority,
          level, source, description, acceptance_criteria, hash, status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
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
        hash,
        'pending', // Default status
        now
      )

      return {
        id,
        gateId: gateId || null,
        parentId: parentId || null,
        projectRequirementId: projectRequirementId || null,
        type,
        priority,
        level,
        source,
        description: description.trim(),
        acceptanceCriteria: acceptanceCriteria?.trim(),
        hash,
        status: 'pending',
        createdAt: new Date(now),
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to store requirement',
        'DB_REQUIREMENT_STORE_FAILED',
        { hash, description: description.substring(0, 100) },
        error instanceof Error ? error : undefined
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
            undefined  // project requirement
          )
          requirements.push(requirement)
        } catch (error) {
          // Log but continue with other requirements
          console.warn(`Failed to store requirement: ${candidate.description}`, error)
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
      const stmt = this.db.prepare(`
        SELECT id, gate_id, parent_id, project_requirement_id, type, priority,
               level, source, description, acceptance_criteria, hash, status,
               source_gate_id, created_at
        FROM requirements
        WHERE hash = ?
      `)

      const row = stmt.get(hash) as RequirementRow | undefined
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
        acceptanceCriteria: row.acceptance_criteria,
        hash: row.hash,
        status: row.status as RequirementStatus,
        sourceGateId: row.source_gate_id,
        createdAt: new Date(row.created_at),
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to get requirement by hash',
        'DB_REQUIREMENT_GET_FAILED',
        { hash },
        error instanceof Error ? error : undefined
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
               r.source_gate_id, r.created_at
        FROM requirements r
        WHERE r.level = 'project'
      `
      const params: any[] = []

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
        acceptanceCriteria: row.acceptance_criteria,
        hash: row.hash,
        status: row.status as RequirementStatus,
        sourceGateId: row.source_gate_id,
        createdAt: new Date(row.created_at),
      }))
    } catch (error) {
      throw new DatabaseError(
        'Failed to get project requirements',
        'DB_PROJECT_REQUIREMENTS_GET_FAILED',
        { projectId },
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Update requirement status
   */
  updateRequirementStatus(hash: string, status: RequirementStatus): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE requirements
        SET status = ?
        WHERE hash = ?
      `)

      const result = stmt.run(status, hash)
      if (result.changes === 0) {
        throw new Error(`Requirement with hash ${hash} not found`)
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to update requirement status',
        'DB_REQUIREMENT_UPDATE_FAILED',
        { hash, status },
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Delete requirement by hash
   */
  deleteRequirement(hash: string): void {
    try {
      const stmt = this.db.prepare('DELETE FROM requirements WHERE hash = ?')
      stmt.run(hash)
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete requirement',
        'DB_REQUIREMENT_DELETE_FAILED',
        { hash },
        error instanceof Error ? error : undefined
      )
    }
  }
}