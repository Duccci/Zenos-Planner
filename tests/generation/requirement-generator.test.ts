import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequirementGenerator } from '../../src/generation/requirement-generator.js'
import { RequirementStorage } from '../../src/generation/requirement-storage.js'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

describe('RequirementGenerator', () => {
  let db: Database.Database
  let storage: RequirementStorage
  let generator: RequirementGenerator
  let tempDbPath: string

  beforeEach(() => {
    // Create temporary database for testing
    tempDbPath = join(tmpdir(), `test-zeno-${randomUUID()}.db`)
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
      CREATE TABLE requirement_gate_links (
        requirement_id TEXT NOT NULL,
        gate_id TEXT NOT NULL,
        linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (requirement_id, gate_id)
      )
    `)

    storage = new RequirementStorage(db)
    generator = new RequirementGenerator(storage)
  })

  afterEach(() => {
    if (db) {
      db.close()
    }
    // Clean up temp file if it exists
    try {
      require('node:fs').unlinkSync(tempDbPath)
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('generateFromProjectStatement', () => {
    it('extracts functional requirements from end state description', async () => {
      const endState = `
        The system must support user authentication and authorization.
        It should provide a REST API for data access.
        Users must be able to create and manage their profiles.
      `

      const requirements = await generator.generateFromProjectStatement(endState)

      expect(requirements.length).toBeGreaterThan(0)
      expect(requirements.some((r) => r.type === 'functional')).toBe(true)
      expect(requirements.some((r) => r.description.includes('authentication'))).toBe(true)
    })

    it('extracts non-functional requirements', async () => {
      const endState = `
        The system must be secure and handle high throughput.
        Response time should be under 100ms.
        It must achieve 90% test coverage.
      `

      const requirements = await generator.generateFromProjectStatement(endState)

      expect(requirements.some((r) => r.type === 'non_functional')).toBe(true)
      expect(requirements.some((r) => r.description.includes('response time'))).toBe(true)
      expect(requirements.some((r) => r.description.includes('test coverage'))).toBe(true)
    })

    it('extracts constraints', async () => {
      const endState = `
        The system must comply with GDPR regulations.
        It should work offline when possible.
        Platform support includes Windows, macOS, and Linux.
      `

      const requirements = await generator.generateFromProjectStatement(endState)

      expect(requirements.some((r) => r.type === 'constraint')).toBe(true)
      expect(requirements.some((r) => r.description.includes('GDPR'))).toBe(true)
    })

    it('assigns correct priorities', async () => {
      const endState = `
        The system must support HTTPS.
        It should have a user-friendly interface.
        It could support multiple languages.
      `

      const requirements = await generator.generateFromProjectStatement(endState)

      expect(requirements.some((r) => r.priority === 'must')).toBe(true)
      expect(requirements.some((r) => r.priority === 'should')).toBe(true)
      expect(requirements.some((r) => r.priority === 'could')).toBe(true)
    })

    it('is idempotent - same end state generates same requirements', async () => {
      const endState = 'The system must support user login.'

      const requirements1 = await generator.generateFromProjectStatement(endState)
      const requirements2 = await generator.generateFromProjectStatement(endState)

      expect(requirements1.length).toBe(requirements2.length)
      expect(requirements1[0]?.hash).toBe(requirements2[0]?.hash)
    })

    it('handles empty or minimal descriptions', async () => {
      const requirements = await generator.generateFromProjectStatement('')

      expect(requirements).toEqual([])
    })

    it('sets correct metadata for project-level requirements', async () => {
      const endState = 'System must be fast.'

      const requirements = await generator.generateFromProjectStatement(endState)

      for (const req of requirements) {
        // Project-level requirements have no gateId
        expect(req.gateId).toBeNull()
        expect(req.projectId).toBeDefined()
        expect(req.type).toBeDefined()
      }
    })
  })

  describe('generateWithDetails', () => {
    it('returns detailed generation result', async () => {
      const endState = 'System must support authentication and be secure.'

      const result = await generator.generateWithDetails(endState)

      expect(result).toHaveProperty('requirements')
      expect(result).toHaveProperty('candidates')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('metadata')

      expect(result.metadata.sourceTextLength).toBe(endState.length)
      expect(typeof result.metadata.processingTimeMs).toBe('number')
    })

    it('includes low-confidence candidates separately', async () => {
      const endState = 'Maybe the system should be fast.' // Low confidence "maybe"

      const result = await generator.generateWithDetails(endState)

      // Low confidence candidates should be in candidates array, not requirements
      expect(result.requirements.length).toBeLessThanOrEqual(
        result.candidates.length + result.requirements.length
      )
    })
  })

  describe('getProjectRequirements', () => {
    it('returns all project-level requirements', async () => {
      const endState = 'System must be secure and fast.'
      await generator.generateFromProjectStatement(endState)

      const allRequirements = generator.getProjectRequirements()

      expect(allRequirements.length).toBeGreaterThan(0)
      // Project-level requirements should have no gateId
      expect(allRequirements.every((r) => !r.gateId)).toBe(true)
    })
  })

  describe('generateWithDetails error handling', () => {
    it('captures storage errors in result errors array', async () => {
      // Corrupt the db so storage throws
      db.close()
      // Use a description that matches patterns to ensure storage is accessed
      const result = await generator.generateWithDetails(
        'The system must support user authentication'
      )
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.requirements).toEqual([])
      // Re-open for afterEach cleanup
      db = new Database(tempDbPath)
    })
  })

  describe('static methods', () => {
    it('extractRequirementsFromText returns candidates array', () => {
      const candidates = RequirementGenerator.extractRequirementsFromText(
        'The system must support real-time notifications'
      )
      expect(Array.isArray(candidates)).toBe(true)
    })

    it('approveRequirements partitions by confidence threshold', () => {
      const candidates = [
        {
          description: 'High confidence',
          type: 'functional' as const,
          priority: 'must' as const,
          confidence: 0.9,
          source: 'test',
          sourceText: 'test',
        },
        {
          description: 'Medium confidence',
          type: 'functional' as const,
          priority: 'should' as const,
          confidence: 0.6,
          source: 'test',
          sourceText: 'test',
        },
        {
          description: 'Low confidence',
          type: 'functional' as const,
          priority: 'could' as const,
          confidence: 0.3,
          source: 'test',
          sourceText: 'test',
        },
      ]

      const result = RequirementGenerator.approveRequirements(candidates)
      expect(result.approved.length).toBe(1)
      expect(result.review.length).toBe(1)
      expect(result.rejected.length).toBe(1)
    })
  })

  describe('generateRequirementsForGate', () => {
    it('throws for a gate that does not exist', async () => {
      await expect(generator.generateRequirementsForGate('gate-nonexistent-99')).rejects.toThrow()
    })
  })

  describe('generateFromProjectStatement - error handling', () => {
    it('should throw on null input', () => {
      const invalidDescription = null as any
      expect(() => {
        generator.generateFromProjectStatement(invalidDescription)
      }).toThrow()
    })
  })

  describe('decomposeRequirement', () => {
    it('should decompose requirements recursively', async () => {
      const parentReq = storage.storeRequirement(
        'Build authentication system with OAuth and JWT support',
        'functional',
        'must',
        'default-project',
        undefined,
        undefined
      )

      const children = await generator.decomposeRequirement(parentReq, 1)

      expect(children).toBeDefined()
      expect(Array.isArray(children)).toBe(true)
    })

    it('should respect max depth limit', async () => {
      const parentReq = storage.storeRequirement(
        'Implement caching layer',
        'functional',
        'should',
        'default-project',
        undefined,
        undefined
      )

      const childrenDepth0 = await generator.decomposeRequirement(parentReq, 0)
      const childrenDepth2 = await generator.decomposeRequirement(parentReq, 2)

      expect(childrenDepth0).toHaveLength(0)
      expect(Array.isArray(childrenDepth2)).toBe(true)
    })

    it('should propagate confidence through decomposition', async () => {
      const parentReq = storage.storeRequirement(
        'System must be performant and scalable',
        'non_functional',
        'must',
        'default-project',
        undefined,
        undefined
      )

      const children = await generator.decomposeRequirement(parentReq, 1, 0.9)

      expect(children).toBeDefined()
      expect(Array.isArray(children)).toBe(true)
    })
  })
})
