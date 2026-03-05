import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FunctionRegistry } from '../../../src/integration/function-registry.js'
import { gitTraceHandlers } from '../../../src/mcp/tools/git-trace-tools.js'

describe('MCP Git Trace tools', () => {
  let mockRegistry: FunctionRegistry

  beforeEach(() => {
    mockRegistry = {
      invoke: vi.fn(),
    } as unknown as FunctionRegistry
  })

  it('git_trace validates artifactHash is required', async () => {
    const handlers = gitTraceHandlers(mockRegistry)

    const result = await handlers.git_trace({})

    expect(result.isError).toBe(true)
    const text = result.content?.[0] && 'text' in result.content[0] ? (result.content[0] as any).text : ''
    expect(text).toContain('error')
  })

  it('git_trace calls registry with artifact hash', async () => {
    const handlers = gitTraceHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: true,
      data: {
        commits: [],
        totalCommits: 0,
        searchParams: {
          artifactHash: '#abc123',
        },
      },
    })

    const result = await handlers.git_trace({ artifactHash: '#abc123' })

    expect(mockRegistry.invoke).toHaveBeenCalledWith('git_trace', { artifactHash: '#abc123' })
    expect(result.isError).toBeFalsy()
  })

  it('git_trace handles registry error', async () => {
    const handlers = gitTraceHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: false,
      error: { message: 'Failed to access git repository' },
    })

    const result = await handlers.git_trace({ artifactHash: '#abc123' })

    expect(result.isError).toBe(true)
  })

  it('git_trace handles thrown validation errors', async () => {
    const handlers = gitTraceHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockRejectedValue(new Error('Validation failed'))

    const result = await handlers.git_trace({ artifactHash: '#abc123' })

    expect(result.isError).toBe(true)
    const content = result.structuredContent as any
    expect((content.error?.message as string) || '').toContain('Validation failed')
  })

  it('git_trace handles registry invocation errors', async () => {
    const handlers = gitTraceHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockRejectedValue(new Error('Repository not found'))

    const result = await handlers.git_trace({ artifactHash: '#test' })

    expect(result.isError).toBe(true)
  })

  it('git_trace handles non-Error throw', async () => {
    const handlers = gitTraceHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockRejectedValue('Unknown error')

    const result = await handlers.git_trace({ artifactHash: '#test' })

    expect(result.isError).toBe(true)
  })

  it('git_trace passes through all valid input properties', async () => {
    const handlers = gitTraceHandlers(mockRegistry)
    ;(mockRegistry.invoke as any).mockResolvedValue({
      success: true,
      data: {
        commits: [],
        totalCommits: 0,
        searchParams: {
          artifactHash: '#abc123',
          branch: 'develop',
          limit: 50,
          dir: '/repo',
        },
      },
    })

    // Test with all optional parameters
    const allParams = {
      artifactHash: '#abc123',
      branch: 'develop',
      limit: 50,
      dir: '/repo',
    }

    const result = await handlers.git_trace(allParams)

    expect(mockRegistry.invoke).toHaveBeenCalledWith('git_trace', allParams)
    expect(result.isError).toBeFalsy()
  })
})
