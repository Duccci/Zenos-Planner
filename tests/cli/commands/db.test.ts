import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { Command } from 'commander'
import { registerDbCommands } from '../../../src/cli/commands/db.js'

const mockGetDatabasePath = vi.fn().mockReturnValue('/test/registry.db')
const mockCleanupStaleFiles = vi.fn()
const mockValidateDatabaseIntegrity = vi.fn()
const mockCheckpointWAL = vi.fn()

vi.mock('../../../src/storage/database.js', () => ({
  getDatabasePath: (...args: unknown[]) => mockGetDatabasePath(...args),
  checkpointWAL: (...args: unknown[]) => mockCheckpointWAL(...args),
}))

vi.mock('../../../src/storage/database-cleanup.js', () => ({
  cleanupStaleFiles: (...args: unknown[]) => mockCleanupStaleFiles(...args),
  validateDatabaseIntegrity: (...args: unknown[]) => mockValidateDatabaseIntegrity(...args),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('DB commands action coverage', () => {
  let program: Command
  let exitSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    program = new Command()
    program.exitOverride()
    registerDbCommands(program)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
  })

  describe('cleanup subcommand', () => {
    it('should report no stale files removed', async () => {
      mockCleanupStaleFiles.mockReturnValue({ deleted: 0, files: [] })

      await program.parseAsync(['node', 'test', 'db', 'cleanup'])

      expect(mockCleanupStaleFiles).toHaveBeenCalledWith('/test/registry.db')
    })

    it('should report stale files removed', async () => {
      mockCleanupStaleFiles.mockReturnValue({
        deleted: 2,
        files: ['registry.db-wal', 'registry.db-shm'],
      })

      await program.parseAsync(['node', 'test', 'db', 'cleanup'])

      expect(mockCleanupStaleFiles).toHaveBeenCalled()
    })

    it('should use custom path option', async () => {
      mockCleanupStaleFiles.mockReturnValue({ deleted: 0, files: [] })

      await program.parseAsync(['node', 'test', 'db', 'cleanup', '--path', '/custom/path.db'])

      expect(mockCleanupStaleFiles).toHaveBeenCalledWith('/custom/path.db')
    })

    it('should handle errors', async () => {
      mockCleanupStaleFiles.mockImplementation(() => {
        throw new Error('cleanup failed')
      })

      await expect(program.parseAsync(['node', 'test', 'db', 'cleanup'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('validate subcommand', () => {
    it('should report database integrity OK', async () => {
      mockValidateDatabaseIntegrity.mockReturnValue({
        integrityOk: true,
        integrityOutput: ['ok'],
        foreignKeyViolations: [],
      })

      await program.parseAsync(['node', 'test', 'db', 'validate'])

      expect(mockValidateDatabaseIntegrity).toHaveBeenCalled()
    })

    it('should report integrity issues', async () => {
      mockValidateDatabaseIntegrity.mockReturnValue({
        integrityOk: false,
        integrityOutput: ['issues found'],
        foreignKeyViolations: [{ table: 'requirements', from: 'id1', to: 'id2' }],
      })

      await expect(program.parseAsync(['node', 'test', 'db', 'validate'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(2)
    })

    it('should handle validation errors', async () => {
      mockValidateDatabaseIntegrity.mockImplementation(() => {
        throw new Error('validate failed')
      })

      await expect(program.parseAsync(['node', 'test', 'db', 'validate'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should accept custom path', async () => {
      mockValidateDatabaseIntegrity.mockReturnValue({
        integrityOk: true,
        integrityOutput: ['ok'],
        foreignKeyViolations: [],
      })

      await program.parseAsync(['node', 'test', 'db', 'validate', '--path', '/my/db.sqlite'])

      expect(mockValidateDatabaseIntegrity).toHaveBeenCalledWith('/my/db.sqlite')
    })
  })

  describe('checkpoint subcommand', () => {
    it('should report checkpoint OK', async () => {
      mockCheckpointWAL.mockReturnValue({ status: 'ok' })

      await program.parseAsync(['node', 'test', 'db', 'checkpoint'])

      expect(mockCheckpointWAL).toHaveBeenCalled()
    })

    it('should report checkpoint blocked', async () => {
      mockCheckpointWAL.mockReturnValue({ status: 'blocked', detail: 'busy' })

      await expect(program.parseAsync(['node', 'test', 'db', 'checkpoint'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(2)
    })

    it('should handle checkpoint errors', async () => {
      mockCheckpointWAL.mockImplementation(() => {
        throw new Error('checkpoint failed')
      })

      await expect(program.parseAsync(['node', 'test', 'db', 'checkpoint'])).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})
