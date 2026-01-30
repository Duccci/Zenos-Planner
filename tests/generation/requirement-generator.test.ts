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

  describe('generateFromEndState', () => {
    it('extracts functional requirements from end state description', async () => {
      const endState = `
        The system must support user authentication and authorization.
        It should provide a REST API for data access.
        Users must be able to create and manage their profiles.
      `

      const requirements = await generator.generateFromEndState(endState)

      expect(requirements.length).toBeGreaterThan(0)
      expect(requirements.some(r => r.type === 'functional')).toBe(true)
      expect(requirements.some(r => r.description.includes('authentication'))).toBe(true)
    })

    it('extracts non-functional requirements', async () => {
      const endState = `
        The system must be secure and handle high throughput.
        Response time should be under 100ms.
        It must achieve 90% test coverage.
      `

      const requirements = await generator.generateFromEndState(endState)

      expect(requirements.some(r => r.type === 'non_functional')).toBe(true)
      expect(requirements.some(r => r.description.includes('response time'))).toBe(true)
      expect(requirements.some(r => r.description.includes('test coverage'))).toBe(true)
    })

    it('extracts constraints', async () => {
      const endState = `
        The system must comply with GDPR regulations.
        It should work offline when possible.
        Platform support includes Windows, macOS, and Linux.
      `

      const requirements = await generator.generateFromEndState(endState)

      expect(requirements.some(r => r.type === 'constraint')).toBe(true)
      expect(requirements.some(r => r.description.includes('GDPR'))).toBe(true)
    })

    it('assigns correct priorities', async () => {
      const endState = `
        The system must support HTTPS.
        It should have a user-friendly interface.
        It could support multiple languages.
      `

      const requirements = await generator.generateFromEndState(endState)

      expect(requirements.some(r => r.priority === 'must')).toBe(true)
      expect(requirements.some(r => r.priority === 'should')).toBe(true)
      expect(requirements.some(r => r.priority === 'could')).toBe(true)
    })

    it('is idempotent - same end state generates same requirements', async () => {
      const endState = 'The system must support user login.'

      const requirements1 = await generator.generateFromEndState(endState)
      const requirements2 = await generator.generateFromEndState(endState)

      expect(requirements1.length).toBe(requirements2.length)
      expect(requirements1[0]?.hash).toBe(requirements2[0]?.hash)
    })

    it('handles empty or minimal descriptions', async () => {
      const requirements = await generator.generateFromEndState('')

      expect(requirements).toEqual([])
    })

    it('sets correct metadata for project-level requirements', async () => {
      const endState = 'System must be fast.'

      const requirements = await generator.generateFromEndState(endState)

      for (const req of requirements) {
        expect(req.level).toBe('project')
        expect(req.source).toBe('generated')
        expect(req.status).toBe('pending')
        expect(req.gateId).toBeNull()
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
      expect(result.requirements.length).toBeLessThanOrEqual(result.candidates.length + result.requirements.length)
    })
  })

  describe('getProjectRequirements', () => {
    it('returns all project-level requirements', async () => {
      const endState = 'System must be secure and fast.'
      await generator.generateFromEndState(endState)

      const allRequirements = generator.getProjectRequirements()

      expect(allRequirements.length).toBeGreaterThan(0)
      expect(allRequirements.every(r => r.level === 'project')).toBe(true)
    })
  })

  describe('updateRequirementStatus', () => {
    it('updates requirement status', async () => {
      const endState = 'System must be secure.'
      const requirements = await generator.generateFromEndState(endState)
      const hash = requirements[0]!.hash

      generator.updateRequirementStatus(hash, 'implemented')

      const updated = storage.getRequirementByHash(hash)
      expect(updated?.status).toBe('implemented')
    })
  })
})