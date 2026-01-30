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

    // Initialize schema
    db.exec(`
      CREATE TABLE requirements (
        id TEXT PRIMARY KEY,
        gate_id TEXT,
        parent_id TEXT,
        project_requirement_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('functional', 'non_functional', 'constraint')),
        priority TEXT NOT NULL CHECK (priority IN ('must', 'should', 'could', 'wont')),
        level TEXT NOT NULL CHECK (level IN ('project', 'gate')),
        source TEXT NOT NULL CHECK (source IN ('generated', 'inherited', 'transferred')),
        description TEXT NOT NULL,
        acceptance_criteria TEXT,
        hash TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'implemented', 'tested')),
        source_gate_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      expect(requirement.level).toBe('project')
      expect(requirement.source).toBe('generated')
      expect(requirement.status).toBe('pending')
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
        'project',
        'generated',
        undefined,
        acceptanceCriteria
      )

      expect(requirement.acceptanceCriteria).toBe(acceptanceCriteria)
    })

    it('stores gate-specific requirements', () => {
      const gateId = 'gate-123'

      const requirement = storage.storeRequirement(
        'Component must be testable',
        'non_functional',
        'should',
        'gate',
        'generated',
        gateId
      )

      expect(requirement.gateId).toBe(gateId)
      expect(requirement.level).toBe('gate')
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
      storage.storeRequirement('Project req 1', 'functional', 'must', 'project')
      storage.storeRequirement('Project req 2', 'non_functional', 'should', 'project')
      storage.storeRequirement('Gate req', 'functional', 'must', 'gate', 'generated', 'gate-1')

      const projectReqs = storage.getProjectRequirements()

      expect(projectReqs.length).toBe(2)
      expect(projectReqs.every(r => r.level === 'project')).toBe(true)
    })

    it('returns empty array when no requirements exist', () => {
      const requirements = storage.getProjectRequirements()

      expect(requirements).toEqual([])
    })
  })

  describe('updateRequirementStatus', () => {
    it('updates requirement status', () => {
      const stored = storage.storeRequirement('Test req', 'functional', 'must')

      storage.updateRequirementStatus(stored.hash, 'implemented')

      const updated = storage.getRequirementByHash(stored.hash)
      expect(updated!.status).toBe('implemented')
    })

    it('throws error for non-existent hash', () => {
      expect(() => {
        storage.updateRequirementStatus('nonexistent', 'implemented')
      }).toThrow()
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
})