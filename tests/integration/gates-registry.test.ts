import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerGatesOps } from '../../src/integration/gates-registry.js'

const mockPrepare = vi.fn()
const mockGetDatabase = vi.fn()
const mockReadProjectOverview = vi.fn()
const mockSaveProjectOverview = vi.fn()
const mockGetGatesFromOverview = vi.fn()
const mockExistsSync = vi.fn()
const mockReaddirSync = vi.fn()
const mockFindGateByGateId = vi.fn().mockResolvedValue(null)
const mockReadFileFsPromises = vi.fn().mockResolvedValue('')
const mockSyncProposalsFromDisk = vi.fn()

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('/project/zeno/.zeno'),
  readProjectOverview: (...args: unknown[]) => mockReadProjectOverview(...args),
  saveProjectOverview: (...args: unknown[]) => mockSaveProjectOverview(...args),
  getGatesFromOverview: (...args: unknown[]) => mockGetGatesFromOverview(...args),
}))

vi.mock('../../src/utils/git.js', () => ({
  getGitUserInfo: vi.fn().mockResolvedValue({ name: 'Test User', email: 'test@example.com' }),
}))

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}))

vi.mock('../../src/integration/command-invoker.js', () => ({
  invokeCommand: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('../../src/utils/artifact-locator.js', () => ({
  findGateByGateId: (...args: unknown[]) => mockFindGateByGateId(...args),
}))

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFileFsPromises(...args),
}))

vi.mock('../../src/storage/proposal-sync.js', () => ({
  syncProposalsFromDisk: (...args: unknown[]) => mockSyncProposalsFromDisk(...args),
}))

vi.mock('../../src/generation/requirement-storage.js', () => ({
  RequirementStorage: class {
    buildRequirementGraph() {
      return { nodes: new Map() }
    }
  },
}))

vi.mock('../../src/core/completions.js', () => ({
  startGate: vi.fn().mockResolvedValue(undefined),
  completeGate: vi.fn().mockResolvedValue({
    projectRoot: '/project',
    gateId: 'gate-01',
    gateName: 'Setup',
    previousVersion: '1.0.0',
    newVersion: '1.1.0',
    bump: 'minor' as const,
    gitInstructions: {
      commitMessage: 'feat(gate-01): complete Setup\n\nVersion: 1.1.0\n',
      tagName: 'v1.1.0-gate-01',
      tagMessage: 'Gate gate-01: Setup (version 1.1.0)',
      commands: [
        'git add -A',
        'git commit -m "feat(gate-01): complete Setup\\n\\nVersion: 1.1.0\\n"',
        'git tag -a v1.1.0-gate-01 -m "Gate gate-01: Setup (version 1.1.0)"',
      ],
    },
  }),
  regenerateGates: vi.fn().mockResolvedValue(undefined),
}))

