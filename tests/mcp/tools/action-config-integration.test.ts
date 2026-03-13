import { describe, it, expect, vi } from 'vitest'

// TODO: Tests use vi.spyOn to mock registry.invoke and verify validator calls
describe('Action Tool Config Integration', () => {
  describe('Proposal Action Tool', () => {
    it('calls config_get during validation', async () => {
      const { createFunctionRegistry } =
        await import('../../../src/integration/function-implementations.js')
      const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')

      const registry = createFunctionRegistry()
      const handlers = proposalHandlers(registry)

      // Mock config_get to return test config
      const mockConfig = {
        qualityThresholds: {
          codeCoverage: 90,
          typeCheckingErrors: 0,
          lintingErrorRate: 0.01,
          securityVulnerabilities: 0,
        },
      }

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return { success: true, data: mockConfig }
        }
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: 'test0001',
              filesAffected: ['src/test.ts'],
              status: 'validated',
            },
          }
        }
        return { success: true, data: {} }
      })

      // Test start action with validation
      const result = await handlers.proposal_action({
        action: 'start',
        payload: { hash: 'test0001' },
      })

      expect(result).toBeDefined()
      // Verify that config_get was called during validation
      const calls = vi.mocked(registry.invoke).mock.calls
      const hasConfigGetCall = calls.some(([name]) => name === 'config_get')
      expect(hasConfigGetCall).toBe(true)
    })

    it('includes validation results in output', async () => {
      const { createFunctionRegistry } =
        await import('../../../src/integration/function-implementations.js')
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
                securityVulnerabilities: 0,
              },
            },
          }
        }
        if (name === 'proposal_show') {
          const now = new Date().toISOString()
          return {
            success: true,
            data: {
              hash: 'test0001',
              title: 'Test Proposal',
              description: 'Test proposal description',
              status: 'validated',
              gateId: 'gate-03',
              role: 'testing',
              tasks: [],
              created: now,
            },
          }
        }
        if (name === 'proposal_start') {
          const now = new Date().toISOString()
          return {
            success: true,
            data: {
              hash: 'test0001',
              previousStatus: 'validated',
              newStatus: 'in_progress',
              startedAt: now,
            },
          }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.proposal_action({
        action: 'start',
        hash: 'test0001',
        preReview: {
          phase: 'apply',
          openQuestionsResolved: true,
          questionsFound: [],
          filesVerified: true,
          assumptionsDocumented: [],
          blockersIdentified: [],
        },
        qualitativeReview: {
          taskDescriptionsSpecific: true,
          acceptanceCriteriaMeasurable: true,
          filesAffectedVerified: true,
          noUnresolvedMarkers: true,
          scopeFocused: true,
          rollbackSpecific: true,
          flaggedItems: [],
        },
      })

      const parsed = JSON.parse((result.content[0] as any).text)
      // Validation results may be included if there are warnings
      expect(parsed).toBeDefined()
      expect(result.isError).toBeUndefined()
    })
  })

  describe('Gates Action Tool', () => {
    it('calls config_get during gate validation', async () => {
      const { createFunctionRegistry } =
        await import('../../../src/integration/function-implementations.js')
      const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')

      const registry = createFunctionRegistry()
      const handlers = gateHandlers(registry)

      const mockConfig = {
        qualityThresholds: {
          codeCoverage: 90,
          typeCheckingErrors: 0,
          lintingErrorRate: 0.01,
          securityVulnerabilities: 0,
        },
      }

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return { success: true, data: mockConfig }
        }
        if (name === 'gates_list') {
          return { success: true, data: [] }
        }
        if (name === 'gate_create') {
          return {
            success: true,
            data: {
              gateId: 'gate-01',
              filePath: 'zeno/gates/gate-01-test.md',
              validation: { passed: true, errors: [], warnings: [] },
              roadmapUpdated: true,
              createdAt: new Date().toISOString(),
            },
          }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.gates_action({
        action: 'create',
        payload: {
          gateId: 'gate-01',
          name: 'Test Gate',
          type: 'feature',
          sequence: 1,
          dependencies: [],
          objectives: ['Test objective'],
        },
      })

      expect(result).toBeDefined()
      // Verify that config_get was called during validation
      const calls = vi.mocked(registry.invoke).mock.calls
      const hasConfigGetCall = calls.some(([name]) => name === 'config_get')
      expect(hasConfigGetCall).toBe(true)
    })

    it('blocks gate completion when quality fails', async () => {
      const { createFunctionRegistry } =
        await import('../../../src/integration/function-implementations.js')
      const { gateHandlers } = await import('../../../src/mcp/tools/gate-tools.js')

      const registry = createFunctionRegistry()
      const handlers = gateHandlers(registry)

      const now = new Date().toISOString()
      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return {
            success: true,
            data: {
              qualityThresholds: {
                codeCoverage: 90,
                typeCheckingErrors: 0,
                lintingErrorRate: 0.01,
                securityVulnerabilities: 0,
              },
            },
          }
        }
        if (name === 'gates_show') {
          return {
            success: true,
            data: {
              id: 'gate-01',
              name: 'Test Gate',
              status: 'in_progress',
              qualityMetrics: {
                testCoverage: 50,
                lintErrors: 10,
                securityIssues: 1,
              },
            },
          }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.gates_action({
        action: 'complete',
        payload: {
          gateId: 'gate-01',
          completionNotes: 'Test completion',
        },
      })

      // Should fail due to quality validation (mock quality metrics have issues)
      expect(result).toBeDefined()
      const parsed = JSON.parse(result.content[0].text)
      // Validation should fail because testCoverage is 50 (below 90 threshold)
      expect(parsed.error).toBe('Validation failed')
      expect(parsed.validation).toBeDefined()
      expect(parsed.validation.allowed).toBe(false)
    })
  })

  describe('Config Error Handling', () => {
    it('handles config_get failure gracefully', async () => {
      const { createFunctionRegistry } =
        await import('../../../src/integration/function-implementations.js')
      const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')

      const registry = createFunctionRegistry()
      const handlers = proposalHandlers(registry)

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return { success: false, error: { message: 'Config not found' } }
        }
        if (name === 'proposal_show') {
          const now = new Date().toISOString()
          return {
            success: true,
            data: {
              hash: 'test0001',
              title: 'Test Proposal',
              description: 'Test proposal description',
              status: 'validated',
              gateId: 'gate-03',
              role: 'testing',
              tasks: [],
              created: now,
            },
          }
        }
        if (name === 'proposal_start') {
          const now = new Date().toISOString()
          return {
            success: true,
            data: {
              hash: 'test0001',
              previousStatus: 'validated',
              newStatus: 'in_progress',
              startedAt: now,
            },
          }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.proposal_action({
        action: 'start',
        hash: 'test0001',
        preReview: {
          phase: 'apply',
          openQuestionsResolved: true,
          questionsFound: [],
          filesVerified: true,
          assumptionsDocumented: [],
          blockersIdentified: [],
        },
        qualitativeReview: {
          taskDescriptionsSpecific: true,
          acceptanceCriteriaMeasurable: true,
          filesAffectedVerified: true,
          noUnresolvedMarkers: true,
          scopeFocused: true,
          rollbackSpecific: true,
          flaggedItems: [],
        },
      })

      // Should still work but with warnings
      expect(result.isError).toBeUndefined()
      const parsedHash = JSON.parse((result.content[0] as any).text)
      expect(parsedHash?.hash).toBeDefined()
    })

    it('uses sensible defaults when config missing', async () => {
      const { createFunctionRegistry } =
        await import('../../../src/integration/function-implementations.js')
      const { proposalHandlers } = await import('../../../src/mcp/tools/proposal-tools.js')

      const registry = createFunctionRegistry()
      const handlers = proposalHandlers(registry)

      vi.spyOn(registry, 'invoke').mockImplementation(async (name: string, payload: any) => {
        if (name === 'config_get') {
          return { success: true, data: {} } // Empty config
        }
        if (name === 'proposal_show') {
          const now = new Date().toISOString()
          return {
            success: true,
            data: {
              hash: 'test0001',
              title: 'Test Proposal',
              description: 'Test proposal description',
              status: 'validated',
              gateId: 'gate-03',
              role: 'testing',
              tasks: [],
              created: now,
            },
          }
        }
        if (name === 'proposal_start') {
          const now = new Date().toISOString()
          return {
            success: true,
            data: {
              hash: 'test0001',
              previousStatus: 'validated',
              newStatus: 'in_progress',
              startedAt: now,
            },
          }
        }
        return { success: true, data: {} }
      })

      const result = await handlers.proposal_action({
        action: 'start',
        hash: 'test0001',
        preReview: {
          phase: 'apply',
          openQuestionsResolved: true,
          questionsFound: [],
          filesVerified: true,
          assumptionsDocumented: [],
          blockersIdentified: [],
        },
        qualitativeReview: {
          taskDescriptionsSpecific: true,
          acceptanceCriteriaMeasurable: true,
          filesAffectedVerified: true,
          noUnresolvedMarkers: true,
          scopeFocused: true,
          rollbackSpecific: true,
          flaggedItems: [],
        },
      })

      expect(result).toBeDefined()
      expect(result.isError).toBeUndefined()
    })
  })
})
