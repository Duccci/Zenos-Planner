import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createToolHandler } from '../../src/mcp/tool-handlers.js'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { logger } from '../../src/utils/logger.js'

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../src/mcp/diagnostics.js', () => ({
  diagnostics: {
    recordError: vi.fn(),
  },
}))

describe('MCP Error Logging', () => {
  let mockRegistry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    mockRegistry = {
      invoke: vi.fn(),
    } as any
  })

  it('logs tool invocations in debug mode', async () => {
    mockRegistry.invoke.mockResolvedValue({
      success: true,
      data: { result: 'success' },
    })

    const handler = createToolHandler(mockRegistry, 'test_tool')
    await handler({ param1: 'value1' })

    expect(logger.debug).toHaveBeenCalledWith('Executing tool: test_tool', { args: { param1: 'value1' } })
    expect(logger.debug).toHaveBeenCalledWith('Tool execution successful: test_tool')
  })

  it('logs tool execution failures', async () => {
    mockRegistry.invoke.mockResolvedValue({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        context: { field: 'param1' },
      },
    })

    const handler = createToolHandler(mockRegistry, 'test_tool')
    await handler({ param1: 'invalid' })

    expect(logger.warn).toHaveBeenCalledWith('Tool execution failed: test_tool', {
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        context: { field: 'param1' },
      },
    })
  })

  it('logs exceptions with full context', async () => {
    const testError = new Error('Database connection failed')
    testError.stack = 'Error: Database connection failed\n    at testFunction'

    mockRegistry.invoke.mockRejectedValue(testError)

    const handler = createToolHandler(mockRegistry, 'test_tool')
    await handler({ param1: 'value1' })

    expect(logger.error).toHaveBeenCalledWith('MCP Error: NETWORK_ERROR', expect.objectContaining({
      message: 'Database connection failed',
      context: {
        function: 'test_tool',
        args: ['param1'],
      },
      originalError: expect.objectContaining({
        name: 'Error',
        stack: testError.stack,
      }),
    }))
  })

  it('records errors in diagnostics', async () => {
    const { diagnostics } = await import('../../src/mcp/diagnostics.js')

    mockRegistry.invoke.mockRejectedValue(new Error('Test error'))

    const handler = createToolHandler(mockRegistry, 'test_tool')
    await handler({ param1: 'value1' })

    expect(diagnostics.recordError).toHaveBeenCalledWith('test_tool', 'Test error')
  })
})