import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { Command } from 'commander'
import { registerTraceCommand } from '../../../src/cli/commands/trace.js'

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockInvoke = vi.fn()
vi.mock('../../../src/integration/function-implementations.js', () => ({
  getGlobalRegistry: vi.fn().mockReturnValue({
    invoke: (...args: unknown[]) => mockInvoke(...args),
  }),
}))

describe('trace command action coverage', () => {
  let program: Command
  let exitSpy: MockInstance
  let consoleSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    program = new Command()
    program.exitOverride()
    registerTraceCommand(program)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('should print pretty output on success', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: {
        commits: [
          {
            commitSha: 'abc123def456',
            subject: 'feat: add feature',
            author: 'Test User',
            date: '2024-01-15',
            confidenceScore: 0.95,
            notes: 'Direct hash match',
            filesChanged: ['src/foo.ts', 'src/bar.ts'],
          },
          {
            commitSha: 'def456abc789',
            subject: 'fix: bug fix',
            author: 'Another User',
            date: '2024-01-16',
            confidenceScore: 0.8,
            filesChanged: ['src/baz.ts'],
          },
        ],
        totalCommits: 100,
      },
    })

    await program.parseAsync(['node', 'test', 'trace', 'abc123'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found 2 commits'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total commits searched: 100'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('abc123de'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Author: Test User'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Confidence: 95.0%'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Notes: Direct hash match'))
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Files: src/foo.ts, src/bar.ts')
    )
  })

  it('should print JSON output with --json flag', async () => {
    const data = {
      commits: [
        {
          commitSha: 'abc123',
          subject: 'test',
          author: 'Test',
          date: '2024-01-01',
          confidenceScore: 1.0,
          filesChanged: [],
        },
      ],
      totalCommits: 10,
    }
    mockInvoke.mockResolvedValue({ success: true, data })

    await program.parseAsync(['node', 'test', 'trace', '--json', 'abc123'])

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2))
  })

  it('should pass date range, branch, and limit params', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: { commits: [], totalCommits: 0 },
    })

    await program.parseAsync([
      'node',
      'test',
      'trace',
      '--from',
      '2024-01-01',
      '--to',
      '2024-06-01',
      '--branch',
      'main',
      '--limit',
      '5',
      'hash123',
    ])

    expect(mockInvoke).toHaveBeenCalledWith('git_trace', {
      artifactHash: 'hash123',
      dateRange: { from: '2024-01-01', to: '2024-06-01' },
      branch: 'main',
      limit: 5,
    })
  })

  it('should handle error result from registry', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: { message: 'No git repo' },
    })

    await expect(program.parseAsync(['node', 'test', 'trace', 'abc'])).rejects.toThrow()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should handle exception from registry invoke', async () => {
    mockInvoke.mockRejectedValue(new Error('Network failure'))

    await expect(program.parseAsync(['node', 'test', 'trace', 'abc'])).rejects.toThrow()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should handle success with no data', async () => {
    mockInvoke.mockResolvedValue({ success: true, data: undefined })

    await expect(program.parseAsync(['node', 'test', 'trace', 'abc'])).rejects.toThrow()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should handle commits without notes', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: {
        commits: [
          {
            commitSha: 'a1b2c3d4e5f6',
            subject: 'no notes commit',
            author: 'Dev',
            date: '2024-02-01',
            confidenceScore: 0.5,
            filesChanged: ['README.md'],
          },
        ],
        totalCommits: 50,
      },
    })

    await program.parseAsync(['node', 'test', 'trace', 'xyz'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Confidence: 50.0%'))
    // Notes line should NOT appear
    const notesCalls = consoleSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('Notes:')
    )
    expect(notesCalls.length).toBe(0)
  })

  it('should handle empty commits list', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: { commits: [], totalCommits: 200 },
    })

    await program.parseAsync(['node', 'test', 'trace', 'xyz'])
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found 0 commits'))
  })

  it('should handle error result without message', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: {},
    })

    await expect(program.parseAsync(['node', 'test', 'trace', 'abc'])).rejects.toThrow()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
