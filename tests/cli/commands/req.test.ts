/**
 * Requirements Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerReqCommands } from '../../../src/cli/commands/req.js'
import { Command } from 'commander'
import type { FunctionRegistry } from '../../../src/integration/function-registry.js'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../../../src/integration/function-implementations.js', () => ({
  getGlobalRegistry: vi.fn(),
}))

describe('Requirements Commands', () => {
  let logger: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/utils/logger.js')
    logger = mod.logger
  })

  it('should register req command with subcommands', () => {
    const program = new Command()
    registerReqCommands(program)

    const reqCmd = program.commands.find(cmd => cmd.name() === 'req')
    expect(reqCmd).toBeDefined()

    const subcommands = reqCmd!.commands.map(cmd => cmd.name())
    expect(subcommands).toContain('list')
    expect(subcommands).toContain('show')
    expect(subcommands).toContain('deps')
    expect(subcommands).toContain('transfer')
  })

  it('req list should call registry with gate filter and display results', async () => {
    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue({ success: true, output: { requirements: [{ hash: 'r#1', type: 'functional', title: 'Req One', gateId: 'gate-01' }] } }),
      register: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      getByCategory: vi.fn()
    }
    const mod = await import('../../../src/integration/function-implementations.js')
    vi.mocked(mod.getGlobalRegistry).mockReturnValue(registry as FunctionRegistry)

    const program = new Command()
    program.exitOverride()
    registerReqCommands(program)

    await program.parseAsync(['node', 'test', 'req', 'list', '--gate', 'gate-01'])

    expect(registry.invoke).toHaveBeenCalledWith('req_list', { gateId: 'gate-01' })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Requirements'))
  })

  it('req list --project should filter to project-level requirements', async () => {
    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue({ success: true, output: { requirements: [ { hash: 'r#proj', title: 'Project Req', gateId: '' }, { hash: 'r#g', title: 'Gate Req', gateId: 'gate-01' } ] } }),
      register: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      getByCategory: vi.fn()
    }
    const mod = await import('../../../src/integration/function-implementations.js')
    vi.mocked(mod.getGlobalRegistry).mockReturnValue(registry as FunctionRegistry)

    const program = new Command()
    program.exitOverride()
    registerReqCommands(program)

    await program.parseAsync(['node', 'test', 'req', 'list', '--project'])

    // should call req_list with no gateId
    expect(registry.invoke).toHaveBeenCalledWith('req_list', {})
    // should show project requirement
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Project Req'))
  })

  it('req show should display details including parent and children', async () => {
    const mockOut = {
      success: true,
      output: {
        hash: 'r#1',
        title: 'Top level',
        description: 'Detailed description',
        type: 'functional',
        gateId: 'gate-01',
        parentRequirement: { hash: 'r#0', title: 'Parent' },
        childRequirements: [{ hash: 'r#2', title: 'Child A' }],
        acceptance: [{ criteria: 'Do X' }]
      }
    }

    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValueOnce(mockOut),
      register: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      getByCategory: vi.fn()
    }
    const mod = await import('../../../src/integration/function-implementations.js')
    vi.mocked(mod.getGlobalRegistry).mockReturnValue(registry as FunctionRegistry)

    const program = new Command()
    program.exitOverride()
    registerReqCommands(program)

    await program.parseAsync(['node', 'test', 'req', 'show', 'r#1'])

    expect(registry.invoke).toHaveBeenCalledWith('req_show', { hash: 'r#1' })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Requirement Details'))
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Parent:'))
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Children:'))
  })

  it('req deps should print ascii tree by default and json with --format json', async () => {
    const depsOut = {
      success: true,
      output: {
        root: 'r#1',
        nodes: [{ hash: 'r#1', title: 'Root' }, { hash: 'r#2', title: 'Child' }],
        edges: [{ from: 'r#1', to: 'r#2', type: 'depends_on' }]
      }
    }

    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue(depsOut),
      register: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      getByCategory: vi.fn()
    }
    const mod = await import('../../../src/integration/function-implementations.js')
    vi.mocked(mod.getGlobalRegistry).mockReturnValue(registry as FunctionRegistry)

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const program = new Command()
    program.exitOverride()
    registerReqCommands(program)

    await program.parseAsync(['node', 'test', 'req', 'deps', 'r#1'])

    expect(registry.invoke).toHaveBeenCalledWith('req_deps', { hash: 'r#1' })
    expect(logSpy).toHaveBeenCalled()

    logSpy.mockClear()

    await program.parseAsync(['node', 'test', 'req', 'deps', 'r#1', '--format', 'json'])
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"root": "r#1"'))

    logSpy.mockRestore()
  })

  it('req transfer should call transfer and show confirmation', async () => {
    const transferOut = { success: true, output: { hash: 'r#1', previousGateId: 'gate-01', newGateId: 'gate-04' } }
    const showOut = { success: true, output: { title: 'Transferred Req' } }
    const depsOut = { success: true, output: { nodes: [{ hash: 'r#1' }, { hash: 'r#2' }] } }

    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn()
        .mockResolvedValueOnce(transferOut)
        .mockResolvedValueOnce(showOut)
        .mockResolvedValueOnce(depsOut),
      register: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      getByCategory: vi.fn()
    }

    const mod = await import('../../../src/integration/function-implementations.js')
    vi.mocked(mod.getGlobalRegistry).mockReturnValue(registry as FunctionRegistry)

    const program = new Command()
    program.exitOverride()
    registerReqCommands(program)

    await program.parseAsync(['node', 'test', 'req', 'transfer', 'r#1', 'gate-04'])

    expect(registry.invoke).toHaveBeenCalledWith('req_transfer', { hash: 'r#1', gateId: 'gate-04' })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Requirement transferred'))
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Source Gate: gate-01'))
  })
})
