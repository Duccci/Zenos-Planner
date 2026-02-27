/**
 * Proposal Locator - Branch Coverage Tests
 *
 * Tests the content-based hash scanning behaviour: files are named by date,
 * not by hash, so the locator reads each .md file and matches the embedded
 * `**Hash**: #?<hash>` frontmatter line.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

describe('artifact-locator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns file path when found in gate directory', async () => {
    const fsPromises = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/utils/artifact-locator.js')

    vi.mocked(existsSync).mockReturnValue(true)
    // proposals root
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce(['gate-01'] as any)
    // stat gate-01 → directory
    vi.mocked(fsPromises.stat).mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any)
    // gate-01 contents
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce(['2026-02-24-my-feature.md'] as any)
    // stat 2026-02-24-my-feature.md → file
    vi.mocked(fsPromises.stat).mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any)
    // file content with matching hash
    vi.mocked(fsPromises.readFile).mockResolvedValueOnce('# Proposal\n\n**Hash**: abc123\n**Status**: completed\n' as any)

    const result = await findProposalByHash('abc123', '/project')
    expect(result).toContain('gate-01')
    expect(result).toContain('2026-02-24-my-feature.md')
  })

  it('returns null when entry is not a directory (file entry branch)', async () => {
    const fsPromises = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/utils/artifact-locator.js')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce(['readme.md'] as any)
    // stat readme.md → file (not a directory)
    vi.mocked(fsPromises.stat).mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any)
    // content does not match
    vi.mocked(fsPromises.readFile).mockResolvedValueOnce('# README\n\nNo hash here.\n' as any)

    const result = await findProposalByHash('not-found', '/project')
    expect(result).toBeNull()
  })

  it('returns file path when found in solitary directory', async () => {
    const fsPromises = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/utils/artifact-locator.js')

    vi.mocked(existsSync).mockReturnValue(true)
    // proposals root — only solitary
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce(['solitary'] as any)
    // stat solitary → directory
    vi.mocked(fsPromises.stat).mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any)
    // solitary contents
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce(['2026-02-24-01-something.md'] as any)
    // stat file → file
    vi.mocked(fsPromises.stat).mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any)
    // content with matching hash
    vi.mocked(fsPromises.readFile).mockResolvedValueOnce('# Proposal\n\n**Hash**: sol-hash\n**Status**: in_progress\n' as any)

    const result = await findProposalByHash('sol-hash', '/project')
    expect(result).toContain('solitary')
    expect(result).toContain('2026-02-24-01-something.md')
  })

  it('returns null when readdir throws (catch branch)', async () => {
    const fsPromises = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/utils/artifact-locator.js')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(fsPromises.readdir).mockRejectedValueOnce(new Error('ENOENT'))

    const result = await findProposalByHash('any', '/missing')
    expect(result).toBeNull()
  })

  it('returns null when directory exists but hash not found anywhere', async () => {
    const fsPromises = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/utils/artifact-locator.js')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce(['gate-01'] as any)
    vi.mocked(fsPromises.stat).mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any)
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce(['other-proposal.md'] as any)
    vi.mocked(fsPromises.stat).mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any)
    // content does not contain the target hash
    vi.mocked(fsPromises.readFile).mockResolvedValueOnce('# Proposal\n\n**Hash**: different-hash\n' as any)

    const result = await findProposalByHash('ghost', '/project')
    expect(result).toBeNull()
  })
})


