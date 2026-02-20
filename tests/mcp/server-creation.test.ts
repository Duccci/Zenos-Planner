import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: function MockMcpServer() {
    this.connect = vi.fn()
    this.close = vi.fn()
    this.tool = vi.fn()
  },
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../../src/integration/function-implementations.js', () => ({
  createFunctionRegistry: vi.fn().mockReturnValue({}),
}))

vi.mock('../../src/mcp/tools/index.js', () => ({
  registerTools: vi.fn().mockReturnValue(Array.from({ length: 5 }, (_, i) => `tool-${i}`)),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import { createMcpServer } from '../../src/mcp/server.js'

describe('MCP Server creation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createMcpServer should build server and register tools', async () => {
    const server = await createMcpServer()
    expect(server).toBeDefined()
    const { logger } = await import('../../src/utils/logger.js')
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Registered 5 MCP tools'))
  })
})
