import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncMemoryFromProjectOverview } from '../../src/utils/memory-sync.js'
import type { Project, ProjectGate } from '../../src/utils/config.js'

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
  getCompletedGates: (p: Project) =>
    p.gates.filter((g: ProjectGate) => g.status === 'completed').sort((a: ProjectGate, b: ProjectGate) => a.sequence - b.sequence),
  getUpcomingGates: (p: Project) =>
    p.gates.filter((g: ProjectGate) => g.status === 'pending' || g.status === 'validated').sort((a: ProjectGate, b: ProjectGate) => a.sequence - b.sequence),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

type GateInput = Partial<ProjectGate>

function makeGate(seq: number, overrides: GateInput = {}): ProjectGate {
  return {
    id: `gate-${String(seq).padStart(2, '0')}`,
    sequence: seq,
    name: `Gate ${seq}`,
    hash: `hash${seq}`,
    status: 'pending',
    type: 'feature',
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  } as ProjectGate
}

function makeOverview(gates: ProjectGate[] = [], totalGatesPlanned = 0): Project {
  return {
    project: {
      name: 'Test Project',
      version: '0.1.0',
      projectStatement: 'Done',

      totalGatesPlanned,
    },
    gates,
    lastUpdated: new Date().toISOString(),
    status: 'awaiting_review',
  }
}

// Exact section that buildRoadmapSection produces for an empty overview.
// Derived from the join logic in memory-sync.ts with all empty arrays/null values.
const EMPTY_ROADMAP_SECTION =
  '## Gate Roadmap (auto-updated from project.json)\n\n### Completed (0/0)\n_None yet_\n\n### Current\n_None_\n\n### Upcoming\n_None_'

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
      makeOverview([
        makeGate(1, { name: 'Bootstrap', status: 'completed', completedAt: '2026-01-10T00:00:00.000Z' }),
        makeGate(2, { name: 'Core Feature', status: 'in_progress' }),
        makeGate(3, { name: 'Optimise', status: 'pending' }),
      ], 3)
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
      makeOverview([
        makeGate(1, { name: 'Gate Alpha', status: 'completed', completedAt: '2026-01-01T00:00:00.000Z' }),
        makeGate(2, { name: 'Gate Beta', status: 'completed', completedAt: '2026-01-15T00:00:00.000Z' }),
        makeGate(3, { name: 'Gate Gamma', status: 'pending' }),
      ], 3)
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
      makeOverview([
        makeGate(1, { name: 'Active Gate', status: 'in_progress' }),
      ], 1)
    )
    mockReadFile.mockResolvedValue('# Memory')

    await syncMemoryFromProjectOverview('/project')

    const [, written] = mockWriteFile.mock.calls[0] as [string, string]
    expect(written).toContain('Active Gate')
    expect(written).toContain('in_progress')
    expect(written).toContain('_None_') // no upcoming
    expect(written).toContain('_None yet_') // no completed
  })

  it('builds section with only pending gate (no current gate)', async () => {
    mockFileExists.mockReturnValue(true)
    mockReadProjectOverview.mockResolvedValue(
      makeOverview([
        makeGate(1, { name: 'Statusless Gate', status: 'pending' }),
      ], 1)
    )
    mockReadFile.mockResolvedValue('# Memory')

    await syncMemoryFromProjectOverview('/project')

    const [, written] = mockWriteFile.mock.calls[0] as [string, string]
    expect(written).toContain('Statusless Gate')
    expect(written).toContain('_None_') // no current (pending != in_progress)
  })
})
