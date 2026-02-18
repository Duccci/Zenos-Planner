import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { Command } from 'commander'
import { registerConfigCommand } from '../../../src/cli/commands/config.js'

const mockFindProjectRoot = vi.fn()
const mockLoadConfig = vi.fn()
const mockSaveConfig = vi.fn()

vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: (...args: unknown[]) => mockFindProjectRoot(...args),
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  saveConfig: (...args: unknown[]) => mockSaveConfig(...args),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Config command action coverage', () => {
  let program: Command
  let exitSpy: MockInstance
  let consoleSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    program = new Command()
    program.exitOverride()
    registerConfigCommand(program)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('config show', () => {
    it('should show all config', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({
        projectName: 'TestProject',
        workflowMode: 'solitary',
      })

      await program.parseAsync(['node', 'test', 'config', 'show'])

      expect(mockLoadConfig).toHaveBeenCalledWith('/project')
    })

    it('should get a specific key', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({
        projectName: 'TestProject',
        git: { autoCommit: true },
      })

      await program.parseAsync(['node', 'test', 'config', 'show', '--get', 'projectName'])
    })

    it('should get a nested key', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({
        projectName: 'TestProject',
        git: { autoCommit: true },
      })

      await program.parseAsync(['node', 'test', 'config', 'show', '--get', 'git.autoCommit'])
    })

    it('should exit on missing key', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({ projectName: 'Test' })

      // Use backward-compat route (config --get) since parent also defines --get
      try {
        await program.parseAsync(['node', 'test', 'config', '--get', 'nonexistent'])
      } catch {
        // process.exit mock throws
      }
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should exit when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null)

      await expect(
        program.parseAsync(['node', 'test', 'config', 'show'])
      ).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle load errors', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockRejectedValue(new Error('load failed'))

      await expect(
        program.parseAsync(['node', 'test', 'config', 'show'])
      ).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should output JSON when ZENO_INTEGRATION is set', async () => {
      const origEnv = process.env['ZENO_INTEGRATION']
      process.env['ZENO_INTEGRATION'] = 'true'

      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({ projectName: 'Test' })

      await program.parseAsync(['node', 'test', 'config', 'show'])

      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify({ projectName: 'Test' }, null, 2)
      )

      process.env['ZENO_INTEGRATION'] = origEnv
    })

    it('should output specific key as JSON in integration mode', async () => {
      const origEnv = process.env['ZENO_INTEGRATION']
      process.env['ZENO_INTEGRATION'] = 'true'

      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({ projectName: 'Test' })

      // Use backward-compat route (config --get) since parent also defines --get
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--get',
        'projectName',
      ])

      expect(consoleSpy).toHaveBeenCalledWith('"Test"')

      process.env['ZENO_INTEGRATION'] = origEnv
    })
  })

  describe('config set', () => {
    it('should set a simple key', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({ projectName: 'Old' })
      mockSaveConfig.mockResolvedValue(undefined)

      await program.parseAsync(['node', 'test', 'config', 'set', 'projectName', 'New'])

      expect(mockSaveConfig).toHaveBeenCalled()
    })

    it('should set a nested key', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({ git: { autoCommit: true } })
      mockSaveConfig.mockResolvedValue(undefined)

      await program.parseAsync(['node', 'test', 'config', 'set', 'git.autoCommit', 'false'])

      expect(mockSaveConfig).toHaveBeenCalled()
    })

    it('should parse JSON values', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({ settings: {} })
      mockSaveConfig.mockResolvedValue(undefined)

      await program.parseAsync([
        'node',
        'test',
        'config',
        'set',
        'settings.count',
        '42',
      ])

      expect(mockSaveConfig).toHaveBeenCalled()
    })

    it('should handle not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null)

      await program.parseAsync(['node', 'test', 'config', 'set', 'key', 'val'])

      expect(process.exitCode).toBe(1)
      // Reset
      process.exitCode = undefined
    })

    it('should handle save errors', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({ projectName: 'Test' })
      mockSaveConfig.mockRejectedValue(new Error('save failed'))

      await program.parseAsync(['node', 'test', 'config', 'set', 'projectName', 'New'])

      expect(process.exitCode).toBe(1)
      process.exitCode = undefined
    })
  })

  describe('config (backward compat, no subcommand)', () => {
    it('should show config with --get via parent action', async () => {
      mockFindProjectRoot.mockReturnValue('/project')
      mockLoadConfig.mockResolvedValue({ projectName: 'TestProject' })

      // Commander fires the parent action when no subcommand is matched
      await program.parseAsync(['node', 'test', 'config', '--get', 'projectName'])
    })
  })
})
