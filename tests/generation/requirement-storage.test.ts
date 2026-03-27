import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RequirementStorage } from '../../src/generation/requirement-storage.js'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

describe('RequirementStorage', () => {
  let db: Database.Database
  let storage: RequirementStorage
  let tempDbPath: string

  beforeEach(() => {
    // Create temporary database for testing
    tempDbPath = join(tmpdir(), `test-storage-${randomUUID()}.db`)
    db = new Database(tempDbPath)

    // Disable foreign key constraints for unit tests
    db.pragma('foreign_keys = OFF')

    // Initialize schema (must match src/storage/migrations/001_initial_schema.sql)
    db.exec(`
      CREATE TABLE gates (
        id TEXT PRIMARY KEY,
        name TEXT,
        sequence INTEGER,
        status TEXT
      )
    `)

    db.exec(`
      CREATE TABLE requirements (
        id TEXT PRIMARY KEY,
        project_id TEXT DEFAULT 'default-project',
        gate_id TEXT,
        parent_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('functional', 'non_functional', 'constraint')),
        priority TEXT NOT NULL CHECK (priority IN ('must', 'should', 'could', 'wont')),
        description TEXT NOT NULL,
        acceptance_criteria TEXT,
        hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        level TEXT NOT NULL DEFAULT 'gate',
        source_gate_id TEXT,
        FOREIGN KEY (parent_id) REFERENCES requirements(id),
        FOREIGN KEY (gate_id) REFERENCES gates(id)
      )
    `)

    db.exec(`
      CREATE TABLE gate_dependencies (
        requirement_id TEXT NOT NULL,
        gate_id TEXT NOT NULL,
        linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (requirement_id, gate_id)
      )
    `)

    storage = new RequirementStorage(db)
  })

  afterEach(() => {
    if (db) {
      db.close()
    }
    // Clean up temp file
    try {
      require('node:fs').unlinkSync(tempDbPath)
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('storeRequirement', () => {
    it('stores a requirement with generated hash', () => {
      const description = 'System must be secure'
      const type = 'non_functional' as const
      const priority = 'must' as const

      const requirement = storage.storeRequirement(description, type, priority)

      expect(requirement).toHaveProperty('id')
      expect(requirement).toHaveProperty('hash')
      expect(requirement.description).toBe(description)
      expect(requirement.type).toBe(type)
      expect(requirement.priority).toBe(priority)
      // Project-level requirement (no gateId)
      expect(requirement.gateId).toBeNull()
      expect(requirement.projectId).toEqual(['default-project'])

    })

    it('generates stable hashes for same content', () => {
      const desc1 = 'System must be secure'
      const desc2 = 'System must be secure'

      const req1 = storage.storeRequirement(desc1, 'non_functional', 'must')
      const req2 = storage.storeRequirement(desc2, 'non_functional', 'must')

      expect(req1.hash).toBe(req2.hash)
    })

    it('is idempotent - same content doesn\'t create duplicates', () => {
      const description = 'System must be fast'

      const req1 = storage.storeRequirement(description, 'non_functional', 'must')
      const req2 = storage.storeRequirement(description, 'non_functional', 'must')

      expect(req1.id).toBe(req2.id)
      expect(req1.hash).toBe(req2.hash)
    })

    it('stores different content as separate requirements', () => {
      const req1 = storage.storeRequirement('System must be fast', 'non_functional', 'must')
      const req2 = storage.storeRequirement('System must be secure', 'non_functional', 'must')

      expect(req1.hash).not.toBe(req2.hash)
      expect(req1.id).not.toBe(req2.id)
    })

    it('stores acceptance criteria', () => {
      const acceptanceCriteria = 'Response time measured via automated tests'

      const requirement = storage.storeRequirement(
        'System must have fast response time',
        'non_functional',
        'must',
        'default-project',      // projectId
        undefined,              // gateId
        acceptanceCriteria      // acceptanceCriteria
      )

      expect(requirement.acceptanceCriteria).toBe(acceptanceCriteria)
    })

    it('stores gate-specific requirements', () => {
      const gateId = 'gate-123'

      const requirement = storage.storeRequirement(
        'Component must be testable',  // description
        'non_functional',               // type
        'should',                       // priority
        'project-1',                    // projectId
        gateId,                         // gateId
        undefined,                      // acceptanceCriteria
        undefined                       // parentId
      )

      expect(requirement.gateId).toBe(gateId)
      expect(requirement.projectId).toEqual(['project-1'])
      expect(requirement.type).toBe('non_functional')
    })

  })

  describe('getRequirementByHash', () => {
    it('retrieves stored requirement by hash', () => {
      const description = 'System must support authentication'
      const stored = storage.storeRequirement(description, 'functional', 'must')

      const retrieved = storage.getRequirementByHash(stored.hash)

      expect(retrieved).toBeTruthy()
      expect(retrieved!.description).toBe(description)
      expect(retrieved!.hash).toBe(stored.hash)
    })

    it('returns null for non-existent hash', () => {
      const retrieved = storage.getRequirementByHash('nonexistent')

      expect(retrieved).toBeNull()
    })
  })

  describe('getProjectRequirements', () => {
    it('returns all project-level requirements', () => {
      storage.storeRequirement('Project req 1', 'functional', 'must')
      storage.storeRequirement('Project req 2', 'non_functional', 'should')
      storage.storeRequirement('Gate req', 'functional', 'must', 'default-project', 'gate-1')

      const projectReqs = storage.getProjectRequirements()

      expect(projectReqs.length).toBe(2)
      // Project-level requirements should have no gateId
      expect(projectReqs.every(r => !r.gateId)).toBe(true)
    })

    it('returns empty array when no requirements exist', () => {
      const requirements = storage.getProjectRequirements()

      expect(requirements).toEqual([])
    })
  })



  describe('storeRequirementsFromCandidates', () => {
    it('stores high-confidence candidates', () => {
      const candidates = [
        {
          description: 'High confidence requirement',
          type: 'functional' as const,
          priority: 'must' as const,
          confidence: 0.9,
          sourceText: 'test',
        },
        {
          description: 'Low confidence requirement',
          type: 'functional' as const,
          priority: 'could' as const,
          confidence: 0.4,
          sourceText: 'test',
        },
      ]

      const requirements = storage.storeRequirementsFromCandidates(candidates)

      expect(requirements.length).toBe(1)
      expect(requirements[0]!.description).toBe('High confidence requirement')
    })

    it('filters out low-confidence candidates', () => {
      const candidates = [
        {
          description: 'Low confidence',
          type: 'functional' as const,
          priority: 'could' as const,
          confidence: 0.5,
          sourceText: 'test',
        },
      ]

      const requirements = storage.storeRequirementsFromCandidates(candidates)

      expect(requirements.length).toBe(0)
    })
  })

  describe('linkRequirementToGate / getLinkedGates / getGateLinkedRequirements', () => {
    it('links a requirement to a gate idempotently', () => {
      const req = storage.storeRequirement('Shared security policy', 'non_functional', 'must', 'default-project', 'gate-01')
      storage.linkRequirementToGate(req.id, 'gate-02')
      storage.linkRequirementToGate(req.id, 'gate-02') // idempotent

      const linked = storage.getLinkedGates(req.id)
      expect(linked).toEqual(['gate-02'])
    })

    it('returns multiple linked gates for one requirement', () => {
      const req = storage.storeRequirement('Cross-cutting concern', 'constraint', 'must', 'default-project', 'gate-01')
      storage.linkRequirementToGate(req.id, 'gate-02')
      storage.linkRequirementToGate(req.id, 'gate-03')

      const linked = storage.getLinkedGates(req.id)
      expect(linked).toContain('gate-02')
      expect(linked).toContain('gate-03')
      expect(linked.length).toBe(2)
    })

    it('getGateLinkedRequirements returns requirements linked but not owned by the gate', () => {
      const ownedReq = storage.storeRequirement('Owned req', 'functional', 'must', 'default-project', 'gate-02')
      const linkedReq = storage.storeRequirement('Linked req', 'constraint', 'must', 'default-project', 'gate-01')
      storage.linkRequirementToGate(linkedReq.id, 'gate-02')

      const linked = storage.getGateLinkedRequirements('gate-02')
      const hashes = linked.map((r) => r.hash)
      expect(hashes).toContain(linkedReq.hash)
      expect(hashes).not.toContain(ownedReq.hash)
    })
  })

  describe('getProjectLevelRequirements', () => {
    it('returns requirements with level=project', () => {
      storage.storeRequirement('Project prd req', 'constraint', 'must', 'proj-1', undefined, undefined, undefined, 'project')
      storage.storeRequirement('Gate specific req', 'functional', 'should', 'proj-1', 'gate-01')

      const projectLevel = storage.getProjectLevelRequirements('proj-1')
      expect(projectLevel.length).toBe(1)
      expect(projectLevel[0]!.level).toBe('project')
    })
  })

  describe('getRequirementReferencingGates', () => {
    it('returns owner gate with role=owner', () => {
      const req = storage.storeRequirement('Auth policy', 'constraint', 'must', 'default-project', 'gate-01')
      const refs = storage.getRequirementReferencingGates(req.hash)
      expect(refs.some((r) => r.gateId === 'gate-01' && r.role === 'owner')).toBe(true)
    })

    it('returns linked gates with role=linked', () => {
      const req = storage.storeRequirement('GDPR constraint', 'constraint', 'must', 'default-project', 'gate-01')
      storage.linkRequirementToGate(req.id, 'gate-03')
      const refs = storage.getRequirementReferencingGates(req.hash)
      expect(refs.some((r) => r.gateId === 'gate-03' && r.role === 'linked')).toBe(true)
    })
  })

  describe('storeRequirement level', () => {
    it('stores requirement with project level', () => {
      const req = storage.storeRequirement('PRD constraint', 'constraint', 'must', 'proj-1', undefined, undefined, undefined, 'project')
      expect(req.level).toBe('project')
    })
  })

})