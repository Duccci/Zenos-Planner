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
  loadConfig: vi.fn(),
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

vi.mock('../../../src/storage/proposal-sync.js', () => ({
  syncProposalsFromDisk: vi.fn(),
}))

describe('Proposal validate command', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    mockDb = { prepare: vi.fn() }
    vi.clearAllMocks()
    const { loadConfig } = await import('../../../src/utils/config.js')
    vi.mocked(loadConfig).mockResolvedValue({
      projectName: 'test-project',
      qualityThresholds: {
        codeCoverage: 90,
        securityVulnerabilities: 0,
        lintingErrorRate: 0.01,
        typeCheckingErrors: 0,
      },
    } as never)
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
    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: '1',
        gate_id: 'gate-01',
        title: 'Test Proposal',
        status: 'in_progress',
        hash: 'abcdef',
      }),
    })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    // Mock filesystem to return a single proposal file and content without completion summary
    vi.mocked(readdir).mockResolvedValue(['proposal.md'])
    vi.mocked(readFile).mockResolvedValue(
      '# Proposal: Test Proposal\n\n## Summary\n\nShort summary\n'
    )

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#abcdef'])

    expect(logger.warn).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Checks passed with warnings'))
  })

  it('validates with hash prefix normalization', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { logger } = await import('../../../src/utils/logger.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    // Test that hash is normalized (# prefix removed)
    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#abcdef'])

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Proposal not found'))
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('fails validation in strict mode when warnings are present', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile } = await import('../../../src/utils/file.js')
    const { readdir } = await import('node:fs/promises')
    const { logger } = await import('../../../src/utils/logger.js')

    // Mock DB to return a proposal entry
    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: '1',
        gate_id: 'gate-01',
        title: 'Test Proposal',
        status: 'in_progress',
        hash: 'abcdef',
      }),
    })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    // Mock filesystem to return a single proposal file and content without completion summary
    vi.mocked(readdir).mockResolvedValue(['proposal.md'])
    vi.mocked(readFile).mockResolvedValue(
      '# Proposal: Test Proposal\n\n## Summary\n\nShort summary\n'
    )

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

  it('handles missing proposal in validate command', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { logger } = await import('../../../src/utils/logger.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#notfound'])

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Proposal not found'))
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('validates proposal with proper completion summary', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile } = await import('../../../src/utils/file.js')
    const { readdir } = await import('node:fs/promises')
    const { logger } = await import('../../../src/utils/logger.js')

    // Mock DB to return a proposal entry
    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: '1',
        gate_id: 'gate-01',
        title: 'Test Proposal',
        status: 'in_progress',
        hash: 'complete01',
      }),
    })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    // Create proposal with complete summary and matching task counts
    const proposalContent = `
# Proposal: Complete Task

**Hash**: #complete01
**Gate**: gate-01
**Status**: in_progress

## Summary
Complete proposal with all required fields.

## Completion Summary

**Tasks Completed**: 3/3

- [x] Task 1: Setup
- [x] Task 2: Implementation
- [x] Task 3: Testing
`
    vi.mocked(readdir).mockResolvedValue(['proposal.md'])
    vi.mocked(readFile).mockResolvedValue(proposalContent)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#complete01'])

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('All checks passed'))
  })

  it('detects task count mismatches in completion summary', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile } = await import('../../../src/utils/file.js')
    const { readdir } = await import('node:fs/promises')
    const { logger } = await import('../../../src/utils/logger.js')

    // Mock DB to return a proposal entry
    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: '2',
        gate_id: 'gate-01',
        title: 'Mismatch Test',
        status: 'in_progress',
        hash: 'mismatch02',
      }),
    })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    // Create proposal with mismatched task counts
    // Claims 3/3 but only 2 checked boxes
    const proposalContent = `
# Proposal: Mismatch Test

**Hash**: #mismatch02
**Gate**: gate-01
**Status**: in_progress

## Completion Summary

**Tasks Completed**: 3/3

- [x] Task 1: Setup
- [x] Task 2: Implementation
- [ ] Task 3: Testing
`
    vi.mocked(readdir).mockResolvedValue(['proposal.md'])
    vi.mocked(readFile).mockResolvedValue(proposalContent)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#mismatch02'])

    expect(logger.warn).toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Tasks Completed'))
  })

  it('does not warn about missing completion summary for pending proposals', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile } = await import('../../../src/utils/file.js')
    const { readdir } = await import('node:fs/promises')
    const { logger } = await import('../../../src/utils/logger.js')

    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: '3',
        gate_id: 'gate-01',
        title: 'Pending Proposal',
        status: 'pending',
        hash: 'pending03',
      }),
    })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    vi.mocked(readdir).mockResolvedValue(['proposal.md'])
    vi.mocked(readFile).mockResolvedValue(
      '# Proposal: Pending Proposal\n\n**Hash**: #pending03\n\n## Summary\n\nNot yet started.\n'
    )

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#pending03'])

    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('All checks passed'))
  })

  it('counts checked tasks only within the Completion Summary section', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile } = await import('../../../src/utils/file.js')
    const { readdir } = await import('node:fs/promises')
    const { logger } = await import('../../../src/utils/logger.js')

    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: '4',
        gate_id: 'gate-01',
        title: 'Mixed Checkboxes',
        status: 'in_progress',
        hash: 'mixed04',
      }),
    })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    // Document has [x] items in Tasks section AND Completion Summary.
    // Claimed 2/2 in summary; summary has exactly 2 checked boxes.
    // The 3 checked boxes in Tasks section must NOT inflate the count.
    const proposalContent = `
# Proposal: Mixed Checkboxes

**Hash**: #mixed04

## Tasks

- [x] Pre-work item 1
- [x] Pre-work item 2
- [x] Pre-work item 3

## Completion Summary

**Tasks Completed**: 2/2

- [x] Final task 1
- [x] Final task 2
`
    vi.mocked(readdir).mockResolvedValue(['proposal.md'])
    vi.mocked(readFile).mockResolvedValue(proposalContent)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#mixed04'])

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Tasks Completed'))
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('All checks passed'))
  })

  it('exits with code 1 when project root is not found during validate', async () => {
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    vi.mocked(findProjectRoot).mockReturnValueOnce(undefined as unknown as string)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#anything'])

    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('exits with code 1 when proposal is not found during validate', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) })
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'validate', '#missinghash'])

    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('should create a proposal file and register in DB', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { readFile, writeFile } = await import('../../../src/utils/file.js')
    const mockDb = { prepare: vi.fn().mockReturnValue({ run: vi.fn() }) }

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)
    vi.mocked(readFile).mockResolvedValue(
      '# Proposal: [Proposal Title]\n**Hash**: #[Generated SHA-256 first 16 chars]\n**Gate**: solitary - Solitary Proposal\n**Status**: pending'
    )

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    // Create a solitary proposal (no --gate passed)
    await program.parseAsync(['node', 'test', 'proposal', 'create', 'Add hash utility module'])

    const { syncProposalsFromDisk } = await import('../../../src/storage/proposal-sync.js')
    expect(readFile).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalled()
    expect(syncProposalsFromDisk).toHaveBeenCalled()

    vi.clearAllMocks()

    // Now create with a gate
    await program.parseAsync([
      'node',
      'test',
      'proposal',
      'create',
      'Add hash utility module',
      '--gate',
      'gate-01',
    ])
    expect(readFile).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalled()
    expect(syncProposalsFromDisk).toHaveBeenCalled()
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

  it('solo mode: blocks approval when security vulnerabilities exist', async () => {
    const { loadConfig } = await import('../../../src/utils/config.js')
    const { logger } = await import('../../../src/utils/logger.js')

    vi.mocked(loadConfig).mockResolvedValue({
      projectName: 'Test',
      workflowMode: 'solo',
      qualityThresholds: {
        codeCoverage: 90,
        securityVulnerabilities: 2, // > 0
        lintingErrorRate: 0,
        typeCheckingErrors: 0,
      },
    } as never)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    const program = await buildProgram()
    await program.parseAsync(['node', 'test', 'proposal', 'approve', '#abc123'])

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('security vulnerabilities'))
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('solo mode: blocks approval when linting error rate exceeds threshold', async () => {
    const { loadConfig } = await import('../../../src/utils/config.js')
    const { logger } = await import('../../../src/utils/logger.js')

    vi.mocked(loadConfig).mockResolvedValue({
      projectName: 'Test',
      workflowMode: 'solo',
      qualityThresholds: {
        codeCoverage: 90,
        securityVulnerabilities: 0,
        lintingErrorRate: 0.05, // >= 0.01
        typeCheckingErrors: 0,
      },
    } as never)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    const program = await buildProgram()
    await program.parseAsync(['node', 'test', 'proposal', 'approve', '#abc123'])

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Linting error rate'))
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('solo mode: blocks approval when TypeScript type errors exist', async () => {
    const { loadConfig } = await import('../../../src/utils/config.js')
    const { logger } = await import('../../../src/utils/logger.js')

    vi.mocked(loadConfig).mockResolvedValue({
      projectName: 'Test',
      workflowMode: 'solo',
      qualityThresholds: {
        codeCoverage: 90,
        securityVulnerabilities: 0,
        lintingErrorRate: 0,
        typeCheckingErrors: 3, // > 0
      },
    } as never)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    const program = await buildProgram()
    await program.parseAsync(['node', 'test', 'proposal', 'approve', '#abc123'])

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('TypeScript type errors'))
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('solo mode: blocks approval when multiple quality gates fail', async () => {
    const { loadConfig } = await import('../../../src/utils/config.js')
    const { logger } = await import('../../../src/utils/logger.js')

    vi.mocked(loadConfig).mockResolvedValue({
      projectName: 'Test',
      workflowMode: 'solo',
      qualityThresholds: {
        codeCoverage: 75,
        securityVulnerabilities: 2,
        lintingErrorRate: 0.02,
        typeCheckingErrors: 1,
      },
    } as never)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    const program = await buildProgram()
    await program.parseAsync(['node', 'test', 'proposal', 'approve', '#abc123'])

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Auto-approval blocked: quality gate failures')
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Reject command tests
// ---------------------------------------------------------------------------

describe('Proposal reject command', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDb = { prepare: vi.fn() }
    vi.clearAllMocks()
  })

  it('rejects a proposal with pending status', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { logger } = await import('../../../src/utils/logger.js')

    const mockPrepare = vi.fn()
    mockDb.prepare = mockPrepare

    // First call: SELECT to get proposal
    mockPrepare.mockReturnValueOnce({
      get: vi.fn().mockReturnValue({ id: 'prop-1', status: 'pending' }),
    })
    // Second call: UPDATE to reject
    mockPrepare.mockReturnValueOnce({
      run: vi.fn(),
    })

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'reject', '#abc123'])

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Proposal rejected'))
  })

  it('prevents rejection of completed proposals', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { logger } = await import('../../../src/utils/logger.js')

    const mockPrepare = vi.fn()
    mockDb.prepare = mockPrepare

    mockPrepare.mockReturnValueOnce({
      get: vi.fn().mockReturnValue({ id: 'prop-1', status: 'completed' }),
    })

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'reject', '#abc123'])

    expect(logger.error).toHaveBeenCalledWith('Cannot reject a completed proposal')
  })

  it('handles rejection when proposal not found', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { logger } = await import('../../../src/utils/logger.js')

    const mockPrepare = vi.fn()
    mockDb.prepare = mockPrepare

    mockPrepare.mockReturnValueOnce({
      get: vi.fn().mockReturnValue(undefined),
    })

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'reject', '#notfound'])

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Proposal not found'))
  })

  it('handles rejection when not in a Zeno project', async () => {
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    const { logger } = await import('../../../src/utils/logger.js')

    vi.mocked(findProjectRoot).mockReturnValue(null)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'reject', '#abc123'])

    expect(logger.error).toHaveBeenCalledWith('Not a Zeno project')
  })
})

