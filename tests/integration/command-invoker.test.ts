/**
 * Command Invoker Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  invokeCommand,
  validateCommandArguments,
  getAvailableCommands,
  getCommandHelp
} from '../../src/integration/command-invoker.js'

// Mock execSync
vi.mock('child_process', () => ({
  execSync: vi.fn()
}))

import { execSync } from 'child_process'

describe('Command Invoker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('invokeCommand', () => {
    it('should successfully invoke valid commands', async () => {
      const mockExecSync = vi.mocked(execSync)
      mockExecSync.mockReturnValue('success output')

      const result = await invokeCommand('init', {})

      expect(result.success).toBe(true)
      expect(result.output).toBe('success output')
      expect(result.exitCode).toBe(0)
      expect(mockExecSync).toHaveBeenCalledWith(
        'node bin/zeno.js init',
        expect.any(Object)
      )
    })

    it('should handle command failures', async () => {
      const mockExecSync = vi.mocked(execSync)
      const error = new Error('Command failed') as any
      error.status = 1
      error.stdout = Buffer.from('stdout content')
      error.stderr = Buffer.from('stderr content')
      mockExecSync.mockImplementation(() => {
        throw error
      })

      const result = await invokeCommand('invalid_command', {})

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
      // Note: output/error handling depends on execSync error format
    })

    it('should validate arguments before execution', async () => {
      const result = await invokeCommand('gates_show', {}) // Missing required gateId

      expect(result.success).toBe(false)
      expect(result.error).toContain('Required parameter')
      expect(result.error).toContain('gateId')
    })

    it('should build correct command strings', async () => {
      const mockExecSync = vi.mocked(execSync)
      mockExecSync.mockReturnValue('')

      await invokeCommand('gates_show', { gateId: 'gate-01' })

      expect(mockExecSync).toHaveBeenCalledWith(
        'node bin/zeno.js gates show "gate-01"',
        expect.any(Object)
      )
    })

    it('should handle boolean flags', async () => {
      const mockExecSync = vi.mocked(execSync)
      mockExecSync.mockReturnValue('')

      await invokeCommand('req_list', { project: true })

      expect(mockExecSync).toHaveBeenCalledWith(
        'node bin/zeno.js req list --project',
        expect.any(Object)
      )
    })
  })

  describe('validateCommandArguments', () => {
    it('should validate required parameters', () => {
      const result = validateCommandArguments('gates_show', {})

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('gateId')
      expect(result.errors[0].message).toContain('Required parameter')
    })

    it('should validate parameter types', () => {
      const result = validateCommandArguments('gates_show', { gateId: 123 })

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('gateId')
      expect(result.errors[0].message).toContain('must be of type string')
    })

    it('should accept valid arguments', () => {
      const result = validateCommandArguments('gates_show', { gateId: 'gate-01' })

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject unknown commands', () => {
      const result = validateCommandArguments('unknown_command', {})

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('command')
      expect(result.errors[0].message).toContain('Unknown command')
    })

    it('should reject unknown parameters', () => {
      const result = validateCommandArguments('init', { unknownParam: 'value' })

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('unknownParam')
      expect(result.errors[0].message).toContain('Unknown parameter')
    })

    it('should accept optional parameters', () => {
      const result = validateCommandArguments('req_list', { gateId: 'gate-01' })

      expect(result.valid).toBe(true)
    })
  })

  describe('getAvailableCommands', () => {
    it('should return array of command names', () => {
      const commands = getAvailableCommands()

      expect(Array.isArray(commands)).toBe(true)
      expect(commands.length).toBeGreaterThan(0)
      expect(commands).toContain('init')
      expect(commands).toContain('gates_list')
      expect(commands).toContain('proposal_show')
    })
  })

  describe('getCommandHelp', () => {
    it('should return help for valid commands', () => {
      const help = getCommandHelp('gates_show')

      expect(typeof help).toBe('string')
      expect(help).toContain('gates_show')
      expect(help).toContain('gateId')
      expect(help).toContain('string')
    })

    it('should return undefined for unknown commands', () => {
      const help = getCommandHelp('unknown_command')

      expect(help).toBeUndefined()
    })
  })

  describe('Command String Building', () => {
    it('should convert function names to CLI commands', () => {
      // Test the internal functionNameToCliCommand logic through invokeCommand
      const mockExecSync = vi.mocked(execSync)
      mockExecSync.mockReturnValue('')

      // gates_show -> gates show
      invokeCommand('gates_show', { gateId: 'gate-01' })
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gates show'),
        expect.any(Object)
      )

      // proposal_list -> proposal list
      invokeCommand('proposal_list', {})
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('proposal list'),
        expect.any(Object)
      )
    })

    it('should handle commands without underscores', () => {
      const mockExecSync = vi.mocked(execSync)
      mockExecSync.mockReturnValue('')

      invokeCommand('init', {})
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('init'),
        expect.any(Object)
      )
    })
  })
})