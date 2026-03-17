import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RequirementStorage } from '../../src/generation/requirement-storage.js'
import { RequirementGenerator } from '../../src/generation/requirement-generator.js'
import { buildDependencyGraph, validateDependencyGraph } from '../../src/generation/dependency-graph.js'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

describe('Requirement Lifecycle Integration', () => {
  let db: Database.Database
  let storage: RequirementStorage
  let generator: RequirementGenerator
  let tempDbPath: string

  beforeEach(() => {
    // Create temporary database for testing
    tempDbPath = join(tmpdir(), `test-lifecycle-${randomUUID()}.db`)
    db = new Database(tempDbPath)
    
    // Disable foreign key constraints for this test
    db.pragma('foreign_keys = OFF')

    // Initialize schema
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

    // Create gates table for transfer operations
    db.exec(`
      CREATE TABLE IF NOT EXISTS gates (
        id TEXT PRIMARY KEY,
        name TEXT,
        sequence INTEGER,
        status TEXT
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

  describe('Complete Lifecycle: Create → Store → Query → Build Graph → Validate', () => {
    it('testCompleteRequirementLifecycleForFunctionalRequirement', async () => {
      // Step 1: Generate from end state
      const endState = 'System must support user authentication'
      const generated = await generator.generateFromProjectStatement(endState)

      expect(generated.length).toBeGreaterThan(0)

      // Step 2: Access storage via requirements
      const stored = generated[0]!
      // Project-level requirements have no gateId
      expect(stored.gateId).toBeNull()

      // Step 3: Retrieve from storage
      const retrieved = storage.getRequirementByHash(stored.hash)
      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(stored.id)

      // Step 4: Build dependency graph
      const graph = storage.buildRequirementGraph()
      expect(graph.nodes.has(stored.hash)).toBe(true)

      // Step 6: Validate graph
      const errors = validateDependencyGraph(graph)
      expect(errors.length).toBe(0)
    })
  })

  describe('Parent-Child Relationship Lifecycle', () => {
    it('testCreateParentThenChild', async () => {
      // Create parent requirement
      const parent = storage.storeRequirement(
        'System must support authentication',
        'functional',
        'must'
      )

      // Create child requirement
      const child = storage.storeRequirement(
        'Support JWT tokens',
        'functional',
        'must',
        'default-project',
        undefined,
        undefined,
        parent.hash
      )

      // Verify relationship
      expect(child.parentId).toBe(parent.hash)

      const children = storage.getRequirementChildren(parent.hash)
      expect(children.length).toBe(1)
      expect(children[0]?.hash).toBe(child.hash)

      const ancestors = storage.getRequirementAncestors(child.hash)
      expect(ancestors.length).toBe(1)
      expect(ancestors[0]?.hash).toBe(parent.hash)
    })

    it('testHierarchicalRequirementTree', async () => {
      // Create a three-level hierarchy
      const root = storage.storeRequirement('Authentication system', 'functional', 'must')
      const auth = storage.storeRequirement(
        'User authentication',
        'functional',
        'must',
        'default-project',
        undefined,
        undefined,
        root.hash
      )
      const jwt = storage.storeRequirement(
        'JWT token support',
        'functional',
        'must',
        'default-project',
        undefined,
        undefined,
        auth.hash
      )

      // Verify tree structure
      expect(storage.getRequirementChildren(root.hash).length).toBe(1)
      expect(storage.getRequirementChildren(auth.hash).length).toBe(1)
      expect(storage.getRequirementChildren(jwt.hash).length).toBe(0)

      expect(storage.getRequirementAncestors(jwt.hash).length).toBe(2)
      expect(storage.getRequirementAncestors(auth.hash).length).toBe(1)
      expect(storage.getRequirementAncestors(root.hash).length).toBe(0)
    })

    it('testUpdateChildRequirementPreservesHierarchy', () => {
      const parent = storage.storeRequirement('Parent', 'functional', 'must')
      const child = storage.storeRequirement(
        'Child',
        'functional',
        'must',
        'default-project',
        undefined,
        undefined,
        parent.hash
      )

      // Verify parent-child relationship is preserved
      const retrieved = storage.getRequirementByHash(child.hash)
      expect(retrieved).not.toBeNull()
      expect(retrieved?.parentId).toBe(parent.hash)
      const children = storage.getRequirementChildren(parent.hash)
      expect(children.length).toBe(1)
    })
  })

  describe('Requirement Decomposition Lifecycle', () => {
    it('testDecomposeAndUpdateStatuses', async () => {
      // Create complex requirement
      const complex = storage.storeRequirement(
        'System must support authentication with multiple methods and token refresh',
        'functional',
        'must',
        'default-project',
        'gate-04'
      )

      // Decompose it
      const decomposed = await generator.decomposeRequirement(complex, 2, 0.6)

      // Decomposed requirements should exist
      expect(decomposed.length).toBeGreaterThan(0)

      const children = storage.getRequirementChildren(complex.hash)
      expect(children.length).toBeGreaterThan(0)

      // Verify children are accessible via storage
      for (const child of children) {
        const retrieved = storage.getRequirementByHash(child.hash)
        expect(retrieved).not.toBeNull()
        expect(retrieved?.parentId).toBe(complex.id)
      }
    })
  })

  describe('Multi-Gate Requirement Transfer', () => {
    it('testTransferRequirementBetweenGates', () => {
      // Setup gate data
      db.prepare('INSERT INTO gates (id, name, sequence, status) VALUES (?, ?, ?, ?)').run(
        'gate-01',
        'Gate 01',
        1,
        'pending'
      )
      db.prepare('INSERT INTO gates (id, name, sequence, status) VALUES (?, ?, ?, ?)').run(
        'gate-02',
        'Gate 02',
        2,
        'pending'
      )

      // Create requirement in gate-01
      const req = storage.storeRequirement(
        'API requirement',
        'functional',
        'must',
        'default-project',
        'gate-01'
      )

      expect(req.gateId).toBe('gate-01')

      // Transfer to gate-02
      const result = storage.transferRequirement(req.hash, 'gate-02')

      expect(result.previousGateId).toBe('gate-01')
      expect(result.newGateId).toBe('gate-02')

      const transferred = storage.getRequirementByHash(req.hash)
      expect(transferred?.gateId).toBe('gate-02')
    })

    it('testTransferRequirementWithChildren', () => {
      // Setup gate data
      db.prepare('INSERT INTO gates (id, name, sequence, status) VALUES (?, ?, ?, ?)').run(
        'gate-03',
        'Gate 03',
        3,
        'pending'
      )
      db.prepare('INSERT INTO gates (id, name, sequence, status) VALUES (?, ?, ?, ?)').run(
        'gate-04',
        'Gate 04',
        4,
        'pending'
      )

      // Create parent requirement in gate-03
      const parent = storage.storeRequirement(
        'Parent requirement',
        'functional',
        'must',
        'default-project',
        'gate-03'
      )

      // Create child requirement
      const child = storage.storeRequirement(
        'Child requirement',
        'functional',
        'must',
        'default-project',
        'gate-03',
        undefined,
        parent.hash
      )

      // Transfer parent (should also transfer children)
      storage.transferRequirement(parent.hash, 'gate-04')

      const transferredParent = storage.getRequirementByHash(parent.hash)
      const transferredChild = storage.getRequirementByHash(child.hash)

      expect(transferredParent?.gateId).toBe('gate-04')
      expect(transferredChild?.gateId).toBe('gate-04')
    })
  })

  describe('Full Workflow: Generation → Storage → Hierarchy → Graph → Validation', () => {
    it('testFullWorkflowFromProjectStatementToValidatedGraph', async () => {
      const endState = `
        System must support user authentication.
        It should provide REST endpoints.
        Users must be able to create accounts.
        The system must be secure.
      `

      // 1. Generate requirements from end state
      const generated = await generator.generateFromProjectStatement(endState)
      expect(generated.length).toBeGreaterThan(0)

      // 2. All requirements should be stored and retrievable
      for (const req of generated) {
        const retrieved = storage.getRequirementByHash(req.hash)
        expect(retrieved).not.toBeNull()
        expect(retrieved?.description).toBe(req.description)
      }

      // 3. Get detailed generation result
      const detailed = await generator.generateWithDetails(endState)
      expect(detailed.requirements.length).toBeGreaterThan(0)
      expect(typeof detailed.metadata.processingTimeMs).toBe('number')

      // 4. Build dependency graph
      const allProjectReqs = storage.getProjectRequirements()
      const graph = buildDependencyGraph(allProjectReqs)
      expect(graph.nodes.size).toBeGreaterThan(0)

      // 5. Validate graph
      const errors = validateDependencyGraph(graph)
      expect(errors.length).toBe(0)

      // 6. Verify requirements are retrievable
      if (generated.length > 0) {
        const retrieved = storage.getRequirementByHash(generated[0]!.hash)
        expect(retrieved).not.toBeNull()
      }
    })

    it('testWorkflowWithDecompositionAndTransfer', async () => {
      // Setup gates
      db.prepare('INSERT INTO gates (id, name, sequence, status) VALUES (?, ?, ?, ?)').run(
        'gate-05',
        'Gate 05',
        5,
        'pending'
      )
      db.prepare('INSERT INTO gates (id, name, sequence, status) VALUES (?, ?, ?, ?)').run(
        'gate-06',
        'Gate 06',
        6,
        'pending'
      )

      // 1. Generate complex requirement
      const complex = storage.storeRequirement(
        'System must support user authentication with JWT tokens and refresh mechanism',
        'functional',
        'must',
        'default-project',
        'gate-05'
      )

      // 2. Decompose it
      const decomposed = await generator.decomposeRequirement(complex, 2, 0.7)
      const children = storage.getRequirementChildren(complex.hash)
      expect(children.length).toBeGreaterThan(0)

      // 3. Check hierarchy
      const ancestors = storage.getRequirementAncestors(children[0]!.hash)
      expect(ancestors.some(a => a.hash === complex.hash)).toBe(true)

      // 4. Transfer parent requirement
      const result = storage.transferRequirement(complex.hash, 'gate-06')
      expect(result.previousGateId).toBe('gate-05')
      expect(result.newGateId).toBe('gate-06')

      // 5. Verify children are also transferred
      const movedChildren = storage.getRequirementChildren(complex.hash)
      for (const child of movedChildren) {
        const moved = storage.getRequirementByHash(child.hash)
        expect(moved?.gateId).toBe('gate-06')
      }

      // 6. Build and validate graph
      const graph = storage.buildRequirementGraph('gate-06')
      const errors = validateDependencyGraph(graph)
      expect(errors.length).toBe(0)

    })
  })

  describe('Edge Cases in Lifecycle', () => {
    it('testUpdateNonexistentRequirementThrowsError', () => {
      expect(() => {
        storage.updateRequirement('nonexistent-hash', { description: 'new' })
      }).toThrow()
    })

    it('testDeleteRequirementBreaksParentChildRelationship', () => {
      const parent = storage.storeRequirement('Parent', 'functional', 'must')
      const child = storage.storeRequirement('Child', 'functional', 'must', 'default-project', undefined, undefined, parent.hash)

      // Cannot delete parent without cascade when children exist
      expect(() => {
        storage.deleteRequirement(parent.hash, false)
      }).toThrow()

      // With cascade, should work
      storage.deleteRequirement(parent.hash, true)

      const deletedParent = storage.getRequirementByHash(parent.hash)
      const deletedChild = storage.getRequirementByHash(child.hash)

      expect(deletedParent).toBeNull()
      expect(deletedChild).toBeNull()
    })

    it('testCascadeDeleteRemovesEntireTree', () => {
      const root = storage.storeRequirement('Root', 'functional', 'must')
      const child = storage.storeRequirement('Child', 'functional', 'must', 'default-project', undefined, undefined, root.hash)
      const grandchild = storage.storeRequirement('Grandchild', 'functional', 'must', 'default-project', undefined, undefined, child.hash)

      storage.deleteRequirement(root.hash, true) // Cascade

      expect(storage.getRequirementByHash(root.hash)).toBeNull()
      expect(storage.getRequirementByHash(child.hash)).toBeNull()
      expect(storage.getRequirementByHash(grandchild.hash)).toBeNull()
    })

  })
})
