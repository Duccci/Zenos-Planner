import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectConflicts } from '../../src/core/conflict-detector.js'

vi.mock('../../src/registry/schema-registry.js', () => ({
  SchemaRegistry: vi.fn(),
}))

/** Minimal proposal fixture for conflict detection tests */
interface TestProposal {
  hash: string
  repositoryId?: string
  filesAffected: string[]
}

describe('conflict-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detects conflict between two proposals sharing a file', async () => {
    const proposals: TestProposal[] = [
      { hash: 'prop-a', filesAffected: ['src/storage/repository-storage.ts', 'src/types.ts'] },
      { hash: 'prop-b', filesAffected: ['src/storage/repository-storage.ts', 'src/cli/index.ts'] },
      { hash: 'prop-c', filesAffected: ['src/analysis/code-analyzer.ts'] },
    ]

    const result = await detectConflicts('prop-a', proposals)

    expect(result.hasConflicts).toBe(true)
    expect(result.conflicts.length).toBeGreaterThan(0)
    const conflict = result.conflicts[0]
    expect(conflict?.conflictingFiles).toContain('src/storage/repository-storage.ts')
    expect(conflict?.proposalHash).toBe('prop-b')
  })

  it('reports no conflicts when proposals touch distinct files', async () => {
    const proposals: TestProposal[] = [
      { hash: 'prop-a', filesAffected: ['src/storage/repository-storage.ts'] },
      { hash: 'prop-b', filesAffected: ['src/cli/repos.ts'] },
      { hash: 'prop-c', filesAffected: ['src/analysis/code-analyzer.ts'] },
    ]

    const result = await detectConflicts('prop-a', proposals)

    expect(result.hasConflicts).toBe(false)
    expect(result.conflicts).toHaveLength(0)
  })

  it('conflict report includes file paths and proposal hashes', async () => {
    const proposals: TestProposal[] = [
      { hash: 'prop-x', filesAffected: ['src/core/boundary-detection.ts', 'src/types.ts'] },
      { hash: 'prop-y', filesAffected: ['src/types.ts'] },
    ]

    const result = await detectConflicts('prop-x', proposals)

    expect(result.hasConflicts).toBe(true)
    const conflict = result.conflicts[0]
    expect(conflict).toHaveProperty('proposalHash')
    expect(conflict).toHaveProperty('conflictingFiles')
    expect(typeof conflict?.proposalHash).toBe('string')
    expect(Array.isArray(conflict?.conflictingFiles)).toBe(true)
  })

  it('detects cross-repository conflicts when repos share a file path', async () => {
    const proposals: TestProposal[] = [
      { hash: 'prop-r1', repositoryId: 'repo-api', filesAffected: ['shared/types.ts', 'src/api.ts'] },
      { hash: 'prop-r2', repositoryId: 'repo-client', filesAffected: ['shared/types.ts', 'src/client.ts'] },
    ]

    const result = await detectConflicts('prop-r1', proposals)

    expect(result.hasConflicts).toBe(true)
    const conflict = result.conflicts[0]
    expect(conflict?.conflictingFiles).toContain('shared/types.ts')
    expect(conflict?.proposalHash).toBe('prop-r2')
  })

  it('does not report the target proposal as conflicting with itself', async () => {
    const proposals: TestProposal[] = [
      { hash: 'prop-self', filesAffected: ['src/storage/repository-storage.ts'] },
    ]

    const result = await detectConflicts('prop-self', proposals)

    expect(result.hasConflicts).toBe(false)
    const selfConflicts = result.conflicts.filter(c => c.proposalHash === 'prop-self')
    expect(selfConflicts).toHaveLength(0)
  })
})
