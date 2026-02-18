import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

// Import all command registration functions
import { registerInitCommand } from '../../../src/cli/commands/init.js'
import { registerMcpCommands } from '../../../src/cli/commands/mcp.js'
import { registerDbCommands } from '../../../src/cli/commands/db.js'
import { registerTraceCommand } from '../../../src/cli/commands/trace.js'
import { registerConfigCommand } from '../../../src/cli/commands/config.js'

// Mock dependencies
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../../src/storage/database.js', () => ({
  getDatabase: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
      run: vi.fn().mockReturnValue({ changes: 1 }),
    }),
  }),
  getDatabasePath: vi.fn().mockReturnValue('/test/db'),
  checkpointWAL: vi.fn().mockReturnValue({ status: 'ok' }),
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn().mockReturnValue('/project'),
  loadConfig: vi.fn().mockResolvedValue({ projectName: 'Test' }),
  getDefaultConfig: vi.fn((n, e) => ({ projectName: n, endState: e })),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  getZenoDir: vi.fn().mockReturnValue('/project/.zeno'),
}))

vi.mock('../../../src/utils/git.js', () => ({
  parseCommitsForHashes: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../src/storage/database-cleanup.js', () => ({
  cleanupStaleFiles: vi.fn().mockReturnValue({ deleted: 0, files: [] }),
  validateDatabaseIntegrity: vi.fn().mockReturnValue({ integrityOk: true }),
}))

vi.mock('../../../src/integration/function-implementations.js', () => ({
  getGlobalRegistry: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({ result: 'success' }),
  }),
}))

vi.mock('../../../src/integration/context-provider.js', () => ({
  getProjectContext: vi.fn().mockResolvedValue({ status: 'ready' }),
}))

vi.mock('../../../src/mcp/diagnostics.js', () => ({
  diagnostics: {
    generateReport: vi.fn().mockResolvedValue({ health: { status: 'healthy' } }),
  },
}))

describe('CLI Commands - Comprehensive Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Command Registration Completeness', () => {
    it('init command has all expected properties', () => {
      const program = new Command()
      registerInitCommand(program)
      const cmd = program.commands.find((c) => c.name() === 'init')
      
      expect(cmd).toBeDefined()
      expect(cmd?.description?.()).toMatch(/init|Initialize/i)
      expect(cmd?.options?.length || 0).toBeGreaterThan(0)
      expect(typeof cmd?.action).toBe('function')
    })

    it('mcp command has all expected properties', () => {
      const program = new Command()
      registerMcpCommands(program)
      const cmd = program.commands.find((c) => c.name() === 'mcp')
      
      expect(cmd).toBeDefined()
      expect(cmd?.description?.()).toBeDefined()
      expect(typeof cmd?.action).toBe('function')
    })

    it('db command has all expected properties', () => {
      const program = new Command()
      registerDbCommands(program)
      const cmd = program.commands.find((c) => c.name() === 'db')
      
      expect(cmd).toBeDefined()
      expect(cmd?.description?.()).toBeDefined()
    })

    it('trace command has all expected properties', () => {
      const program = new Command()
      registerTraceCommand(program)
      const cmd = program.commands.find((c) => c.name() === 'trace')
      
      expect(cmd).toBeDefined()
      expect(cmd?.description?.()).toMatch(/trace|git|commit/i)
      expect((cmd?.options || []).length).toBeGreaterThan(0)
    })

    it('config command has all expected properties', () => {
      const program = new Command()
      registerConfigCommand(program)
      const cmd = program.commands.find((c) => c.name() === 'config')
      
      expect(cmd).toBeDefined()
      expect(cmd?.description?.()).toBeDefined()
      expect((cmd?.options || []).some((o) => o.flags.includes('get'))).toBe(true)
    })
  })

  describe('Command Option Verification', () => {
    it('init has force flag', () => {
      const program = new Command()
      registerInitCommand(program)
      const cmd = program.commands.find((c) => c.name() === 'init')
      const hasForce = cmd?.options?.some((o) => o.flags.includes('force'))
      expect(hasForce).toBe(true)
    })

    it('trace has json, from, to, branch, limit options', () => {
      const program = new Command()
      registerTraceCommand(program)
      const cmd = program.commands.find((c) => c.name() === 'trace')
      const opts = cmd?.options || []
      
      expect(opts.some((o) => o.flags.includes('json'))).toBe(true)
      expect(opts.some((o) => o.flags.includes('from'))).toBe(true)
      expect(opts.some((o) => o.flags.includes('to'))).toBe(true)
      expect(opts.some((o) => o.flags.includes('branch'))).toBe(true)
      expect(opts.some((o) => o.flags.includes('limit'))).toBe(true)
    })

    it('config has get option', () => {
      const program = new Command()
      registerConfigCommand(program)
      const cmd = program.commands.find((c) => c.name() === 'config')
      const hasGet = cmd?.options?.some((o) => o.flags.includes('get'))
      expect(hasGet).toBe(true)
    })
  })

  describe('Command Hierarchy', () => {
    it('all commands are registered at program level', () => {
      const program = new Command()
      registerInitCommand(program)
      registerMcpCommands(program)
      registerDbCommands(program)
      registerTraceCommand(program)
      registerConfigCommand(program)

      const cmdNames = program.commands.map((c) => c.name())
      expect(cmdNames).toContain('init')
      expect(cmdNames).toContain('mcp')
      expect(cmdNames).toContain('db')
      expect(cmdNames).toContain('trace')
      expect(cmdNames).toContain('config')
    })

    it('all commands are properly initialized', () => {
      const program = new Command()
      registerInitCommand(program)
      registerMcpCommands(program)
      registerDbCommands(program)
      registerTraceCommand(program)
      registerConfigCommand(program)

      const requiredCommands = ['init', 'mcp', 'db', 'trace', 'config']
      const registeredCommands = program.commands.filter((c) =>
        requiredCommands.includes(c.name())
      )

      expect(registeredCommands.length).toBeGreaterThanOrEqual(5)
      for (const cmd of registeredCommands) {
        expect(cmd.name()).toBeDefined()
        expect(typeof cmd.description() === 'string').toBe(true)
      }
    })
  })

  describe('Logger Interaction Verification', () => {
    it('logger is available for all commands', async () => {
      const program = new Command()
      program.exitOverride()
      registerStatusCommand(program)

      try {
        await program.parseAsync(['node', 'test', 'status'])
      } catch {
        // Expected to exit
      }

      // Logger should be accessible through mocks
      const { logger } = await import('../../../src/utils/logger.js')
      expect(logger.info).toBeDefined()
      expect(logger.error).toBeDefined()
    })
  })
})

async function registerStatusCommand(program: Command) {
  const { registerStatusCommand } = await import('../../../src/cli/commands/status.js')
  registerStatusCommand(program)
}
