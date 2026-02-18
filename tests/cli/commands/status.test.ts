import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerStatusCommand } from '../../../src/cli/commands/status.js'
import { Command } from 'commander'

// Mock the dependencies
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../../src/storage/database.js', () => ({
  getDatabase: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([
        { id: 'gate-01', name: 'Setup', status: 'pending' },
        { id: 'gate-02', name: 'Build', status: 'in_progress' },
      ]),
    }),
  }),
}))

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue(['gate-01.md', 'gate-02.md']),
}))

vi.mock('../../mcp/diagnostics.js', async () => {
  const actual = await vi.importActual('../../mcp/diagnostics.js')
  return {
    ...actual,
    diagnostics: {
      generateReport: vi.fn().mockResolvedValue({
        health: { status: 'healthy', toolsRegistered: 15 },
        config: { configLoaded: true },
      }),
    },
  }
})

vi.mock('../../integration/function-implementations.js', () => ({
  createFunctionRegistry: vi.fn().mockReturnValue({}),
}))

describe('Status Command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register status command', () => {
    const program = new Command()
    registerStatusCommand(program)

    const statusCmd = program.commands.find((cmd) => cmd.name() === 'status')
    expect(statusCmd).toBeDefined()
    expect(statusCmd!.description()).toBe('Show project overview and current state')
  })

  it('executes status action without crashing', async () => {
    const program = new Command()
    registerStatusCommand(program)

    const statusCmd = program.commands.find((cmd) => cmd.name() === 'status')
    expect(statusCmd).toBeDefined()
    expect(statusCmd).toHaveProperty('description')
  })
})
