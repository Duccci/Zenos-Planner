import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { Command } from 'commander'

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

vi.mock('../../../src/utils/logger.js', () => ({
  logger: mockLogger,
}))

vi.mock('../../../src/scaffold/index.js', () => ({
  createProjectStructure: vi.fn().mockResolvedValue(['/a', '/b', '/c']),
}))

vi.mock('../../../src/generation/requirement-generator.js', () => ({
  RequirementGenerator: vi.fn().mockImplementation(() => ({
    generateFromEndState: vi.fn().mockReturnValue([
      { id: 'r1', description: 'requirement 1' },
    ]),
  })),
}))

vi.mock('../../../src/core/gate-generator.js', () => ({
  generateGates: vi.fn().mockReturnValue({
    gates: [{ id: 'gate-01', name: 'Foundation' }],
    totalComplexity: 10,
  }),
}))

vi.mock('../../../src/generation/agents-writer.js', () => ({
  writeAgentsMD: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/generation/agents-generator.js', () => ({
  generateAgentsMD: vi.fn().mockReturnValue('# AGENTS\n\nGenerated content'),
}))

vi.mock('../../../src/utils/file.js', () => ({
  directoryExists: vi.fn().mockReturnValue(true),
}))

vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn().mockReturnValue(null),
  loadConfig: vi.fn().mockResolvedValue({ projectName: 'Test' }),
  getDefaultConfig: vi.fn().mockReturnValue({ projectName: 'Test' }),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/storage/database.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
}))

// Mock inquirer prompts
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn().mockResolvedValue('TestProject'),
  confirm: vi.fn().mockResolvedValue(true),
  editor: vi.fn().mockResolvedValue('Build a complete app with auth and API'),
}))

describe('init command coverage', () => {
  let exitSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
  })

  it('should run full init workflow', async () => {
    const { registerInitCommand } = await import('../../../src/cli/commands/init.js')
    const { confirm } = await import('@inquirer/prompts')
    vi.mocked(confirm)
      .mockResolvedValueOnce(false)  // hasExistingCodebase
      .mockResolvedValueOnce(true)   // confirmed

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'test', 'init'])

    expect(mockLogger.info).toHaveBeenCalledWith('Project initialized successfully!')
  })

  it('should skip init with existing project and no force', async () => {
    const { registerInitCommand } = await import('../../../src/cli/commands/init.js')
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValue('/existing')

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'test', 'init'])

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Project already initialized')
    )
  })

  it('should force reinitialize with --force', async () => {
    const { registerInitCommand } = await import('../../../src/cli/commands/init.js')
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValue('/existing')

    const { confirm } = await import('@inquirer/prompts')
    vi.mocked(confirm)
      .mockResolvedValueOnce(false)  // hasExistingCodebase
      .mockResolvedValueOnce(true)   // confirmed

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'test', 'init', '--force'])

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Forcing reinitialization')
    )
  })

  it('should handle cancelled init', async () => {
    const { registerInitCommand } = await import('../../../src/cli/commands/init.js')
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValue(null)

    const { confirm } = await import('@inquirer/prompts')
    vi.mocked(confirm)
      .mockResolvedValueOnce(false)  // hasExistingCodebase
      .mockResolvedValueOnce(false)  // NOT confirmed

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'test', 'init'])

    expect(mockLogger.info).toHaveBeenCalledWith('Initialization cancelled')
  })

  it('should handle ExitPromptError (user cancelled prompts)', async () => {
    const { registerInitCommand } = await import('../../../src/cli/commands/init.js')
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValue(null)

    const { input } = await import('@inquirer/prompts')
    const exitError = new Error('User cancelled')
    exitError.name = 'ExitPromptError'
    vi.mocked(input).mockRejectedValueOnce(exitError)

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'test', 'init'])

    expect(mockLogger.info).toHaveBeenCalledWith('Initialization cancelled')
  })

  it('should handle unexpected errors', async () => {
    const { registerInitCommand } = await import('../../../src/cli/commands/init.js')
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValue(null)

    const { input } = await import('@inquirer/prompts')
    vi.mocked(input).mockRejectedValueOnce(new Error('Unexpected failure'))

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await expect(
      program.parseAsync(['node', 'test', 'init'])
    ).rejects.toThrow()

    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should handle existing codebase path', async () => {
    const { registerInitCommand } = await import('../../../src/cli/commands/init.js')
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValue(null)

    const { confirm, input } = await import('@inquirer/prompts')
    vi.mocked(input)
      .mockResolvedValueOnce('TestProject')  // project name
      .mockResolvedValueOnce('/path/to/code') // codebase path

    vi.mocked(confirm)
      .mockResolvedValueOnce(true)  // hasExistingCodebase
      .mockResolvedValueOnce(true)  // confirmed

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'test', 'init'])

    expect(mockLogger.info).toHaveBeenCalledWith('Codebase path: /path/to/code')
  })

  it('should handle failed config load on existing project', async () => {
    const { registerInitCommand } = await import('../../../src/cli/commands/init.js')
    const { findProjectRoot, loadConfig } = await import('../../../src/utils/config.js')
    vi.mocked(findProjectRoot).mockReturnValue('/existing')
    vi.mocked(loadConfig).mockRejectedValueOnce(new Error('corrupt config'))

    const { confirm } = await import('@inquirer/prompts')
    vi.mocked(confirm)
      .mockResolvedValueOnce(false)  // hasExistingCodebase
      .mockResolvedValueOnce(true)   // confirmed

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'test', 'init'])

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Could not load existing configuration, proceeding with fresh initialization'
    )
  })
})
