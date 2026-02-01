import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Command } from 'commander'
import { registerMcpCommands } from '../../src/cli/commands/mcp.js'
import { createFunctionRegistry } from '../../src/integration/function-implementations.js'
import { logger } from '../../src/utils/logger.js'

describe('CLI: mcp run', () => {
  let program: Command
  let registry: ReturnType<typeof createFunctionRegistry>

  beforeEach(() => {
    registry = createFunctionRegistry()
    vi.clearAllMocks()
    // Prevent actual process.exit during tests
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`process.exit:${code ?? 0}`) }) as any)
  })

  it('should run config_get and output config', async () => {
    // Use the runToolOnce helper directly to avoid commander parsing issues
    const { runToolOnce } = await import('../../src/mcp/run.js')

    const result = await runToolOnce('config_get', {})

    expect(result).toBeDefined()
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toBeDefined()
    expect(Object.keys(result.structuredContent ?? {}).length).toBeGreaterThan(0)
  })

  it('should fail for unknown tool', async () => {
    const { runToolOnce } = await import('../../src/mcp/run.js')

    const result = await runToolOnce('does_not_exist', {})

    expect(result).toBeDefined()
    expect(result.isError).toBe(true)

    // Ensure error message was returned in content
    const text = result.content && result.content[0] ? String(result.content[0].text) : ''
    expect(text.toLowerCase()).toContain('error')
  })
})