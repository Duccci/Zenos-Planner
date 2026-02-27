import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockFindProposalByHash = vi.fn()
const mockUpdateTaskStatus = vi.fn()
const mockCalculateCompletionSummary = vi.fn()
const mockUpdateCompletionSummary = vi.fn()

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../src/utils/artifact-locator.js', () => ({
  findProposalByHash: (...args: unknown[]) => mockFindProposalByHash(...args),
}))

vi.mock('../../src/core/proposal-progress.js', () => ({
  updateTaskStatus: (...args: unknown[]) => mockUpdateTaskStatus(...args),
  calculateCompletionSummary: (...args: unknown[]) => mockCalculateCompletionSummary(...args),
  updateCompletionSummary: (...args: unknown[]) => mockUpdateCompletionSummary(...args),
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
  beforeEach(() => vi.clearAllMocks())

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
})
