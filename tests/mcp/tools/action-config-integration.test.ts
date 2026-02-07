import { describe, it, expect, vi } from 'vitest'

describe('Action Tool Config Integration', () => {
  describe('Proposal Action Tool', () => {
    it('calls config_get during validation', async () => {
      const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
      const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')

      const registry = createFunctionRegistry()
      const handlers = proposalHandlers(registry)

      // Mock config_get to return test config
      const mockConfig = {
        qualityThresholds: {
          codeCoverage: 90,
          typeCheckingErrors: 0,
          lintingErrorRate: 0.01,
          securityVulnerabilities: 0
        }
      }

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return { success: true, data: mockConfig }
        }
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: '#test',
              filesAffected: ['src/test.ts'],
              status: 'pending'
            }
          }
        }
        return { success: true, data: {} }
      })

      // Test start action with validation
      const result = await handlers.proposal_action({
        action: 'start',
        payload: { hash: '#test' }
      })

      expect(result).toBeDefined()
      expect(registry.invoke).toHaveBeenCalledWith('config_get', {})
    })

    it('includes validation results in output', async () => {
      const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
      const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')

      const registry = createFunctionRegistry()
      const handlers = proposalHandlers(registry)

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return {
            success: true,
            data: {
              qualityThresholds: {
                codeCoverage: 90,
                typeCheckingErrors: 0,
                lintingErrorRate: 0.01,
                securityVulnerabilities: 0
              }
            }
          }
        }
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: '#test',
              filesAffected: ['src/test.ts'],
              status: 'pending'
            }
          }
        }
        if (name === 'proposal_start') {
          return { success: true, data: { status: 'in_progress' } }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.proposal_action({
        action: 'start',
        payload: { hash: '#test' }
      })

      expect(result.structuredContent).toHaveProperty('validation')
      expect(result.structuredContent.action).toBe('start')
    })
  })

  describe('Gates Action Tool', () => {
    it('calls config_get during gate validation', async () => {
      const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
      const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')

      const registry = createFunctionRegistry()
      const handlers = gateHandlers(registry)

      const mockConfig = {
        qualityThresholds: {
          codeCoverage: 90,
          typeCheckingErrors: 0,
          lintingErrorRate: 0.01,
          securityVulnerabilities: 0
        }
      }

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return { success: true, data: mockConfig }
        }
        if (name === 'gates_list') {
          return { success: true, data: [] }
        }
        if (name === 'gate_create') {
          return { success: true, data: { gateId: 'gate-01' } }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.gates_action({
        action: 'create',
        payload: {
          gateId: 'gate-01',
          name: 'Test Gate',
          type: 'feature',
          dependencies: [],
          objectives: ['Test objective']
        }
      })

      expect(result).toBeDefined()
      expect(registry.invoke).toHaveBeenCalledWith('config_get', {})
    })

    it('blocks gate completion when quality fails', async () => {
      const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
      const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')

      const registry = createFunctionRegistry()
      const handlers = gateHandlers(registry)

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return {
            success: true,
            data: {
              qualityThresholds: {
                codeCoverage: 90,
                typeCheckingErrors: 0,
                lintingErrorRate: 0.01,
                securityVulnerabilities: 0
              }
            }
          }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.gates_action({
        action: 'complete',
        payload: {
          gateId: 'gate-01',
          completionNotes: 'Test completion'
        }
      })

      // Should fail due to quality validation (mock quality metrics have issues)
      expect(result.isError).toBe(true)
      expect(result.structuredContent.validation).toBeDefined()
      expect(result.structuredContent.validation.allowed).toBe(false)
    })
  })

  describe('Config Error Handling', () => {
    it('handles config_get failure gracefully', async () => {
      const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
      const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')

      const registry = createFunctionRegistry()
      const handlers = proposalHandlers(registry)

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return { success: false, error: { message: 'Config not found' } }
        }
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: '#test',
              filesAffected: ['src/test.ts'],
              status: 'pending'
            }
          }
        }
        if (name === 'proposal_start') {
          return { success: true, data: { status: 'in_progress' } }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.proposal_action({
        action: 'start',
        payload: { hash: '#test' }
      })

      // Should still work but with warnings
      expect(result.isError).toBeUndefined()
      expect(result.structuredContent.validation).toBeDefined()
    })

    it('uses sensible defaults when config missing', async () => {
      const { createFunctionRegistry } = await import('../../../src/integration/function-implementations.js')
      const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')

      const registry = createFunctionRegistry()
      const handlers = proposalHandlers(registry)

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return { success: true, data: {} } // Empty config
        }
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: '#test',
              filesAffected: ['src/test.ts'],
              status: 'pending'
            }
          }
        }
        if (name === 'proposal_start') {
          return { success: true, data: { status: 'in_progress' } }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.proposal_action({
        action: 'start',
        payload: { hash: '#test' }
      })

      expect(result).toBeDefined()
      expect(result.isError).toBeUndefined()
    })
  })
})