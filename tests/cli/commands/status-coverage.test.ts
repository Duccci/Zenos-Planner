import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'
import { registerStatusCommand } from '../../../src/cli/commands/status.js'

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
        all: vi.fn().mockReturnValue([
          { id: 'gate-03', name: 'API Layer', status: 'in_progress' },
        ]),
      }),
    })
  })

  it('should show status with active and archived gates', async () => {
    await program.parseAsync(['node', 'test', 'status'])
  })

  it('should handle no active gates', async () => {
    mockGetDatabase.mockReturnValue({
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      }),
    })

    await program.parseAsync(['node', 'test', 'status'])
  })

  it('should handle db errors gracefully', async () => {
    mockGetDatabase.mockImplementation(() => {
      throw new Error('DB not available')
    })

    // Should not throw - error is caught internally
    await program.parseAsync(['node', 'test', 'status'])
  })
})
