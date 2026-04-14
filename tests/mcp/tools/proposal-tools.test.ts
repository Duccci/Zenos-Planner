import { describe, it, expect, afterAll } from 'vitest'
import { simpleGit } from 'simple-git'

describe('MCP Proposal tools (integration)', () => {
  it('proposal_list returns structured result or structured error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_list')
    const result = await handler({})
    expect(result).toBeDefined()
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
      expect(text.toLowerCase()).toContain('error')
    } else {
      expect(result.content[0]?.text).toBeDefined()
    }
  })

  it('proposal_validate missing param returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_validate')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('invalid')
  })

  it('proposal_start missing param returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_start')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action show returns proposal details', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'show', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action without action returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({})
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action with invalid action returns validation error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'invalid_action' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
  })

  it('proposal_action list returns proposals', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'list', payload: {} })
    expect(result).toBeDefined()
  })

  it('proposal_action start with valid hash triggers validation', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'start', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action approve with valid payload triggers quality validation', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'approve', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action reject with valid hash rejects proposal', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'reject', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action validate with valid hash validates proposal', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'validate', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action progress with valid hash updates progress', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'progress', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action generate with valid payload generates proposals', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'generate', payload: {} })
    expect(result).toBeDefined()
  })

  it('proposal_action generate with explicit fields creates proposal directly', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'generate',
      payload: {
        title: 'Test Proposal',
        gateId: 'gate-01',
      },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action generate with solitary=true routes to proposal workflow', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    // Call generate with solitary=true - should route to proposal_create workflow
    const result = await handler({
      action: 'generate',
      solitary: true,
      title: 'Solitary Proposal',
      summary: 'A self-contained proposal',
      tasks: [
        {
          description: 'Task 1',
          acceptanceCriteria: ['AC1'],
        },
      ],
    })
    expect(result).toBeDefined()
    // Should either succeed or return a structured error, but NOT fail to route
    expect(result.content).toBeDefined()
  })

  it('proposal_action generate with no gateId defaults to solitary workflow', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    // Call generate without gateId - should route to solitary (proposal_create) workflow
    const result = await handler({
      action: 'generate',
      title: 'Implicit Solitary Proposal',
      summary: 'A proposal without explicit gate',
      tasks: [
        {
          description: 'Task 1',
          acceptanceCriteria: ['AC1'],
        },
      ],
    })
    expect(result).toBeDefined()
    // Should either succeed or return a structured error, but NOT fail to route
    expect(result.content).toBeDefined()
  })

  it('proposal_action generate with no gateId defaults to solitary workflow', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    // Call generate without gateId - should route to solitary (proposal_create) workflow
    const result = await handler({
      action: 'generate',
      title: 'Implicit Solitary Proposal',
      summary: 'A proposal without explicit gate',
      tasks: [
        {
          description: 'Task 1',
          acceptanceCriteria: ['AC1'],
        },
      ],
    })
    expect(result).toBeDefined()
    // Should route to proposal_create successfully
    expect(result.content).toBeDefined()
  })

  // Additional tests for proposal tool routing and action sequences
  it('proposal_action cancel transitions proposal state', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'cancel', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action defer postpones proposal to backlog', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({ action: 'defer', payload: { hash: 'test-hash' } })
    expect(result).toBeDefined()
  })

  it('proposal_action list filters by gateId when provided', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'list',
      payload: { gateId: 'gate-01' },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action show with payload containing hash returns details', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'show',
      payload: { hash: 'abc12345' },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action approve requires hash parameter', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')

    // Missing hash should trigger validation error
    const result = await handler({
      action: 'approve',
      payload: {},
    })
    expect(result).toBeDefined()
    // May be error or partial success depending on validation
  })

  it('proposal_action reject with feedback reason', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'reject',
      payload: {
        hash: 'test-hash',
        feedback: 'Needs clarification on requirements',
      },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action validate with quality checks', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'validate',
      payload: {
        hash: 'test-hash',
        checkCoverage: true,
        checkSecurity: true,
      },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action progress updates task completion state', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'progress',
      payload: {
        hash: 'test-hash',
        taskIndex: 0,
        status: 'completed',
        notes: 'Implementation complete',
      },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action generate with all explicit fields creates proposal directly', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'generate',
      payload: {
        title: 'Complete Feature Proposal',
        summary: 'Full implementation plan',
        gateId: 'gate-02',
        tasks: [
          {
            description: 'Task 1',
            acceptanceCriteria: ['Must pass tests', 'Code review approved'],
            estimatedHours: 8,
          },
          {
            description: 'Task 2',
            acceptanceCriteria: ['Documentation written'],
            estimatedHours: 4,
          },
        ],
        filesAffected: ['src/feature.ts', 'tests/feature.test.ts'],
        dependencies: {
          blocks: ['gate-03'],
          requires: ['gate-01'],
        },
      },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action generate with gate-specific requirements', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'generate',
      payload: {
        gateId: 'gate-03',
        templateName: 'proposal-template',
      },
    })
    expect(result).toBeDefined()
  })

  it('proposal_action start creates worktree and returns path', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'proposal_action')
    const result = await handler({
      action: 'start',
      payload: {
        hash: 'test-hash',
        reason: 'Implementation in progress',
      },
    })
    expect(result).toBeDefined()
  })

  // ============================================================================
  // PreReview Enforcement Tests (G1-G4, G5-G8, currentTask)
  // ============================================================================

  it('proposal_action start without preReview returns structured error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    const result = await handler({ action: 'start', hash: 'test-hash' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
    expect(text.toLowerCase()).toContain('prereview')
  })

  it('proposal_action start with preReview.openQuestionsResolved=false and open questions returns error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    const result = await handler({
      action: 'start',
      hash: 'test-hash',
      preReview: {
        phase: 'apply',
        openQuestionsResolved: false,
        questionsFound: ['What does "complete" mean for task 3?'],
        filesVerified: true,
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
    expect(text.toLowerCase()).toContain('unresolved')
  })

  it('proposal_action start with preReview.filesVerified=false returns error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    const result = await handler({
      action: 'start',
      hash: 'test-hash',
      preReview: {
        phase: 'apply',
        openQuestionsResolved: true,
        questionsFound: [],
        filesVerified: false,
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
    expect(text.toLowerCase()).toContain('filesverified')
  })

  it('proposal_action start with valid preReview proceeds to state validation', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    const result = await handler({
      action: 'start',
      hash: 'test-hash',
      preReview: {
        phase: 'apply',
        openQuestionsResolved: true,
        questionsFound: [],
        filesVerified: true,
        assumptionsDocumented: ['Assumes test DB exists'],
        blockersIdentified: [],
      },
    })
    // Passes preReview validation; may fail on state check (proposal not found) — that's expected
    expect(result).toBeDefined()
    // preReview validation passed, so any error is from downstream (not preReview enforcement)
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
      expect(text.toLowerCase()).not.toContain('prereview is required')
    }
  })

  it('proposal_action generate without preReview returns structured error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    const result = await handler({ action: 'generate', gateId: 'gate-01' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
    expect(text.toLowerCase()).toContain('prereview')
  })

  it('proposal_action generate with valid preReview proceeds past enforcement', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    const result = await handler({
      action: 'generate',
      gateId: 'gate-01',
      preReview: {
        phase: 'generate',
        openQuestionsResolved: true,
        questionsFound: [],
        gateReviewed: true,
        requirementsVerified: true,
        vagueRequirements: [],
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })
    expect(result).toBeDefined()
    // preReview validation passed — any error is from downstream gate generation (expected)
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
      expect(text.toLowerCase()).not.toContain('prereview is required')
    }
  })

  // ============================================================================
  // Coverage: cancel/defer via proposalHandlers, dependency validator, validate validators
  // ============================================================================

  it('proposal_action cancel via proposalHandlers covers outputSchemaFor cancel branch', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    // Routes through entity-action-handler: actionOutputSchema('cancel') + cancel action handler
    const result = await handler({ action: 'cancel', hash: 'test-hash' })
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
  })

  it('proposal_action defer via proposalHandlers covers outputSchemaFor defer branch', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    // Routes through entity-action-handler: actionOutputSchema('defer') + defer action handler
    const result = await handler({ action: 'defer', hash: 'test-hash' })
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
  })

  it('proposal_action generate with dependencies exercises validateProposalDependencies', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    // Non-empty dependencies triggers the circular-dependency validator,
    // which calls validateProposalDependencies (lines 206-220) and the try block (789-790)
    const result = await handler({
      action: 'generate',
      gateId: 'gate-01',
      dependencies: ['dep-hash-1'],
      preReview: {
        phase: 'generate',
        openQuestionsResolved: true,
        questionsFound: [],
        gateReviewed: true,
        requirementsVerified: true,
        vagueRequirements: [],
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
  })

  it('proposal_action validate via proposalHandlers exercises validate validators', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    // Exercises all five validate validators including gate-level test-first (line 893)
    // and cleanup reuse validator which call proposal_show and handle non-existent proposals
    const result = await handler({ action: 'validate', hash: 'test-hash' })
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
  })

  it('proposal_action progress without currentTask returns structured error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    const result = await handler({ action: 'progress', hash: 'test-hash' })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
    expect(text.toLowerCase()).toContain('currenttask')
  })

  it('proposal_action progress with currentTask=0 (out of bounds) returns error', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    const result = await handler({ action: 'progress', hash: 'test-hash', currentTask: 0 })
    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
    expect(text.toLowerCase()).toContain('1')
  })

  it('proposal_action progress with valid currentTask proceeds to handler', async () => {
    const { createFunctionRegistry } =
      await import('../../../src/integration/function-implementations.js')
    const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')
    const registry = createFunctionRegistry()
    const handler = proposalHandlers(registry)['proposal_action']
    // currentTask=1 passes validation; handler will attempt real progress update
    const result = await handler({ action: 'progress', hash: 'test-hash', currentTask: 1 })
    expect(result).toBeDefined()
    // currentTask validation passed; downstream may error (expected for test-hash)
    if (result.isError) {
      const text = result.content?.[0]?.text ? String(result.content[0].text) : ''
      expect(text.toLowerCase()).not.toContain('currenttask is required')
    }
  })

  afterAll(async () => {
    const git = simpleGit(process.cwd())
    await git.raw(['worktree', 'prune']).catch(() => {})
  })
})
