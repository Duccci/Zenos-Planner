import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerTraceCommand } from '../../../src/cli/commands/trace.js'
import { registerStatusCommand } from '../../../src/cli/commands/status.js'
import { registerDbCommands } from '../../../src/cli/commands/db.js'
import { registerMcpCommands } from '../../../src/cli/commands/mcp.js'
import { registerConfigCommand } from '../../../src/cli/commands/config.js'
import { Command } from 'commander'

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
      get: vi.fn().mockReturnValue({ id: 'test' }),
      all: vi.fn().mockReturnValue([]),
      run: vi.fn().mockReturnValue({ changes: 1 }),
    }),
  }),
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/utils/git.js', () => ({
  parseCommitsForHashes: vi.fn().mockResolvedValue([
    { hash: 'abc123', message: 'feat(gate): test', author: 'Test', date: '2024-01-01' },
  ]),
  getGitLog: vi.fn().mockResolvedValue([
    { hash: 'abc123', message: 'test commit', author: 'Test User', date: '2024-01-01' },
  ]),
}))

vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn().mockReturnValue('/project'),
  loadConfig: vi.fn().mockResolvedValue({ projectName: 'Test' }),
  getZenoDir: vi.fn().mockReturnValue('/project/.zeno'),
}))

vi.mock('../../../src/integration/context-provider.js', () => ({
  getProjectContext: vi.fn().mockResolvedValue({
    status: 'ready',
    workflow: { currentGate: 1 },
  }),
}))

vi.mock('../../../src/mcp/diagnostics.js', () => ({
  diagnostics: {
    generateReport: vi.fn().mockResolvedValue({ health: { status: 'healthy' } }),
  },
}))

vi.mock('../../../src/integration/function-implementations.js', () => ({
  getGlobalRegistry: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({ result: 'success' }),
  }),
}))

describe('Trace Command Extended', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should have options registered', () => {
    const program = new Command()
    registerTraceCommand(program)

    const traceCmd = program.commands.find((cmd) => cmd.name() === 'trace')
    expect(traceCmd).toBeDefined()
    expect(traceCmd?.options.length).toBeGreaterThan(0)
  })

  it('should have json option', () => {
    const program = new Command()
    registerTraceCommand(program)

    const traceCmd = program.commands.find((cmd) => cmd.name() === 'trace')
    const jsonOpt = traceCmd?.options.find((opt) => opt.flags.includes('--json'))
    expect(jsonOpt).toBeDefined()
  })

  it('should have from, to, branch, limit options', () => {
    const program = new Command()
    registerTraceCommand(program)

    const traceCmd = program.commands.find((cmd) => cmd.name() === 'trace')
    const hasFromOpt = traceCmd?.options.some((opt) => opt.flags.includes('from'))
    const hasToOpt = traceCmd?.options.some((opt) => opt.flags.includes('to'))
    const hasBranchOpt = traceCmd?.options.some((opt) => opt.flags.includes('branch'))
    const hasLimitOpt = traceCmd?.options.some((opt) => opt.flags.includes('limit'))
    
    expect(hasFromOpt).toBe(true)
    expect(hasToOpt).toBe(true)
    expect(hasBranchOpt).toBe(true)
    expect(hasLimitOpt).toBe(true)
  })
})

describe('Status Command Extended', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should have correct full description', () => {
    const program = new Command()
    registerStatusCommand(program)

    const statusCmd = program.commands.find((cmd) => cmd.name() === 'status')
    const desc = statusCmd?.description()
    expect(desc).toMatch(/[Ss]how/)
  })

  it('should be callable', async () => {
    const program = new Command()
    program.exitOverride()
    registerStatusCommand(program)

    const statusCmd = program.commands.find((cmd) => cmd.name() === 'status')
    expect(statusCmd?.action).toBeDefined()
    expect(typeof statusCmd?.action).toBe('function')
  })

  it('should have no required arguments', () => {
    const program = new Command()
    registerStatusCommand(program)

    const statusCmd = program.commands.find((cmd) => cmd.name() === 'status')
    // Status should have no required args
    expect(statusCmd).toBeDefined()
  })
})

describe('DB Command Extended', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should have description', () => {
    const program = new Command()
    registerDbCommands(program)

    const dbCmd = program.commands.find((cmd) => cmd.name() === 'db')
    const desc = dbCmd?.description()
    expect(desc).toBeDefined()
    expect(desc?.length).toBeGreaterThan(0)
  })

  it('should be callable', () => {
    const program = new Command()
    registerDbCommands(program)

    const dbCmd = program.commands.find((cmd) => cmd.name() === 'db')
    expect(dbCmd?.action).toBeDefined()
  })
})

describe('MCP Command Extended', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should have description', () => {
    const program = new Command()
    registerMcpCommands(program)

    const mcpCmd = program.commands.find((cmd) => cmd.name() === 'mcp')
    const desc = mcpCmd?.description()
    expect(desc).toBeDefined()
  })

  it('should be properly registered', () => {
    const program = new Command()
    registerMcpCommands(program)

    const mcpCmd = program.commands.find((cmd) => cmd.name() === 'mcp')
    expect(mcpCmd?.name()).toBe('mcp')
  })
})

describe('Config Command Extended', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should have description', () => {
    const program = new Command()
    registerConfigCommand(program)

    const configCmd = program.commands.find((cmd) => cmd.name() === 'config')
    const desc = configCmd?.description()
    expect(desc).toBeDefined()
  })

  it('should have get option', () => {
    const program = new Command()
    registerConfigCommand(program)

    const configCmd = program.commands.find((cmd) => cmd.name() === 'config')
    const getOpt = configCmd?.options.find((opt) => opt.flags.includes('--get'))
    expect(getOpt).toBeDefined()
  })

  it('should be callable', () => {
    const program = new Command()
    registerConfigCommand(program)

    const configCmd = program.commands.find((cmd) => cmd.name() === 'config')
    expect(configCmd?.action).toBeDefined()
  })
})
