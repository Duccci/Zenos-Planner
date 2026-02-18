import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.fn()
const mockReadFile = vi.fn()
const mockGetZenoDir = vi.fn()

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}))

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  readdir: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../src/utils/config.js', () => ({
  getZenoDir: (...args: unknown[]) => mockGetZenoDir(...args),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../src/analysis/artifact-validation-service.js', () => ({
  ArtifactValidationService: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({ passed: true, errors: [], warnings: [] }),
  })),
}))

describe('archive-validation coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetZenoDir.mockReturnValue('/project/zeno/.zeno')
  })

  describe('validateGateReady', () => {
    it('should reject when gate file not found', async () => {
      mockExistsSync.mockReturnValue(false)

      const { validateGateReady } = await import('../../src/core/archive-validation.js')
      await expect(validateGateReady('gate-01')).rejects.toThrow('not found')
    })

    it('should reject when gate is not completed', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue('# Gate\n**Status**: in_progress')

      const { validateGateReady } = await import('../../src/core/archive-validation.js')
      await expect(validateGateReady('gate-01')).rejects.toThrow('not completed')
    })

    it('should pass when gate is completed and validation passes', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue('# Gate\n**Status**: completed')

      const { validateGateReady } = await import('../../src/core/archive-validation.js')
      await expect(validateGateReady('gate-01')).resolves.toBeUndefined()
    })
  })

  describe('validateProposalReady', () => {
    it('should reject when proposal not found', async () => {
      mockExistsSync.mockReturnValue(false)

      const { validateProposalReady } = await import('../../src/core/archive-validation.js')
      await expect(validateProposalReady('abc123')).rejects.toThrow('not found')
    })

    it('should reject when proposal is not completed', async () => {
      // First check: gatesDir exists, then proposal not found in gate dirs, then solitary found
      mockExistsSync
        .mockReturnValueOnce(true) // gatesDir
        .mockReturnValueOnce(false) // proposal in gate dir
        .mockReturnValueOnce(true) // solitaryPath
      mockReadFile.mockResolvedValue('# Proposal\n**Status**: pending\n**Title**: Test')

      const { validateProposalReady } = await import('../../src/core/archive-validation.js')
      await expect(validateProposalReady('abc123')).rejects.toThrow()
    })
  })
})
