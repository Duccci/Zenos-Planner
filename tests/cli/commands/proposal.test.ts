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
  writeFile: vi.fn(),
  ensureDir: vi.fn(),
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

  it('should create a proposal file and register in DB', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile, writeFile } = await import('../../../src/utils/file.js')
    const mockDb = { prepare: vi.fn().mockReturnValue({ run: vi.fn() }) }

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)
    vi.mocked(readFile).mockResolvedValue('# Proposal: [Proposal Title]\n**Hash**: #[Generated SHA-256 first 16 chars]\n**Gate**: solitary - Solitary Proposal\n**Status**: pending')

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    // Create a solitary proposal (no --gate passed)
    await program.parseAsync(['node', 'test', 'proposal', 'create', 'Add hash utility module'])

    expect(readFile).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalled()
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO proposals'))

    // Now create with a gate
    await program.parseAsync(['node', 'test', 'proposal', 'create', 'Add hash utility module', '--gate', 'gate-01'])
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(writeFile).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// Approve command tests
// ---------------------------------------------------------------------------

vi.mock('../../../src/core/completions.js', () => ({
  approveProposal: vi.fn(),
}))

vi.mock('../../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn().mockReturnValue('project-root'),
  loadConfig: vi.fn(),
}))

describe('Proposal approve command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function buildProgram() {
    const { registerProposalCommands } = await import('../../../src/cli/commands/proposal.js')
    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)
    return program
  }

  it('solo mode: auto-approves when quality thresholds pass', async () => {
    const { loadConfig } = await import('../../../src/utils/config.js')
    const { approveProposal } = await import('../../../src/core/completions.js')
    const { logger } = await import('../../../src/utils/logger.js')

    vi.mocked(loadConfig).mockResolvedValue({
      projectName: 'Test',
      workflowMode: 'solo',
      qualityThresholds: {
        codeCoverage: 90,
        securityVulnerabilities: 0,
        lintingErrorRate: 0,
        typeCheckingErrors: 0,
      },
    } as never)
    vi.mocked(approveProposal).mockResolvedValue({
      projectRoot: 'project-root',
      proposalHash: 'abc123',
      gateId: 'gate-01',
      title: 'Test',
      previousVersion: '0.1.0',
      newVersion: '0.1.0',
    })

    const program = await buildProgram()
    await program.parseAsync(['node', 'test', 'proposal', 'approve', '#abc123'])

    expect(approveProposal).toHaveBeenCalledWith('#abc123', { approver: 'solo-auto' })
    expect(logger.info).toHaveBeenCalledWith('auto-approved (solo mode)')
  })

  it('solo mode: blocks approval when quality gate fails', async () => {
    const { loadConfig } = await import('../../../src/utils/config.js')
    const { approveProposal } = await import('../../../src/core/completions.js')

    vi.mocked(loadConfig).mockResolvedValue({
      projectName: 'Test',
      workflowMode: 'solo',
      qualityThresholds: {
        codeCoverage: 80, // below 90%
        securityVulnerabilities: 0,
        lintingErrorRate: 0,
        typeCheckingErrors: 0,
      },
    } as never)

    // Prevent process.exit(1) from killing the test runner
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    const program = await buildProgram()
    await program.parseAsync(['node', 'test', 'proposal', 'approve', '#abc123'])

    expect(approveProposal).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })

  it('team mode: calls approveProposal without approver (existing behaviour)', async () => {
    const { loadConfig } = await import('../../../src/utils/config.js')
    const { approveProposal } = await import('../../../src/core/completions.js')

    vi.mocked(loadConfig).mockResolvedValue({
      projectName: 'Test',
      workflowMode: 'team',
      qualityThresholds: {
        codeCoverage: 90,
        securityVulnerabilities: 0,
        lintingErrorRate: 0,
        typeCheckingErrors: 0,
      },
    } as never)
    vi.mocked(approveProposal).mockResolvedValue({
      projectRoot: 'project-root',
      proposalHash: 'abc123',
      gateId: 'gate-01',
      title: 'Test',
      previousVersion: '0.1.0',
      newVersion: '0.1.0',
    })

    const program = await buildProgram()
    await program.parseAsync(['node', 'test', 'proposal', 'approve', '#abc123'])

    // Team mode calls without approver option
    expect(approveProposal).toHaveBeenCalledWith('#abc123')
  })
})