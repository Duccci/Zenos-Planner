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

vi.mock('../../../src/integration/function-implementations.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/integration/function-implementations.js')>('../../../src/integration/function-implementations.js')
  return {
    ...actual,
    getGlobalRegistry: vi.fn(),
  }
})

describe('Status command coverage', () => {
  let program: Command
  let mockInvoke: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockInvoke = vi.fn()

    const { getGlobalRegistry } = await import('../../../src/integration/function-implementations.js')
    vi.mocked(getGlobalRegistry).mockReturnValue({
      invoke: mockInvoke,
    } as any)

    // Default successful status response
    mockInvoke.mockResolvedValue({
      success: true,
      data: {
        activeGates: [{ id: 'gate-03', name: 'API Layer', status: 'in_progress' }],
        completedGates: ['gate-01-startup', 'gate-02-setup'],
        mcp: { status: 'healthy', toolsRegistered: 10, configLoaded: true },
      },
    })

    program = new Command()
    program.exitOverride()
    registerStatusCommand(program)
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
    mockInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        activeGates: [],
        completedGates: [],
        mcp: { status: 'healthy', toolsRegistered: 10, configLoaded: true },
      },
    })

    await program.parseAsync(['node', 'test', 'status'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('No active gates found.')
  })

  it('should handle db errors gracefully', async () => {
    mockInvoke.mockImplementation(() => {
      throw new Error('DB not available')
    })

    // Should not throw - error is caught internally
    await program.parseAsync(['node', 'test', 'status'])

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get status')
    )
  })

  it('should handle readdir of archive dir failure gracefully', async () => {
    const { readdir } = await import('node:fs/promises')
    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'))

    // When readdir fails, the registry should return success with empty completed gates
    mockInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        activeGates: [{ id: 'gate-03', name: 'API Layer', status: 'in_progress' }],
        completedGates: [],
        mcp: { status: 'healthy', toolsRegistered: 10, configLoaded: true },
      },
    })

    await program.parseAsync(['node', 'test', 'status'])

    // Should complete successfully with status output
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Project Status')
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
  })

  it('should handle MCP diagnostics failure gracefully', async () => {
    const { diagnostics } = await import('../../../src/mcp/diagnostics.js')
    vi.mocked(diagnostics.generateReport).mockRejectedValueOnce(new Error('not running'))

    // When MCP diagnostics fail, the registry should return success with MCP status unavailable
    mockInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        activeGates: [{ id: 'gate-03', name: 'API Layer', status: 'in_progress' }],
        completedGates: ['gate-01-startup', 'gate-02-setup'],
        mcp: { status: 'unavailable', toolsRegistered: 0, configLoaded: false },
      },
    })

    await program.parseAsync(['node', 'test', 'status'])

    // Should complete successfully despite MCP diagnostics failure
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Project Status')
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
  })
})
