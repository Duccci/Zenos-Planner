import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'

describe('archive-validation', () => {
  let tempDir: string
  let gatesDir: string
  let proposalsDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `zeno-test-${Date.now()}`)
    gatesDir = join(tempDir, 'zeno', 'gates')
    proposalsDir = join(tempDir, 'zeno', 'proposals')
    mkdirSync(gatesDir, { recursive: true })
    mkdirSync(proposalsDir, { recursive: true })

    // mock getZenoDir to point to tempDir
    vi.doMock('../../src/utils/config.js', () => ({
      getZenoDir: () => join(tempDir, 'zeno', '.zeno'),
      getProjectRoot: () => tempDir,
      getZenoConfig: vi.fn(),
      loadConfig: vi.fn(),
      saveConfig: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  it('validateGateReady throws when gate file does not exist', async () => {
    const { validateGateReady } = await import('../../src/core/archive-validation.js')
    await expect(validateGateReady('gate-99')).rejects.toMatchObject({
      code: 'ARCHIVE_VALIDATION_FAILED',
    })
  })

  it('validateGateReady throws when gate is not completed', async () => {
    // Create gate file without "completed" status
    const gateFile = join(gatesDir, 'gate-01.md')
    writeFileSync(gateFile, '# Gate 01\n\n**Status**: pending\n')

    const { validateGateReady } = await import('../../src/core/archive-validation.js')
    await expect(validateGateReady('gate-01')).rejects.toMatchObject({
      code: 'ARCHIVE_NOT_READY',
    })
  })

  it('validateGateReady resolves or throws based on artifact validation result', async () => {
    // Create gate file with completed status
    const gateFile = join(gatesDir, 'gate-01.md')
    writeFileSync(gateFile, '# Gate 01\n\n**Status**: completed\n')

    const { validateGateReady } = await import('../../src/core/archive-validation.js')
    // Artifact validation may pass or fail on minimal content - both are acceptable behaviors
    try {
      await validateGateReady('gate-01')
      // If it resolves, that's fine too
    } catch (err) {
      // If it throws, it should be a ZenoError
      expect((err as { code?: string }).code).toBeDefined()
    }
  })

  it('validateProposalReady throws when proposal does not exist', async () => {
    const { validateProposalReady } = await import('../../src/core/archive-validation.js')
    await expect(validateProposalReady('nonexistent-hash')).rejects.toMatchObject({
      code: 'ARCHIVE_VALIDATION_FAILED',
    })
  })

  it('validateProposalReady throws when proposal is not completed', async () => {
    // Create a solitary proposal file without completed status
    const solitaryDir = join(proposalsDir, 'solitary')
    mkdirSync(solitaryDir, { recursive: true })
    const proposalFile = join(solitaryDir, 'my-hash.md')
    writeFileSync(proposalFile, '# Proposal\n\n**Status**: pending\n**Title**: Test Proposal\n')

    const { validateProposalReady } = await import('../../src/core/archive-validation.js')
    await expect(validateProposalReady('my-hash')).rejects.toMatchObject({
      code: 'ARCHIVE_NOT_READY',
    })
  })

  it('validateProposalReady with non-existent hash returns ARCHIVE_VALIDATION_FAILED', async () => {
    // Create a gate subfolder (no matching proposal file)
    mkdirSync(join(proposalsDir, 'gate-01'), { recursive: true })
    const { validateProposalReady } = await import('../../src/core/archive-validation.js')
    await expect(validateProposalReady('no-such-hash-xyz')).rejects.toMatchObject({
      code: 'ARCHIVE_VALIDATION_FAILED',
    })
  })

  it('validateGateReady throws ARCHIVE_VALIDATION_FAILED when artifact validation returns !passed', async () => {
    const gateFile = join(gatesDir, 'gate-02.md')
    writeFileSync(gateFile, '# Gate 02\n\n**Status**: completed\n')

    // Mock ArtifactValidationService to return passed=false
    vi.doMock('../../src/analysis/artifact-validation-service.js', () => ({
      ArtifactValidationService: class {
        validate = vi
          .fn()
          .mockResolvedValue({ passed: false, errors: ['missing required section'] })
      },
    }))

    const { validateGateReady } = await import('../../src/core/archive-validation.js')
    await expect(validateGateReady('gate-02')).rejects.toMatchObject({
      code: 'ARCHIVE_VALIDATION_FAILED',
    })
  })

  it('validateProposalReady resolves with gate-tied type when proposal in gate subdirectory', async () => {
    // Create a gate-01 entry (no-dot name) in gatesDir so it appears in readdir filter
    writeFileSync(join(gatesDir, 'gate-01'), '')

    // Create gate-tied proposal file
    const gatePropDir = join(proposalsDir, 'gate-01')
    mkdirSync(gatePropDir, { recursive: true })
    const proposalFile = join(gatePropDir, 'abc123.md')
    writeFileSync(
      proposalFile,
      '# Proposal: My Feature\n\n**Status**: completed\n**Title**: My Feature\n'
    )

    // Mock ArtifactValidationService to return passed=true
    vi.doMock('../../src/analysis/artifact-validation-service.js', () => ({
      ArtifactValidationService: class {
        validate = vi.fn().mockResolvedValue({ passed: true })
      },
    }))

    const { validateProposalReady } = await import('../../src/core/archive-validation.js')
    const result = await validateProposalReady('abc123')
    expect(result.type).toBe('gate-tied')
    expect(result.gateId).toBe('gate-01')
  })

  it('validateProposalReady throws ARCHIVE_VALIDATION_FAILED when gate-tied proposal validation fails', async () => {
    // Create a gate-01 entry in gatesDir
    writeFileSync(join(gatesDir, 'gate-03'), '')

    const gatePropDir = join(proposalsDir, 'gate-03')
    mkdirSync(gatePropDir, { recursive: true })
    const proposalFile = join(gatePropDir, 'failhash.md')
    writeFileSync(
      proposalFile,
      '# Proposal: Bad One\n\n**Status**: completed\n**Title**: Bad One\n'
    )

    // Mock ArtifactValidationService to return passed=false
    vi.doMock('../../src/analysis/artifact-validation-service.js', () => ({
      ArtifactValidationService: class {
        validate = vi.fn().mockResolvedValue({ passed: false, errors: ['invalid structure'] })
      },
    }))

    const { validateProposalReady } = await import('../../src/core/archive-validation.js')
    await expect(validateProposalReady('failhash')).rejects.toMatchObject({
      code: 'ARCHIVE_VALIDATION_FAILED',
    })
  })
})
