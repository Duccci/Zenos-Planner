/**
 * State Transition Tests
 *
 * Verifies that the MCP handler layer enforces valid state transitions for gates and proposals.
 * Tests cover:
 *   - Invalid transitions return structured errors with valid-action hints
 *   - Idempotent transitions (already-at-target) return success
 *   - Valid transitions proceed without validator blocking
 *
 * // See MCP: entity-action-handler.ts#createStateTransitionValidator
 */
import { describe, it, expect } from 'vitest'
import {
  createStateTransitionValidator,
  type StateTransitionMap,
} from '../../../src/mcp/tools/entity-action-handler.js'

// ---------------------------------------------------------------------------
// Unit tests for createStateTransitionValidator
// ---------------------------------------------------------------------------

type TestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'

const TEST_TRANSITIONS: StateTransitionMap<TestStatus> = {
  pending: ['in_progress'],
  in_progress: ['completed', 'rejected'],
  completed: [],
  rejected: ['pending'],
}

function makeValidator(currentStatus: TestStatus | null, targetStatus: TestStatus, validFrom: TestStatus[]) {
  return createStateTransitionValidator<TestStatus>({
    getCurrentStatus: async () => currentStatus,
    targetStatus,
    validFromStatuses: validFrom,
    allTransitions: TEST_TRANSITIONS,
    entityLabel: 'test-entity:test-id',
  })
}

describe('createStateTransitionValidator', () => {
  it('allows valid transition (pending → in_progress)', async () => {
    const validate = makeValidator('pending', 'in_progress', ['pending'])
    const result = await validate()
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('blocks invalid transition (completed → in_progress)', async () => {
    const validate = makeValidator('completed', 'in_progress', ['pending'])
    const result = await validate()
    expect(result.allowed).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors![0]).toContain('completed cannot transition to in_progress')
    expect(result.errors![0]).toContain('Valid transitions from completed: none')
  })

  it('blocks invalid transition (pending → completed)', async () => {
    const validate = makeValidator('pending', 'completed', ['in_progress'])
    const result = await validate()
    expect(result.allowed).toBe(false)
    expect(result.errors![0]).toContain('pending cannot transition to completed')
    expect(result.errors![0]).toContain('Valid transitions from pending: in_progress')
  })

  it('idempotent: already at target state returns allowed:true with warning', async () => {
    const validate = makeValidator('in_progress', 'in_progress', ['pending'])
    const result = await validate()
    expect(result.allowed).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings![0]).toContain('already in_progress')
    expect(result.warnings![0]).toContain('no-op')
  })

  it('idempotent (completed): already completed returns allowed:true', async () => {
    const validate = makeValidator('completed', 'completed', ['in_progress'])
    const result = await validate()
    expect(result.allowed).toBe(true)
    expect(result.warnings![0]).toContain('already completed')
  })

  it('entity not found (null) → allowed:true (let handler report error)', async () => {
    const validate = makeValidator(null, 'in_progress', ['pending'])
    const result = await validate()
    expect(result.allowed).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('validator throws internally → allowed:true (does not block)',  async () => {
    const validator = createStateTransitionValidator<TestStatus>({
      getCurrentStatus: async () => { throw new Error('db unavailable') },
      targetStatus: 'in_progress',
      validFromStatuses: ['pending'],
      allTransitions: TEST_TRANSITIONS,
      entityLabel: 'test-entity:test-id',
    })
    const result = await validator()
    expect(result.allowed).toBe(true)
  })

  it('error message includes entity label and valid transitions hint', async () => {
    const validator = createStateTransitionValidator<TestStatus>({
      getCurrentStatus: async () => 'in_progress',
      targetStatus: 'in_progress',
      validFromStatuses: ['pending', 'rejected'],
      allTransitions: { ...TEST_TRANSITIONS, in_progress: ['completed', 'rejected'] },
      entityLabel: 'gate:gate-01',
    })
    // Already at target → no error
    const idempotentResult = await validator()
    expect(idempotentResult.allowed).toBe(true)

    // Try invalid from completed  
    const invalidValidator = createStateTransitionValidator<TestStatus>({
      getCurrentStatus: async () => 'completed',
      targetStatus: 'in_progress',
      validFromStatuses: ['pending'],
      allTransitions: TEST_TRANSITIONS,
      entityLabel: 'gate:gate-01',
    })
    const invalidResult = await invalidValidator()
    expect(invalidResult.errors![0]).toContain('gate:gate-01:completed cannot transition to in_progress')
  })
})

// ---------------------------------------------------------------------------
// Integration-level tests via MCP tool handlers
// ---------------------------------------------------------------------------

describe('MCP gate_action state transition enforcement', () => {
  it('gates_action start with non-existent gate returns error (not state error)', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_action')

    const result = await handler({ action: 'start', gateId: 'gate-nonexistent-99' })
    expect(result).toBeDefined()
    // Should fail (gate not found in CLI) — not a state transition error
    expect(result.isError).toBe(true)
  })

  it('gates_action start without gateId returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_action')

    const result = await handler({ action: 'start' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('gates_action complete without gateId returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_action')

    const result = await handler({ action: 'complete' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })
})

describe('MCP proposal_action state transition enforcement', () => {
  it('proposal_action start without hash returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    const result = await handler({ action: 'start' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action approve without hash returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    const result = await handler({ action: 'approve' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action reject without hash returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    const result = await handler({ action: 'reject' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action start with non-existent hash proceeds through validator (entity not found → allowed)', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    // State validator allows unknown entities; action handler reports not-found
    const result = await handler({ action: 'start', hash: 'nonexistent-hash-99' })
    expect(result).toBeDefined()
    // May succeed or fail from the action handler, but should NOT fail with a state-transition error
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
      // Should not be a state transition error
      expect(text).not.toContain('cannot transition to')
    }
  })
})
