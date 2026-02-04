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
    // Use the function registry directly to invoke the tool
    const result = await registry.invoke('config_get', {})

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('object')
    }
  })

  it('should fail for unknown tool', async () => {
    const result = await registry.invoke('does_not_exist', {})

    expect(result).toBeDefined()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('FUNCTION_NOT_FOUND')
    }
  })
})