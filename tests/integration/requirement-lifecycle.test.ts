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
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      const generated = await generator.generateFromEndState(endState)

      expect(generated.length).toBeGreaterThan(0)

      // Step 2: Access storage via requirements
      const stored = generated[0]!
      expect(stored.status).toBe('pending')
      expect(stored.level).toBe('project')

      // Step 3: Retrieve from storage
      const retrieved = storage.getRequirementByHash(stored.hash)
      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(stored.id)

      // Step 4: Update status through lifecycle
      generator.updateRequirementStatus(stored.hash, 'implemented')
      const implemented = storage.getRequirementByHash(stored.hash)
      expect(implemented?.status).toBe('implemented')

      generator.updateRequirementStatus(stored.hash, 'tested')
      const tested = storage.getRequirementByHash(stored.hash)
      expect(tested?.status).toBe('tested')

      // Step 5: Build dependency graph
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
        'must',
        'project',
        'generated'
      )

      // Create child requirement
      const child = storage.storeRequirement(
        'Support JWT tokens',
        'functional',
        'must',
        'project',
        'generated',
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
        'project',
        'generated',
        undefined,
        undefined,
        root.hash
      )
      const jwt = storage.storeRequirement(
        'JWT token support',
        'functional',
        'must',
        'project',
        'generated',
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
        'project',
        'generated',
        undefined,
        undefined,
        parent.hash
      )

      // Update child
      const updated = storage.updateRequirement(child.hash, {
        description: 'Updated child description',
      })

      // Parent-child relationship should be preserved
      expect(updated.parentId).toBe(parent.hash)
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
        'gate',
        'generated',
        'gate-04'
      )

      // Decompose it
      const decomposed = await generator.decomposeRequirement(complex, 2, 0.6)

      // Decomposed requirements should exist
      expect(decomposed.length).toBeGreaterThan(0)

      const children = storage.getRequirementChildren(complex.hash)
      expect(children.length).toBeGreaterThan(0)

      // Update statuses of decomposed requirements
      for (const child of children) {
        generator.updateRequirementStatus(child.hash, 'implemented')
        const updated = storage.getRequirementByHash(child.hash)
        expect(updated?.status).toBe('implemented')
      }

      // Update parent status
      generator.updateRequirementStatus(complex.hash, 'implemented')
      const parentUpdated = storage.getRequirementByHash(complex.hash)
      expect(parentUpdated?.status).toBe('implemented')
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
        'gate',
        'generated',
        'gate-01'
      )

      expect(req.gateId).toBe('gate-01')

      // Transfer to gate-02
      const result = storage.transferRequirement(req.hash, 'gate-02')

      expect(result.previousGateId).toBe('gate-01')
      expect(result.newGateId).toBe('gate-02')

      const transferred = storage.getRequirementByHash(req.hash)
      expect(transferred?.gateId).toBe('gate-02')
      expect(transferred?.source).toBe('transferred')
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
        'gate',
        'generated',
        'gate-03'
      )

      // Create child requirement
      const child = storage.storeRequirement(
        'Child requirement',
        'functional',
        'must',
        'gate',
        'generated',
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
    it('testFull WorkflowFromEndStateToValidatedGraph', async () => {
      const endState = `
        System must support user authentication.
        It should provide REST endpoints.
        Users must be able to create accounts.
        The system must be secure.
      `

      // 1. Generate requirements from end state
      const generated = await generator.generateFromEndState(endState)
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

      // 6. Update some requirements through lifecycle
      if (generated.length > 0) {
        generator.updateRequirementStatus(generated[0]!.hash, 'implemented')
        const updated = storage.getRequirementByHash(generated[0]!.hash)
        expect(updated?.status).toBe('implemented')
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
        'gate',
        'generated',
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

      // 7. Update lifecycle statuses
      for (const child of movedChildren) {
        generator.updateRequirementStatus(child.hash, 'implemented')
      }
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
      const child = storage.storeRequirement('Child', 'functional', 'must', 'project', 'generated', undefined, undefined, parent.hash)

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
      const child = storage.storeRequirement('Child', 'functional', 'must', 'project', 'generated', undefined, undefined, root.hash)
      const grandchild = storage.storeRequirement('Grandchild', 'functional', 'must', 'project', 'generated', undefined, undefined, child.hash)

      storage.deleteRequirement(root.hash, true) // Cascade

      expect(storage.getRequirementByHash(root.hash)).toBeNull()
      expect(storage.getRequirementByHash(child.hash)).toBeNull()
      expect(storage.getRequirementByHash(grandchild.hash)).toBeNull()
    })

    it('testStatusProgressionValidation', () => {
      const req = storage.storeRequirement('Test', 'functional', 'must')

      // Status should start as pending
      expect(storage.getRequirementByHash(req.hash)?.status).toBe('pending')

      // Update to implemented
      generator.updateRequirementStatus(req.hash, 'implemented')
      expect(storage.getRequirementByHash(req.hash)?.status).toBe('implemented')

      // Update to tested
      generator.updateRequirementStatus(req.hash, 'tested')
      expect(storage.getRequirementByHash(req.hash)?.status).toBe('tested')

      // Can revert to implemented (system allows)
      generator.updateRequirementStatus(req.hash, 'implemented')
      expect(storage.getRequirementByHash(req.hash)?.status).toBe('implemented')
    })
  })
})
