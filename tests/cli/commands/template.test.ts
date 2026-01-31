/**
 * Template Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerTemplateCommand } from '../../../src/cli/commands/template.js'
import { Command } from 'commander'
import { TEMPLATES } from '../../../src/generation/template-registry.js'

let consoleLogs: string[] = []
let consoleErrors: string[] = []

describe('Template Command', () => {
  beforeEach(() => {
    consoleLogs = []
    consoleErrors = []

    vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      consoleLogs.push(msg)
    })
    vi.spyOn(console, 'error').mockImplementation((msg: string) => {
      consoleErrors.push(msg)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createProgram(): Command {
    const program = new Command()
    registerTemplateCommand(program)
    return program
  }

  describe('template list', () => {
    it('should list all templates', async () => {
      const program = createProgram()
      await program.parseAsync(['template', 'list'], {
        from: 'user'
      })

      const output = consoleLogs.join('\n')
      expect(output).toContain('gate-prd-template')
    })

    it('should support --format json', async () => {
      const program = createProgram()
      await program.parseAsync(
        ['template', 'list', '--format', 'json'],
        { from: 'user' }
      )

      const output = consoleLogs.join('')
      const parsed = JSON.parse(output)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(TEMPLATES.length)
    })

    it('should support --format list', async () => {
      const program = createProgram()
      await program.parseAsync(
        ['template', 'list', '--format', 'list'],
        { from: 'user' }
      )

      const output = consoleLogs.join('\n')
      const lines = output.split('\n').filter(l => l.trim())
      expect(lines.length).toBe(TEMPLATES.length)
    })
  })

  describe('template get', () => {
    it('should load by full name', async () => {
      const program = createProgram()
      await program.parseAsync(
        ['template', 'get', 'gate-prd-template'],
        { from: 'user' }
      )

      const output = consoleLogs.join('\n')
      expect(output).toContain('gate-prd-template')
    })

    it('should load by short name', async () => {
      const program = createProgram()
      await program.parseAsync(
        ['template', 'get', 'gate-prd'],
        { from: 'user' }
      )

      const output = consoleLogs.join('\n')
      expect(output).toContain('gate-prd-template')
    })

    it('should support --raw flag', async () => {
      const program = createProgram()
      await program.parseAsync(
        ['template', 'get', 'gate-prd-template', '--raw'],
        { from: 'user' }
      )

      const output = consoleLogs.join('\n')
      expect(output).not.toContain('Template:')
      expect(output.length).toBeGreaterThan(0)
    })
  })

  describe('template context', () => {
    it('should output with metadata', async () => {
      const program = createProgram()
      await program.parseAsync(
        ['template', 'context', 'gate-prd-template'],
        { from: 'user' }
      )

      const output = consoleLogs.join('\n')
      expect(output).toContain('Template Context')
      expect(output).toContain('Word Count')
    })

    it('should support --metadata flag', async () => {
      const program = createProgram()
      await program.parseAsync(
        [
          'template',
          'context',
          'gate-prd-template',
          '--metadata'
        ],
        { from: 'user' }
      )

      const output = consoleLogs.join('\n')
      expect(output).toContain('Purpose')
    })

    it('should support --compact flag', async () => {
      const program = createProgram()
      await program.parseAsync(
        [
          'template',
          'context',
          'gate-prd-template',
          '--compact'
        ],
        { from: 'user' }
      )

      const output = consoleLogs.join('\n')
      expect(output.length).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should reject non-existent template', async () => {
      const program = createProgram()
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit')
      })

      try {
        await program.parseAsync(
          ['template', 'get', 'nonexistent'],
          { from: 'user' }
        )
      } catch {
        // Expected
      }

      expect(consoleErrors.join('\n')).toContain('not found')
      exitSpy.mockRestore()
    })

    it('should reject invalid format', async () => {
      const program = createProgram()
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit')
      })

      try {
        await program.parseAsync(
          ['template', 'list', '--format', 'invalid'],
          { from: 'user' }
        )
      } catch {
        // Expected
      }

      expect(consoleErrors.join('\n')).toContain("Invalid format 'invalid'")
      exitSpy.mockRestore()
    })
  })
})
