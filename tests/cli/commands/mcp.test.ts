import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { Command } from 'commander'
import { registerMcpCommands } from '../../../src/cli/commands/mcp.js'

// Track dynamic imports
const mockDiagnostics = {
  formatReport: vi.fn().mockResolvedValue('=== MCP Report ==='),
  getRecentErrors: vi.fn().mockReturnValue([]),
}
const mockCreateFunctionRegistry = vi.fn().mockReturnValue({
  list: vi.fn().mockReturnValue([
    {
      name: 'test_tool',
      description: 'A test tool',
      parameters: [{ name: 'param1' }],
    },
  ]),
})
const mockEnsureWorkspaceMcp = vi.fn()
const mockIsZenoInstalled = vi.fn()
const mockStopServer = vi.fn()

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../../src/mcp/diagnostics.js', () => ({
  diagnostics: mockDiagnostics,
}))

vi.mock('../../../src/integration/function-implementations.js', () => ({
  createFunctionRegistry: (...args: unknown[]) => mockCreateFunctionRegistry(...args),
}))

vi.mock('../../../src/mcp/editor-adapters.js', () => ({
  ensureWorkspaceMcp: (...args: unknown[]) => mockEnsureWorkspaceMcp(...args),
  isZenoInstalled: (...args: unknown[]) => mockIsZenoInstalled(...args),
}))

vi.mock('../../../src/mcp/manager.js', () => ({
  stopServer: (...args: unknown[]) => mockStopServer(...args),
}))

describe('MCP commands action coverage', () => {
  let program: Command
  let exitSpy: MockInstance
  let consoleSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    program = new Command()
    program.exitOverride()
    registerMcpCommands(program)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('diagnostics subcommand', () => {
    it('should run diagnostics', async () => {
      await program.parseAsync(['node', 'test', 'mcp', 'diagnostics'])

      expect(mockDiagnostics.formatReport).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith('=== MCP Report ===')
    })

    it('should handle diagnostics errors', async () => {
      mockDiagnostics.formatReport.mockRejectedValueOnce(new Error('diag failed'))

      await expect(program.parseAsync(['node', 'test', 'mcp', 'diagnostics'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('tools subcommand', () => {
    it('should list tools', async () => {
      await program.parseAsync(['node', 'test', 'mcp', 'tools'])

      expect(consoleSpy).toHaveBeenCalledWith('=== Registered MCP Tools ===')
      expect(consoleSpy).toHaveBeenCalledWith('test_tool: A test tool')
    })

    it('should handle tools listing errors', async () => {
      mockCreateFunctionRegistry.mockImplementationOnce(() => {
        throw new Error('registry failed')
      })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'tools'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('errors subcommand', () => {
    it('should show no recent errors', async () => {
      mockDiagnostics.getRecentErrors.mockReturnValue([])

      await program.parseAsync(['node', 'test', 'mcp', 'errors'])

      expect(consoleSpy).toHaveBeenCalledWith('=== Recent MCP Errors ===')
      expect(consoleSpy).toHaveBeenCalledWith('No recent errors')
    })

    it('should show recent errors with count', async () => {
      mockDiagnostics.getRecentErrors.mockReturnValue([
        {
          timestamp: new Date('2024-01-01'),
          function: 'test_fn',
          error: 'Something broke',
        },
      ])

      await program.parseAsync(['node', 'test', 'mcp', 'errors', '-c', '1'])

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test_fn'))
    })

    it('should fallback to count=10 when --count is not a valid number', async () => {
      mockDiagnostics.getRecentErrors.mockReturnValue([])

      await program.parseAsync(['node', 'test', 'mcp', 'errors', '-c', 'abc'])

      // parseInt('abc', 10) = NaN, || 10 activates → no errors printed
      expect(consoleSpy).toHaveBeenCalledWith('No recent errors')
    })

    it('should handle errors subcommand failure', async () => {
      mockDiagnostics.getRecentErrors.mockImplementation(() => {
        throw new Error('errors failed')
      })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'errors'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('install subcommand', () => {
    it('should install MCP config with written=true', async () => {
      mockIsZenoInstalled.mockReturnValue({ valid: true })
      mockEnsureWorkspaceMcp.mockReturnValue(true)

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install'])).rejects.toThrow()
      // process.exit(0) is called after install
      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(consoleSpy).toHaveBeenCalledWith('[mcp-install] Wrote .vscode/mcp.json to workspace')
    })

    it('should handle already existing config', async () => {
      mockIsZenoInstalled.mockReturnValue({ valid: true })
      mockEnsureWorkspaceMcp.mockReturnValue(false)

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install'])).rejects.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith('[mcp-install] Workspace MCP config already exists')
    })

    it('should handle zeno not installed', async () => {
      mockIsZenoInstalled.mockReturnValue({ valid: false, reason: 'node_modules missing' })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should use Unknown reason when zeno not installed without reason', async () => {
      mockIsZenoInstalled.mockReturnValue({ valid: false })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should dry-run', async () => {
      mockIsZenoInstalled.mockReturnValue({ valid: true })

      await expect(
        program.parseAsync(['node', 'test', 'mcp', 'install', '--dry-run'])
      ).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    it('should handle install errors', async () => {
      mockIsZenoInstalled.mockImplementation(() => {
        throw new Error('install check failed')
      })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('stop subcommand', () => {
    it('should stop running server', async () => {
      mockStopServer.mockReturnValue(true)

      await program.parseAsync(['node', 'test', 'mcp', 'stop'])

      expect(consoleSpy).toHaveBeenCalledWith('[mcp-stop] MCP server stopped')
    })

    it('should report no server running', async () => {
      mockStopServer.mockReturnValue(false)

      await program.parseAsync(['node', 'test', 'mcp', 'stop'])

      expect(consoleSpy).toHaveBeenCalledWith('[mcp-stop] No running MCP server found')
    })

    it('should handle stop errors', async () => {
      mockStopServer.mockImplementation(() => {
        throw new Error('stop failed')
      })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'stop'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})
