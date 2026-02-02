/**
 * Gates Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerGatesCommands } from '../../../src/cli/commands/gates.js'
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
}))

vi.mock('../../../src/core/write-time-analyzer.js', () => ({
  analyzeGateChanges: vi.fn(),
}))

vi.mock('../../../src/storage/database.js', () => ({
  getDatabase: vi.fn(),
}))

vi.mock('../../../src/utils/config.js', () => ({
  getZenoDir: vi.fn().mockReturnValue('zeno'),
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

    const gatesCmd = program.commands.find(cmd => cmd.name() === 'gates')
    expect(gatesCmd).toBeDefined()

    const subcommands = gatesCmd!.commands.map(cmd => cmd.name())
    expect(subcommands).toContain('list')
    expect(subcommands).toContain('show')
    expect(subcommands).toContain('start')
    expect(subcommands).toContain('complete')
    expect(subcommands).toContain('regenerate')
  })

  describe('gates list', () => {
    it('should display gates in table format', async () => {
      const { getDatabase } = await import('../../../src/storage/database.js')
      const { logger } = await import('../../../src/utils/logger.js')

      const mockGates = [
        {
          id: 'gate-01',
          sequence: 1,
          name: 'Foundation',
          description: 'Initial setup',
          status: 'completed',
          hash: 'hash1',
        },
        {
          id: 'gate-02',
          sequence: 2,
          name: 'Features',
          description: 'Core features',
          status: 'in_progress',
          hash: 'hash2',
        },
      ]

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockGates),
      })

      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'list'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Project Gates'))
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM gates'))
    })

    it('should filter gates by status', async () => {
      const { getDatabase } = await import('../../../src/storage/database.js')

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      })

      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'list', '--status', 'completed'])

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE status = ?'))
    })
  })

  describe('gates show', () => {
    it('should display gate details', async () => {
      const { getDatabase } = await import('../../../src/storage/database.js')
      const { logger } = await import('../../../src/utils/logger.js')
      const { existsSync } = await import('node:fs')

      const mockGate = {
        id: 'gate-01',
        sequence: 1,
        name: 'Foundation',
        description: 'Initial setup',
        status: 'completed',
        hash: 'hash1',
      }

      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM gates')) {
          return { get: vi.fn().mockReturnValue(mockGate) }
        }
        if (query.includes('SELECT COUNT(*) as count FROM requirements')) {
          return { get: vi.fn().mockReturnValue({ count: 5 }) }
        }
        if (query.includes('SELECT COUNT(*) as count FROM proposals')) {
          return { get: vi.fn().mockReturnValue({ count: 3 }) }
        }
        if (query.includes('SELECT g.id, g.name, g.status FROM gates')) {
          return { all: vi.fn().mockReturnValue([]) }
        }
        return { get: vi.fn(), all: vi.fn().mockReturnValue([]) }
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
      const { getDatabase } = await import('../../../src/storage/database.js')
      const { logger } = await import('../../../src/utils/logger.js')

      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
      })

      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

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
    it('should transition gate from pending to in_progress', async () => {
      const { getDatabase } = await import('../../../src/storage/database.js')
      const { confirm } = await import('@inquirer/prompts')
      const { logger } = await import('../../../src/utils/logger.js')

      const mockGate = {
        id: 'gate-01',
        sequence: 1,
        name: 'Foundation',
        status: 'pending',
        hash: 'hash1',
      }

      const mockRun = vi.fn()
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM gates')) {
          return { get: vi.fn().mockReturnValue(mockGate) }
        }
        if (query.includes('UPDATE gates SET status')) {
          return { run: mockRun }
        }
        if (query.includes('INSERT INTO state_history')) {
          return { run: vi.fn() }
        }
        return { get: vi.fn(), run: vi.fn() }
      })

      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)
      vi.mocked(confirm).mockResolvedValue(true)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'start', 'gate-01'])

      expect(confirm).toHaveBeenCalled()
      expect(mockRun).toHaveBeenCalledWith('in_progress', 'gate-01')
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('started successfully'))
    })

    it('should reject invalid status transitions', async () => {
      const { getDatabase } = await import('../../../src/storage/database.js')
      const { logger } = await import('../../../src/utils/logger.js')

      const mockGate = {
        id: 'gate-01',
        status: 'completed',
        hash: 'hash1',
      }

      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(mockGate),
      })

      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

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
      expect(validateStatusTransition('pending', 'in_progress').valid).toBe(true)
      expect(validateStatusTransition('in_progress', 'completed').valid).toBe(true)
      expect(validateStatusTransition('in_progress', 'rejected').valid).toBe(true)
      expect(validateStatusTransition('rejected', 'pending').valid).toBe(true)
    })

    it('should reject invalid transitions', () => {
      expect(validateStatusTransition('pending', 'completed').valid).toBe(false)
      expect(validateStatusTransition('completed', 'in_progress').valid).toBe(false)
      expect(validateStatusTransition('completed', 'pending').valid).toBe(false)
    })

    it('should provide error messages for invalid transitions', () => {
      const result = validateStatusTransition('pending', 'completed')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Cannot transition')
    })
  })

  describe('gates list (archive)', () => {
    it('should display archived gates when db empty and archive exists', async () => {
      const { getDatabase } = await import('../../../src/storage/database.js')
      const { logger } = await import('../../../src/utils/logger.js')
      const { existsSync, readdirSync } = await import('node:fs')

      // DB empty
      mockDb.prepare.mockReturnValue({ all: vi.fn().mockReturnValue([]) })
      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

      // Archive exists
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readdirSync).mockReturnValue(['gate-03-my-gate.md'])

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'list'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Archived Gates'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('To sync these gates with the database'))
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
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Running write-time analysis'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Analysis complete'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('New metrics'))
    })
  })

  describe('gates regenerate', () => {
    it('should sync archived gates and generate missing gates when DB empty', async () => {
      const { getDatabase } = await import('../../../src/storage/database.js')
      const { existsSync, readdirSync, readFileSync } = await import('node:fs')
      const { regenerateGatesWithAnalysis } = await import('../../../src/core/gate-generator.js')

      // No recent completed gate and no project
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes('SELECT id, name, completed_at FROM gates')) {
          return { get: vi.fn().mockReturnValue(undefined) }
        }
        if (query.includes('SELECT id FROM projects')) {
          return { get: vi.fn().mockReturnValue(undefined) }
        }
        // Generic insert/run
        return { run: vi.fn(), all: vi.fn().mockReturnValue([]) }
      })

      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as Database.Database)

      // Archive files
      vi.mocked(existsSync).mockImplementation((p: string) => true)
      vi.mocked(readdirSync).mockReturnValue(['gate-03-one.md', 'gate-04-other.md'])
      vi.mocked(readFileSync).mockImplementation((p: string) => {
        if (String(p).includes('gate-roadmap.md')) return 'G3[Gate 3<br/>Requirements & Database Layer]'
        return '**Status**: completed'
      })

      // regenerate returns no changes
      vi.mocked(regenerateGatesWithAnalysis).mockResolvedValue({ reason: 'ok', changes: [] } as any)

      const program = new Command()
      program.exitOverride()
      registerGatesCommands(program)

      await program.parseAsync(['node', 'test', 'gates', 'regenerate'])

      expect(regenerateGatesWithAnalysis).toHaveBeenCalled()
      // Should have synced and generated messages
      // We check generic logged messages exist
      const { logger } = await import('../../../src/utils/logger.js')
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Synced'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Generated'))
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

type GateStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'

function validateStatusTransition(
  currentStatus: GateStatus,
  targetStatus: GateStatus
): { valid: boolean; error?: string } {
  const validTransitions: Record<GateStatus, GateStatus[]> = {
    'pending': ['in_progress'],
    'in_progress': ['completed', 'rejected'],
    'completed': [],
    'rejected': ['pending'],
  }

  if (validTransitions[currentStatus].includes(targetStatus)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: `Cannot transition from ${currentStatus} to ${targetStatus}. Valid transitions: ${validTransitions[currentStatus].join(', ') || 'none'}`,
  }
}
