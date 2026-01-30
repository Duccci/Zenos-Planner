/**
 * Gates Command Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerGatesCommands } from '../../../src/cli/commands/gates.js'
import { Command } from 'commander'

// Mock dependencies
vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../../src/core/completions.js', () => ({
  completeGate: vi.fn(),
}))

describe('Gates Commands', () => {
  it('should register gates command with subcommands', () => {
    const program = new Command()
    registerGatesCommands(program)

    const gatesCmd = program.commands.find(cmd => cmd.name() === 'gates')
    expect(gatesCmd).toBeDefined()

    const subcommands = gatesCmd!.commands.map(cmd => cmd.name())
    expect(subcommands).toContain('list')
    expect(subcommands).toContain('show')
    expect(subcommands).toContain('start')
    expect(subcommands).toContain('complete')
    expect(subcommands).toContain('regenerate')
  })
})