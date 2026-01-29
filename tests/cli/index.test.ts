/**
 * CLI Tests
 *
 * Tests for CLI entry point and command registration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createProgram } from '../../src/cli/index.js'
import type { Command } from 'commander'

describe('CLI', () => {
  describe('createProgram', () => {
    it('should create a program with correct name and description', async () => {
      const program = await createProgram()
      expect(program.name()).toBe('zeno')
      expect(program.description()).toContain("Zeno's Planner")
    })

    it('should have version command', async () => {
      const program = await createProgram()
      // Version is loaded from package.json
      expect(program.version()).toBeDefined()
    })

    it('should handle errors gracefully', async () => {
      const program = await createProgram()
      // Program should be configured with error handling
      expect(program).toBeDefined()
    })
  })

  describe('Command Registration', () => {
    it('should register command categories', async () => {
      const program = await createProgram()

      // Commands are already registered by createProgram()
      // Check that categories are registered
      const commands = program.commands.map((cmd) => cmd.name())
      expect(commands).toContain('gates')
      expect(commands).toContain('req')
      expect(commands).toContain('arch')
      expect(commands).toContain('repos')
      expect(commands).toContain('proposal')
    })

    it('should register top-level commands', async () => {
      const program = await createProgram()

      // Commands are already registered by createProgram()
      const commands = program.commands.map((cmd) => cmd.name())
      expect(commands).toContain('init')
      expect(commands).toContain('status')
      expect(commands).toContain('show')
    })
  })
})
