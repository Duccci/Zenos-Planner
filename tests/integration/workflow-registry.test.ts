/**
 * Workflow Registry Tests
 *
 * Covers the three registered workflow operations:
 *   - generateProposals
 *   - updateProposalProgress
 *   - generateGates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerWorkflowOps } from '../../src/integration/workflow-registry.js'

const mockGenerateProposals = vi.fn()
const mockUpdateProposalProgress = vi.fn()
const mockGenerateGates = vi.fn()

vi.mock('../../src/core/workflow-logic.js', () => ({
  generateProposals: (...args: unknown[]) => mockGenerateProposals(...args),
  updateProposalProgress: (...args: unknown[]) => mockUpdateProposalProgress(...args),
  generateGates: (...args: unknown[]) => mockGenerateGates(...args),
}))

const mockProposalGenerateOutput = {
  success: true,
  gateId: 'gate-01',
  proposalsGenerated: 2,
  proposals: [
    {
      hash: 'abc12345',
      filename: '01-test-proposal.md',
      path: '/zeno/proposals/gate-01/01-test-proposal.md',
      type: 'gate-tied' as const,
      status: 'pending',
      summary: 'A test proposal',
    },
  ],
  message: 'Generated 2 proposals',
}

const mockUpdateProgressOutput = {
  success: true,
  hash: 'abc12345',
  taskIndex: 0,
  completed: true,
  message: 'Task 0 marked as completed',
}

const mockGateGenerateOutput = {
  success: true,
  mode: 'new',
  gatesGenerated: 1,
  gates: [
    {
      id: 'gate-02',
      name: 'New Gate',
      type: 'feature',
      status: 'pending',
      requirementsCount: 3,
      dependencies: [],
    },
  ],
  requirementsAttributed: 3,
  diagramsUpdated: [],
  message: 'Generated 1 gate',
}

describe('workflow-registry', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()
    registerWorkflowOps(registry)
  })

  it('registers all three workflow operations', () => {
    const tools = registry.list()
    const names = tools.map((t) => t.name)
    expect(names).toContain('generateProposals')
    expect(names).toContain('updateProposalProgress')
    expect(names).toContain('generateGates')
  })

  describe('generateProposals', () => {
    it('delegates to core generateProposals and returns result', async () => {
      mockGenerateProposals.mockResolvedValue(mockProposalGenerateOutput)

      const result = (await registry.invoke('generateProposals', {
        gateId: 'gate-01',
      })) as { success: boolean; data: unknown }

      expect(result.success).toBe(true)
      expect(mockGenerateProposals).toHaveBeenCalledWith(
        expect.objectContaining({ gateId: 'gate-01' })
      )
    })

    it('includes optional templateName and outputDir', async () => {
      mockGenerateProposals.mockResolvedValue(mockProposalGenerateOutput)

      await registry.invoke('generateProposals', {
        gateId: 'gate-02',
        templateName: 'custom-template',
        outputDir: '/custom/path',
      })

      expect(mockGenerateProposals).toHaveBeenCalledWith(
        expect.objectContaining({
          gateId: 'gate-02',
          templateName: 'custom-template',
          outputDir: '/custom/path',
        })
      )
    })

    it('fails schema validation for missing gateId', async () => {
      const result = (await registry.invoke('generateProposals', {})) as { success: boolean }
      expect(result.success).toBe(false)
    })

    it('propagates errors from core generateProposals', async () => {
      mockGenerateProposals.mockRejectedValue(new Error('Core failure'))

      const result = (await registry.invoke('generateProposals', {
        gateId: 'gate-01',
      })) as { success: boolean }

      expect(result.success).toBe(false)
    })
  })

  describe('updateProposalProgress', () => {
    it('delegates to core updateProposalProgress and returns result', async () => {
      mockUpdateProposalProgress.mockResolvedValue(mockUpdateProgressOutput)

      const result = (await registry.invoke('updateProposalProgress', {
        hash: 'abc12345',
        taskIndex: 0,
        completed: true,
      })) as { success: boolean; data: unknown }

      expect(result.success).toBe(true)
      expect(mockUpdateProposalProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: 'abc12345',
          taskIndex: 0,
          completed: true,
        })
      )
    })

    it('includes optional notes', async () => {
      mockUpdateProposalProgress.mockResolvedValue(mockUpdateProgressOutput)

      await registry.invoke('updateProposalProgress', {
        hash: 'abc12345',
        taskIndex: 1,
        completed: false,
        notes: 'Work in progress',
      })

      expect(mockUpdateProposalProgress).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Work in progress' })
      )
    })

    it('fails schema validation for missing hash', async () => {
      const result = (await registry.invoke('updateProposalProgress', {
        taskIndex: 0,
        completed: true,
      })) as { success: boolean }
      expect(result.success).toBe(false)
    })

    it('propagates errors from core updateProposalProgress', async () => {
      mockUpdateProposalProgress.mockRejectedValue(new Error('Update error'))

      const result = (await registry.invoke('updateProposalProgress', {
        hash: 'abc12345',
        taskIndex: 0,
        completed: true,
      })) as { success: boolean }

      expect(result.success).toBe(false)
    })
  })

  describe('generateGates', () => {
    it('delegates to core generateGates and returns result', async () => {
      mockGenerateGates.mockResolvedValue(mockGateGenerateOutput)

      const result = (await registry.invoke('generateGates', {
        mode: 'new',
      })) as { success: boolean; data: unknown }

      expect(result.success).toBe(true)
      expect(mockGenerateGates).toHaveBeenCalledWith(expect.objectContaining({ mode: 'new' }))
    })

    it('accepts mode=rebaseline', async () => {
      mockGenerateGates.mockResolvedValue(mockGateGenerateOutput)

      await registry.invoke('generateGates', { mode: 'rebaseline' })
      expect(mockGenerateGates).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'rebaseline' })
      )
    })

    it('accepts mode=single with anchorGateId', async () => {
      mockGenerateGates.mockResolvedValue(mockGateGenerateOutput)

      await registry.invoke('generateGates', {
        mode: 'single',
        anchorGateId: 'gate-03',
      })
      expect(mockGenerateGates).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'single', anchorGateId: 'gate-03' })
      )
    })

    it('uses default mode=new when not specified', async () => {
      mockGenerateGates.mockResolvedValue(mockGateGenerateOutput)

      await registry.invoke('generateGates', {})
      expect(mockGenerateGates).toHaveBeenCalledWith(expect.objectContaining({ mode: 'new' }))
    })

    it('propagates errors from core generateGates', async () => {
      mockGenerateGates.mockRejectedValue(new Error('Gate gen error'))

      const result = (await registry.invoke('generateGates', { mode: 'new' })) as {
        success: boolean
      }
      expect(result.success).toBe(false)
    })
  })
})
