import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'
import { registerReposCommands } from '../../../src/cli/commands/repos.js'
import { logger } from '../../../src/utils/logger.js'

const mockListRepositories = vi.fn()
const mockSaveRepository = vi.fn()
const mockDeleteRepository = vi.fn()
const mockGetRepoDependencyGraph = vi.fn()
const mockDetectCircularDependencies = vi.fn()
const mockDetectRepositoryBoundaries = vi.fn()
const mockShortHash = vi.fn()

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../src/storage/repository-storage.js', () => ({
  listRepositories: (...args: unknown[]) => mockListRepositories(...args),
  saveRepository: (...args: unknown[]) => mockSaveRepository(...args),
  deleteRepository: (...args: unknown[]) => mockDeleteRepository(...args),
}))

vi.mock('../../../src/storage/repository-dependencies.js', () => ({
  getRepoDependencyGraph: (...args: unknown[]) => mockGetRepoDependencyGraph(...args),
  detectCircularDependencies: (...args: unknown[]) => mockDetectCircularDependencies(...args),
}))

vi.mock('../../../src/core/boundary-detection.js', () => ({
  detectRepositoryBoundaries: (...args: unknown[]) => mockDetectRepositoryBoundaries(...args),
}))

vi.mock('../../../src/utils/hash.js', () => ({
  shortHash: (...args: unknown[]) => mockShortHash(...args),
}))

describe('Repos command coverage', () => {
  let program: Command

  beforeEach(() => {
    vi.clearAllMocks()
    mockListRepositories.mockReturnValue([])
    mockGetRepoDependencyGraph.mockReturnValue({ repositories: [], edges: [] })
    mockDetectCircularDependencies.mockReturnValue([])
    mockDetectRepositoryBoundaries.mockResolvedValue({ recommendations: [], persisted: false })
    mockShortHash.mockReturnValue('abc12345')
    program = new Command()
    program.exitOverride()
    registerReposCommands(program)
  })

  it('repos list prints "No repositories registered." when storage is empty', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'list'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('No repositories registered.')
    expect(mockListRepositories).toHaveBeenCalled()
  })

  it('repos list prints a table row for each repository', async () => {
    mockListRepositories.mockReturnValue([
      { hash: 'aabbccdd', name: 'core-lib', type: 'library', path: 'packages/core' },
    ])

    await program.parseAsync(['node', 'test', 'repos', 'list'])

    const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
    expect(calls.some(s => s.includes('core-lib'))).toBe(true)
    expect(calls.some(s => s.includes('library'))).toBe(true)
  })

  it('repos deps prints "No dependency edges found." when graph is empty', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'deps'])

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('No dependency edges found.')
    expect(mockGetRepoDependencyGraph).toHaveBeenCalled()
    expect(mockDetectCircularDependencies).toHaveBeenCalled()
  })

  it('repos deps prints edges when graph has data', async () => {
    mockGetRepoDependencyGraph.mockReturnValue({
      repositories: [{ hash: 'aaa', name: 'svc-a' }],
      edges: [{ from: 'aaabbbcc', to: 'dddeeeff', depType: 'imports' }],
    })

    await program.parseAsync(['node', 'test', 'repos', 'deps'])

    const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
    expect(calls.some(s => s.includes('imports'))).toBe(true)
  })

  it('repos deps prints circular dependency warnings', async () => {
    mockDetectCircularDependencies.mockReturnValue([['aaa', 'bbb', 'aaa']])
    mockGetRepoDependencyGraph.mockReturnValue({
      repositories: [],
      edges: [{ from: 'aaa', to: 'bbb', depType: 'imports' }],
    })

    await program.parseAsync(['node', 'test', 'repos', 'deps'])

    const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
    expect(calls.some(s => s.includes('Circular'))).toBe(true)
  })

  it('repos detect calls detectRepositoryBoundaries with persist:false', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'detect'])

    expect(mockDetectRepositoryBoundaries).toHaveBeenCalledWith(expect.any(String), { persist: false })
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('No boundary recommendations generated.')
  })

  it('repos detect prints recommendations when returned', async () => {
    mockDetectRepositoryBoundaries.mockResolvedValue({
      recommendations: [{ name: 'svc-x', type: 'service', path: 'src/svc-x', rationale: 'High coupling' }],
      persisted: false,
    })

    await program.parseAsync(['node', 'test', 'repos', 'detect'])

    const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
    expect(calls.some(s => s.includes('svc-x'))).toBe(true)
  })

  it('repos detect prints recommendations without rationale (no extra line)', async () => {
    mockDetectRepositoryBoundaries.mockResolvedValue({
      recommendations: [{ name: 'svc-norational', type: 'service', path: 'src/svc-norational' }],
      persisted: false,
    })

    await program.parseAsync(['node', 'test', 'repos', 'detect'])

    const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
    expect(calls.some(s => s.includes('svc-norational'))).toBe(true)
    expect(calls.some(s => s.includes('Rationale'))).toBe(false)
  })

  it('repos adjust without --apply previews without persisting', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'adjust'])

    expect(mockDetectRepositoryBoundaries).toHaveBeenCalledWith(expect.any(String), { persist: false })
    const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
    expect(calls.some(s => s.toLowerCase().includes('preview'))).toBe(true)
  })

  it('repos adjust without --apply prints preview recommendations', async () => {
    mockDetectRepositoryBoundaries.mockResolvedValue({
      recommendations: [{ name: 'svc-preview', type: 'service', path: 'src/svc-preview' }],
      persisted: false,
    })

    await program.parseAsync(['node', 'test', 'repos', 'adjust'])

    const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
    expect(calls.some(s => s.includes('svc-preview'))).toBe(true)
    // persist=false so ternary does NOT add ' applied'
    expect(calls.some(s => s.includes(' applied'))).toBe(false)
  })

  it('repos adjust --apply calls detectRepositoryBoundaries with persist:true', async () => {
    mockDetectRepositoryBoundaries.mockResolvedValue({
      recommendations: [{ name: 'svc-y', type: 'service', path: 'src/svc-y' }],
      persisted: true,
    })

    await program.parseAsync(['node', 'test', 'repos', 'adjust', '--apply'])

    expect(mockDetectRepositoryBoundaries).toHaveBeenCalledWith(expect.any(String), { persist: true })
    const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
    expect(calls.some(s => s.includes('svc-y'))).toBe(true)
  })

  it('repos add calls saveRepository with derived hash', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'add', '--path', 'src/my-service', '--type', 'service', '--name', 'my-service'])

    expect(mockShortHash).toHaveBeenCalledWith('my-servicesrc/my-service')
    expect(mockSaveRepository).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my-service', path: 'src/my-service', type: 'service', hash: 'abc12345' }),
      expect.any(String)
    )
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(expect.stringContaining('my-service'))
  })

  it('repos add derives name from path when --name is omitted', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'add', '--path', 'packages/utils'])

    expect(mockSaveRepository).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'utils', type: 'library' }),
      expect.any(String)
    )
  })

  it('repos add falls back to path when split produces empty segment', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'add', '--path', '/'])

    expect(mockSaveRepository).toHaveBeenCalledWith(
      expect.objectContaining({ name: '/' }),
      expect.any(String)
    )
  })

  it('repos remove calls deleteRepository with the given id', async () => {
    await program.parseAsync(['node', 'test', 'repos', 'remove', '--id', 'repo-abc123'])

    expect(mockDeleteRepository).toHaveBeenCalledWith('repo-abc123', expect.any(String))
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(expect.stringContaining('repo-abc123'))
  })
})
