import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncMemoryFromProjectOverview } from '../../src/utils/memory-sync.js'

const mockFileExists = vi.fn()
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockReadProjectOverview = vi.fn()

vi.mock('../../src/utils/file.js', () => ({
  fileExists: (...args: unknown[]) => mockFileExists(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../src/utils/config.js', () => ({
  readProjectOverview: (...args: unknown[]) => mockReadProjectOverview(...args),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

type OverviewInput = Partial<{
  totalGatesPlanned: number
  completedGates: { name: string; completedAt: string; hash?: string; sequence?: number }[]
  currentGateInfo: { name: string; status?: string } | null
  upcomingGates: { name: string }[]
}>

function makeOverview(overrides: OverviewInput = {}) {
  return {
    totalGatesPlanned: 0,
    completedGates: [] as { name: string; completedAt: string }[],
    currentGateInfo: null as { name: string; status?: string } | null,
    upcomingGates: [] as { name: string }[],
    ...overrides,
  }
}

// Exact section that buildRoadmapSection produces for an empty overview.
// Derived from the join logic in memory-sync.ts with all empty arrays/null values.
const EMPTY_ROADMAP_SECTION =
  '## Gate Roadmap (auto-updated from project-overview.json)\n\n### Completed (0/0)\n_None yet_\n\n### Current\n_None_\n\n### Upcoming\n_None_'

describe('syncMemoryFromProjectOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteFile.mockResolvedValue(undefined)
  })

  it('is a no-op when the memory file does not exist', async () => {
    mockFileExists.mockReturnValue(false)

    await syncMemoryFromProjectOverview('/project')

    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('is a no-op when readProjectOverview throws', async () => {
    mockFileExists.mockReturnValue(true)
    mockReadProjectOverview.mockRejectedValue(new Error('No overview.json'))

    await syncMemoryFromProjectOverview('/project')

    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('is a no-op when readFile throws', async () => {
    mockFileExists.mockReturnValue(true)
    mockReadProjectOverview.mockResolvedValue(makeOverview())
    mockReadFile.mockRejectedValue(new Error('File unreadable'))

    await syncMemoryFromProjectOverview('/project')

    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('appends Gate Roadmap section when heading is absent from file', async () => {
    mockFileExists.mockReturnValue(true)
    mockReadProjectOverview.mockResolvedValue(makeOverview())
    mockReadFile.mockResolvedValue('# Project Memory\n\nSome other content.')

    await syncMemoryFromProjectOverview('/project')

    expect(mockWriteFile).toHaveBeenCalledOnce()
    const [, written] = mockWriteFile.mock.calls[0] as [string, string]
    expect(written).toContain('## Gate Roadmap')
    expect(written).toContain('Some other content.')
  })

  it('replaces stale section when existing content differs', async () => {
    mockFileExists.mockReturnValue(true)
    mockReadProjectOverview.mockResolvedValue(
      makeOverview({
        totalGatesPlanned: 2,
        completedGates: [{ name: 'Bootstrap', completedAt: '2026-01-10T00:00:00.000Z', sequence: 1 }],
        currentGateInfo: { name: 'Core Feature', status: 'in_progress' },
        upcomingGates: [{ name: 'Optimise' }],
      })
    )
    mockReadFile.mockResolvedValue(
      '# Memory\n\n## Gate Roadmap\n_old stale data_\n\n## Notes\nsome notes'
    )

    await syncMemoryFromProjectOverview('/project')

    expect(mockWriteFile).toHaveBeenCalledOnce()
    const [, written] = mockWriteFile.mock.calls[0] as [string, string]
    expect(written).toContain('Bootstrap')
    expect(written).toContain('Core Feature')
    expect(written).toContain('Optimise')
    expect(written).toContain('## Notes')
    expect(written).not.toContain('_old stale data_')
  })

  it('skips write when section is already up to date', async () => {
    mockFileExists.mockReturnValue(true)
    mockReadProjectOverview.mockResolvedValue(makeOverview())
    mockReadFile.mockResolvedValue(EMPTY_ROADMAP_SECTION)

    await syncMemoryFromProjectOverview('/project')

    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('builds section with multiple completed gates and no current gate', async () => {
    mockFileExists.mockReturnValue(true)
    mockReadProjectOverview.mockResolvedValue(
      makeOverview({
        totalGatesPlanned: 3,
        completedGates: [
          { name: 'Gate Alpha', completedAt: '2026-01-01T00:00:00.000Z', sequence: 1 },
          { name: 'Gate Beta', completedAt: '2026-01-15T00:00:00.000Z', sequence: 2 },
        ],
        currentGateInfo: null,
        upcomingGates: [{ name: 'Gate Gamma' }],
      })
    )
    mockReadFile.mockResolvedValue('# Memory') // no existing Gate Roadmap section

    await syncMemoryFromProjectOverview('/project')

    const [, written] = mockWriteFile.mock.calls[0] as [string, string]
    expect(written).toContain('Gate Alpha')
    expect(written).toContain('Gate Beta')
    expect(written).toContain('_None_') // no current gate
    expect(written).toContain('Gate Gamma')
    expect(written).toContain('Completed (2/3)')
  })

  it('builds section with current gate showing status', async () => {
    mockFileExists.mockReturnValue(true)
    mockReadProjectOverview.mockResolvedValue(
      makeOverview({
        totalGatesPlanned: 1,
        currentGateInfo: { name: 'Active Gate', status: 'in_progress' },
        upcomingGates: [],
      })
    )
    mockReadFile.mockResolvedValue('# Memory')

    await syncMemoryFromProjectOverview('/project')

    const [, written] = mockWriteFile.mock.calls[0] as [string, string]
    expect(written).toContain('Active Gate')
    expect(written).toContain('in_progress')
    expect(written).toContain('_None_') // no upcoming
    expect(written).toContain('_None yet_') // no completed
  })
})
