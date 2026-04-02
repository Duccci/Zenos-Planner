/**
 * Refresh Command Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'
import { registerRefreshCommand } from '../../../src/cli/commands/refresh.js'
import { logger } from '../../../src/utils/logger.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReaddirSync = vi.fn()
const mockReadFileSync = vi.fn()
const mockExistsSync = vi.fn()

vi.mock('node:fs', () => ({
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const mockGetWorkspaceRoot = vi.fn().mockReturnValue('/project')
const mockGetZenoGitDir = vi.fn().mockReturnValue('/project/zeno')
const mockFindProjectRoot = vi.fn().mockReturnValue('/project')
const mockLoadConfig = vi.fn()

vi.mock('../../../src/utils/config.js', () => ({
  getWorkspaceRoot: (...args: unknown[]) => mockGetWorkspaceRoot(...args),
  getZenoGitDir: (...args: unknown[]) => mockGetZenoGitDir(...args),
  findProjectRoot: (...args: unknown[]) => mockFindProjectRoot(...args),
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}))

const mockReconcileGatePRD = vi.fn()
const mockComputeTemplateHash = vi.fn()

vi.mock('../../../src/core/gate-prd-reconciler.js', () => ({
  reconcileGatePRD: (...args: unknown[]) => mockReconcileGatePRD(...args),
  computeTemplateHash: (...args: unknown[]) => mockComputeTemplateHash(...args),
}))

const mockGenerateAgentsMD = vi.fn()

vi.mock('../../../src/generation/agents-generator.js', () => ({
  generateAgentsMD: (...args: unknown[]) => mockGenerateAgentsMD(...args),
  ZENO_BLOCK_START: '<!-- ZENO:START -->',
  ZENO_BLOCK_END: '<!-- ZENO:END -->',
}))

const mockWriteAgentsMD = vi.fn()

vi.mock('../../../src/generation/agents-writer.js', () => ({
  writeAgentsMD: (...args: unknown[]) => mockWriteAgentsMD(...args),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGateContent(templateHash: string | null): string {
  const fm = templateHash ? `template_hash: ${templateHash}` : 'status: in_progress'
  return `---\n${fm}\n---\n\n# Gate 01\n`
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('refresh command', () => {
  let program: Command

  beforeEach(() => {
    vi.clearAllMocks()

    mockExistsSync.mockReturnValue(true)
    mockComputeTemplateHash.mockReturnValue('abcd1234abcd1234')
    mockReconcileGatePRD.mockResolvedValue(undefined)
    mockLoadConfig.mockResolvedValue({ projectName: 'Test Project' })
    mockGenerateAgentsMD.mockReturnValue('**Project**: Test Project\n')
    mockWriteAgentsMD.mockResolvedValue('/project/AGENTS.md')

    program = new Command()
    program.exitOverride()
    registerRefreshCommand(program)
  })

  it('reports all-up-to-date when all PRDs match current hash', async () => {
    const currentHash = 'abcd1234abcd1234'
    mockReaddirSync.mockReturnValue(['gate-01-infra.md'])
    mockReadFileSync.mockReturnValue(makeGateContent(currentHash))

    await program.parseAsync(['node', 'test', 'refresh'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('up-to-date')
    )
    expect(mockReconcileGatePRD).not.toHaveBeenCalled()
  })

  it('reconciles stale gate PRDs', async () => {
    mockReaddirSync.mockReturnValue(['gate-01-infra.md', 'gate-02-api.md'])
    mockReadFileSync
      .mockReturnValueOnce(makeGateContent('bbbb1234bbbb1234'))  // gate-01 — stale
      .mockReturnValueOnce(makeGateContent('abcd1234abcd1234'))  // gate-02 — current

    await program.parseAsync(['node', 'test', 'refresh'])

    expect(mockReconcileGatePRD).toHaveBeenCalledTimes(1)
    expect(mockReconcileGatePRD).toHaveBeenCalledWith('gate-01', '/project')
  })

  it('skips gate PRDs with no template_hash field', async () => {
    mockReaddirSync.mockReturnValue(['gate-01-infra.md'])
    mockReadFileSync.mockReturnValue(makeGateContent(null))  // no template_hash

    await program.parseAsync(['node', 'test', 'refresh'])

    expect(mockReconcileGatePRD).not.toHaveBeenCalled()
  })

  it('--dry-run reports stale files without writing', async () => {
    mockReaddirSync.mockReturnValue(['gate-01-infra.md'])
    mockReadFileSync.mockReturnValue(makeGateContent('bbbb1234bbbb1234'))

    await program.parseAsync(['node', 'test', 'refresh', '--dry-run'])

    expect(mockReconcileGatePRD).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(expect.stringContaining('Would reconcile'))
  })

  it('--dry-run reports AGENTS.md refresh without writing', async () => {
    mockReaddirSync.mockReturnValue([])

    await program.parseAsync(['node', 'test', 'refresh', '--dry-run'])

    expect(mockWriteAgentsMD).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('Would refresh AGENTS.md')
    )
  })

  it('refreshes AGENTS.md after reconciling PRDs', async () => {
    mockReaddirSync.mockReturnValue([])

    await program.parseAsync(['node', 'test', 'refresh'])

    expect(mockWriteAgentsMD).toHaveBeenCalledWith('**Project**: Test Project\n', '/project')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('Refreshed AGENTS.md')
    )
  })

  it('handles missing gates directory gracefully', async () => {
    mockExistsSync.mockReturnValue(false)

    await program.parseAsync(['node', 'test', 'refresh'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('No gates directory found')
    )
    expect(mockReconcileGatePRD).not.toHaveBeenCalled()
  })

  it('continues when reconcileGatePRD throws for one gate', async () => {
    mockReaddirSync.mockReturnValue(['gate-01-infra.md', 'gate-02-api.md'])
    mockReadFileSync.mockReturnValue(makeGateContent('bbbb1234bbbb1234'))
    mockReconcileGatePRD
      .mockRejectedValueOnce(new Error('DB locked'))
      .mockResolvedValueOnce(undefined)

    await program.parseAsync(['node', 'test', 'refresh'])

    expect(mockReconcileGatePRD).toHaveBeenCalledTimes(2)
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(expect.stringContaining('DB locked'))
  })

  it('warns but succeeds when AGENTS.md refresh throws', async () => {
    mockReaddirSync.mockReturnValue([])
    mockLoadConfig.mockRejectedValue(new Error('config not found'))

    await program.parseAsync(['node', 'test', 'refresh'])

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('AGENTS.md refresh skipped')
    )
  })
})
