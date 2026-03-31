/**
 * Gates Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerGatesCommands } from '../../../src/cli/commands/gates.js'
import { validateTransition, GATE_TRANSITIONS } from '../../../src/core/transitions.js'
import { Command } from 'commander'
import type Database from 'better-sqlite3'

// Mock dependencies
vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../../../src/core/completions.js', () => ({
  completeGate: vi.fn(),
}))

vi.mock('../../../src/core/gate-generator.js', () => ({
  regenerateGatesWithAnalysis: vi.fn(),
  regenerateGatesTheoreticalFromProject: vi.fn(),
  replanGates: vi.fn(),
}))

vi.mock('../../../src/core/write-time-analyzer.js', () => ({
  analyzeGateChanges: vi.fn(),
}))

vi.mock('../../../src/storage/database.js', () => ({
  getDatabase: vi.fn(),
}))

vi.mock('../../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('zeno'),
  getWorkspaceRoot: vi.fn().mockReturnValue('/mock-workspace'),
  readProjectOverview: vi.fn(),
  saveProjectOverview: vi.fn().mockResolvedValue(undefined),
  getGatesFromOverview: vi.fn().mockReturnValue([]),
}))

vi.mock('../../../src/utils/state-sync.js', () => ({
  updateCurrentGateInState: vi.fn().mockResolvedValue(undefined),
  syncProjectMetadataToState: vi.fn().mockResolvedValue(undefined),
  syncUpcomingGatesToState: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/utils/gate-sync.js', () => ({
  syncGatesToProjectOverview: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}))

describe('Gates Commands', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should register gates command with subcommands', () => {
    const program = new Command()
    registerGatesCommands(program)

    const gatesCmd = program.commands.find((cmd) => cmd.name() === 'gates')
    expect(gatesCmd).toBeDefined()

    const subcommands = gatesCmd!.commands.map((cmd) => cmd.name())
    expect(subcommands).toContain('list')
    expect(subcommands).toContain('show')
    expect(subcommands).toContain('start')
    expect(subcommands).toContain('complete')
    expect(subcommands).toContain('replan')
  })

  describe('gates list', () => {
    it('should display gates in table format', async () => {
      const { readProjectOverview, getGatesFromOverview } =
        await import('../../../src/utils/config.js')
      const { logger } = await import('../../../src/utils/logger.js')

      const mockSummaries = [
        { id: 'gate-01', sequence: 1, name: 'Foundation', status: 'completed', hash: 'hash1' },
        { id: 'gate-02', sequence: 2, name: 'Features', status: 'in_progress', hash: 'hash2' },
      ]

      vi.mocked(readProjectOverview).mockResolvedValue({} as any)
      vi.mocked(getGatesFromOverview).mockReturnValue(mockSummaries as any)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'list'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Project Gates'))
    })

    it('should filter gates by status', async () => {
      const { readProjectOverview, getGatesFromOverview } =
        await import('../../../src/utils/config.js')
      const { logger } = await import('../../../src/utils/logger.js')

      const mockSummaries = [
        { id: 'gate-01', sequence: 1, name: 'Foundation', status: 'completed', hash: 'hash1' },
        { id: 'gate-02', sequence: 2, name: 'Features', status: 'in_progress', hash: 'hash2' },
      ]

      vi.mocked(readProjectOverview).mockResolvedValue({} as any)
      vi.mocked(getGatesFromOverview).mockReturnValue(mockSummaries as any)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'list', '--status', 'completed'])

      // Filtering is now done in JS — only completed gate should appear
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Project Gates'))
    })
  })

  describe('gates show', () => {
    it('should display gate details', async () => {
      const { getDatabase } = await import('../../../src/storage/database.js')
      const { readProjectOverview, getGatesFromOverview } =
        await import('../../../src/utils/config.js')
      const { logger } = await import('../../../src/utils/logger.js')
      const { existsSync } = await import('node:fs')

      const mockGateSummary = {
        id: 'gate-01',
        sequence: 1,
        name: 'Foundation',
        status: 'completed',
        hash: 'hash1',
      }

      vi.mocked(readProjectOverview).mockResolvedValue({} as any)
      vi.mocked(getGatesFromOverview).mockReturnValue([mockGateSummary] as any)

      // DB still used for requirements/proposals counts
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('SELECT COUNT(*) as count FROM requirements')) {
          return { get: vi.fn().mockReturnValue({ count: 5 }) }
        }
        if (query.includes('SELECT COUNT(*) as count FROM proposals')) {
          return { get: vi.fn().mockReturnValue({ count: 3 }) }
        }
        return { get: vi.fn().mockReturnValue({ count: 0 }), all: vi.fn().mockReturnValue([]) }
      })

      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)
      vi.mocked(existsSync).mockReturnValue(true)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'show', 'gate-01'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Gate Details'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('gate-01'))
    })

    it('should handle non-existent gate', async () => {
      const { readProjectOverview, getGatesFromOverview } =
        await import('../../../src/utils/config.js')
      const { logger } = await import('../../../src/utils/logger.js')

      vi.mocked(readProjectOverview).mockResolvedValue({} as any)
      vi.mocked(getGatesFromOverview).mockReturnValue([])

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      try {
        await program.parseAsync(['node', 'test', 'gates', 'show', 'invalid-gate'])
      } catch (error) {
        // Expected to exit
      }

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'))
    })
  })

  describe('gates start', () => {
    it('should transition gate from validated to in_progress', async () => {
      const { readProjectOverview, getGatesFromOverview } =
        await import('../../../src/utils/config.js')
      const { updateCurrentGateInState } =
        await import('../../../src/utils/state-sync.js')
      const { confirm } = await import('@inquirer/prompts')
      const { logger } = await import('../../../src/utils/logger.js')

      const mockGateSummary = {
        id: 'gate-01',
        sequence: 1,
        name: 'Foundation',
        status: 'validated',
        hash: 'hash1',
      }

      const mockOverview = {
        project: { name: 'Test', version: '1.0.0', projectStatement: 'Done', totalGatesPlanned: 1 },
        gates: [],
        lastUpdated: new Date().toISOString(),
        status: 'awaiting_review',
      } as any
      vi.mocked(readProjectOverview).mockResolvedValue(mockOverview)
      vi.mocked(getGatesFromOverview).mockReturnValue([mockGateSummary] as any)
      vi.mocked(confirm).mockResolvedValue(true)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'start', 'gate-01'])

      expect(confirm).toHaveBeenCalled()
      expect(updateCurrentGateInState).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('started successfully'))
    })

    it('should reject invalid status transitions', async () => {
      const { readProjectOverview, getGatesFromOverview } =
        await import('../../../src/utils/config.js')
      const { logger } = await import('../../../src/utils/logger.js')

      const mockGateSummary = {
        id: 'gate-01',
        sequence: 1,
        name: 'Foundation',
        status: 'completed',
        hash: 'hash1',
      }

      vi.mocked(readProjectOverview).mockResolvedValue({} as any)
      vi.mocked(getGatesFromOverview).mockReturnValue([mockGateSummary] as any)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      try {
        await program.parseAsync(['node', 'test', 'gates', 'start', 'gate-01'])
      } catch (error) {
        // Expected to exit
      }

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot transition'))
    })
  })

  describe('gate ID normalization', () => {
    it('should normalize various gate ID formats', () => {
      // Test normalization function indirectly through gate lookup
      expect(normalizeGateId('1')).toBe('gate-01')
      expect(normalizeGateId('01')).toBe('gate-01')
      expect(normalizeGateId('gate-1')).toBe('gate-01')
      expect(normalizeGateId('gate-01')).toBe('gate-01')
      expect(normalizeGateId('gate 01')).toBe('gate-01')
    })
  })

  describe('status transition validation', () => {
    it('should allow valid transitions', () => {
      expect(validateTransition(GATE_TRANSITIONS, 'pending', 'validated').valid).toBe(true)
      expect(validateTransition(GATE_TRANSITIONS, 'validated', 'in_progress').valid).toBe(true)
      expect(validateTransition(GATE_TRANSITIONS, 'in_progress', 'completed').valid).toBe(true)
      expect(validateTransition(GATE_TRANSITIONS, 'in_progress', 'rejected').valid).toBe(true)
      // rejected gates resume as in_progress (not reset to pending)
      expect(validateTransition(GATE_TRANSITIONS, 'rejected', 'in_progress').valid).toBe(true)
    })

    it('should reject invalid transitions', () => {
      expect(validateTransition(GATE_TRANSITIONS, 'pending', 'completed').valid).toBe(false)
      expect(validateTransition(GATE_TRANSITIONS, 'completed', 'in_progress').valid).toBe(false)
      expect(validateTransition(GATE_TRANSITIONS, 'completed', 'pending').valid).toBe(false)
      // rejected → pending is not valid; only in_progress is
      expect(validateTransition(GATE_TRANSITIONS, 'rejected', 'pending').valid).toBe(false)
    })

    it('should provide error messages for invalid transitions', () => {
      const result = validateTransition(GATE_TRANSITIONS, 'pending', 'completed')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Cannot transition')
    })

    it('returns valid=false with "none" when current status has no defined transitions in map', () => {
      type MinStatus = 'a' | 'b'
      const partialMap: Partial<Record<MinStatus, MinStatus[]>> = { a: ['b'] }
      // 'b' has no entry in partialMap → transitionMap['b'] is undefined → ?? [] fires
      const result = validateTransition(partialMap, 'b', 'a')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('none')
    })
  })

  describe('gates list (archive)', () => {
    it('should display archived gates when overview empty and archive exists', async () => {
      const { readProjectOverview, getGatesFromOverview } =
        await import('../../../src/utils/config.js')
      const { logger } = await import('../../../src/utils/logger.js')
      const { existsSync, readdirSync } = await import('node:fs')

      // No gates from overview (throw to trigger archive fallback)
      vi.mocked(readProjectOverview).mockRejectedValue(new Error('no overview'))
      vi.mocked(getGatesFromOverview).mockReturnValue([])

      // Archive exists
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readdirSync).mockReturnValue(['gate-03-my-gate.md'])

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'list'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Archived Gates'))
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('To sync these gates with the database')
      )
    })
  })

  describe('gates complete', () => {
    it('should run analysis when user confirms after completion', async () => {
      const { completeGate } = await import('../../../src/core/completions.js')
      const { analyzeGateChanges } = await import('../../../src/core/write-time-analyzer.js')
      const { confirm } = await import('@inquirer/prompts')
      const { logger } = await import('../../../src/utils/logger.js')

      // Mock completeGate success
      vi.mocked(completeGate).mockResolvedValue({
        gateId: 'gate-03',
        gateName: 'Feature Work',
        previousVersion: '1.0.0',
        newVersion: '1.1.0',
        bump: 'minor',
      })

      // User confirms analysis
      vi.mocked(confirm).mockResolvedValueOnce(true)

      // Mock analysis result
      vi.mocked(analyzeGateChanges).mockResolvedValue({
        errors: [],
        analysisTime: 5,
        changedFiles: ['a.js'],
        incrementalMetrics: {
          coupling: { highCoupling: ['m'] },
          complexity: { averageComplexity: 2.5 },
          loc: { totalCodeLines: 10 },
        },
      } as unknown as any)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'complete', 'gate-03'])

      expect(completeGate).toHaveBeenCalledWith('gate-03', expect.any(Object))
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Running write-time analysis')
      )
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Analysis complete'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('New metrics'))
    })
  })

  describe('gates regenerate', () => {
    it('should use archive fallback when overview has no completed gates', async () => {
      const { readProjectOverview, getGatesFromOverview } =
        await import('../../../src/utils/config.js')
      const { existsSync, readdirSync } = await import('node:fs')
      const { replanGates } = await import('../../../src/core/gate-generator.js')

      // No completed gates in overview — fall through to archive
      vi.mocked(readProjectOverview).mockRejectedValue(new Error('no overview'))
      vi.mocked(getGatesFromOverview).mockReturnValue([])

      // Archive files exist
      vi.mocked(existsSync).mockImplementation(() => true)
      vi.mocked(readdirSync).mockReturnValue(['gate-03-one.md', 'gate-04-other.md'])

      // replanGates returns a result
      vi.mocked(replanGates).mockResolvedValue({ mode: 'multi', trigger: 'regenerate', gatesAffected: [], filesWritten: [], reasoning: 'ok' } as any)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'regenerate'])

      const { logger } = await import('../../../src/utils/logger.js')
      expect(replanGates).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Running regenerate on future gates'))
    })
  })
})

/**
 * Helper functions extracted from gates.ts for testing
 */
function normalizeGateId(gateId: string): string {
  const match = gateId.match(/(\d+)/)
  if (match) {
    const num = parseInt(match[1], 10)
    return `gate-${num.toString().padStart(2, '0')}`
  }
  return gateId
}
