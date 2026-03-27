import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerRequirementsOps, parseGateRequirementsFromMarkdown } from '../../src/integration/requirements-registry.js'

// Module-level mock functions - mock-prefixed names are accessible in vi.mock factories
const mockGetProjectRequirements = vi.fn().mockReturnValue([
  {
    hash: 'proj-req-1',
    description: 'Project requirement 1',
    type: 'functional',
    priority: 'must',
    gateId: null,
    parentId: null,
    projectId: ['project-1'],
  },
])
const mockBuildRequirementGraph = vi.fn().mockReturnValue({
  nodes: new Map([
    [
      'gate-req-1',
      {
        hash: 'gate-req-1',
        title: 'Gate requirement 1',
        type: 'functional',
        priority: 'should',
        gateId: 'gate-01',
        parent: null,
      },
    ],
  ]),
  edges: [],
})
const mockGetRequirementByHash = vi.fn().mockReturnValue({
  hash: 'test-hash',
  description: 'Test requirement',
  type: 'functional',
  priority: 'must',
  gateId: 'gate-01',
  parentId: null,
  projectId: ['project-1'],
  acceptanceCriteria: ['Criteria 1', 'Criteria 2'],
  createdAt: new Date('2026-01-01'),
})
const mockGetRequirementChildren = vi
  .fn()
  .mockReturnValue([{ hash: 'child-1', description: 'Child requirement 1' }])
const mockGetRequirementAncestors = vi
  .fn()
  .mockReturnValue([{ hash: 'parent-1', description: 'Parent requirement' }])
const mockTransferRequirement = vi.fn().mockReturnValue({
  hash: 'test-hash',
  previousGateId: 'gate-01',
  newGateId: 'gate-02',
  transferredAt: new Date().toISOString(),
  affectedProposals: [],
})
const mockSearchRequirements = vi.fn().mockReturnValue({
  requirements: [
    {
      hash: 'search-result-1',
      description: 'Search result 1',
      type: 'functional',
      priority: 'must',
      gateId: 'gate-01',
      parentId: null,
    },
  ],
  total: 1,
})

const mockStoreRequirement = vi.fn().mockImplementation(
  (description: string, type: string, priority: string, _projectId: string, gateId: string) => ({
    id: `stored-${description.substring(0, 8)}`,
    hash: `stored${description.substring(0, 10).replace(/\s/g, '')}`,
    description,
    type,
    priority,
    gateId,
    parentId: null,
    projectId: ['default-project'],
    level: 'gate',
    createdAt: new Date(),
  })
)

const mockGetGateLinkedRequirements = vi.fn().mockReturnValue([])
const mockGetRequirementReferencingGates = vi.fn().mockReturnValue([])
const mockLinkRequirementToGate = vi.fn()
const mockGetLinkedGates = vi.fn().mockReturnValue([])
const mockGetProjectLevelRequirements = vi.fn().mockReturnValue([])

vi.mock('../../src/generation/requirement-storage.js', () => {
  return {
    RequirementStorage: function MockRequirementStorage() {
      this.getProjectRequirements = mockGetProjectRequirements
      this.buildRequirementGraph = mockBuildRequirementGraph
      this.getRequirementByHash = mockGetRequirementByHash
      this.getRequirementChildren = mockGetRequirementChildren
      this.getRequirementAncestors = mockGetRequirementAncestors
      this.transferRequirement = mockTransferRequirement
      this.searchRequirements = mockSearchRequirements
      this.storeRequirement = mockStoreRequirement
      this.getGateLinkedRequirements = mockGetGateLinkedRequirements
      this.getRequirementReferencingGates = mockGetRequirementReferencingGates
      this.linkRequirementToGate = mockLinkRequirementToGate
      this.getLinkedGates = mockGetLinkedGates
      this.getProjectLevelRequirements = mockGetProjectLevelRequirements
    },
  }
})

// DB maintenance action mocks — used by db_status, db_sync, purge_orphans, reset_gate
const mockGetDatabase = vi.fn()
const mockSyncProposalsFromDisk = vi.fn()
const mockReaddirSyncFs = vi.fn()
const mockStatSyncFs = vi.fn()
const mockReadFileSyncFs = vi.fn()
const mockDbPrepare = vi.fn()
const mockDbAll = vi.fn()
const mockDbGet = vi.fn()
const mockDbRun = vi.fn()

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../src/storage/proposal-sync.js', () => ({
  syncProposalsFromDisk: (...args: unknown[]) => mockSyncProposalsFromDisk(...args),
}))

