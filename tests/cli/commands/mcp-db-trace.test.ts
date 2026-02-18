import { describe, it, expect, vi } from 'vitest'
import { registerMcpCommands } from '../../../src/cli/commands/mcp.js'
import { registerDbCommands } from '../../../src/cli/commands/db.js'
import { registerTraceCommand } from '../../../src/cli/commands/trace.js'
import { Command } from 'commander'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../../src/mcp/manager.js', () => ({
  createMcpManager: vi.fn().mockResolvedValue({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('../../../src/storage/database.js', () => ({
  getDatabase: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
  }),
}))

vi.mock('../../../src/utils/git.js', () => ({
  parseCommitsForHashes: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('/zeno/.zeno'),
  getProjectRoot: vi.fn().mockReturnValue('/project'),
}))

describe('MCP Command', () => {
  it('should register mcp command', () => {
    const program = new Command()
    registerMcpCommands(program)

    const mcpCmd = program.commands.find((cmd) => cmd.name() === 'mcp')
    expect(mcpCmd).toBeDefined()
  })

  it('should have description', () => {
    const program = new Command()
    registerMcpCommands(program)

    const mcpCmd = program.commands.find((cmd) => cmd.name() === 'mcp')
    expect(mcpCmd?.description()).toBeDefined()
  })

  it('should be introspectable', () => {
    const program = new Command()
    registerMcpCommands(program)

    const mcpCmd = program.commands.find((cmd) => cmd.name() === 'mcp')
    expect(mcpCmd?.name()).toBe('mcp')
  })
})

describe('DB Command', () => {
  it('should register db command', () => {
    const program = new Command()
    registerDbCommands(program)

    const dbCmd = program.commands.find((cmd) => cmd.name() === 'db')
    expect(dbCmd).toBeDefined()
  })

  it('should have description', () => {
    const program = new Command()
    registerDbCommands(program)

    const dbCmd = program.commands.find((cmd) => cmd.name() === 'db')
    expect(dbCmd?.description()).toBeDefined()
  })

  it('should be introspectable', () => {
    const program = new Command()
    registerDbCommands(program)

    const dbCmd = program.commands.find((cmd) => cmd.name() === 'db')
    expect(dbCmd?.name()).toBe('db')
  })
})

describe('Trace Command', () => {
  it('should register trace command', () => {
    const program = new Command()
    registerTraceCommand(program)

    const traceCmd = program.commands.find((cmd) => cmd.name() === 'trace')
    expect(traceCmd).toBeDefined()
  })

  it('should have description', () => {
    const program = new Command()
    registerTraceCommand(program)

    const traceCmd = program.commands.find((cmd) => cmd.name() === 'trace')
    expect(traceCmd?.description()).toBeDefined()
  })

  it('should be introspectable', () => {
    const program = new Command()
    registerTraceCommand(program)

    const traceCmd = program.commands.find((cmd) => cmd.name() === 'trace')
    expect(traceCmd?.name()).toBe('trace')
  })

  it('should have action handler', () => {
    const program = new Command()
    registerTraceCommand(program)

    const traceCmd = program.commands.find((cmd) => cmd.name() === 'trace')
    expect(traceCmd?.action).toBeDefined()
  })
})
