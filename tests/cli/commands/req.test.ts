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
      invoke: vi.fn().mockResolvedValue({ success: true, data: { requirements: [{ hash: 'r#1', type: 'functional', title: 'Req One', gateId: 'gate-01' }] } }),
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

    expect(registry.invoke).toHaveBeenCalledWith('reg_action', { action: 'list', payload: { gateId: 'gate-01' } })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Requirements'))
  })

  it('req list --project should filter to project-level requirements', async () => {
    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { requirements: [ { hash: 'r#proj', title: 'Project Req' }, { hash: 'r#g', title: 'Gate Req' } ] } }),
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
    expect(registry.invoke).toHaveBeenCalledWith('reg_action', { action: 'list', payload: {} })
    // should show project requirement
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Project Req'))
  })

  it('req show should display details including parent and children', async () => {
    const mockOut = {
      success: true,
      data: {
        requirement: {
          hash: 'r#1',
          description: 'Detailed description',
          type: 'functional',
          priority: 'must',
          level: 'gate',
          gateId: 'gate-01',
          parentId: 'r#0',
          acceptanceCriteria: 'Do X'
        }
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

    expect(registry.invoke).toHaveBeenCalledWith('reg_action', { action: 'show', payload: { hash: 'r#1' } })
    expect(logger.info).toHaveBeenCalledWith('Requirement: r#1')
    expect(logger.info).toHaveBeenCalledWith('Parent: r#0')
  })

  it('req deps should print ascii tree by default and json with --format json', async () => {
    const depsOut = {
      success: true,
      data: {
        graph: {
          root: 'r#1',
          nodes: [{ hash: 'r#1', title: 'Root' }, { hash: 'r#2', title: 'Child' }],
          edges: [{ from: 'r#1', to: 'r#2', type: 'depends_on' }]
        }
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

    const program = new Command()
    program.exitOverride()
    registerReqCommands(program)

    await program.parseAsync(['node', 'test', 'req', 'deps', 'r#1'])

    expect(registry.invoke).toHaveBeenCalledWith('reg_action', { action: 'deps', payload: { hash: 'r#1' } })
    expect(logger.info).toHaveBeenCalledWith('Dependency graph for r#1:')
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('"root": "r#1"'))
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

    expect(registry.invoke).toHaveBeenCalledWith('reg_action', { action: 'transfer', payload: { hash: 'r#1', gateId: 'gate-04' } })
    expect(logger.info).toHaveBeenCalledWith('Requirement r#1 transferred to gate gate-04')
  })

  it('req search should call search with query and options', async () => {
    const searchOut = { success: true, data: { requirements: [{ hash: 'r#1', description: 'Test req' }] } }

    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue(searchOut),
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

    await program.parseAsync(['node', 'test', 'req', 'search', 'performance', '--gate', 'gate-01', '--type', 'functional'])

    const payload = {
      query: 'performance',
      gateId: 'gate-01',
      type: 'functional',
    }
    expect(registry.invoke).toHaveBeenCalledWith('reg_action', { action: 'search', payload })
    expect(logger.info).toHaveBeenCalled()
  })

  it('req search without pagination options', async () => {
    const searchOut = { success: true, data: { requirements: [] } }

    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue(searchOut),
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

    await program.parseAsync(['node', 'test', 'req', 'search', 'test'])

    expect(registry.invoke).toHaveBeenCalledWith('reg_action', { 
      action: 'search', 
      payload: { query: 'test' }
    })
  })

  it('req list should handle error', async () => {
    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: 'Database error' }),
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

    await program.parseAsync(['node', 'test', 'req', 'list'])

    expect(logger.error).toHaveBeenCalledWith('Failed to list requirements:', 'Database error')
  })

  it('req show should handle error', async () => {
    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: 'Not found' }),
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

    await program.parseAsync(['node', 'test', 'req', 'show', 'r#missing'])

    expect(logger.error).toHaveBeenCalledWith('Failed to show requirement:', 'Not found')
  })

  it('req deps should handle error', async () => {
    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: 'Graph generation failed' }),
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

    await program.parseAsync(['node', 'test', 'req', 'deps', 'r#1'])

    expect(logger.error).toHaveBeenCalledWith('Failed to get dependencies:', 'Graph generation failed')
  })

  it('req transfer should handle error', async () => {
    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: 'Transfer failed' }),
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

    await program.parseAsync(['node', 'test', 'req', 'transfer', 'r#1', 'gate-02'])

    expect(logger.error).toHaveBeenCalledWith('Failed to transfer requirement:', 'Transfer failed')
  })

  it('req list should handle exception', async () => {
    const registry: Partial<FunctionRegistry> = {
      invoke: vi.fn().mockRejectedValue(new Error('Connection error')),
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

    await program.parseAsync(['node', 'test', 'req', 'list'])

    expect(logger.error).toHaveBeenCalledWith('Error listing requirements:', expect.any(Error))
  })
})