// ---------------------------------------------------------------------------
// Show and list command error cases
// ---------------------------------------------------------------------------

describe('Proposal show command', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDb = { prepare: vi.fn() }
    vi.clearAllMocks()
  })

  it('handles missing proposal in show command', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { logger } = await import('../../../src/utils/logger.js')

    const mockPrepare = vi.fn()
    mockDb.prepare = mockPrepare

    mockPrepare.mockReturnValueOnce({
      get: vi.fn().mockReturnValue(undefined),
    })

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'show', '#notfound'])

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Proposal not found'))
  })
})

describe('Proposal list command', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDb = { prepare: vi.fn() }
    vi.clearAllMocks()
  })

  it('shows message when no proposals found', async () => {
    const { getDatabase } = await import('../../../src/storage/database.js')
    const { logger } = await import('../../../src/utils/logger.js')

    const mockPrepare = vi.fn()
    mockDb.prepare = mockPrepare

    mockPrepare.mockReturnValueOnce({
      all: vi.fn().mockReturnValue([]),
    })

    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'list'])

    expect(logger.info).toHaveBeenCalledWith('No proposals found')
  })
})

describe('Proposal commands error handling', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDb = { prepare: vi.fn() }
    vi.clearAllMocks()
  })

  it('approve command handles missing project root', async () => {
    const { findProjectRoot } = await import('../../../src/utils/config.js')
    const { logger } = await import('../../../src/utils/logger.js')

    vi.mocked(findProjectRoot).mockReturnValue(null)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    const program = new Command()
    program.exitOverride()
    registerProposalCommands(program)

    await program.parseAsync(['node', 'test', 'proposal', 'approve', '#abc123'])

    expect(logger.error).toHaveBeenCalledWith('Not a Zeno project')
    exitSpy.mockRestore()
  })
})
