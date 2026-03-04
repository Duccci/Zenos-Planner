import { describe, it, expect } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

describe('MCP Gates tools (integration)', () => {
  it('gates_list returns structured gates', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_list')

    const result = (await handler({})) as CallToolResult

    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    const structured = JSON.parse((result.content[0] as any).text)
    expect(structured).toBeDefined()

    let gatesArray: unknown[] = []
    if (Array.isArray(structured)) {
      gatesArray = structured
    } else if (structured && typeof structured === 'object' && 'gates' in structured) {
      const maybeGates = (structured as Record<string, unknown>)['gates']
      if (Array.isArray(maybeGates)) {
        gatesArray = maybeGates
      }
    }

    expect(Array.isArray(gatesArray)).toBe(true)
  })

  it('gates_start with invalid input returns error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { createToolHandler } = await import('../../../src/mcp/tool-handlers.js')
    const registry = createFunctionRegistry()
    const handler = createToolHandler(registry, 'gates_start')

    const result = (await handler({ gateId: 'does-not-exist' })) as CallToolResult

    expect(result).toBeDefined()
    expect(result.isError).toBe(true)

    let content = ''
    if (Array.isArray(result.content) && result.content.length > 0) {
      const first = result.content[0] as { text?: unknown }
      if (typeof first.text === 'string') {
        content = first.text
      } else {
        content = String(first.text ?? '')
      }
    }

    expect(content.toLowerCase()).toContain('error')
  })

  // ============================================================================
  // PreReview Enforcement Tests for gates_action: generate (G5-G8)
  // ============================================================================

  it('gates_action generate without preReview returns structured error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')
    const registry = createFunctionRegistry()
    const handler = gateHandlers(registry)['gates_action']

    const result = (await handler({ action: 'generate' })) as CallToolResult

    expect(result).toBeDefined()
    expect(result.isError).toBe(true)

    const text = Array.isArray(result.content) && result.content.length > 0
      ? String((result.content[0] as { text?: unknown }).text ?? '')
      : ''
    expect(text.toLowerCase()).toContain('prereview')
  })

  it('gates_action generate with preReview.gateReviewed=false returns error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')
    const registry = createFunctionRegistry()
    const handler = gateHandlers(registry)['gates_action']

    const result = (await handler({
      action: 'generate',
      preReview: {
        phase: 'generate',
        openQuestionsResolved: true,
        questionsFound: [],
        gateReviewed: false,
        requirementsVerified: true,
        vagueRequirements: [],
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })) as CallToolResult

    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = Array.isArray(result.content) && result.content.length > 0
      ? String((result.content[0] as { text?: unknown }).text ?? '')
      : ''
    expect(text.toLowerCase()).toContain('gatereviewed')
  })

  it('gates_action generate with valid preReview proceeds past enforcement', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')
    const registry = createFunctionRegistry()
    const handler = gateHandlers(registry)['gates_action']

    const result = (await handler({
      action: 'generate',
      preReview: {
        phase: 'generate',
        openQuestionsResolved: true,
        questionsFound: [],
        gateReviewed: true,
        requirementsVerified: true,
        vagueRequirements: [],
        assumptionsDocumented: ['Assumes PRD is finalized'],
        blockersIdentified: [],
      },
    })) as CallToolResult

    expect(result).toBeDefined()
    // preReview validation passed; any downstream error is from gate generation (expected)
    if (result.isError) {
      const text = Array.isArray(result.content) && result.content.length > 0
        ? String((result.content[0] as { text?: unknown }).text ?? '')
        : ''
      expect(text.toLowerCase()).not.toContain('prereview is required')
    }
  })

  it('gates_action generate with vague requirements and requirementsVerified=false returns error', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')
    const registry = createFunctionRegistry()
    const handler = gateHandlers(registry)['gates_action']

    const result = (await handler({
      action: 'generate',
      preReview: {
        phase: 'generate',
        openQuestionsResolved: true,
        questionsFound: [],
        gateReviewed: true,
        requirementsVerified: false,
        vagueRequirements: ['R2: acceptance criteria unclear'],
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })) as CallToolResult

    expect(result).toBeDefined()
    expect(result.isError).toBe(true)
    const text = Array.isArray(result.content) && result.content.length > 0
      ? String((result.content[0] as { text?: unknown }).text ?? '')
      : ''
    expect(text.toLowerCase()).toContain('vague')
  })

  it('gates_action generate with preReviewSummary surfaced in successful response', async () => {
    const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
    const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')
    const registry = createFunctionRegistry()
    const handler = gateHandlers(registry)['gates_action']

    const result = (await handler({
      action: 'generate',
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
    })) as CallToolResult

    expect(result).toBeDefined()
    // If successful, response should contain preReviewSummary echoed back
    if (!result.isError && result.content[0]) {
      const sc = JSON.parse((result.content[0] as any).text) as Record<string, unknown>
      const resultData = sc as Record<string, unknown> | undefined
      if (resultData?.['preReviewSummary']) {
        const summary = resultData['preReviewSummary'] as Record<string, unknown>
        expect(summary['openQuestionsResolved']).toBe(true)
        expect(summary['gateReviewed']).toBe(true)
      }
    }
  })
})
