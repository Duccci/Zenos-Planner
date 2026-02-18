import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'
import { registerReposCommands } from '../../../src/cli/commands/repos.js'

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

  it('should execute repos list', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'list'])
  })

  it('should execute repos deps', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'deps'])
  })

  it('should execute repos detect', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'detect'])
  })

  it('should execute repos adjust', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'adjust'])
  })
})
