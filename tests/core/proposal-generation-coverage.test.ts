import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/utils/file.js', () => ({
  readFile: vi.fn().mockResolvedValue(
    '# Gate PRD\n\n## Objectives\n\n- Build API\n- Add Auth\n\n## Requirements\n\n- REQ-001: REST endpoints\n'
  ),
}))

vi.mock('../../src/core/proposal-parser.js', () => ({
  extractObjectives: vi.fn().mockReturnValue(['Build API', 'Add Auth']),
  extractRequirements: vi.fn().mockReturnValue([
    { id: 'req-1', description: 'REST endpoints' },
  ]),
}))

vi.mock('../../src/core/proposal-writer.js', () => ({
  decomposeToProposals: vi.fn().mockResolvedValue([
    {
      hash: 'abc12345',
      filename: '01-build-api.md',
      path: '/out/01-build-api.md',
      type: 'gate-tied',
      status: 'pending',
      summary: 'Build API',
    },
    {
      hash: 'def67890',
      filename: '02-add-auth.md',
      path: '/out/02-add-auth.md',
      type: 'gate-tied',
      status: 'pending',
      summary: 'Add Auth',
    },
  ]),
  calculateProposalDependencies: vi.fn().mockReturnValue([
    { from: 'abc12345', to: 'def67890', type: 'sequential' },
  ]),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../src/utils/errors.js', () => ({
  ZenoError: class extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.code = code
    }
  },
}))

describe('proposal-generation coverage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should generate proposals from gate PRD', async () => {
    const { generateProposals } = await import('../../src/core/proposal-generation.js')

    const result = await generateProposals({
      gateId: 'gate-01-core-api',
      templateName: 'proposal-template',
      outputDir: '/output/proposals',
    })

    expect(result.success).toBe(true)
    expect(result.gateId).toBe('gate-01-core-api')
    expect(result.proposalsGenerated).toBe(2)
    expect(result.proposals).toHaveLength(2)
    expect(result.dependencies).toHaveLength(1)
    expect(result.message).toContain('Generated 2 proposals')
  })

  it('should use default template name', async () => {
    const { generateProposals } = await import('../../src/core/proposal-generation.js')

    const result = await generateProposals({
      gateId: 'gate-02-auth-layer',
    })

    expect(result.success).toBe(true)
  })

  it('should handle read error', async () => {
    const { readFile } = await import('../../src/utils/file.js')
    vi.mocked(readFile).mockRejectedValueOnce(new Error('file not found'))

    const { generateProposals } = await import('../../src/core/proposal-generation.js')

    await expect(
      generateProposals({ gateId: 'gate-99-nonexistent' })
    ).rejects.toThrow('Proposal generation failed')
  })
})
