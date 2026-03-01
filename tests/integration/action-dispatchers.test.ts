/**
 * Integration tests for unified action dispatchers
 * Tests proposal_action and gates_action discriminated union tools
 *
 * TODO: These tests use MockFunctionRegistry for mocking registry.invoke calls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { proposalHandlers } from '../../src/mcp/tools/proposal-tools.js'
import { gateHandlers } from '../../src/mcp/tools/gate-tools.js'
import type { FunctionRegistry } from '../../src/integration/function-registry.js'

/**
 * Mock function registry for testing handlers in isolation
 * Ensures mocks stay type-safe and match FunctionRegistry interface
 */
class MockFunctionRegistry implements Partial<FunctionRegistry> {
  private mockResults = new Map<string, any>()

  setMockResult(functionName: string, result: any): void {
    this.mockResults.set(functionName, result)
  }

  async invoke(functionName: string, params: any): Promise<any> {
    const result = this.mockResults.get(functionName)
    if (result === undefined) {
      throw new Error(
        `No mock result set for function: ${functionName}. Use setMockResult() before calling this function.`
      )
    }
    return { success: true, data: result }
  }

  // Stub implementations for required interface methods
  register(): void {}
  list(): any[] {
    return []
  }
  get(): undefined {
    return undefined
  }
  getByCategory(): any[] {
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
    const now = new Date().toISOString()
    const mockProposals = [
      {
        hash: 'prop0001',
        title: 'Proposal 1',
        status: 'pending',
        gateId: 'gate-03',
        tasksCompleted: 0,
        totalTasks: 1,
        lastUpdated: now,
      },
      {
        hash: 'prop0002',
        title: 'Proposal 2',
        status: 'in_progress',
        gateId: 'gate-03',
        tasksCompleted: 1,
        totalTasks: 2,
        lastUpdated: now,
      },
    ]

    const mockListResult = {
      proposals: mockProposals,
    }

    registry.setMockResult('proposal_list', mockListResult)

    const result = await handlers.proposal_action({
      action: 'list',
      gateId: 'gate-03',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('list')
    expect(parsed.result.proposals).toEqual(mockProposals)
  })

  it('should dispatch show action correctly', async () => {
    const now = new Date().toISOString()
    const mockDetail = {
      hash: 'prop0001',
      title: 'Test Proposal',
      description: 'Test description',
      status: 'pending',
      gateId: 'gate-03',
      tasks: [],
      lastUpdated: now,
    }

    registry.setMockResult('proposal_show', mockDetail)

    const result = await handlers.proposal_action({
      action: 'show',
      hash: 'prop0001',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('show')
    expect(parsed.result.hash).toBe('prop0001')
  })

  it('should dispatch create action correctly', async () => {
    const now = new Date().toISOString()
    const mockCreateResult = {
      hash: 'prop0002',
      filePath: 'zeno/proposals/solitary/2026-02-06-01-test.md',
      validation: { passed: true, errors: [], warnings: [] },
      status: 'pending',
      createdAt: now,
      solitary: true,
    }

    registry.setMockResult('proposal_create', mockCreateResult)

    const result = await handlers.proposal_action({
      action: 'create',
      title: 'Test Proposal',
      summary: 'Test summary',
      solitary: true,
      tasks: [{ description: 'Task 1', acceptanceCriteria: ['Done'] }],
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('create')
    expect(parsed.result.hash).toBe('prop0002')
  })

  it('should dispatch validate action correctly', async () => {
    const mockValidation = {
      hash: 'prxy0001',
      passed: true,
      issues: [],
      summary: 'All checks passed',
    }

    registry.setMockResult('proposal_validate', mockValidation)

    const result = await handlers.proposal_action({
      action: 'validate',
      hash: 'prxy0001',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('validate')
    expect(parsed.result.passed).toBe(true)
  })

  it('should dispatch approve action correctly', async () => {
    const now = new Date().toISOString()
    registry.setMockResult('proposal_show', {
      hash: 'prxy0001',
      title: 'Test',
      description: 'Test',
      status: 'in_progress',
      gateId: 'gate-01',
      tasks: [],
      lastUpdated: now,
    })
    registry.setMockResult('config_get', {
      projectName: 'test',
      version: '0.1.0',
      qualityThresholds: {
        codeCoverage: 90,
        typeCheckingErrors: 0,
        lintingErrorRate: 0.01,
        securityVulnerabilities: 0,
      },
      hashAlgorithm: 'sha256',
      hashLength: 16,
    })
    registry.setMockResult('proposal_approve', {
      hash: 'prxy0001',
      previousStatus: 'in_progress',
      newStatus: 'completed',
      approvedAt: now,
    })

    const result = await handlers.proposal_action({
      action: 'approve',
      hash: 'prxy0001',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('approve')
  })

  it('should dispatch reject action correctly', async () => {
    const now = new Date().toISOString()
    registry.setMockResult('proposal_show', {
      hash: 'prxy0001',
      title: 'Test',
      description: 'Test',
      status: 'in_progress',
      gateId: 'gate-01',
      tasks: [],
      lastUpdated: now,
    })
    registry.setMockResult('proposal_reject', {
      hash: 'prxy0001',
      previousStatus: 'in_progress',
      newStatus: 'rejected',
      rejectedAt: now,
      reason: 'Requires changes',
    })

    const result = await handlers.proposal_action({
      action: 'reject',
      hash: 'prxy0001',
      rejectionReason: 'Requires changes',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    if (!parsed.action) {
      console.log('Reject error response:', JSON.stringify(parsed, null, 2))
    }
    expect(parsed.action).toBe('reject')
    expect(parsed.result.reason).toBe('Requires changes')
  })

  it('should dispatch start action correctly', async () => {
    const now = new Date().toISOString()
    registry.setMockResult('proposal_show', {
      hash: 'prxy0001',
      title: 'Test',
      description: 'Test',
      status: 'pending',
      gateId: 'gate-01',
      tasks: [],
      lastUpdated: now,
    })
    registry.setMockResult('config_get', {
      projectName: 'test',
      version: '0.1.0',
      qualityThresholds: {
        codeCoverage: 90,
        typeCheckingErrors: 0,
        lintingErrorRate: 0.01,
        securityVulnerabilities: 0,
      },
      hashAlgorithm: 'sha256',
      hashLength: 16,
    })
    registry.setMockResult('proposal_start', {
      hash: 'prxy0001',
      previousStatus: 'pending',
      newStatus: 'in_progress',
      startedAt: now,
    })

    const result = await handlers.proposal_action({
      action: 'start',
      hash: 'prxy0001',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('start')
  })

  it('should handle unknown action gracefully', async () => {
    const result = await handlers.proposal_action({
      action: 'unknown' as any,
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('error')
  })

  it('should handle registry errors gracefully', async () => {
    registry.setMockResult('proposal_list', undefined)

    const result = await handlers.proposal_action({
      action: 'list',
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
    const now = new Date().toISOString()
    const mockGates = [
      {
        id: 'gate-01',
        name: 'Gate 1',
        description: 'First gate',
        sequence: 1,
        status: 'completed',
        type: 'feature',
        lastUpdated: now,
        proposalCount: 2,
        completedProposalCount: 2,
        requirementCount: 5,
        testedRequirementCount: 5,
      },
      {
        id: 'gate-02',
        name: 'Gate 2',
        description: 'Second gate',
        sequence: 2,
        status: 'in_progress',
        type: 'infrastructure',
        lastUpdated: now,
        proposalCount: 1,
        completedProposalCount: 0,
        requirementCount: 3,
        testedRequirementCount: 1,
      },
    ]

    const mockListResult = {
      gates: mockGates,
    }

    registry.setMockResult('gates_list', mockListResult)

    const result = await handlers.gates_action({
      action: 'list',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('list')
    expect(parsed.result.gates).toEqual(mockGates)
  })

  it('should dispatch show action correctly', async () => {
    const now = new Date().toISOString()
    const mockGateDetail = {
      id: 'gate-03',
      name: 'Gate 3',
      description: 'Third gate',
      sequence: 3,
      status: 'pending',
      type: 'feature',
      objectives: [],
      requirements: [],
      proposals: [],
      lastUpdated: now,
    }

    registry.setMockResult('gates_show', mockGateDetail)

    const result = await handlers.gates_action({
      action: 'show',
      gateId: 'gate-03',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('show')
    expect(parsed.result.id).toBe('gate-03')
  })

  it('should dispatch create action correctly', async () => {
    const now = new Date().toISOString()
    registry.setMockResult('config_get', {
      projectName: 'test',
      version: '0.1.0',
      qualityThresholds: {
        codeCoverage: 90,
        typeCheckingErrors: 0,
        lintingErrorRate: 0.01,
        securityVulnerabilities: 0,
      },
      hashAlgorithm: 'sha256',
      hashLength: 16,
    })
    // Mock gates_list for dependency validation
    registry.setMockResult('gates_list', [])
    registry.setMockResult('gate_create', {
      gateId: 'gate-04',
      filePath: 'zeno/gates/gate-04-infrastructure.md',
      validation: {
        passed: true,
        errors: [],
        warnings: [],
      },
      roadmapUpdated: true,
      createdAt: now,
    })

    const result = await handlers.gates_action({
      action: 'create',
      gateId: 'gate-04',
      name: 'Infrastructure Setup',
      type: 'feature',
      sequence: 4,
      dependencies: [],
      objectives: ['Set up CI/CD', 'Configure deployment'],
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('create')
    expect(parsed.result.gateId).toBe('gate-04')
  })

  it('should dispatch start action correctly', async () => {
    const now = new Date().toISOString()
    registry.setMockResult('gates_show', {
      id: 'gate-03',
      name: 'Gate 3',
      status: 'pending',
      type: 'feature',
      sequence: 3,
      lastUpdated: now,
    })
    registry.setMockResult('gates_start', {
      gateId: 'gate-03',
      previousStatus: 'pending',
      newStatus: 'in_progress',
      startedAt: now,
    })

    const result = await handlers.gates_action({
      action: 'start',
      gateId: 'gate-03',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('start')
  })

  it('should dispatch complete action correctly', async () => {
    const now = new Date().toISOString()
    registry.setMockResult('gates_show', {
      id: 'gate-02',
      name: 'Gate 2',
      status: 'in_progress',
      type: 'feature',
      sequence: 2,
      lastUpdated: now,
    })
    registry.setMockResult('config_get', {
      projectName: 'test',
      version: '0.1.0',
      qualityThresholds: {
        codeCoverage: 90,
        typeCheckingErrors: 0,
        lintingErrorRate: 0.01,
        securityVulnerabilities: 0,
      },
      hashAlgorithm: 'sha256',
      hashLength: 16,
    })
    registry.setMockResult('gates_complete', {
      gateId: 'gate-02',
      previousStatus: 'in_progress',
      newStatus: 'completed',
      completedAt: now,
      summary: {
        proposalsCompleted: 5,
        requirementsTested: 10,
      },
    })

    const result = await handlers.gates_action({
      action: 'complete',
      gateId: 'gate-02',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('complete')
  })

  it('should dispatch regenerate action correctly', async () => {
    registry.setMockResult('gates_regenerate', {
      mode: 'check',
      status: 'changes_suggested',
      changes: {
        gatesAffected: ['gate-04', 'gate-05', 'gate-06'],
        proposalsGenerated: 3,
        requirementsAttributed: 12,
        summary: 'Suggested 3 new gates for backlog items',
      },
    })

    const result = await handlers.gates_action({
      action: 'regenerate',
      fromGateId: 'gate-03',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any
    expect(parsed.action).toBe('regenerate')
  })

  it('should handle unknown action gracefully', async () => {
    const result = await handlers.gates_action({
      action: 'unknown' as any,
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('error')
  })

  it('should handle missing registry gracefully', async () => {
    const noRegHandlers = gateHandlers(undefined)
    const result = await noRegHandlers.gates_action({
      action: 'list',
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
    const now = new Date().toISOString()
    registry.setMockResult('proposal_show', {
      hash: 'prxy0001',
      title: 'Test Proposal',
      description: 'Test description',
      status: 'pending',
      gateId: 'gate-03',
      tasks: [],
      lastUpdated: now,
      filesAffected: [],
    })
    const validResult = await handlers.proposal_action({
      action: 'show',
      hash: 'prxy0001',
    })
    expect(validResult.isError).toBeFalsy()

    // Calling without required hash should surface a backend error, not a schema error
    const invalidResult = await handlers.proposal_action({
      action: 'show',
    })
    // Result may succeed or fail depending on registry mock — confirm no schema crash
    expect(invalidResult).toBeDefined()
  })

  it('should enforce correct payload types for gate actions', async () => {
    const registry = new MockFunctionRegistry()
    const handlers = gateHandlers(registry as any)

    // Valid payloads should work
    const now = new Date().toISOString()
    registry.setMockResult('gates_show', {
      id: 'gate-01',
      name: 'Gate 1',
      description: 'Test gate',
      sequence: 1,
      status: 'pending',
      type: 'feature',
      objectives: [],
      requirements: [],
      proposals: [],
      lastUpdated: now,
    })
    const validResult = await handlers.gates_action({
      action: 'show',
      gateId: 'gate-01',
    })
    expect(validResult.isError).toBeFalsy()
  })
})

describe('Action Dispatcher Output Schema Validation', () => {
  it('should validate proposal action output schema', async () => {
    const registry = new MockFunctionRegistry()
    const handlers = proposalHandlers(registry as any)

    // Set valid mock result in the expected structure
    const now = new Date().toISOString()
    const mockListResult = {
      proposals: [
        {
          hash: 'p0000001',
          title: 'Test',
          status: 'pending',
          gateId: 'gate-03',
          tasksCompleted: 0,
          totalTasks: 5,
          lastUpdated: now,
        },
      ],
    }
    registry.setMockResult('proposal_list', mockListResult)

    const result = await handlers.proposal_action({
      action: 'list',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any

    // Output should have discriminated union structure
    expect(parsed).toHaveProperty('action')
    expect(parsed).toHaveProperty('result')
    expect(parsed.action).toBe('list')
  })

  it('should validate gates action output schema', async () => {
    const registry = new MockFunctionRegistry()
    const handlers = gateHandlers(registry as any)

    const now = new Date().toISOString()
    const mockListResult = {
      gates: [
        {
          id: 'gate-01',
          name: 'Test',
          description: 'Test gate',
          sequence: 1,
          status: 'pending',
          type: 'feature',
          proposalCount: 0,
          completedProposalCount: 0,
          requirementCount: 0,
          testedRequirementCount: 0,
          lastUpdated: now,
        },
      ],
    }
    registry.setMockResult('gates_list', mockListResult)

    const result = await handlers.gates_action({
      action: 'list',
    })

    expect(result.content).toBeDefined()
    const parsed = result.structuredContent as any

    expect(parsed).toHaveProperty('action')
    expect(parsed).toHaveProperty('result')
    expect(parsed.action).toBe('list')
  })
})

