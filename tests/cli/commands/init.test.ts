/**
 * Init Command Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerInitCommand } from '../../../src/cli/commands/init.js'
import { Command } from 'commander'

// Mock dependencies
const prompts = vi.mocked(await import('@inquirer/prompts'))
const mockInput = prompts.input
const mockConfirm = prompts.confirm
const mockEditor = prompts.editor

describe('Init Command', () => {
  it('should register the init command', () => {
    const program = new Command()
    registerInitCommand(program)

    const initCmd = program.commands.find(cmd => cmd.name() === 'init')
    expect(initCmd).toBeDefined()
    expect(initCmd!.description()).toBe('Initialize a new Zeno project')
  })
})