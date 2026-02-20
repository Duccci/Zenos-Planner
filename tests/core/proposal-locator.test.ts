/**
 * Proposal Locator - Branch Coverage Tests
 *
 * Tests uncovered branches: directory with non-matching files,
 * solitary folder match, and readdir error path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

describe('proposal-locator branches', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns file path when found in gate directory', async () => {
    const { readdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/core/proposal-locator.js')

    vi.mocked(readdir).mockResolvedValueOnce([
      { name: 'gate-01', isDirectory: () => true, isFile: () => false },
    ] as any)
    vi.mocked(existsSync).mockReturnValueOnce(true)

    const result = await findProposalByHash('abc123', '/project')
    expect(result).toContain('abc123.md')
  })

  it('returns null when entry is not a directory (file entry branch)', async () => {
    const { readdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/core/proposal-locator.js')

    vi.mocked(readdir).mockResolvedValueOnce([
      { name: 'readme.md', isDirectory: () => false, isFile: () => true },
    ] as any)
    // No match in dirs, check solitary
    vi.mocked(existsSync).mockReturnValueOnce(false)

    const result = await findProposalByHash('not-found', '/project')
    expect(result).toBeNull()
  })

  it('returns solitary path when found in solitary dir', async () => {
    const { readdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/core/proposal-locator.js')

    vi.mocked(readdir).mockResolvedValueOnce([
      { name: 'gate-01', isDirectory: () => true, isFile: () => false },
    ] as any)
    // Not in gate dir, but found in solitary
    vi.mocked(existsSync)
      .mockReturnValueOnce(false) // gate dir check
      .mockReturnValueOnce(true) // solitary check

    const result = await findProposalByHash('sol-hash', '/project')
    expect(result).toContain('solitary')
    expect(result).toContain('sol-hash.md')
  })

  it('returns null when readdir throws (catch branch)', async () => {
    const { readdir } = await import('node:fs/promises')
    const { findProposalByHash } = await import('../../src/core/proposal-locator.js')

    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT'))

    const result = await findProposalByHash('any', '/missing')
    expect(result).toBeNull()
  })

  it('returns null when directory exists but hash not found anywhere', async () => {
    const { readdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { findProposalByHash } = await import('../../src/core/proposal-locator.js')

    vi.mocked(readdir).mockResolvedValueOnce([
      { name: 'gate-01', isDirectory: () => true, isFile: () => false },
      { name: 'gate-02', isDirectory: () => true, isFile: () => false },
    ] as any)
    vi.mocked(existsSync).mockReturnValue(false)

    const result = await findProposalByHash('ghost', '/project')
    expect(result).toBeNull()
  })
})