vi.mock('node:fs', () => ({
  readdirSync: (...args: unknown[]) => mockReaddirSyncFs(...args),
  statSync: (...args: unknown[]) => mockStatSyncFs(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSyncFs(...args),
}))

describe('Requirements Registry wiring', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    registry = new FunctionRegistry()
    registerRequirementsOps(registry)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('reg_action handler', () => {
    it('should be registered', () => {
      const func = registry.get('reg_action')
      expect(func).toBeDefined()
      expect(func?.name).toBe('reg_action')
      expect(func?.description).toContain('requirement')
    })

    it('should have correct schema', () => {
      const func = registry.get('reg_action')
      expect(func?.schema).toBeDefined()
    })

    describe('list action', () => {
      it('should list project requirements when project=true', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: { project: true },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
        const reqs = (result as any).requirements
        expect(Array.isArray(reqs)).toBe(true)
        expect(reqs.length).toBeGreaterThan(0)
        expect(reqs[0].hash).toBe('proj-req-1')
      })

      it('should list gate requirements when gateId is provided', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: { gateId: 'gate-01' },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
        const reqs = (result as any).requirements
        expect(Array.isArray(reqs)).toBe(true)
      })

      it('should list all requirements when no filter provided', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: {},
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
        const reqs = (result as any).requirements
        expect(Array.isArray(reqs)).toBe(true)
      })

      it('should handle missing payload', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'list',
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
      })
    })

    describe('show action', () => {
      it('should show requirement details', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'show',
          payload: { hash: 'test-hash' },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirement')
        const req = (result as any).requirement
        expect(req.hash).toBe('test-hash')
        expect(req.description).toBe('Test requirement')
        expect(req.type).toBe('functional')
      })

      it('should include children and ancestors', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'show',
          payload: { hash: 'test-hash' },
        })

        const data = result as any
        expect(data).toHaveProperty('children')
        expect(data).toHaveProperty('ancestors')
        expect(Array.isArray(data.children)).toBe(true)
        expect(Array.isArray(data.ancestors)).toBe(true)
      })

      it('should return null requirement for non-existent hash', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'show',
          payload: { hash: 'non-existent' },
        })

        // When hash doesn't exist, the mock will return null
        // Implementation should handle this
        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirement')
      })
    })

    describe('deps action', () => {
      it('should show requirement dependencies', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'deps',
          payload: { hash: 'test-hash' },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('graph')
        const graph = (result as any).graph
        expect(graph).toBeDefined()
        expect(graph).toHaveProperty('nodes')
        expect(graph).toHaveProperty('edges')
      })

      it('should return null for non-existent requirement', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'deps',
          payload: { hash: 'non-existent' },
        })

        // When hash doesn't exist, graph will be null
        expect(result).toBeDefined()
        expect(result).toHaveProperty('graph')
      })
    })

    describe('transfer action', () => {
      it('should transfer requirement to new gate', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'transfer',
          payload: { hash: 'test-hash', gateId: 'gate-02' },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('hash', 'test-hash')
        expect(result).toHaveProperty('newGateId', 'gate-02')
      })

      it('should return transfer result with metadata', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'transfer',
          payload: { hash: 'test-hash', gateId: 'gate-02' },
        })

        const data = result as any
        expect(data).toHaveProperty('previousGateId')
        expect(data).toHaveProperty('newGateId')
        expect(data).toHaveProperty('transferredAt')
        expect(data).toHaveProperty('affectedProposals')
      })
    })

    describe('search action', () => {
      it('should search requirements by query', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'search',
          payload: { query: 'test' },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
      })

      it('should support gateId filter', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'search',
          payload: { query: 'test', gateId: 'gate-01' },
        })

        const data = result as any
        expect(data.requirements).toBeDefined()
        expect(Array.isArray(data.requirements)).toBe(true)
      })

      it('should support type filter', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'search',
          payload: { query: 'test', type: 'functional' },
        })

        const data = result as any
        expect(data.requirements).toBeDefined()
      })

    })

    describe('error handling', () => {
      it('should throw on invalid action', () => {
        expect(() => {
          registry.get('reg_action')?.implementation({
            action: 'invalid-action',
            payload: {},
          })
        }).toThrow('Unknown reg_action')
      })

      it('should throw on required payload missing', () => {
        expect(() => {
          registry.get('reg_action')?.implementation({
            action: 'show',
            payload: {}, // Missing hash
          })
        }).toThrow()
      })

      it('should handle missing payload gracefully for list action', () => {
        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: undefined,
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
      })
    })
  })

  describe('Registry validation', () => {
    it('reg_action should have proper description', () => {
      const func = registry.get('reg_action')
      expect(func?.description).toMatch(/list|show|deps|transfer/i)
    })

    it('reg_action should have action parameter defined', () => {
      const func = registry.get('reg_action')
      const actionParam = func?.parameters.find((p) => p.name === 'action')
      expect(actionParam).toBeDefined()
      expect(actionParam?.required).toBe(true)
    })

    it('reg_action should have schema validation', () => {
      const func = registry.get('reg_action')
      expect(func?.schema).toBeDefined()

      // Should validate action is string
      try {
        func?.schema.parse({ action: 'list' })
        expect(true).toBe(true)
      } catch {
        expect(false).toBe(true)
      }
    })
  })

  describe('Integration with FunctionRegistry', () => {
    it('should invoke reg_action through registry.invoke', async () => {
      const result = await registry.invoke('reg_action', {
        action: 'list',
        payload: { project: true },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('requirements')
      }
    })

    it('should handle parameter validation errors', async () => {
      const result = await registry.invoke('reg_action', {
        action: 'show',
        payload: {}, // Missing required hash
      })

      expect(result.success).toBe(false)
    })

    it('should return error for unknown action', async () => {
      const result = await registry.invoke('reg_action', {
        action: 'unknown',
        payload: {},
      })

      expect(result.success).toBe(false)
    })
  })

  describe('null-path branches', () => {
    it('show — returns null requirement when hash not found', () => {
      mockGetRequirementByHash.mockReturnValueOnce(null)

      const result = registry.get('reg_action')?.implementation({
        action: 'show',
        payload: { hash: 'missing-hash' },
      }) as { requirement: null; children: unknown[]; ancestors: unknown[] }

      expect(result.requirement).toBeNull()
      expect(result.children).toEqual([])
      expect(result.ancestors).toEqual([])
    })

    it('deps — returns null graph when requirement not found', () => {
      mockGetRequirementByHash.mockReturnValueOnce(null)

      const result = registry.get('reg_action')?.implementation({
        action: 'deps',
        payload: { hash: 'missing-hash' },
      }) as { graph: null }

      expect(result.graph).toBeNull()
    })

    it('show — requirement without acceptanceCriteria omits acceptance field', () => {
      mockGetRequirementByHash.mockReturnValueOnce({
        hash: 'no-ac',
        description: 'No criteria',
        type: 'constraint',
        priority: 'could',
        gateId: 'gate-01',
        acceptanceCriteria: null,
        createdAt: null,
      })
      mockGetRequirementChildren.mockReturnValueOnce([])
      mockGetRequirementAncestors.mockReturnValueOnce([])

      const result = registry.get('reg_action')?.implementation({
        action: 'show',
        payload: { hash: 'no-ac' },
      }) as { requirement: { acceptance: unknown; parentRequirement: unknown } }

      expect(result.requirement.acceptance).toBeUndefined()
      expect(result.requirement.parentRequirement).toBeUndefined()
    })

    it('inherit — links requirement to gate and returns success', () => {
      mockGetRequirementByHash.mockReturnValueOnce({
        id: 42,
        hash: '#req001',
        description: 'A requirement to inherit',
        gateId: 'gate-01',
      })

      const result = registry.get('reg_action')?.implementation({
        action: 'inherit',
        payload: { hash: '#req001', gateId: 'gate-02' },
      }) as { success: boolean; requirementHash: string; linkedToGateId: string }

      expect(result.success).toBe(true)
      expect(result.requirementHash).toBe('#req001')
      expect(result.linkedToGateId).toBe('gate-02')
      expect(mockLinkRequirementToGate).toHaveBeenCalledWith(42, 'gate-02')
    })

    it('inherit — returns error when requirement not found', () => {
      mockGetRequirementByHash.mockReturnValueOnce(null)

      const result = registry.get('reg_action')?.implementation({
        action: 'inherit',
        payload: { hash: '#missing', gateId: 'gate-02' },
      }) as { success: boolean; error: string }

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/#missing/)
    })

    it('trace — returns full traceability info when requirement found', () => {
      mockGetRequirementByHash.mockReturnValueOnce({
        hash: '#req001',
        description: 'Traceable requirement',
        level: 'gate',
        type: 'functional',
        priority: 'must',
        gateId: 'gate-01',
      })
      mockGetRequirementAncestors.mockReturnValueOnce([
        { hash: '#parent', description: 'Parent req', gateId: 'gate-00', level: 'project' },
      ])
      mockGetRequirementChildren.mockReturnValueOnce([])
      mockGetRequirementReferencingGates.mockReturnValueOnce(['gate-01', 'gate-02'])

      const result = registry.get('reg_action')?.implementation({
        action: 'trace',
        payload: { hash: '#req001' },
      }) as { found: boolean; hash: string; ancestors: unknown[]; referencingGates: string[] }

      expect(result.found).toBe(true)
      expect(result.hash).toBe('#req001')
      expect(result.ancestors).toHaveLength(1)
      expect(result.referencingGates).toContain('gate-01')
    })

    it('trace — returns found: false when requirement not found', () => {
      mockGetRequirementByHash.mockReturnValueOnce(null)

      const result = registry.get('reg_action')?.implementation({
        action: 'trace',
        payload: { hash: '#missing' },
      }) as { found: boolean; hash: string }

      expect(result.found).toBe(false)
      expect(result.hash).toBe('#missing')
    })

    it('list — includes linked requirements when gateId is set', () => {
      // Make getGateLinkedRequirements return a linked req that is NOT in allRequirements
      mockGetGateLinkedRequirements.mockReturnValueOnce([
        { hash: 'linked-req-1', description: 'Linked from another gate' },
      ])
      // getProjectLevelRequirements returns empty for project-level query
      mockGetProjectLevelRequirements.mockReturnValueOnce([])

      const result = registry.get('reg_action')?.implementation({
        action: 'list',
        payload: { gateId: 'gate-02' },
      }) as { requirements: { hash: string; title: string }[]; linkedCount: number }

      // linked req should be included in results
      expect(result.requirements.some((r) => r.hash === 'linked-req-1')).toBe(true)
      expect(result.linkedCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('DB maintenance actions', () => {
    beforeEach(() => {
      // Default: empty disk (readdirSync returns []) → every DB hash is an orphan
      mockReaddirSyncFs.mockReturnValue([])
      mockDbPrepare.mockReturnValue({ all: mockDbAll, get: mockDbGet, run: mockDbRun })
      mockGetDatabase.mockReturnValue({ prepare: mockDbPrepare })
      mockSyncProposalsFromDisk.mockReturnValue(undefined)
    })

    describe('db_status', () => {
      it('reports orphans when DB rows have no matching disk hash', () => {
        mockDbAll.mockReturnValue([
          { hash: 'orphan-1', status: 'pending', gate_id: 'gate-01' },
          { hash: 'orphan-2', status: 'in_progress', gate_id: null },
        ])

        const result = registry.get('reg_action')?.implementation({
          action: 'db_status',
        }) as { total: number; orphaned: number; byStatus: Record<string, number>; message: string }

        expect(result.total).toBe(2)
        expect(result.orphaned).toBe(2)
        expect(result.byStatus).toEqual({ pending: 1, in_progress: 1 })
        expect(result.message).toContain('orphaned DB row(s) found')
      })

      it('reports consistent when all DB hashes exist on disk', () => {
        // Configure disk to have the same hash as the DB row
        mockReaddirSyncFs.mockReturnValue(['proposal.md'])
        mockStatSyncFs.mockReturnValue({ isDirectory: () => false })
        mockReadFileSyncFs.mockReturnValue('**Hash**: known-hash\n\nSome content')
        mockDbAll.mockReturnValue([{ hash: 'known-hash', status: 'completed', gate_id: 'gate-01' }])

        const result = registry.get('reg_action')?.implementation({
          action: 'db_status',
        }) as { orphaned: number; message: string }

        expect(result.orphaned).toBe(0)
        expect(result.message).toContain('consistent with disk')
      })

      it('returns zero counts for empty proposals table', () => {
        mockDbAll.mockReturnValue([])

        const result = registry.get('reg_action')?.implementation({
          action: 'db_status',
        }) as { total: number; orphaned: number; onDisk: number }

        expect(result.total).toBe(0)
        expect(result.orphaned).toBe(0)
        expect(result.onDisk).toBe(0)
      })

      it('accumulates count for duplicate status values in byStatus', () => {
        // Two rows with the same status — second iteration hits the truthy branch of byStatus[row.status] ?? 0
        mockDbAll.mockReturnValue([
          { hash: 'p1', status: 'pending', gate_id: null },
          { hash: 'p2', status: 'pending', gate_id: null },
        ])

        const result = registry.get('reg_action')?.implementation({
          action: 'db_status',
        }) as { byStatus: Record<string, number> }

        expect(result.byStatus['pending']).toBe(2)
      })

      it('skips archive subdirectory when scanning disk hashes', () => {
        // Disk has only an 'archive' subdirectory — collectDiskHashes must skip it
        mockReaddirSyncFs.mockReturnValue(['archive'])
        mockStatSyncFs.mockReturnValue({ isDirectory: () => true })
        mockDbAll.mockReturnValue([])

        const result = registry.get('reg_action')?.implementation({
          action: 'db_status',
        }) as { onDisk: number; orphaned: number }

        expect(result.onDisk).toBe(0)
        expect(result.orphaned).toBe(0)
      })
    })

    describe('db_sync', () => {
      it('syncs proposals from disk and purges orphans', () => {
        // Sequence of get() calls: before count, afterSync count, after purge count
        mockDbGet
          .mockReturnValueOnce({ count: 2 })
          .mockReturnValueOnce({ count: 3 })
          .mockReturnValueOnce({ count: 2 })
        // SELECT hash FROM proposals → one orphan not on disk
        mockDbAll.mockReturnValue([{ hash: 'orphan-hash' }])

        const result = registry.get('reg_action')?.implementation({
          action: 'db_sync',
        }) as { before: number; after: number; added: number; orphansRemoved: number; message: string }

        expect(result.before).toBe(2)
        expect(mockSyncProposalsFromDisk).toHaveBeenCalledOnce()
        expect(result.orphansRemoved).toBe(1)
        expect(result.message).toContain('Sync complete')
      })

      it('reports zero orphans when all hashes are on disk', () => {
        mockDbGet
          .mockReturnValueOnce({ count: 1 })
          .mockReturnValueOnce({ count: 1 })
          .mockReturnValueOnce({ count: 1 })
        // Configure disk to contain the hash
        mockReaddirSyncFs.mockReturnValue(['p.md'])
        mockStatSyncFs.mockReturnValue({ isDirectory: () => false })
        mockReadFileSyncFs.mockReturnValue('**Hash**: known-hash')
        mockDbAll.mockReturnValue([{ hash: 'known-hash' }])

        const result = registry.get('reg_action')?.implementation({
          action: 'db_sync',
        }) as { orphansRemoved: number }

        expect(result.orphansRemoved).toBe(0)
      })
    })

    describe('purge_orphans', () => {
      it('dry run reports orphans without deleting', () => {
        mockDbAll.mockReturnValue([
          { hash: 'o1', gate_id: 'gate-01', title: 'A', status: 'pending' },
        ])

        const result = registry.get('reg_action')?.implementation({
          action: 'purge_orphans',
          payload: { dryRun: true },
        }) as { dryRun: boolean; removed: number; orphans: unknown[]; message: string }

        expect(result.dryRun).toBe(true)
        expect(result.removed).toBe(0)
        expect(result.orphans).toHaveLength(1)
        expect(result.message).toContain('Dry run')
        // DELETE should not have been called
        expect(mockDbRun).not.toHaveBeenCalled()
      })

      it('removes orphans when dryRun is false (default)', () => {
        mockDbAll.mockReturnValue([
          { hash: 'o1', gate_id: null, title: 'B', status: 'pending' },
          { hash: 'o2', gate_id: 'gate-01', title: 'C', status: 'in_progress' },
        ])

        const result = registry.get('reg_action')?.implementation({
          action: 'purge_orphans',
          payload: {},
        }) as { removed: number; dryRun: boolean; message: string }

        expect(result.dryRun).toBe(false)
        expect(result.removed).toBe(2)
        expect(mockDbRun).toHaveBeenCalledTimes(2)
        expect(result.message).toContain('Removed 2')
      })

      it('filters by gateId when provided', () => {
        mockDbAll.mockReturnValue([
          { hash: 'g1', gate_id: 'gate-02', title: 'D', status: 'pending' },
        ])

        const result = registry.get('reg_action')?.implementation({
          action: 'purge_orphans',
          payload: { gateId: 'gate-02' },
        }) as { gateId: string | null; message: string }

        expect(result.gateId).toBe('gate-02')
        expect(result.message).toContain('gate-02')
        // prepare should be called with WHERE gate_id = ? SQL
        const prepareCall = mockDbPrepare.mock.calls.find((c) =>
          (c[0] as string).includes('WHERE gate_id = ?')
        )
        expect(prepareCall).toBeDefined()
      })

      it('filters solitary (gate_id IS NULL) when solitary=true', () => {
        mockDbAll.mockReturnValue([])

        const result = registry.get('reg_action')?.implementation({
          action: 'purge_orphans',
          payload: { solitary: true },
        }) as { solitary: boolean; message: string }

        expect(result.solitary).toBe(true)
        expect(result.message).toContain('solitary proposals')
        const prepareCall = mockDbPrepare.mock.calls.find((c) =>
          (c[0] as string).includes('WHERE gate_id IS NULL')
        )
        expect(prepareCall).toBeDefined()
      })

      it('throws when both gateId and solitary are provided', async () => {
        const result = await registry.invoke('reg_action', {
          action: 'purge_orphans',
          payload: { gateId: 'gate-01', solitary: true },
        })

        expect(result.success).toBe(false)
      })
    })

    describe('reset_gate', () => {
      it('deletes gate proposals and resyncs from disk', () => {
        mockDbRun.mockReturnValue({ changes: 3 })
        mockDbGet.mockReturnValue({ count: 2 })

        const result = registry.get('reg_action')?.implementation({
          action: 'reset_gate',
          payload: { gateId: 'gate-03' },
        }) as { gateId: string; deletedCount: number; resyncedCount: number; message: string }

        expect(result.gateId).toBe('gate-03')
        expect(result.deletedCount).toBe(3)
        expect(result.resyncedCount).toBe(2)
        expect(mockSyncProposalsFromDisk).toHaveBeenCalledOnce()
        expect(result.message).toContain('gate-03')
      })
    })

    describe('list action fallback (gate markdown parsing)', () => {
      it('parses gate markdown and seeds DB when no requirements exist for a gate', () => {
        // First call returns empty graph, second call (after seeding) returns populated graph
        mockBuildRequirementGraph
          .mockReturnValueOnce({ nodes: new Map(), edges: [] })
          .mockReturnValueOnce({
            nodes: new Map([
              ['seeded-req-1', {
                hash: 'seeded-req-1',
                title: 'SQLite database stores requirements',
                type: 'constraint',
                priority: 'must',
                gateId: 'gate-06',
                parent: null,
              }],
            ]),
            edges: [],
          })

        // getRequirementByHash returns null (requirements not in DB yet)
        mockGetRequirementByHash.mockReturnValue(null)

        // Gate file discovery: readdirSync returns gate files
        mockReaddirSyncFs.mockImplementation((dir: string) => {
          if (dir.includes('gates')) return ['gate-06-multi-repo.md']
          return []
        })

        // readFileSync returns gate markdown with requirement tables
        mockReadFileSyncFs.mockImplementation((filePath: string) => {
          if (filePath.includes('gate-06')) {
            return `# Gate 06

## Requirements

### Project Requirements (Attributed to This Gate)

|Hash|Name|Type|Priority|How This Gate Addresses It|
|-|-|-|-|-|
|#4bc74e36854c4221|SQLite database stores requirements|constraint|must|Adds repositories tables|
|#9b4ecdb42908c10f|Use content-addressable SHA-256 hashes|constraint|must|Repository hash registry|

### Gate-Specific Requirements

**Status**: Requirements will be generated when gate is started.

## Architecture
`
          }
          return ''
        })

        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: { gateId: 'gate-06' },
        }) as { requirements: Array<{ hash: string; title: string }> }

        expect(result.requirements).toHaveLength(1)
        expect(result.requirements[0].hash).toBe('seeded-req-1')
        expect(mockStoreRequirement).toHaveBeenCalledTimes(2)
        expect(mockStoreRequirement).toHaveBeenCalledWith(
          'SQLite database stores requirements',
          'constraint',
          'must',
          'default-project',
          'gate-06',
          undefined,
          undefined,
          'project'
        )
      })

      it('returns error message when no requirements found after parsing', () => {
        // Both calls return empty
        mockBuildRequirementGraph.mockReturnValue({ nodes: new Map(), edges: [] })

        // Gate file not found
        mockReaddirSyncFs.mockReturnValue([])

        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: { gateId: 'gate-99' },
        }) as { requirements: unknown[]; error: string }

        expect(result.requirements).toHaveLength(0)
        expect(result.error).toBeDefined()
        expect(result.error).toContain('No requirements registered')
        expect(result.error).toContain('gate-99')
      })

      it('returns error when gate file has no parseable requirement tables', () => {
        mockBuildRequirementGraph.mockReturnValue({ nodes: new Map(), edges: [] })

        mockReaddirSyncFs.mockImplementation((dir: string) => {
          if (dir.includes('gates')) return ['gate-07-proposal.md']
          return []
        })

        mockReadFileSyncFs.mockImplementation((filePath: string) => {
          if (filePath.includes('gate-07')) {
            return `# Gate 07

## Requirements

### Project Requirements (Attributed to This Gate)

| Hash    | Name        | Type       | Priority |
| ------- | ----------- | ---------- | -------- |
| #[hash] | Placeholder | functional | must     |

## Architecture
`
          }
          return ''
        })

        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: { gateId: 'gate-07' },
        }) as { requirements: unknown[]; error: string }

        expect(result.requirements).toHaveLength(0)
        expect(result.error).toContain('No requirements registered')
        expect(mockStoreRequirement).not.toHaveBeenCalled()
      })

      it('does not attempt fallback when gateId is not provided', () => {
        mockBuildRequirementGraph.mockReturnValue({ nodes: new Map(), edges: [] })

        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: {},
        }) as { requirements: unknown[]; error?: string }

        expect(result.requirements).toHaveLength(0)
        expect(result.error).toBeUndefined()
      })

      it('resolves inherited requirements from source gates and merges into results', () => {
        // First call returns empty graph, second call (after seeding) returns project reqs
        mockBuildRequirementGraph
          .mockReturnValueOnce({ nodes: new Map(), edges: [] })
          .mockReturnValueOnce({
            nodes: new Map([
              ['4bc74e36854c4221', {
                hash: '4bc74e36854c4221',
                id: '4bc74e36854c4221',
                title: 'SQLite database stores requirements',
                type: 'constraint',
                priority: 'must',
                gateId: 'gate-06',
                children: [],
                depth: 0,
              }],
            ]),
            edges: [],
          })

        // Inherited req exists in DB under gate-01
        mockGetRequirementByHash.mockImplementation((hash: string) => {
          if (hash === 'ac3ffa69e28bfed4') {
            return {
              hash: 'ac3ffa69e28bfed4',
              description: 'Create SQLite database with schema',
              type: 'functional',
              priority: 'must',
              gateId: 'gate-01',
              parentId: null,
              projectId: ['default-project'],
            }
          }
          return null
        })

        // Gate file with both project and inherited requirements
        mockReaddirSyncFs.mockImplementation((dir: string) => {
          if (dir.includes('gates')) return ['gate-06-multi-repo.md']
          return []
        })
        mockReadFileSyncFs.mockImplementation((filePath: string) => {
          if (filePath.includes('gate-06')) {
            return `# Gate 06

## Requirements

### Project Requirements (Attributed to This Gate)

|Hash|Name|Type|Priority|How This Gate Addresses It|
|-|-|-|-|-|
|#4bc74e36854c4221|SQLite database stores requirements|constraint|must|Adds repositories tables|

### Inherited/Transferred Requirements

|Hash|Title|Source Gate|Relationship|Consumed By|
|-|-|-|-|-|
|#ac3ffa69e28bfed4|Create SQLite database with schema|gate-01|depends-on|Gate-06 adds tables|

---

## Architecture
`
          }
          return ''
        })

        const result = registry.get('reg_action')?.implementation({
          action: 'list',
          payload: { gateId: 'gate-06' },
        }) as { requirements: Array<{ hash: string; title: string }> }

        // Should have 1 project req from graph + 1 inherited req resolved by hash
        expect(result.requirements).toHaveLength(2)
        expect(result.requirements.map((r) => r.hash)).toContain('4bc74e36854c4221')
        expect(result.requirements.map((r) => r.hash)).toContain('ac3ffa69e28bfed4')

        // storeRequirement called for project req only (inherited already in DB)
        expect(mockStoreRequirement).toHaveBeenCalledTimes(1)
      })

      it('stores inherited requirement with sourceGateId when not in DB (covers ?? false branch)', () => {
        // Both graph calls return empty so fallback triggers and nothing re-seeds
        mockBuildRequirementGraph.mockReturnValue({ nodes: new Map(), edges: [] })

        // Inherited req is NOT in DB — storeRequirement path executes
        mockGetRequirementByHash.mockReturnValue(null)
        mockStoreRequirement.mockReturnValue({
          id: 'stored-inh-1',
          hash: 'ac3ffa69e28bfed4',
          description: 'Create SQLite database',
          gateId: 'gate-01',
        })

        mockReaddirSyncFs.mockImplementation((dir: string) => {
          if (dir.includes('gates')) return ['gate-06.md']
          return []
        })
        mockReadFileSyncFs.mockImplementation((filePath: string) => {
          if (filePath.includes('gate-06')) {
            return `# Gate 06\n\n## Requirements\n\n### Inherited/Transferred Requirements\n\n|Hash|Title|Source Gate|Relationship|\n|-|-|-|-|\n|#ac3ffa69e28bfed4|Create SQLite database|gate-01|depends-on|\n\n---\n`
          }
          return ''
        })

        registry.get('reg_action')?.implementation({
          action: 'list',
          payload: { gateId: 'gate-06' },
        })

        // storeRequirement called with 8 args (sourceGateId removed)
        expect(mockStoreRequirement).toHaveBeenCalledWith(
          'Create SQLite database',
          expect.any(String),
          expect.any(String),
          'default-project',
          undefined,
          undefined,
          undefined,
          'gate',
        )
      })

      it('stores inherited requirement when source gate column absent', () => {
        mockBuildRequirementGraph.mockReturnValue({ nodes: new Map(), edges: [] })

        // Inherited req not in DB
        mockGetRequirementByHash.mockReturnValue(null)
        mockStoreRequirement.mockReturnValue({
          id: 'stored-inh-2',
          hash: 'bb4ecdb42908c10f',
          description: 'Inherited no source',
          gateId: null,
        })

        mockReaddirSyncFs.mockImplementation((dir: string) => {
          if (dir.includes('gates')) return ['gate-08.md']
          return []
        })
        mockReadFileSyncFs.mockImplementation((filePath: string) => {
          if (filePath.includes('gate-08')) {
            return `# Gate 08\n\n## Requirements\n\n### Inherited/Transferred Requirements\n\n|Hash|Title|\n|-|-|\n|#bb4ecdb42908c10f|Inherited no source|\n\n---\n`
          }
          return ''
        })

        registry.get('reg_action')?.implementation({
          action: 'list',
          payload: { gateId: 'gate-08' },
        })

        // storeRequirement called with 8 args (sourceGateId removed)
        expect(mockStoreRequirement).toHaveBeenCalledWith(
          'Inherited no source',
          expect.any(String),
          expect.any(String),
          'default-project',
          undefined,
          undefined,
          undefined,
          'gate',
        )
      })
    })
  })
})

