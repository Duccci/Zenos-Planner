import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockFindProposalByHash = vi.fn()
const mockFindGateByGateId = vi.fn()
const mockUpdateTaskStatus = vi.fn()
const mockCalculateCompletionSummary = vi.fn()
const mockUpdateCompletionSummary = vi.fn()
const mockExtractAllCompletedTaskFiles = vi.fn().mockReturnValue([])
const mockDbRun = vi.fn()
const mockDbPrepare = vi.fn(() => ({ run: (...args: unknown[]) => mockDbRun(...args) }))
const mockGetDatabase = vi.fn(() => ({ prepare: (...args: unknown[]) => mockDbPrepare(...args) }))

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../src/utils/artifact-locator.js', () => ({
  findProposalByHash: (...args: unknown[]) => mockFindProposalByHash(...args),
  findGateByGateId: (...args: unknown[]) => mockFindGateByGateId(...args),
}))

vi.mock('../../src/core/proposal-progress.js', () => ({
  updateTaskStatus: (...args: unknown[]) => mockUpdateTaskStatus(...args),
  calculateCompletionSummary: (...args: unknown[]) => mockCalculateCompletionSummary(...args),
  updateCompletionSummary: (...args: unknown[]) => mockUpdateCompletionSummary(...args),
  extractAllCompletedTaskFiles: (...args: unknown[]) => mockExtractAllCompletedTaskFiles(...args),
}))

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
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

