import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerProposalCommands } from '../../../src/cli/commands/proposal.js'
import { Command } from 'commander'
import type Database from 'better-sqlite3'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../../../src/storage/database.js', () => ({
  getDatabase: vi.fn(),
}))

// Mock config helpers to return a project root
vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn().mockReturnValue('project-root'),
}))

// Mock filesystem helpers used by readProposalFile
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
}))

vi.mock('../../../src/utils/file.js', () => ({
  readFile: vi.fn(),
}))

describe('Proposal validate command', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDb = { prepare: vi.fn() }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('emits warnings when proposal file is missing completion summary (non-strict)', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile } = await import('../../../src/utils/file.js')
    const { readdir } = await import('node:fs/promises')
    const { logger } = await import('../../../src/utils/logger.js')

    // Mock DB to return a proposal entry
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: '1', gate_id: 'gate-01', title: 'Test Proposal', status: 'in_progress', hash: 'abcdef' }) })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    // Mock filesystem to return a single proposal file and content without completion summary
    vi.mocked(readdir).mockResolvedValue(['proposal.md'])
    vi.mocked(readFile).mockResolvedValue('# Proposal: Test Proposal\n\n## Summary\n\nShort summary\n')

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#abcdef'])

    expect(logger.warn).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Checks passed with warnings'))
  })

  it('fails validation in strict mode when warnings are present', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile } = await import('../../../src/utils/file.js')
    const { readdir } = await import('node:fs/promises')
    const { logger } = await import('../../../src/utils/logger.js')

    // Mock DB to return a proposal entry
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: '1', gate_id: 'gate-01', title: 'Test Proposal', status: 'in_progress', hash: 'abcdef' }) })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    // Mock filesystem to return a single proposal file and content without completion summary
    vi.mocked(readdir).mockResolvedValue(['proposal.md'])
    vi.mocked(readFile).mockResolvedValue('# Proposal: Test Proposal\n\n## Summary\n\nShort summary\n')

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    let threw = false
    try {
      await program.parseAsync(['node', 'test', 'proposal', 'validate', '--strict', '#abcdef'])
    } catch (err) {
      threw = true
    }

    expect(threw).toBe(true)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Validation failed'))
  })
})