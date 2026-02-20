import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { Command } from 'commander'
import { registerShowCommand } from '../../../src/cli/commands/show.js'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('show command coverage', () => {
  let program: Command

  beforeEach(() => {
    vi.clearAllMocks()
    program = new Command()
    program.exitOverride()
    registerShowCommand(program)
  })

  it('should execute action with hash argument', async () => {
    const { logger } = await import('../../../src/utils/logger.js')

    await program.parseAsync(['node', 'test', 'show', 'abc123'])

    expect(logger.info).toHaveBeenCalledWith('Show command: abc123')
    expect(logger.info).toHaveBeenCalledWith('Not yet implemented - Gate 3 required')
    expect(logger.info).toHaveBeenCalledWith(
      'This command will resolve a hash to its entity and display details'
    )
    expect(logger.info).toHaveBeenCalledWith(
      'Supports: gates, requirements, proposals, repositories'
    )
  })

  it('should accept any hash format', async () => {
    const { logger } = await import('../../../src/utils/logger.js')

    await program.parseAsync(['node', 'test', 'show', '#a3f9c2d1'])
    expect(logger.info).toHaveBeenCalledWith('Show command: #a3f9c2d1')
  })
})