describe('proposal-application coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbRun.mockReturnValue({ changes: 1 })
  })

  it('should update proposal progress successfully', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    mockFindProposalByHash.mockResolvedValue('/project/zeno/proposals/gate-01/01-api.md')
    mockReadFile.mockResolvedValue('# Proposal\n- [ ] Task 1\n- [ ] Task 2')
    mockUpdateTaskStatus.mockReturnValue('# Proposal\n- [x] Task 1\n- [ ] Task 2')
    mockCalculateCompletionSummary.mockReturnValue({
      tasksCompleted: 1,
      tasksTotal: 2,
      filesModified: 3,
    })
    mockUpdateCompletionSummary.mockReturnValue(
      '# Proposal\n- [x] Task 1\n- [ ] Task 2\n\n## Summary\n1/2 tasks'
    )
    mockWriteFile.mockResolvedValue(undefined)

    const result = await updateProposalProgress({
      hash: 'abc123',
      taskIndex: 0,
      completed: true,
      notes: 'Done with API',
    })

    expect(result.success).toBe(true)
    expect(result.hash).toBe('abc123')
    expect(result.taskIndex).toBe(0)
    expect(result.completed).toBe(true)
    expect(result.completionSummary?.tasksCompleted).toBe(1)
    expect(mockWriteFile).toHaveBeenCalledTimes(2)
  })

  it('should throw if proposal not found', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    mockFindProposalByHash.mockResolvedValue(null)

    await expect(
      updateProposalProgress({
        hash: 'nonexistent',
        taskIndex: 0,
        completed: true,
      })
    ).rejects.toThrow('Progress update failed')
  })

  it('should throw on readFile error', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    mockFindProposalByHash.mockResolvedValue('/some/path.md')
    mockReadFile.mockRejectedValue(new Error('read failed'))

    await expect(
      updateProposalProgress({
        hash: 'abc',
        taskIndex: 0,
        completed: false,
      })
    ).rejects.toThrow('Progress update failed')
  })

  it('syncs gate Proposal Status table when all tasks are complete', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    const proposalContent =
      '# Proposal: Test\n\n**Hash**: #abc123\n**Gate**: gate-01 - Some Gate\n**Status**: in_progress\n\n- [x] Task 1'
    const gateContent =
      '## Proposals\n\n### Proposal Status\n\n| Proposal | Hash | Status | Notes |\n| Test | #abc123 | pending | Some notes |'

    mockFindProposalByHash.mockResolvedValue('/project/zeno/proposals/gate-01/01-test.md')
    mockFindGateByGateId.mockResolvedValue('/project/zeno/gates/gate-01-some-gate.md')
    mockReadFile
      .mockResolvedValueOnce(proposalContent)  // read proposal
      .mockResolvedValueOnce(gateContent)      // read gate file
    mockUpdateTaskStatus.mockReturnValue(proposalContent)
    mockCalculateCompletionSummary.mockReturnValue({
      tasksCompleted: 1,
      tasksTotal: 1,
      filesModified: 0,
    })
    mockUpdateCompletionSummary.mockReturnValue(proposalContent + '\n\n## Completion Summary')
    mockWriteFile.mockResolvedValue(undefined)

    const result = await updateProposalProgress({
      hash: 'abc123',
      taskIndex: 0,
      completed: true,
    })

    expect(result.proposalCompleted).toBe(true)
    expect(result.gateStatusUpdated).toBe(true)
    // writeFile called: task update, completion summary, and gate update
    expect(mockWriteFile).toHaveBeenCalledTimes(3)
    expect(mockWriteFile).toHaveBeenNthCalledWith(
      2,
      '/project/zeno/proposals/gate-01/01-test.md',
      expect.stringContaining('**Status**: completed')
    )
    expect(mockWriteFile).toHaveBeenNthCalledWith(
      3,
      '/project/zeno/gates/gate-01-some-gate.md',
      expect.stringContaining('| Test | #abc123 | completed | Some notes |')
    )
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining("SET status = 'completed'"))
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'abc123',
      'abc123%'
    )
    expect(mockFindGateByGateId).toHaveBeenCalledWith('gate-01', expect.any(String))
  })

  it('writes completed lifecycle metadata into proposal frontmatter on the final task', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    const frontmatterProposal = `---
hash: abc123
status: in_progress
---

# Proposal: Test

**Hash**: #abc123
**Gate**: Solitary
**Status**: in_progress

- [x] Task 1`

    mockFindProposalByHash.mockResolvedValue('/project/zeno/proposals/solitary/test.md')
    mockReadFile.mockResolvedValueOnce(frontmatterProposal)
    mockUpdateTaskStatus.mockReturnValue(frontmatterProposal)
    mockCalculateCompletionSummary.mockReturnValue({
      tasksCompleted: 1,
      tasksTotal: 1,
      filesModified: 0,
    })
    mockUpdateCompletionSummary.mockReturnValue(frontmatterProposal + '\n\n## Completion Summary')
    mockWriteFile.mockResolvedValue(undefined)

    const result = await updateProposalProgress({
      hash: 'abc123',
      taskIndex: 0,
      completed: true,
    })

    expect(result.proposalCompleted).toBe(true)
    expect(mockWriteFile).toHaveBeenNthCalledWith(
      2,
      '/project/zeno/proposals/solitary/test.md',
      expect.stringContaining('status: completed')
    )
    expect(mockWriteFile).toHaveBeenNthCalledWith(
      2,
      '/project/zeno/proposals/solitary/test.md',
      expect.stringContaining('approved_at: ')
    )
    expect(mockWriteFile).toHaveBeenNthCalledWith(
      2,
      '/project/zeno/proposals/solitary/test.md',
      expect.stringContaining('implemented_at: ')
    )
  })

  it('skips gate sync for solitary proposals (no gate ID in metadata)', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    const solitaryContent =
      '# Proposal: Test\n\n**Hash**: #abc123\n**Gate**: Solitary\n**Status**: in_progress\n\n- [x] Task 1'

    mockFindProposalByHash.mockResolvedValue('/project/zeno/proposals/solitary/test.md')
    mockFindGateByGateId.mockClear()
    mockReadFile.mockResolvedValueOnce(solitaryContent)
    mockUpdateTaskStatus.mockReturnValue(solitaryContent)
    mockCalculateCompletionSummary.mockReturnValue({
      tasksCompleted: 1,
      tasksTotal: 1,
      filesModified: 0,
    })
    mockUpdateCompletionSummary.mockReturnValue(solitaryContent + '\n\n## Completion Summary')
    mockWriteFile.mockResolvedValue(undefined)

    const result = await updateProposalProgress({
      hash: 'abc123',
      taskIndex: 0,
      completed: true,
    })

    expect(result.proposalCompleted).toBe(true)
    expect(result.gateStatusUpdated).toBe(false)
    expect(mockFindGateByGateId).not.toHaveBeenCalled()
  })

  it('should include "in progress" message when completed=false (covers ternary false branch)', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    mockFindProposalByHash.mockResolvedValue('/project/zeno/proposals/gate-01/task.md')
    mockReadFile.mockResolvedValue('# Proposal\n- [ ] Task 1')
    mockUpdateTaskStatus.mockReturnValue('# Proposal\n- [ ] Task 1')
    mockCalculateCompletionSummary.mockReturnValue({
      tasksCompleted: 0,
      tasksTotal: 1,
      filesModified: 0,
    })
    mockUpdateCompletionSummary.mockReturnValue('# Proposal\n- [ ] Task 1\n\n## Summary')
    mockWriteFile.mockResolvedValue(undefined)

    const result = await updateProposalProgress({
      hash: 'xyz',
      taskIndex: 1,
      completed: false,
    })

    expect(result.message).toContain('in progress')
  })

  it('uses "Unknown error" fallback when caught error is not an Error instance (line 96 arm=1)', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    mockFindProposalByHash.mockResolvedValue('/some/path.md')
    // Reject with a plain string (not an Error) → error instanceof Error = false → 'Unknown error'
    mockReadFile.mockRejectedValue('plain string error')

    await expect(
      updateProposalProgress({ hash: 'abc', taskIndex: 0, completed: true })
    ).rejects.toThrow('Unknown error')
  })

  it('returns gateStatusUpdated=false when gate file cannot be found (line 126 arm=0)', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    const proposalContent =
      '# Proposal\n\n**Hash**: #abc123\n**Gate**: gate-01 - Some Gate\n\n- [x] Task 1'

    mockFindProposalByHash.mockResolvedValue('/project/zeno/proposals/gate-01/test.md')
    mockReadFile.mockResolvedValueOnce(proposalContent)
    mockUpdateTaskStatus.mockReturnValue(proposalContent)
    mockCalculateCompletionSummary.mockReturnValue({ tasksCompleted: 1, tasksTotal: 1, filesModified: 0 })
    mockUpdateCompletionSummary.mockReturnValue(proposalContent + '\n\n## Summary')
    mockWriteFile.mockResolvedValue(undefined)
    // findGateByGateId returns null → if (!gatePath) return false (line 126 arm=0)
    mockFindGateByGateId.mockResolvedValue(null)

    const result = await updateProposalProgress({ hash: 'abc123', taskIndex: 0, completed: true })

    expect(result.gateStatusUpdated).toBe(false)
  })

  it('returns gateStatusUpdated=false when gate content has no matching hash row (line 136 arm=0)', async () => {
    const { updateProposalProgress } = await import('../../src/core/proposal-application.js')

    const proposalContent =
      '# Proposal\n\n**Hash**: #abc123\n**Gate**: gate-01 - Some Gate\n\n- [x] Task 1'
    // Gate file without a Proposal Status table row containing the hash
    const gateContentNoRow = '# Gate 01\n\nNo proposal status table here.'

    mockFindProposalByHash.mockResolvedValue('/project/zeno/proposals/gate-01/test.md')
    mockReadFile
      .mockResolvedValueOnce(proposalContent)   // read proposal
      .mockResolvedValueOnce(gateContentNoRow)  // read gate (no matching row)
    mockUpdateTaskStatus.mockReturnValue(proposalContent)
    mockCalculateCompletionSummary.mockReturnValue({ tasksCompleted: 1, tasksTotal: 1, filesModified: 0 })
    mockUpdateCompletionSummary.mockReturnValue(proposalContent + '\n\n## Summary')
    mockWriteFile.mockResolvedValue(undefined)
    mockFindGateByGateId.mockResolvedValue('/project/zeno/gates/gate-01-some-gate.md')

    const result = await updateProposalProgress({ hash: 'abc123', taskIndex: 0, completed: true })

    // rowPattern doesn't match gateContent → return false (line 136 arm=0)
    expect(result.gateStatusUpdated).toBe(false)
  })
})
