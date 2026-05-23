/**
 * MCP Server Tests
 *
 * Tests for MCP server startup, tool registration, request handling, and error responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createFunctionRegistry } from '../../src/integration/function-implementations.js'
import { createMcpServer } from '../../src/mcp/server.js'
import { diagnostics } from '../../src/mcp/diagnostics.js'
import { logger } from '../../src/utils/logger.js'
import { createToolHandler } from '../../src/mcp/tool-handlers.js'
import { getWorkspaceRoot, setActiveWorkspaceRoot } from '../../src/utils/config.js'
import { closeDatabase } from '../../src/storage/database.js'

// Mock the transport for testing
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: function MockStdioServerTransport() {
    this.start = vi.fn()
    this.close = vi.fn()
    this.send = vi.fn()
    this.onmessage = null
    this.onerror = null
    this.onclose = null
  },
}))

describe('MCP Server', () => {
  let registry: ReturnType<typeof createFunctionRegistry>

  beforeEach(() => {
    registry = createFunctionRegistry()
    vi.clearAllMocks()
    // Spy on logger.info so we can assert registered tools without depending on
    // the private internals of the MCP SDK implementation
    vi.spyOn(logger, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    setActiveWorkspaceRoot(undefined)
    closeDatabase()
  })

  describe('Server Creation', () => {
    it('should create MCP server with correct configuration', async () => {
      const server = await createMcpServer()

      expect(server).toBeInstanceOf(McpServer)

      // Basic check: server created and registration messages emitted
      const infoCalls =
        (logger.info as unknown as jest.Mock)?.mock?.calls ?? (logger.info as any).mock?.calls ?? []
      const registeredMessages = infoCalls
        .map((c: any) => c[0])
        .filter(
          (m: any) =>
            typeof m === 'string' &&
            (m.startsWith('Registered MCP tool: ') || m.startsWith('Registered MCP handler tool: '))
        )
      expect(registeredMessages.length).toBeGreaterThan(0)
    })

    it('activates the resolved top-level project root for tool defaults', async () => {
      const originalWorkspaceEnv = process.env['ZENO_WORKSPACE']
      delete process.env['ZENO_WORKSPACE']
      const projectRoot = await mkdtemp(join(tmpdir(), 'zeno-mcp-root-'))
      const nestedStart = join(projectRoot, 'src', 'nested')
      const zenoDir = join(projectRoot, 'zeno', '.zeno')

      try {
        await mkdir(nestedStart, { recursive: true })
        await mkdir(zenoDir, { recursive: true })
        await writeFile(join(zenoDir, 'config.json'), JSON.stringify({ projectName: 'Test' }), 'utf-8')

        const server = await createMcpServer(nestedStart)

        expect(getWorkspaceRoot()).toBe(projectRoot.replace(/\\/g, '/'))
        await server.close()
      } finally {
        if (originalWorkspaceEnv === undefined) {
          delete process.env['ZENO_WORKSPACE']
        } else {
          process.env['ZENO_WORKSPACE'] = originalWorkspaceEnv
        }
        setActiveWorkspaceRoot(undefined)
        closeDatabase()
        await rm(projectRoot, { recursive: true, force: true })
      }
    })

    it('should register handler-based tools as MCP tools', async () => {
      await createMcpServer()

      // Derive registered tool names from logger.info calls
      const infoCalls =
        (logger.info as unknown as jest.Mock)?.mock?.calls ??
        (logger.info as any).__mock?.calls ??
        (logger.info as any).mock?.calls ??
        []
      const infoMessages = infoCalls.map((c: any) => c[0]).filter((m: any) => typeof m === 'string')
      // Include both handler and function registration messages
      const registeredMessages = infoMessages.filter(
        (m: string) =>
          m.startsWith('Registered MCP tool: ') || m.startsWith('Registered MCP handler tool: ')
      )
      const toolNames = registeredMessages.map((m: string) =>
        m.replace('Registered MCP tool: ', '').replace('Registered MCP handler tool: ', '')
      )

      expect(toolNames.length).toBeGreaterThanOrEqual(11)
      expect(toolNames).toContain('gates_action')
      expect(toolNames).toContain('reg_action')
      expect(toolNames).toContain('proposal_action')
    })

    it('should have proper tool schemas', async () => {
      await createMcpServer()

      // Check the function definition in the public function registry
      const func = registry.list().find((f) => f.name === 'gates_list')
      expect(func).toBeDefined()
      expect(func?.description).toContain('List all gates')
      expect(func?.schema).toBeDefined()
    })
  })

  describe('Tool Execution', () => {
    it('should execute tools successfully', async () => {
      await createMcpServer()

      // Execute via the function registry (public API)
      const result = await registry.invoke('config_get', {})

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should handle tool execution errors', async () => {
      await createMcpServer()

      // Use the tool handler wrapper to simulate an MCP call with invalid params
      const handler = createToolHandler(registry, 'gates_show')
      const result = await handler({})

      expect(result).toBeDefined()
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('error')
    })
  })

  describe('Diagnostics', () => {
    it('should record errors in diagnostics', async () => {
      await createMcpServer()

      // Execute a failing tool through the MCP wrapper to trigger diagnostics
      const handler = createToolHandler(registry, 'gates_show')
      await handler({})

      // Check diagnostics
      const report = await diagnostics.generateReport(registry)
      expect(report.recentErrors.length).toBeGreaterThan(0)
      expect(report.health.status).toBe('degraded')
    })

    it('should generate diagnostic report', async () => {
      const server = await createMcpServer()
      const report = await diagnostics.generateReport(registry)

      expect(report.health).toBeDefined()
      expect(report.tools).toBeDefined()
      expect(report.config).toBeDefined()
      expect(report.recentErrors).toBeDefined()

      expect(report.tools.length).toBeGreaterThan(12)
      expect(report.health.toolsRegistered).toBeGreaterThan(12)
    })

    it('should format diagnostic report as text', async () => {
      const server = await createMcpServer()
      const formatted = await diagnostics.formatReport(registry)

      expect(formatted).toContain('MCP Server Diagnostics')
      expect(formatted).toContain('Health Status')
      expect(formatted).toContain('Registered Tools')
    })
  })

  describe('Transport Integration', () => {
    it('should create stdio transport', async () => {
      const server = await createMcpServer()
      const transport = new StdioServerTransport()

      expect(transport).toBeDefined()
      expect(transport.start).toBeDefined()
      expect(transport.close).toBeDefined()
    })

    it('should connect server to transport', async () => {
      const server = await createMcpServer()
      const transport = new StdioServerTransport()

      await expect(server.connect(transport)).resolves.toBeUndefined()
    })
  })
})
