import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'
import { registerStatusCommand } from '../../../src/cli/commands/status.js'
import { logger } from '../../../src/utils/logger.js'

const mockGetDatabase = vi.fn()

vi.mock('../../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue(['gate-01-startup.md', 'gate-02-setup.md', 'not-a-gate.txt']),
}))

vi.mock('../../../src/mcp/diagnostics.js', () => ({
  diagnostics: {
    generateReport: vi.fn().mockResolvedValue({
      health: { status: 'healthy', toolsRegistered: 10 },
      config: { configLoaded: true },
    }),
  },
}))

vi.mock('../../../src/integration/function-implementations.js', () => ({
  createFunctionRegistry: vi.fn().mockReturnValue({}),
}))

describe('Status command coverage', () => {
  let program: Command

  beforeEach(() => {
    vi.clearAllMocks()
    program = new Command()
    program.exitOverride()
    registerStatusCommand(program)

    mockGetDatabase.mockReturnValue({
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([{ id: 'gate-03', name: 'API Layer', status: 'in_progress' }]),
      }),
    })
  })

  it('should show status with active and archived gates', async () => {
    await program.parseAsync(['node', 'test', 'status'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Project Status')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Active Gates:')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('  gate-03: API Layer (in_progress)')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Completed Gates:')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('  Gate 01: startup (completed)')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('  Gate 02: setup (completed)')
  })

  it('should handle no active gates', async () => {
    mockGetDatabase.mockReturnValue({
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      }),
    })

    await program.parseAsync(['node', 'test', 'status'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('No active gates found.')
  })

  it('should handle db errors gracefully', async () => {
    mockGetDatabase.mockImplementation(() => {
      throw new Error('DB not available')
    })

    // Should not throw - error is caught internally
    await program.parseAsync(['node', 'test', 'status'])

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get status')
    )
  })

  it('should warn when readdir of archive dir fails (covers line 54)', async () => {
    const { readdir } = await import('node:fs/promises')
    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'))

    await program.parseAsync(['node', 'test', 'status'])

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read archive dir')
    )
  })

  it('should warn when MCP diagnostics unavailable (covers line 92)', async () => {
    const { diagnostics } = await import('../../../src/mcp/diagnostics.js')
    vi.mocked(diagnostics.generateReport).mockRejectedValueOnce(new Error('not running'))

    await program.parseAsync(['node', 'test', 'status'])

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('MCP server status not available')
    )
  })
})