describe('parseGateRequirementsFromMarkdown', () => {
  it('parses project requirements table with valid hashes', () => {
    const content = `# Gate 06

## Requirements

### Project Requirements (Attributed to This Gate)

|Hash|Name|Type|Priority|How This Gate Addresses It|
|-|-|-|-|-|
|#4bc74e36854c4221|SQLite database stores requirements|constraint|must|Adds repositories tables|
|#9b4ecdb42908c10f|Use content-addressable SHA-256 hashes|constraint|must|Repository hash registry|
|#9c5150bf8e008175|Track dependencies between requirements|functional|must|Cross-repo dependency tracking|

### Gate-Specific Requirements

**Status**: Requirements will be generated when gate is started.

---

## Architecture
`
    const result = parseGateRequirementsFromMarkdown(content)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      hash: '4bc74e36854c4221',
      description: 'SQLite database stores requirements',
      type: 'constraint',
      priority: 'must',
      source: 'project',
    })
    expect(result[1].hash).toBe('9b4ecdb42908c10f')
    expect(result[1].source).toBe('project')
    expect(result[2].hash).toBe('9c5150bf8e008175')
    expect(result[2].source).toBe('project')
  })

  it('parses inherited/transferred requirements table', () => {
    const content = `# Gate 06

## Requirements

### Project Requirements (Attributed to This Gate)

No project requirements.

### Inherited/Transferred Requirements

|Hash|Title|Source Gate|Relationship|Consumed By|
|-|-|-|-|-|
|#ac3ffa69e28bfed4|Create SQLite database with schema|gate-01|depends-on|Gate-06 adds tables|
|#ebc7a086e26b111c|Create code analyzer using AST|gate-02|depends-on|detect workflow invokes CodeAnalyzer|

## Architecture
`
    const result = parseGateRequirementsFromMarkdown(content)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      hash: 'ac3ffa69e28bfed4',
      description: 'Create SQLite database with schema',
      type: 'functional', // default — type column not present in inherited table
      priority: 'must',   // default — priority column not present
      source: 'inherited',
    })
    expect(result[1].source).toBe('inherited')
  })

  it('skips placeholder hashes like #[hash]', () => {
    const content = `# Gate 07

## Requirements

### Project Requirements

| Hash    | Name               | Type       | Priority |
| ------- | ------------------ | ---------- | -------- |
| #[hash] | Clear Tasks        | functional | must     |
| #[hash] | Requirement Trace  | functional | must     |

## Architecture
`
    const result = parseGateRequirementsFromMarkdown(content)
    expect(result).toHaveLength(0)
  })

  it('deduplicates hashes appearing in multiple tables', () => {
    const content = `# Gate 06

## Requirements

### Project Requirements (Attributed to This Gate)

|Hash|Name|Type|Priority|Notes|
|-|-|-|-|-|
|#4bc74e36854c4221|SQLite database stores requirements|constraint|must|Primary|

### Inherited/Transferred Requirements

|Hash|Title|Source Gate|Relationship|Consumed By|
|-|-|-|-|-|
|#4bc74e36854c4221|SQLite database stores requirements|gate-01|depends-on|Duplicate|

## Architecture
`
    const result = parseGateRequirementsFromMarkdown(content)
    expect(result).toHaveLength(1)
  })

  it('returns empty array when no ## Requirements section exists', () => {
    const content = `# Gate 01

## Overview

Some overview text.

## Architecture
`
    const result = parseGateRequirementsFromMarkdown(content)
    expect(result).toHaveLength(0)
  })

  it('handles requirements section with comments before tables', () => {
    const content = `# Gate

## Requirements

<!-- Requirements-First Workflow:
  1. Project-level requirements
  2. Gate generation
-->

### Project Requirements (Attributed to This Gate)

|Hash|Name|Type|Priority|How This Gate Addresses It|
|-|-|-|-|-|
|#abcdef0123456789|A real requirement|non_functional|should|Does something|

---
`
    const result = parseGateRequirementsFromMarkdown(content)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      hash: 'abcdef0123456789',
      description: 'A real requirement',
      type: 'non_functional',
      priority: 'should',
      source: 'project',
    })
  })

  it('treats table header with Hash but no Name/Title column as not a valid table', () => {
    // nameCol === -1 → inTable stays false → no data rows parsed
    const content = `# Gate

## Requirements

### Project Requirements

|Hash|Description|Type|Priority|
|-|-|-|-|
|#abcdef0123456789|Some requirement|functional|must|

## Architecture
`
    const result = parseGateRequirementsFromMarkdown(content)
    // 'Description' doesn't match /(name|title)/i → nameCol = -1 → inTable = false
    expect(result).toHaveLength(0)
  })

  it('defaults to functional/must for invalid type/priority values', () => {
    const content = `# Gate

## Requirements

### Project Requirements

|Hash|Name|Type|Priority|
|-|-|-|-|
|#1111111111111111|Some requirement|invalid_type|wrong_priority|

## Architecture
`
    const result = parseGateRequirementsFromMarkdown(content)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('functional')
    expect(result[0].priority).toBe('must')
    expect(result[0].source).toBe('project')
  })

  it('parses both project and inherited tables from gate-06 format', () => {
    const content = `# Gate 06: Multi-Repo & Subproject Detection

## Requirements

### Project Requirements (Attributed to This Gate)

|Hash|Name|Type|Priority|How This Gate Addresses It|
|-|-|-|-|-|
|#4bc74e36854c4221|SQLite database stores requirements and repositories|constraint|must|Adds repositories tables|
|#10a621a3715172ae|Expose all operations as MCP tools|functional|must|repos_action MCP tool handler|

### Gate-Specific Requirements

**Status**: Requirements will be generated when gate is started.

### Inherited/Transferred Requirements

|Hash|Title|Source Gate|Relationship|Consumed By|
|-|-|-|-|-|
|#ac3ffa69e28bfed4|Create SQLite database with complete schema|gate-01|depends-on|Gate-06 adds tables|
|#ebc7a086e26b111c|Create code analyzer using AST parsing|gate-02|depends-on|detect workflow invokes CodeAnalyzer|

---

## Technical Decisions
`
    const result = parseGateRequirementsFromMarkdown(content)
    expect(result).toHaveLength(4)
    // Project requirements
    expect(result[0].hash).toBe('4bc74e36854c4221')
    expect(result[0].type).toBe('constraint')
    expect(result[0].source).toBe('project')
    expect(result[1].hash).toBe('10a621a3715172ae')
    expect(result[1].type).toBe('functional')
    expect(result[1].source).toBe('project')
    // Inherited requirements
    expect(result[2].hash).toBe('ac3ffa69e28bfed4')
    expect(result[2].source).toBe('inherited')
    expect(result[3].hash).toBe('ebc7a086e26b111c')
    expect(result[3].source).toBe('inherited')
  })
})
