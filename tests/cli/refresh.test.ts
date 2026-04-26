/**
 * Refresh Command Tests
 *
 * Unit tests for the `zeno refresh` CLI command.
 * All fs, config, reconciler, and agents-generator calls are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}))

vi.mock('../../src/utils/config.js', () => ({
  getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
  getZenoGitDir: vi.fn().mockReturnValue('/workspace/zeno/.zeno'),
  findProjectRoot: vi.fn().mockReturnValue('/workspace'),
  resolveCliProjectRoot: vi.fn().mockReturnValue('/workspace'),
  loadConfig: vi.fn().mockResolvedValue({ project: { name: 'test' } }),
}))

vi.mock('../../src/core/gate-prd-reconciler.js', () => ({
  reconcileGatePRD: vi.fn().mockResolvedValue(undefined),
  computeTemplateHash: vi.fn().mockReturnValue('abcdef1234567890'),
}))

vi.mock('../../src/generation/agents-generator.js', () => ({
  generateAgentsMD: vi.fn().mockReturnValue('# Agents'),
}))

vi.mock('../../src/generation/agents-writer.js', () => ({
  writeAgentsMD: vi.fn().mockResolvedValue('/workspace/zeno/AGENTS.md'),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { reconcileGatePRD, computeTemplateHash } from '../../src/core/gate-prd-reconciler.js'
import { writeAgentsMD } from '../../src/generation/agents-writer.js'
import { generateAgentsMD } from '../../src/generation/agents-generator.js'
import { logger } from '../../src/utils/logger.js'
import { registerRefreshCommand } from '../../src/cli/commands/refresh.js'
import { Command } from 'commander'

const mockReaddirSync = vi.mocked(readdirSync)
const mockReadFileSync = vi.mocked(readFileSync)
const mockExistsSync = vi.mocked(existsSync)
const mockReconcileGatePRD = vi.mocked(reconcileGatePRD)
const mockComputeTemplateHash = vi.mocked(computeTemplateHash)
const mockWriteAgentsMD = vi.mocked(writeAgentsMD)
const mockGenerateAgentsMD = vi.mocked(generateAgentsMD)
const mockLoggerInfo = vi.mocked(logger.info)
const mockLoggerWarn = vi.mocked(logger.warn)

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGatePRDContent(templateHash: string): string {
  return `---
zeno:
  template_hash: '${templateHash}'
---
# Gate PRD
`
}

function buildProgram(extraArgs: string[] = []): Command {
  const program = new Command()
  program.exitOverride()
  registerRefreshCommand(program)
  program.parse(['node', 'zeno', 'refresh', ...extraArgs])
  return program
}

async function runRefresh(extraArgs: string[] = []): Promise<void> {
  const program = new Command()
  program.exitOverride()
  registerRefreshCommand(program)
  await program.parseAsync(['node', 'zeno', 'refresh', ...extraArgs])
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('zeno refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(true)
    mockComputeTemplateHash.mockReturnValue('abcdef1234567890')
    mockGenerateAgentsMD.mockReturnValue('# Agents')
    mockWriteAgentsMD.mockResolvedValue('/workspace/zeno/AGENTS.md')
  })

  describe('when gates directory does not exist', () => {
    it('logs info and returns without reconciling', async () => {
      mockExistsSync.mockReturnValue(false)

      await runRefresh()

      expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('No gates directory'))
      expect(mockReconcileGatePRD).not.toHaveBeenCalled()
    })
  })

  describe('when all gate PRDs are up-to-date', () => {
    it('logs up-to-date message and skips reconciliation', async () => {
      const currentHash = 'abcdef1234567890'
      mockReaddirSync.mockReturnValue(['gate-01-setup.md', 'gate-02-core.md'] as unknown as ReturnType<typeof readdirSync>)
      mockReadFileSync.mockReturnValue(makeGatePRDContent(currentHash) as unknown as ReturnType<typeof readFileSync>)

      await runRefresh()

      expect(mockReconcileGatePRD).not.toHaveBeenCalled()
      expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('up-to-date'))
    })
  })

  describe('when a gate PRD has a stale template hash', () => {
    it('calls reconcileGatePRD for the stale gate', async () => {
      const staleHash = '1111111111111111'
      mockReaddirSync.mockReturnValue(['gate-01-setup.md'] as unknown as ReturnType<typeof readdirSync>)
      mockReadFileSync.mockReturnValue(makeGatePRDContent(staleHash) as unknown as ReturnType<typeof readFileSync>)

      await runRefresh()

      expect(mockReconcileGatePRD).toHaveBeenCalledWith('gate-01', '/workspace')
    })

    it('logs success for each reconciled gate', async () => {
      const staleHash = '1111111111111111'
      mockReaddirSync.mockReturnValue(['gate-01-setup.md'] as unknown as ReturnType<typeof readdirSync>)
      mockReadFileSync.mockReturnValue(makeGatePRDContent(staleHash) as unknown as ReturnType<typeof readFileSync>)

      await runRefresh()

      expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('gate-01'))
    })

    it('logs a warning and continues if reconcileGatePRD throws', async () => {
      const staleHash = '1111111111111111'
      mockReaddirSync.mockReturnValue(['gate-01-setup.md', 'gate-02-core.md'] as unknown as ReturnType<typeof readdirSync>)
      mockReadFileSync.mockReturnValue(makeGatePRDContent(staleHash) as unknown as ReturnType<typeof readFileSync>)
      mockReconcileGatePRD
        .mockRejectedValueOnce(new Error('DB unavailable'))
        .mockResolvedValueOnce(undefined)

      await runRefresh()

      expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining('gate-01'))
      expect(mockReconcileGatePRD).toHaveBeenCalledTimes(2)
    })
  })

  describe('--dry-run mode', () => {
    it('reports stale gate PRDs without calling reconcileGatePRD', async () => {
      const staleHash = '1111111111111111'
      mockReaddirSync.mockReturnValue(['gate-01-setup.md', 'gate-02-core.md'] as unknown as ReturnType<typeof readdirSync>)
      mockReadFileSync.mockReturnValue(makeGatePRDContent(staleHash) as unknown as ReturnType<typeof readFileSync>)

      await runRefresh(['--dry-run'])

      expect(mockReconcileGatePRD).not.toHaveBeenCalled()
      expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('gate-01'))
    })

    it('reports AGENTS.md would be refreshed without writing', async () => {
      mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>)

      await runRefresh(['--dry-run'])

      expect(mockWriteAgentsMD).not.toHaveBeenCalled()
      expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('AGENTS.md'))
    })
  })

  describe('AGENTS.md refresh', () => {
    it('calls generateAgentsMD and writeAgentsMD on normal run', async () => {
      mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>)

      await runRefresh()

      expect(mockGenerateAgentsMD).toHaveBeenCalled()
      expect(mockWriteAgentsMD).toHaveBeenCalled()
    })

    it('logs the written path after refresh', async () => {
      mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>)
      mockWriteAgentsMD.mockResolvedValue('/workspace/zeno/AGENTS.md')

      await runRefresh()

      expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('AGENTS.md'))
    })

    it('logs a warning and does not throw if AGENTS.md refresh fails', async () => {
      mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>)
      mockWriteAgentsMD.mockRejectedValue(new Error('write error'))

      await expect(runRefresh()).resolves.not.toThrow()
      expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining('AGENTS.md refresh skipped'))
    })
  })

  describe('gate file edge cases', () => {
    it('skips files without a template_hash in frontmatter', async () => {
      mockReaddirSync.mockReturnValue(['gate-01-setup.md'] as unknown as ReturnType<typeof readdirSync>)
      mockReadFileSync.mockReturnValue('---\nzeno:\n  hash: abc\n---\n# Gate\n' as unknown as ReturnType<typeof readFileSync>)

      await runRefresh()

      expect(mockReconcileGatePRD).not.toHaveBeenCalled()
    })

    it('skips non-gate filenames that do not match gate-NN pattern', async () => {
      mockReaddirSync.mockReturnValue(['archive.md', 'README.md'] as unknown as ReturnType<typeof readdirSync>)
      mockReadFileSync.mockReturnValue(makeGatePRDContent('stale000deadbeef') as unknown as ReturnType<typeof readFileSync>)

      await runRefresh()

      expect(mockReconcileGatePRD).not.toHaveBeenCalled()
    })

    it('skips unreadable gate files gracefully', async () => {
      mockReaddirSync.mockReturnValue(['gate-01-setup.md'] as unknown as ReturnType<typeof readdirSync>)
      mockReadFileSync.mockImplementation((): never => { throw new Error('EACCES') })

      await expect(runRefresh()).resolves.not.toThrow()
      expect(mockReconcileGatePRD).not.toHaveBeenCalled()
    })
  })
})
