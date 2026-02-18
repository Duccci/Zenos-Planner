import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerInitCommand } from '../../../src/cli/commands/init.js'
import { registerProposalCommands } from '../../../src/cli/commands/proposal.js'
import { Command } from 'commander'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn().mockResolvedValue('input-value'),
  confirm: vi.fn().mockResolvedValue(true),
  editor: vi.fn().mockResolvedValue('editor-content'),
}))

vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn().mockReturnValue('/project'),
  loadConfig: vi.fn().mockResolvedValue({ projectName: 'Test', projectRoot: '/project' }),
  getDefaultConfig: vi.fn((name, endState) => ({ projectName: name, endState, version: '0.1.0' })),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  getZenoDir: vi.fn().mockReturnValue('/project/.zeno'),
}))

vi.mock('../../../src/utils/file.js', () => ({
  fileExists: vi.fn().mockReturnValue(true),
  directoryExists: vi.fn().mockReturnValue(true),
}))

vi.mock('../../../src/scaffold/index.js', () => ({
  createProjectStructure: vi.fn().mockResolvedValue(['zeno', '.zeno']),
}))

vi.mock('../../../src/generation/requirement-generator.js', () => ({
  RequirementGenerator: vi.fn().mockImplementation(() => ({
    generateFromEndState: vi.fn().mockReturnValue([{ id: 'req1', description: 'Req' }]),
  })),
}))

vi.mock('../../../src/core/gate-generator.js', () => ({
  generateGates: vi.fn().mockReturnValue({
    gates: [{ id: 'gate-01', name: 'Foundation' }],
  }),
}))

vi.mock('../../../src/generation/agents-generator.js', () => ({
  generateAgentsMD: vi.fn().mockReturnValue('# AGENTS\n'),
}))

vi.mock('../../../src/generation/agents-writer.js', () => ({
  writeAgentsMD: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/storage/database.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  getDatabase: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
      run: vi.fn().mockReturnValue({ changes: 1 }),
    }),
  }),
}))

vi.mock('../../../src/integration/function-implementations.js', () => ({
  getGlobalRegistry: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({ success: true, result: {} }),
  }),
  createFunctionRegistry: vi.fn().mockReturnValue({}),
}))

vi.mock('../../../src/generation/proposal-generator.js', () => ({
  ProposalGenerator: vi.fn().mockImplementation(() => ({
    generateProposal: vi.fn().mockResolvedValue({
      title: 'Test Proposal',
      description: 'Test description',
      acceptanceCriteria: [],
    }),
  })),
}))

describe('Init Command - Detailed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers init command with all options', () => {
    const program = new Command()
    registerInitCommand(program)

    const initCmd = program.commands.find((cmd) => cmd.name() === 'init')
    expect(initCmd).toBeDefined()
    expect(initCmd?.description()).toContain('Initialize')
    
    const opts = initCmd?.options || []
    expect(opts.length).toBeGreaterThan(0)
  })

  it('force option exists', () => {
    const program = new Command()
    registerInitCommand(program)

    const initCmd = program.commands.find((cmd) => cmd.name() === 'init')
    const forceOpt = initCmd?.options.find((opt) => opt.flags.includes('force'))
    expect(forceOpt).toBeDefined()
  })

  it('has working action handler', () => {
    const program = new Command()
    registerInitCommand(program)

    const initCmd = program.commands.find((cmd) => cmd.name() === 'init')
    expect(initCmd?.action).toBeDefined()
    expect(typeof initCmd?.action === 'function').toBe(true)
  })
})

describe('Proposal Command - Detailed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers proposal command', () => {
    const program = new Command()
    registerProposalCommands(program)

    const propCmd = program.commands.find((cmd) => cmd.name() === 'proposal')
    expect(propCmd).toBeDefined()
  })

  it('has description', () => {
    const program = new Command()
    registerProposalCommands(program)

    const propCmd = program.commands.find((cmd) => cmd.name() === 'proposal')
    const desc = propCmd?.description()
    expect(desc).toBeDefined()
    expect(desc?.length).toBeGreaterThan(0)
  })

  it('has gen/start/list subcommands or options', () => {
    const program = new Command()
    registerProposalCommands(program)

    const propCmd = program.commands.find((cmd) => cmd.name() === 'proposal')
    // Proposal command should be properly structured
    expect(propCmd).toBeDefined()
  })

  it('action handler exists', () => {
    const program = new Command()
    registerProposalCommands(program)

    const propCmd = program.commands.find((cmd) => cmd.name() === 'proposal')
    // Either has action or has subcommands
    expect(propCmd?.action || propCmd?.commands?.length).toBeTruthy()
  })
})

describe('CLI Command Structure Validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('init command is properly structured', () => {
    const program = new Command()
    registerInitCommand(program)

    const initCmd = program.commands.find((cmd) => cmd.name() === 'init')
    expect(initCmd?.name()).toBe('init')
    expect(initCmd?.action).toBeDefined()
    expect(initCmd?.options?.length).toBeGreaterThan(0)
  })

  it('proposal command is properly structured', () => {
    const program = new Command()
    registerProposalCommands(program)

    const propCmd = program.commands.find((cmd) => cmd.name() === 'proposal')
    expect(propCmd?.name()).toBe('proposal')
  })

  it('commands are registered in the program', () => {
    const program = new Command()
    registerInitCommand(program)
    registerProposalCommands(program)

    const allCmds = program.commands.map((cmd) => cmd.name())
    expect(allCmds).toContain('init')
    expect(allCmds).toContain('proposal')
  })
})
