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
const mockInstallMcpConfig = vi.fn()
const mockStopServer = vi.fn()
const mockLoadConfig = vi.fn()
const mockSaveConfig = vi.fn()
const mockFindProjectRoot = vi.fn()
const mockGetWorkspaceRoot = vi.fn().mockReturnValue(process.cwd())

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
  installMcpConfig: (...args: unknown[]) => mockInstallMcpConfig(...args),
}))

vi.mock('../../../src/mcp/manager.js', () => ({
  stopServer: (...args: unknown[]) => mockStopServer(...args),
}))

vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: (...args: unknown[]) => mockFindProjectRoot(...args),
  getWorkspaceRoot: (...args: unknown[]) => mockGetWorkspaceRoot(...args),
  resolveCliProjectRoot: (...args: unknown[]) => mockFindProjectRoot(...args),
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  saveConfig: (...args: unknown[]) => mockSaveConfig(...args),
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
    // Default: config load fails (no project initialised) — CLI falls back gracefully
    mockLoadConfig.mockRejectedValue(new Error('config not found'))
    mockFindProjectRoot.mockReturnValue(process.cwd())
    mockGetWorkspaceRoot.mockReturnValue(process.cwd())
    mockSaveConfig.mockResolvedValue(undefined)
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
      mockInstallMcpConfig.mockResolvedValue({
        target: 'mcp-json',
        targetPath: '.vscode/mcp.json',
        serverName: 'zeno-planner',
        written: true,
      })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install'])).rejects.toThrow()
      // process.exit(0) is called after install
      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Wrote MCP entry 'zeno-planner'")
      )
    })

    it('should install MCP config globally when requested', async () => {
      mockInstallMcpConfig.mockResolvedValue({
        target: 'user-mcp-json',
        targetPath: 'C:/Users/Owner/AppData/Roaming/Code/User/mcp.json',
        serverName: 'zeno-planner',
        written: true,
      })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install', '--global'])).rejects.toThrow()
      expect(mockInstallMcpConfig).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ scope: 'user' })
      )
      expect(consoleSpy).toHaveBeenCalledWith('[mcp-install] Global MCP config installed.')
    })

    it('should handle already existing config', async () => {
      mockInstallMcpConfig.mockResolvedValue({
        target: 'mcp-json',
        targetPath: '.vscode/mcp.json',
        serverName: 'zeno-planner',
        written: false,
      })

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install'])).rejects.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already up to date')
      )
    })

    it('should dry-run', async () => {
      mockInstallMcpConfig.mockResolvedValue({
        target: 'mcp-json',
        targetPath: '.vscode/mcp.json',
        serverName: 'zeno-planner',
        written: false,
      })

      await expect(
        program.parseAsync(['node', 'test', 'mcp', 'install', '--dry-run'])
      ).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(consoleSpy).toHaveBeenCalledWith('Dry run: no files modified.')
    })

    it('should handle install errors', async () => {
      mockInstallMcpConfig.mockRejectedValue(new Error('install failed'))

      await expect(program.parseAsync(['node', 'test', 'mcp', 'install'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should persist server name to config when changed', async () => {
      mockInstallMcpConfig.mockResolvedValue({
        target: 'mcp-json',
        targetPath: '.vscode/mcp.json',
        serverName: 'custom-name',
        written: true,
      })
      mockLoadConfig.mockResolvedValue({ zenoServerName: 'zeno-planner' })

      await expect(
        program.parseAsync(['node', 'test', 'mcp', 'install', '--server-name', 'custom-name'])
      ).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(mockSaveConfig).toHaveBeenCalled()
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
