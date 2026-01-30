/**
 * Context Provider Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getProjectContext,
  getNextActionSuggestions,
  isActionRecommended
} from '../../src/integration/context-provider.js'

// Mock the command invoker
vi.mock('../../src/integration/command-invoker.js', () => ({
  invokeCommand: vi.fn()
}))

import { invokeCommand } from '../../src/integration/command-invoker.js'

const mockInvokeCommand = vi.mocked(invokeCommand)

describe('Context Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProjectContext', () => {
    it('should return project context for initialized project', async () => {
      // Mock successful command outputs
      mockInvokeCommand.mockImplementation((command) => {
        switch (command) {
          case 'status':
            return Promise.resolve({
              success: true,
              output: 'Project initialized with 3 gates',
              exitCode: 0
            })
          case 'gates_list':
            return Promise.resolve({
              success: true,
              output: 'gate-01: completed - Initial setup\ngate-02: in_progress - Core development\ngate-03: pending - Final testing',
              exitCode: 0
            })
          case 'proposal_list':
            return Promise.resolve({
              success: true,
              output: '#g02p01: completed\n#g02p02: in_progress\n#g02p03: pending',
              exitCode: 0
            })
          default:
            return Promise.resolve({
              success: true,
              output: '',
              exitCode: 0
            })
        }
      })

      const context = await getProjectContext()

      expect(context.status.initialized).toBe(true)
      expect(context.status.gates).toHaveLength(3)
      expect(context.status.currentGate).toBe('gate-02')
      expect(context.status.pendingProposals).toBe(1)
      expect(context.status.inProgressProposals).toBe(1)
      expect(context.status.completedGates).toBe(1)
      expect(context.status.totalGates).toBe(3)
      expect(context.workflow.nextActions).toContain('Continue work on 1 in-progress proposal(s)')
      expect(context.workflow.projectHealth).toBe('good')
    })

    it('should handle uninitialized project', async () => {
      mockInvokeCommand.mockResolvedValue({
        success: false,
        output: 'Project not initialized',
        exitCode: 1
      })

      const context = await getProjectContext()

      expect(context.status.initialized).toBe(false)
      expect(context.status.gates).toHaveLength(0)
      expect(context.workflow.nextActions).toContain('Run zeno init to initialize the project')
      expect(context.workflow.projectHealth).toBe('critical')
    })

    it('should handle command failures gracefully', async () => {
      mockInvokeCommand.mockRejectedValue(new Error('Command failed'))

      const context = await getProjectContext()

      expect(context.status.initialized).toBe(false)
      expect(context.workflow.projectHealth).toBe('critical')
      expect(context.workflow.recommendations).toContain('Check Zeno installation and project setup')
    })

    it('should parse gate information correctly', async () => {
      mockInvokeCommand.mockImplementation((command) => {
        if (command === 'gates_list') {
          return Promise.resolve({
            success: true,
            output: 'gate-01: completed - Setup phase\ngate-02: in_progress - Development phase',
            exitCode: 0
          })
        }
        return Promise.resolve({
          success: true,
          output: command === 'status' ? 'initialized' : '',
          exitCode: 0
        })
      })

      const context = await getProjectContext()

      expect(context.status.gates).toHaveLength(2)
      expect(context.status.gates[0]).toEqual({
        id: 'gate-01',
        status: 'completed',
        description: 'Setup phase',
        requirements: 0,
        proposals: 0
      })
      expect(context.status.gates[1]).toEqual({
        id: 'gate-02',
        status: 'in_progress',
        description: 'Development phase',
        requirements: 0,
        proposals: 0
      })
    })

    it('should parse proposal information correctly', async () => {
      mockInvokeCommand.mockImplementation((command) => {
        if (command === 'proposal_list') {
          return Promise.resolve({
            success: true,
            output: '#p01: pending\n#p02: in_progress\n#p03: completed',
            exitCode: 0
          })
        }
        return Promise.resolve({
          success: true,
          output: command === 'status' ? 'initialized' : '',
          exitCode: 0
        })
      })

      const context = await getProjectContext()

      expect(context.status.pendingProposals).toBe(1)
      expect(context.status.inProgressProposals).toBe(1)
      // completedGates would be 0 since no gates mocked
    })
  })

  describe('Workflow Context Generation', () => {
    it('should recommend initialization for uninitialized projects', async () => {
      const context = await getProjectContext()

      expect(context.workflow.nextActions).toContain('Run zeno init to initialize the project')
      expect(context.workflow.projectHealth).toBe('critical')
    })

    it('should recommend starting pending proposals', async () => {
      mockInvokeCommand.mockImplementation((command) => {
        switch (command) {
          case 'status':
            return Promise.resolve({
              success: true,
              output: 'initialized',
              exitCode: 0
            })
          case 'gates_list':
            return Promise.resolve({
              success: true,
              output: 'gate-01: in_progress - Development',
              exitCode: 0
            })
          case 'proposal_list':
            return Promise.resolve({
              success: true,
              output: '#p01: pending\n#p02: pending\n#p03: pending',
              exitCode: 0
            })
          default:
            return Promise.resolve({
              success: true,
              output: '',
              exitCode: 0
            })
        }
      })

      const context = await getProjectContext()

      expect(context.workflow.nextActions).toContain('Start implementation of 3 pending proposal(s)')
      expect(context.workflow.recommendations).toContain('Focus on completing pending proposals to progress gates')
    })

    it('should recommend continuing in-progress work', async () => {
      mockInvokeCommand.mockImplementation((command) => {
        switch (command) {
          case 'status':
            return Promise.resolve({
              success: true,
              output: 'initialized',
              exitCode: 0
            })
          case 'gates_list':
            return Promise.resolve({
              success: true,
              output: 'gate-01: in_progress - Development',
              exitCode: 0
            })
          case 'proposal_list':
            return Promise.resolve({
              success: true,
              output: '#p01: in_progress\n#p02: in_progress',
              exitCode: 0
            })
          default:
            return Promise.resolve({
              success: true,
              output: '',
              exitCode: 0
            })
        }
      })

      const context = await getProjectContext()

      expect(context.workflow.nextActions).toContain('Continue work on 2 in-progress proposal(s)')
      expect(context.workflow.recommendations).toContain('Complete in-progress proposals before starting new work')
    })

    it('should detect project completion', async () => {
      mockInvokeCommand.mockImplementation((command) => {
        switch (command) {
          case 'status':
            return Promise.resolve({
              success: true,
              output: 'initialized',
              exitCode: 0
            })
          case 'gates_list':
            return Promise.resolve({
              success: true,
              output: 'gate-01: completed - Setup\ngate-02: completed - Development',
              exitCode: 0
            })
          case 'proposal_list':
            return Promise.resolve({
              success: true,
              output: '',
              exitCode: 0
            })
          default:
            return Promise.resolve({
              success: true,
              output: '',
              exitCode: 0
            })
        }
      })

      const context = await getProjectContext()

      expect(context.workflow.nextActions).toContain('All gates completed - project ready for final review')
      expect(context.workflow.recommendations).toContain('Consider project completion and deployment')
    })
  })

  describe('getNextActionSuggestions', () => {
    it('should return next actions from context', async () => {
      mockInvokeCommand.mockResolvedValue({
        success: true,
        output: 'initialized',
        exitCode: 0
      })

      const suggestions = await getNextActionSuggestions()

      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions).toContain('Run zeno init to initialize the project')
    })
  })

  describe('isActionRecommended', () => {
    it('should check if action is in recommendations', async () => {
      mockInvokeCommand.mockResolvedValue({
        success: true,
        output: 'initialized',
        exitCode: 0
      })

      const isRecommended = await isActionRecommended('initialize')

      expect(typeof isRecommended).toBe('boolean')
    })
  })
})