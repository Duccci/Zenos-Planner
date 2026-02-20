import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'
import { registerReposCommands } from '../../../src/cli/commands/repos.js'
import { logger } from '../../../src/utils/logger.js'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('Repos command coverage', () => {
  let program: Command

  beforeEach(() => {
    vi.clearAllMocks()
    program = new Command()
    program.exitOverride()
    registerReposCommands(program)
  })

  it('should execute repos list and log its intent', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'list'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Repositories command: list')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('Not yet implemented')
    )
  })

  it('should execute repos deps and log its intent', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'deps'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Repositories command: deps')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('Not yet implemented')
    )
  })

  it('should execute repos detect and log its intent', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'detect'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Repositories command: detect')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('Not yet implemented')
    )
  })

  it('should execute repos adjust and log its intent', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'adjust'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Repositories command: adjust')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('Not yet implemented')
    )
  })
})
