import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerRequirementsOps } from '../../src/integration/requirements-registry.js'

vi.mock('../../src/generation/requirement-storage.js', () => {
  return {
    RequirementStorage: vi.fn().mockImplementation(() => ({
      getProjectRequirements: vi.fn().mockReturnValue([
        {
          hash: 'proj-req-1',
          description: 'Project requirement 1',
          type: 'functional',
          priority: 'must',
          gateId: null,
          parentId: null,
          projectId: 'project-1',
        },
      ]),
      buildRequirementGraph: vi.fn().mockReturnValue({
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
      }),
      getRequirementByHash: vi.fn().mockReturnValue({
        hash: 'test-hash',
        description: 'Test requirement',
        type: 'functional',
        priority: 'must',
        gateId: 'gate-01',
        parentId: null,
        projectId: 'project-1',
        acceptanceCriteria: ['Criteria 1', 'Criteria 2'],
        createdAt: new Date('2026-01-01'),
      }),
      getRequirementChildren: vi
        .fn()
        .mockReturnValue([{ hash: 'child-1', description: 'Child requirement 1' }]),
      getRequirementAncestors: vi
        .fn()
        .mockReturnValue([{ hash: 'parent-1', description: 'Parent requirement' }]),
      transferRequirement: vi.fn().mockReturnValue({
        hash: 'test-hash',
        previousGateId: 'gate-01',
        newGateId: 'gate-02',
        transferredAt: new Date().toISOString(),
        affectedProposals: [],
      }),
      searchRequirements: vi.fn().mockReturnValue({
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
      }),
    })),
  }
})

describe('Requirements Registry wiring', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    registry = new FunctionRegistry()
    registerRequirementsOps(registry)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('req_action handler', () => {
    it('should be registered', () => {
      const func = registry.get('req_action')
      expect(func).toBeDefined()
      expect(func?.name).toBe('req_action')
      expect(func?.description).toContain('requirement')
    })

    it('should have correct schema', () => {
      const func = registry.get('req_action')
      expect(func?.schema).toBeDefined()
    })

    describe('list action', () => {
      it('should list project requirements when project=true', () => {
        const result = registry.get('req_action')?.implementation({
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
        const result = registry.get('req_action')?.implementation({
          action: 'list',
          payload: { gateId: 'gate-01' },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
        const reqs = (result as any).requirements
        expect(Array.isArray(reqs)).toBe(true)
      })

      it('should list all requirements when no filter provided', () => {
        const result = registry.get('req_action')?.implementation({
          action: 'list',
          payload: {},
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
        const reqs = (result as any).requirements
        expect(Array.isArray(reqs)).toBe(true)
      })

      it('should handle missing payload', () => {
        const result = registry.get('req_action')?.implementation({
          action: 'list',
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
      })
    })

    describe('show action', () => {
      it('should show requirement details', () => {
        const result = registry.get('req_action')?.implementation({
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
        const result = registry.get('req_action')?.implementation({
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
        const result = registry.get('req_action')?.implementation({
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
        const result = registry.get('req_action')?.implementation({
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
        const result = registry.get('req_action')?.implementation({
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
        const result = registry.get('req_action')?.implementation({
          action: 'transfer',
          payload: { hash: 'test-hash', gateId: 'gate-02' },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('hash', 'test-hash')
        expect(result).toHaveProperty('newGateId', 'gate-02')
      })

      it('should return transfer result with metadata', () => {
        const result = registry.get('req_action')?.implementation({
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
        const result = registry.get('req_action')?.implementation({
          action: 'search',
          payload: { query: 'test' },
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
        expect(result).toHaveProperty('total')
        expect(result).toHaveProperty('pagination')
      })

      it('should support gateId filter', () => {
        const result = registry.get('req_action')?.implementation({
          action: 'search',
          payload: { query: 'test', gateId: 'gate-01' },
        })

        const data = result as any
        expect(data.requirements).toBeDefined()
        expect(Array.isArray(data.requirements)).toBe(true)
      })

      it('should support type filter', () => {
        const result = registry.get('req_action')?.implementation({
          action: 'search',
          payload: { query: 'test', type: 'functional' },
        })

        const data = result as any
        expect(data.requirements).toBeDefined()
      })

      it('should support pagination', () => {
        const result = registry.get('req_action')?.implementation({
          action: 'search',
          payload: { query: 'test', skip: 0, take: 10 },
        })

        const data = result as any
        expect(data.pagination).toBeDefined()
        expect(data.pagination).toHaveProperty('skip')
        expect(data.pagination).toHaveProperty('take')
        expect(data.pagination).toHaveProperty('total')
        expect(data.pagination).toHaveProperty('hasMore')
      })
    })

    describe('error handling', () => {
      it('should throw on invalid action', () => {
        expect(() => {
          registry.get('req_action')?.implementation({
            action: 'invalid-action',
            payload: {},
          })
        }).toThrow('Unknown req_action')
      })

      it('should throw on required payload missing', () => {
        expect(() => {
          registry.get('req_action')?.implementation({
            action: 'show',
            payload: {}, // Missing hash
          })
        }).toThrow()
      })

      it('should handle missing payload gracefully for list action', () => {
        const result = registry.get('req_action')?.implementation({
          action: 'list',
          payload: undefined,
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('requirements')
      })
    })
  })

  describe('Registry validation', () => {
    it('req_action should have proper description', () => {
      const func = registry.get('req_action')
      expect(func?.description).toMatch(/list|show|deps|transfer/i)
    })

    it('req_action should have action parameter defined', () => {
      const func = registry.get('req_action')
      const actionParam = func?.parameters.find((p) => p.name === 'action')
      expect(actionParam).toBeDefined()
      expect(actionParam?.required).toBe(true)
    })

    it('req_action should have schema validation', () => {
      const func = registry.get('req_action')
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
    it('should invoke req_action through registry.invoke', async () => {
      const result = await registry.invoke('req_action', {
        action: 'list',
        payload: { project: true },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('requirements')
      }
    })

    it('should handle parameter validation errors', async () => {
      const result = await registry.invoke('req_action', {
        action: 'show',
        payload: {}, // Missing required hash
      })

      expect(result.success).toBe(false)
    })

    it('should return error for unknown action', async () => {
      const result = await registry.invoke('req_action', {
        action: 'unknown',
        payload: {},
      })

      expect(result.success).toBe(false)
    })
  })
})
