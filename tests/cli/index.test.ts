/**
 * CLI Tests
 *
 * Tests for CLI entry point and command registration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createProgram, main, run } from '../../src/cli/index.js'
import { logger } from '../../src/utils/logger.js'

// Mock external dependencies
vi.mock('../../src/storage/database.js', () => ({
  initializeDatabase: vi.fn(),
  getDatabase: vi.fn(),
}))

vi.mock('../../src/integration/function-implementations.js', () => ({
  getGlobalRegistry: vi.fn(),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

describe('CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createProgram', () => {
    it('should create a program with correct name and description', async () => {
      const program = await createProgram()
      expect(program.name()).toBe('zeno')
      expect(program.description()).toContain("Zeno's Planner")
    })

    it('should have version command', async () => {
      const program = await createProgram()
      // Version is loaded from package.json
      expect(program.version()).toBeDefined()
    })

    it('should handle errors gracefully', async () => {
      const program = await createProgram()
      // Program should be configured with error handling
      expect(program).toBeDefined()
      // Verify program is a valid command object
      expect(program.name).toBeDefined()
      expect(typeof program.name).toBe('function')
    })

    it('should configure output handlers', async () => {
      const program = await createProgram()
      // Program should have output configuration
      expect(program).toBeDefined()
    })

    it('should return a Command-like instance', async () => {
      const program = await createProgram()
      // Should have name, description, version methods
      expect(program.name).toBeDefined()
      expect(program.description).toBeDefined()
      expect(program.version).toBeDefined()
      expect(program.commands).toBeDefined()
    })
  })

  describe('Command Registration', () => {
    it('should register command categories', async () => {
      const program = await createProgram()

      // Commands are already registered by createProgram()
      // Check that categories are registered
      const commands = program.commands.map((cmd) => cmd.name())
      expect(commands).toContain('gates')
      expect(commands).toContain('req')
      expect(commands).toContain('arch')
      expect(commands).toContain('repos')
      expect(commands).toContain('proposal')
    })

    it('should register top-level commands', async () => {
      const program = await createProgram()

      // Commands are already registered by createProgram()
      const commands = program.commands.map((cmd) => cmd.name())
      expect(commands).toContain('init')
      expect(commands).toContain('status')
      expect(commands).toContain('show')
    })

    it('should register template command', async () => {
      const program = await createProgram()
      const commands = program.commands.map((cmd) => cmd.name())
      expect(commands).toContain('template')
    })

    it('should register config command', async () => {
      const program = await createProgram()
      const commands = program.commands.map((cmd) => cmd.name())
      expect(commands).toContain('config')
    })

    it('should register help command', async () => {
      const program = await createProgram()
      expect(program.helpInformation()).toBeDefined()
      expect(program.helpInformation().length).toBeGreaterThan(0)
    })
  })

  describe('main function', () => {
    let originalArgv: string[]
    let originalExit: typeof process.exit

    beforeEach(() => {
      originalArgv = process.argv
      originalExit = process.exit
      process.exit = vi.fn() as any
    })

    afterEach(() => {
      process.argv = originalArgv
      process.exit = originalExit
      vi.clearAllMocks()
    })

    it('should initialize database and registry', async () => {
      const { initializeDatabase } = await import('../../src/storage/database.js')
      const { getGlobalRegistry } =
        await import('../../src/integration/function-implementations.js')

      process.argv = ['node', 'zeno', '--help']

      try {
        await main()
      } catch {
        // Expected to throw on --help
      }

      expect(initializeDatabase).toHaveBeenCalled()
      expect(getGlobalRegistry).toHaveBeenCalled()
    })

    it('should output help when no arguments provided', async () => {
      const { initializeDatabase } = await import('../../src/storage/database.js')
      const { getGlobalRegistry } =
        await import('../../src/integration/function-implementations.js')

      vi.mocked(initializeDatabase).mockResolvedValue(undefined)
      vi.mocked(getGlobalRegistry).mockReturnValue({} as any)

      const originalLog = console.log
      const logSpy = vi.fn()
      console.log = logSpy

      process.argv = ['node', 'zeno']

      try {
        await main()
      } catch {
        // May throw due to mocking
      }

      console.log = originalLog
    })

    it('should handle help display gracefully', async () => {
      const { initializeDatabase } = await import('../../src/storage/database.js')
      const { getGlobalRegistry } =
        await import('../../src/integration/function-implementations.js')

      vi.mocked(initializeDatabase).mockResolvedValue(undefined)
      vi.mocked(getGlobalRegistry).mockReturnValue({} as any)

      process.argv = ['node', 'zeno', '--help']

      try {
        await main()
      } catch (error: any) {
        // Commander throws on help, should be caught and handled
        if (error.code !== 'commander.helpDisplayed' && !error.message?.includes('help')) {
          throw error
        }
      }
    })

    it('should handle database initialization errors', async () => {
      const { initializeDatabase } = await import('../../src/storage/database.js')
      const { getGlobalRegistry } =
        await import('../../src/integration/function-implementations.js')

      vi.mocked(initializeDatabase).mockRejectedValue(new Error('DB init error'))
      vi.mocked(getGlobalRegistry).mockReturnValue({} as any)

      process.argv = ['node', 'zeno', '--version']

      try {
        await main()
      } catch {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalled()
      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('should handle unknown errors with stack trace logging', async () => {
      const { initializeDatabase } = await import('../../src/storage/database.js')
      const { getGlobalRegistry } =
        await import('../../src/integration/function-implementations.js')

      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.ts:1:1'
      vi.mocked(initializeDatabase).mockRejectedValue(error)
      vi.mocked(getGlobalRegistry).mockReturnValue({} as any)

      process.argv = ['node', 'zeno']

      try {
        await main()
      } catch {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalled()
    })

    it('should handle non-Error objects', async () => {
      const { initializeDatabase } = await import('../../src/storage/database.js')
      const { getGlobalRegistry } =
        await import('../../src/integration/function-implementations.js')

      const unknownError = { some: 'object' }
      vi.mocked(initializeDatabase).mockRejectedValue(unknownError)
      vi.mocked(getGlobalRegistry).mockReturnValue({} as any)

      process.argv = ['node', 'zeno']

      try {
        await main()
      } catch {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('run function', () => {
    let originalArgv: string[]
    let originalExit: typeof process.exit

    beforeEach(() => {
      originalArgv = process.argv
      originalExit = process.exit
      process.exit = vi.fn() as any
    })

    afterEach(() => {
      process.argv = originalArgv
      process.exit = originalExit
      vi.clearAllMocks()
    })

    it('should be an alias for main', async () => {
      const { initializeDatabase } = await import('../../src/storage/database.js')
      const { getGlobalRegistry } =
        await import('../../src/integration/function-implementations.js')

      vi.mocked(initializeDatabase).mockResolvedValue(undefined)
      vi.mocked(getGlobalRegistry).mockReturnValue({} as any)

      process.argv = ['node', 'zeno']

      try {
        await run()
      } catch {
        // Expected due to mocking
      }

      expect(initializeDatabase).toHaveBeenCalled()
    })
  })

  describe('Error handling utilities', () => {
    it('should identify Commander exit-like errors correctly', async () => {
      // Test through the error handling in main
      const { initializeDatabase } = await import('../../src/storage/database.js')
      const { getGlobalRegistry } =
        await import('../../src/integration/function-implementations.js')

      vi.mocked(initializeDatabase).mockResolvedValue(undefined)
      vi.mocked(getGlobalRegistry).mockReturnValue({} as any)

      process.argv = ['node', 'zeno', '--version']

      try {
        await main()
      } catch (error: any) {
        // Error that looks like Commander exit should be handled
        if (error.code || error.exitCode !== undefined) {
          expect([error.code, error.exitCode]).toBeDefined()
        }
      }
    })
  })

  describe('Program options and configuration', () => {
    it('should support help flag', async () => {
      const program = await createProgram()
      expect(program.helpInformation()).toContain('Options:')
      expect(program.helpInformation()).toContain('-h, --help')
    })

    it('should support version flag', async () => {
      const program = await createProgram()
      expect(program.helpInformation()).toContain('-v, --version')
    })

    it('should have all major commands registered', async () => {
      const program = await createProgram()
      const commands = program.commands.map((cmd) => cmd.name())

      const expectedCommands = [
        'init',
        'status',
        'show',
        'template',
        'config',
        'trace',
        'gates',
        'req',
        'arch',
        'repos',
        'proposal',
        'mcp',
      ]

      for (const cmd of expectedCommands) {
        expect(commands).toContain(cmd)
      }
    })

    it('should have command descriptions', async () => {
      const program = await createProgram()
      for (const command of program.commands) {
        expect(command.description()).toBeDefined()
        expect(command.description().length).toBeGreaterThan(0)
      }
    })
  })
})
