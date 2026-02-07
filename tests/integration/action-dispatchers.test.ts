/**
 * Integration tests for unified action dispatchers
 * Tests proposal_action and gates_action discriminated union tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { proposalHandlers } from '../../src/mcp/tools/proposal-tools.js'
import { gateHandlers } from '../../src/mcp/tools/gate-tools.js'
import type { FunctionRegistry } from '../../src/integration/function-registry.js'

// Mock function registry
class MockFunctionRegistry implements Partial<FunctionRegistry> {
  private mockResults = new Map<string, any>()

  setMockResult(functionName: string, result: any) {
    this.mockResults.set(functionName, result)
  }

  async invoke(functionName: string, params: any): Promise<any> {
    const result = this.mockResults.get(functionName)
    if (result === undefined) {
      return { success: false, error: { code: 'NOT_MOCKED', message: `No mock result set for function: ${functionName}` } }
    }
    return { success: true, data: result }
  }

  // Other methods not needed for testing
  register() {}
  invoke() {
    return Promise.resolve({ success: true, data: {} })
  }
  list() {
    return []
  }
  get() {
    return undefined
  }
  getByCategory() {
    return []
  }
}

describe('Proposal Action Dispatcher', () => {
  let registry: MockFunctionRegistry
  let handlers: ReturnType<typeof proposalHandlers>

  beforeEach(() => {
    registry = new MockFunctionRegistry()
    handlers = proposalHandlers(registry as any)
  })

  it('should dispatch list action correctly', async () => {
    const mockProposals = [
      { hash: '#p1', title: 'Proposal 1', status: 'pending' },
      { hash: '#p2', title: 'Proposal 2', status: 'in_progress' },
    ]

    const mockListResult = {
      proposals: mockProposals,
      pagination: {
        total: 2,
        skip: 0,
        take: 50,
        hasMore: false
      }
    }

    registry.setMockResult('proposal_list', mockListResult)

    const result = await handlers.proposal_action({
      action: 'list',
      payload: { gateId: 'gate-03' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('list')
    expect(parsed.result.proposals).toEqual(mockProposals)
  })

  it('should dispatch show action correctly', async () => {
    const mockDetail = {
      hash: '#abc123',
      title: 'Test Proposal',
      status: 'pending',
      tasks: [],
      filesAffected: [],
    }

    registry.setMockResult('proposal_show', mockDetail)

    const result = await handlers.proposal_action({
      action: 'show',
      payload: { hash: '#abc123' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('show')
    expect(parsed.result.hash).toBe('#abc123')
  })

  it('should dispatch create action correctly', async () => {
    const mockCreateResult = {
      hash: '#new123',
      filePath: 'zeno/proposals/solitary/2026-02-06-01-test.md',
      validation: { passed: true, errors: [], warnings: [] },
      status: 'pending' as const,
      createdAt: '2026-02-06T00:00:00Z',
    }

    registry.setMockResult('proposal_create', mockCreateResult)

    const result = await handlers.proposal_action({
      action: 'create',
      payload: {
        title: 'Test Proposal',
        summary: 'Test summary',
        solitary: true,
        tasks: [{ description: 'Task 1', acceptanceCriteria: ['Done'] }],
      },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('create')
    expect(parsed.result.hash).toBe('#new123')
  })

  it('should dispatch validate action correctly', async () => {
    const mockValidation = {
      hash: '#abc123',
      passed: true,
      errors: undefined,
      warnings: ['Some warning'],
    }

    registry.setMockResult('proposal_validate', mockValidation)

    const result = await handlers.proposal_action({
      action: 'validate',
      payload: { hash: '#abc123', strict: false },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('validate')
    expect(parsed.result.passed).toBe(true)
  })

  it('should dispatch approve action correctly', async () => {
    const mockApproval = {
      hash: '#abc123',
      status: 'approved',
      validation: { passed: true, warnings: [] },
    }

    registry.setMockResult('proposal_approve', mockApproval)

    const result = await handlers.proposal_action({
      action: 'approve',
      payload: { hash: '#abc123' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('approve')
  })

  it('should dispatch reject action correctly', async () => {
    registry.setMockResult('proposal_reject', { hash: '#abc123', status: 'rejected' })

    const result = await handlers.proposal_action({
      action: 'reject',
      payload: { hash: '#abc123' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('reject')
  })

  it('should dispatch start action correctly', async () => {
    registry.setMockResult('proposal_start', { hash: '#abc123', status: 'in_progress' })

    const result = await handlers.proposal_action({
      action: 'start',
      payload: { hash: '#abc123' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('start')
  })

  it('should handle unknown action gracefully', async () => {
    const result = await handlers.proposal_action({
      action: 'unknown' as any,
      payload: {},
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('error')
  })

  it('should handle registry errors gracefully', async () => {
    registry.setMockResult('proposal_list', undefined)

    const result = await handlers.proposal_action({
      action: 'list',
      payload: {},
    })

    expect(result.isError).toBe(true)
  })
})

describe('Gates Action Dispatcher', () => {
  let registry: MockFunctionRegistry
  let handlers: ReturnType<typeof gateHandlers>

  beforeEach(() => {
    registry = new MockFunctionRegistry()
    handlers = gateHandlers(registry as any)
  })

  it('should dispatch list action correctly', async () => {
    const mockGates = [
      { id: 'gate-01', title: 'Gate 1', status: 'completed' },
      { id: 'gate-02', title: 'Gate 2', status: 'in_progress' },
    ]

    registry.setMockResult('gates_list', mockGates)

    const result = await handlers.gates_action({
      action: 'list',
      payload: {},
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('list')
    expect(parsed.result).toEqual(mockGates)
  })

  it('should dispatch show action correctly', async () => {
    const mockGateDetail = {
      id: 'gate-03',
      title: 'Gate 3',
      status: 'pending',
      proposals: [],
      requirements: [],
    }

    registry.setMockResult('gates_show', mockGateDetail)

    const result = await handlers.gates_action({
      action: 'show',
      payload: { gateId: 'gate-03' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('show')
    expect(parsed.result.id).toBe('gate-03')
  })

  it('should dispatch create action correctly', async () => {
    const mockCreateResult = {
      gateId: 'gate-04',
      filePath: 'zeno/gates/gate-04-prd.md',
      validation: { passed: true, errors: [], warnings: [] },
      createdAt: '2026-02-06T00:00:00Z',
    }

    registry.setMockResult('gate_create', mockCreateResult)

    const result = await handlers.gates_action({
      action: 'create',
      payload: {
        title: 'New Gate',
        description: 'Gate description',
        requirements: ['Requirement 1'],
      },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('create')
    expect(parsed.result.gateId).toBe('gate-04')
  })

  it('should dispatch start action correctly', async () => {
    const mockStartResult = {
      gateId: 'gate-03',
      status: 'in_progress',
      startedAt: '2026-02-06T00:00:00Z',
    }

    registry.setMockResult('gates_start', mockStartResult)

    const result = await handlers.gates_action({
      action: 'start',
      payload: { gateId: 'gate-03' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('start')
  })

  it('should dispatch complete action correctly', async () => {
    const mockCompleteResult = {
      gateId: 'gate-02',
      status: 'completed',
      completedAt: '2026-02-06T00:00:00Z',
      gitTag: 'gate-02-v1.0.0',
    }

    registry.setMockResult('gates_complete', mockCompleteResult)

    const result = await handlers.gates_action({
      action: 'complete',
      payload: { gateId: 'gate-02' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('complete')
  })

  it('should dispatch regenerate action correctly', async () => {
    const mockRegenResult = {
      regenerated: 3,
      gatesUpdated: ['gate-04', 'gate-05', 'gate-06'],
    }

    registry.setMockResult('gates_regenerate', mockRegenResult)

    const result = await handlers.gates_action({
      action: 'regenerate',
      payload: { fromGate: 'gate-03' },
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.action).toBe('regenerate')
  })

  it('should handle unknown action gracefully', async () => {
    const result = await handlers.gates_action({
      action: 'unknown' as any,
      payload: {},
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('error')
  })

  it('should handle missing registry gracefully', async () => {
    const noRegHandlers = gateHandlers(undefined)
    const result = await noRegHandlers.gates_action({
      action: 'list',
      payload: {},
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('requires registry')
  })
})

describe('Action Dispatcher Type Safety', () => {
  it('should enforce correct payload types for proposal actions', async () => {
    const registry = new MockFunctionRegistry()
    const handlers = proposalHandlers(registry as any)

    // Valid payloads should work
    registry.setMockResult('proposal_show', { hash: '#abc' })
    const validResult = await handlers.proposal_action({
      action: 'show',
      payload: { hash: '#abc123' },
    })
    expect(validResult.isError).toBeFalsy()

    // Invalid payload structure should fail
    const invalidResult = await handlers.proposal_action({
      action: 'show',
      payload: { wrongField: 'value' } as any,
    })
    expect(invalidResult.isError).toBe(true)
  })

  it('should enforce correct payload types for gate actions', async () => {
    const registry = new MockFunctionRegistry()
    const handlers = gateHandlers(registry as any)

    // Valid payloads should work
    registry.setMockResult('gates_show', { id: 'gate-01' })
    const validResult = await handlers.gates_action({
      action: 'show',
      payload: { gateId: 'gate-01' },
    })
    expect(validResult.isError).toBeFalsy()
  })
})

describe('Action Dispatcher Output Schema Validation', () => {
  it('should validate proposal action output schema', async () => {
    const registry = new MockFunctionRegistry()
    const handlers = proposalHandlers(registry as any)

    // Set valid mock result
    registry.setMockResult('proposal_list', [{ hash: '#p1', title: 'Test' }])

    const result = await handlers.proposal_action({
      action: 'list',
      payload: {},
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)

    // Output should have discriminated union structure
    expect(parsed).toHaveProperty('action')
    expect(parsed).toHaveProperty('result')
    expect(parsed.action).toBe('list')
  })

  it('should validate gates action output schema', async () => {
    const registry = new MockFunctionRegistry()
    const handlers = gateHandlers(registry as any)

    registry.setMockResult('gates_list', [{ id: 'gate-01', title: 'Test' }])

    const result = await handlers.gates_action({
      action: 'list',
      payload: {},
    })

    expect(result.content).toBeDefined()
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toHaveProperty('action')
    expect(parsed).toHaveProperty('result')
    expect(parsed.action).toBe('list')
  })
})