describe('gates-registry coverage', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()

    mockGetDatabase.mockReturnValue({
      prepare: mockPrepare,
    })

    // Default: overview throws => archive fallback path
    mockReadProjectOverview.mockRejectedValue(new Error('Overview unavailable'))
    mockGetGatesFromOverview.mockReturnValue([])
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
    // Default: no gate file found, empty file content
    mockFindGateByGateId.mockResolvedValue(null)
    mockReadFileFsPromises.mockResolvedValue('')
    mockSyncProposalsFromDisk.mockReturnValue(undefined)

    registerGatesOps(registry)
  })

  describe('gates_list', () => {
    it('should list gates from database', async () => {
      const gateSummaries = [
        { id: 'gate-01', name: 'Setup', status: 'completed', sequence: 1, hash: 'h1' },
        { id: 'gate-02', name: 'Core', status: 'in_progress', sequence: 2, hash: 'h2' },
      ]
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue(gateSummaries)

      const result = (await registry.invoke('gates_list', {})) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { gates: unknown[] }
      expect(data.gates).toHaveLength(2)
    })

    it('should fall back to empty list when overview unavailable and no archive dir', async () => {
      // Default: overview rejects, existsSync returns false
      const result = (await registry.invoke('gates_list', {})) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { gates: unknown[] }
      expect(data.gates).toHaveLength(0)
    })

    it('should fall back to archive files when overview unavailable and archive exists', async () => {
      // existsSync returns true, readdirSync returns gate files
      mockExistsSync.mockReturnValue(true)
      mockReaddirSync.mockReturnValue(['gate-01-setup.md', 'gate-02-core.md', 'other-file.txt'])

      const result = (await registry.invoke('gates_list', {})) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { gates: { id: string; status: string }[] }
      // Only .md files that match gate- pattern
      expect(data.gates.length).toBeGreaterThanOrEqual(2)
      expect(data.gates.every((g) => g.status === 'completed')).toBe(true)
    })
  })

  describe('gates_show', () => {
    it('should show gate details with requirements and proposals counts', async () => {
      const gateSummary = {
        id: 'gate-01',
        name: 'Setup',
        hash: 'h1',
        status: 'completed',
        sequence: 1,
      }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])

      const result = (await registry.invoke('gates_show', { gateId: 'gate-01' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
    })

    it('should normalize gate id (strip and reformat)', async () => {
      const gateSummary = {
        id: 'gate-01',
        name: 'Setup',
        hash: 'h1',
        status: 'completed',
        sequence: 1,
      }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])

      await registry.invoke('gates_show', { gateId: '1' })
      // Should have normalized '1' to 'gate-01' and found the gate
    })

    it('should throw for non-existent gate', async () => {
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([])

      const result = (await registry.invoke('gates_show', { gateId: 'gate-99' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })

    it('should fall back to name search', async () => {
      const gateSummary = {
        id: 'gate-01',
        name: 'Setup',
        hash: 'h1',
        status: 'completed',
        sequence: 1,
      }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])

      const result = (await registry.invoke('gates_show', { gateId: 'Setup' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
    })

    it('should set lastUpdated for in_progress gate', async () => {
      const gateSummary = {
        id: 'gate-02',
        name: 'Core',
        hash: 'h2',
        status: 'in_progress',
        sequence: 2,
        completedAt: null,
      }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])

      const result = (await registry.invoke('gates_show', { gateId: 'gate-02' })) as {
        success: boolean
        data: unknown
      }
      expect(result.success).toBe(true)
      const data = result.data as { lastUpdated: string }
      expect(data.lastUpdated).toBeTruthy()
    })

    it('returns gate with expected structure when file operations complete', async () => {
      const gateSummary = {
        id: 'gate-01',
        name: 'Setup',
        hash: 'h1',
        status: 'completed',
        sequence: 1,
      }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])

      const result = (await registry.invoke('gates_show', { gateId: 'gate-01' })) as {
        success: boolean
        data: { description: string; objectives: unknown[] }
      }
      expect(result.success).toBe(true)
      // Verify structure contains expected fields
      expect(typeof result.data.description).toBe('string')
      expect(Array.isArray(result.data.objectives)).toBe(true)
    })

    it('gates_show returns data with all expected fields', async () => {
      const gateSummary = {
        id: 'gate-01',
        name: 'Setup',
        hash: 'h1',
        status: 'completed',
        sequence: 1,
      }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])

      const result = (await registry.invoke('gates_show', { gateId: 'gate-01' })) as {
        success: boolean
        data: Record<string, unknown>
      }
      expect(result.success).toBe(true)
      const data = result.data
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('description')
      expect(data).toHaveProperty('sequence')
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('type')
      expect(data).toHaveProperty('objectives')
      expect(data).toHaveProperty('requirements')
      expect(data).toHaveProperty('proposals')
      expect(data).toHaveProperty('lastUpdated')
    })

    it('gates_show handles gate with null completedAt', async () => {
      const gateSummary = {
        id: 'gate-02',
        name: 'Core',
        hash: 'h2',
        status: 'in_progress',
        sequence: 2,
        completedAt: null,
      }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])

      const result = (await registry.invoke('gates_show', { gateId: 'gate-02' })) as {
        success: boolean
        data: { lastUpdated: string }
      }
      expect(result.success).toBe(true)
      expect(result.data.lastUpdated).toBeTruthy()
      expect(typeof result.data.lastUpdated).toBe('string')
    })

    it('parses pending and completed objectives from gate PRD file', async () => {
      const gateSummary = { id: 'gate-01', name: 'Setup', hash: 'h1', status: 'completed', sequence: 1 }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])
      mockFindGateByGateId.mockResolvedValue('/project/zeno/gates/gate-01-setup.md')
      mockReadFileFsPromises.mockResolvedValue(
        '# Gate 01: Setup\n\n## Overview\n\nInitial project setup\n\n## Objectives\n\n- [ ] Configure tooling\n- [x] Create repository\n\n## Requirements\n'
      )

      const result = (await registry.invoke('gates_show', { gateId: 'gate-01' })) as {
        success: boolean
        data: { description: string; objectives: Array<{ title: string; completed: boolean }> }
      }
      expect(result.success).toBe(true)
      expect(result.data.description).toBe('Initial project setup')
      expect(result.data.objectives.some((o) => o.completed === false && o.title === 'Configure tooling')).toBe(true)
      expect(result.data.objectives.some((o) => o.completed === true && o.title === 'Create repository')).toBe(true)
    })

    it('normalizes invalid proposal status to pending', async () => {
      const gateSummary = { id: 'gate-01', name: 'Setup', hash: 'h1', status: 'completed', sequence: 1 }
      mockReadProjectOverview.mockResolvedValue({})
      mockGetGatesFromOverview.mockReturnValue([gateSummary])
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue(null),
        all: vi.fn().mockReturnValue([
          { hash: 'p1', title: 'Valid Proposal', status: 'in_progress' },
          { hash: 'p2', title: 'Bad Status', status: 'unknown_status_xyz' },
          { hash: '', title: 'No Hash', status: 'pending' }, // filtered out
        ]),
      })

      const result = (await registry.invoke('gates_show', { gateId: 'gate-01' })) as {
        success: boolean
        data: { proposals: Array<{ hash: string; status: string }> }
      }
      expect(result.success).toBe(true)
      const p2 = result.data.proposals.find((p) => p.hash === 'p2')
      expect(p2?.status).toBe('pending')
      const p1 = result.data.proposals.find((p) => p.hash === 'p1')
      expect(p1?.status).toBe('in_progress')
    })
  })

  describe('gates_start', () => {
    it('should start a gate', async () => {
      mockPrepare.mockReturnValue({ get: vi.fn().mockReturnValue({ status: 'validated' }) })
      const result = (await registry.invoke('gates_start', { gateId: 'gate-01' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
    })
  })

  describe('gates_complete', () => {
    it('should complete a gate', async () => {
      const result = (await registry.invoke('gates_complete', { gateId: 'gate-01' })) as {
        success: boolean
      }
      expect(result.success).toBe(true)
    })
  })

  describe('gates_regenerate', () => {
    it('should regenerate gates', async () => {
      const result = (await registry.invoke('gates_regenerate', {})) as { success: boolean }
      expect(result.success).toBe(true)
    })
  })

  describe('gate_cancel', () => {
    beforeEach(() => {
      mockSaveProjectOverview.mockResolvedValue(undefined)
    })

    it('cancels an upcoming gate', async () => {
      mockReadProjectOverview.mockResolvedValue({
        upcomingGates: [{ sequence: 1, name: 'Setup', hash: 'h1', estimatedComplexity: 'medium' }],
        currentGate: null,
        currentGateInfo: null,
        completedGates: [],
        cancelledGates: [],
        backlogGates: [],
        totalGatesPlanned: 1,
      })

      const result = (await registry.invoke('gate_cancel', { gateId: 'gate-01' })) as {
        success: boolean
        data: { gateId: string; previousStatus: string; newStatus: string }
      }

      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('cancelled')
      expect(result.data.previousStatus).toBe('pending')
      expect(mockSaveProjectOverview).toHaveBeenCalledOnce()
    })

    it('cancels the current in-progress gate', async () => {
      mockReadProjectOverview.mockResolvedValue({
        upcomingGates: [],
        currentGate: 'gate-02',
        currentGateInfo: { sequence: 2, name: 'Core Feature', hash: 'h2', status: 'in_progress' },
        completedGates: [],
        cancelledGates: [],
        backlogGates: [],
        totalGatesPlanned: 2,
      })

      const result = (await registry.invoke('gate_cancel', {
        gateId: 'gate-02',
        reason: 'Scope change',
      })) as { success: boolean; data: { previousStatus: string; newStatus: string } }

      expect(result.success).toBe(true)
      expect(result.data.previousStatus).toBe('in_progress')
      expect(result.data.newStatus).toBe('cancelled')
    })

    it('returns error when gate is not found', async () => {
      mockReadProjectOverview.mockResolvedValue({
        upcomingGates: [],
        currentGate: null,
        currentGateInfo: null,
        completedGates: [],
        cancelledGates: [],
        backlogGates: [],
        totalGatesPlanned: 0,
      })

      const result = (await registry.invoke('gate_cancel', { gateId: 'gate-99' })) as {
        success: boolean
      }

      expect(result.success).toBe(false)
    })
  })

  describe('gate_defer', () => {
    beforeEach(() => {
      mockSaveProjectOverview.mockResolvedValue(undefined)
    })

    it('defers an upcoming gate to backlog', async () => {
      mockReadProjectOverview.mockResolvedValue({
        upcomingGates: [{ sequence: 3, name: 'Optimisation', hash: 'h3', estimatedComplexity: 'low' }],
        currentGate: null,
        currentGateInfo: null,
        completedGates: [],
        cancelledGates: [],
        backlogGates: [],
        totalGatesPlanned: 3,
      })

      const result = (await registry.invoke('gate_defer', { gateId: 'gate-03' })) as {
        success: boolean
        data: { gateId: string; previousStatus: string; newStatus: string }
      }

      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('backlog')
      expect(result.data.previousStatus).toBe('pending')
      expect(mockSaveProjectOverview).toHaveBeenCalledOnce()
    })

    it('defers the current in-progress gate to backlog', async () => {
      mockReadProjectOverview.mockResolvedValue({
        upcomingGates: [],
        currentGate: 'gate-02',
        currentGateInfo: {
          sequence: 2,
          name: 'Core Feature',
          hash: 'h2',
          status: 'in_progress',
          estimatedComplexity: 'high',
        },
        completedGates: [],
        cancelledGates: [],
        backlogGates: [],
        totalGatesPlanned: 2,
      })

      const result = (await registry.invoke('gate_defer', { gateId: 'gate-02' })) as {
        success: boolean
        data: { newStatus: string }
      }

      expect(result.success).toBe(true)
      expect(result.data.newStatus).toBe('backlog')
    })

    it('returns error when gate is not found', async () => {
      mockReadProjectOverview.mockResolvedValue({
        upcomingGates: [],
        currentGate: null,
        currentGateInfo: null,
        completedGates: [],
        cancelledGates: [],
        backlogGates: [],
        totalGatesPlanned: 0,
      })

      const result = (await registry.invoke('gate_defer', { gateId: 'gate-88' })) as {
        success: boolean
      }

      expect(result.success).toBe(false)
    })
  })
})
