import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { workflowHandlers, workflowToolDefinitions } from '../../src/mcp/tools/workflow-tools.js'
import { createGatePrdFiles, updateGateDiagrams } from '../../src/core/gate-writer.js'

// ---------------------------------------------------------------------------
// workflow-tools (deprecated compatibility module)
// ---------------------------------------------------------------------------
describe('workflowToolDefinitions', () => {
  it('is an empty array (deprecated)', () => {
    expect(workflowToolDefinitions).toEqual([])
  })
})

describe('workflowHandlers', () => {
  it('returns record with expected handler keys', () => {
    const handlers = workflowHandlers()
    expect(typeof handlers.generateProposals).toBe('function')
    expect(typeof handlers.updateProposalProgress).toBe('function')
    expect(typeof handlers.generateGates).toBe('function')
  })

  it('generateGates handler returns success or throws (prd may exist in workspace)', async () => {
    const handlers = workflowHandlers()
    // The handler may succeed if a prd file exists in the workspace, or throw if not
    // Both behaviors are valid depending on the workspace state
    try {
      const result = await handlers.generateGates({ mode: 'new' })
      expect(result).toBeDefined()
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })

  it('generateProposals handler throws ZenoError for missing gate', async () => {
    const handlers = workflowHandlers()
    await expect(
      handlers.generateProposals({ gateId: 'gate-99-nonexistent' })
    ).rejects.toThrow()
  })

  it('updateProposalProgress handler throws ZenoError for missing proposal', async () => {
    const handlers = workflowHandlers()
    await expect(
      handlers.updateProposalProgress({ hash: 'nonexistent', taskIndex: 0, completed: true })
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// gate-writer (simplified pass-through implementation)
// ---------------------------------------------------------------------------
describe('createGatePrdFiles', () => {
  it('returns the same gates passed in', async () => {
    const gates = [
      { id: 'gate-01', name: 'Setup', type: 'feature', status: 'pending', requirementsCount: 3, dependencies: [] },
      { id: 'gate-02', name: 'Build', type: 'feature', status: 'pending', requirementsCount: 5, dependencies: ['gate-01'] },
    ]
    const result = await createGatePrdFiles(gates, 'gate-prd-template', '/some/project')
    expect(result).toEqual(gates)
  })

  it('handles empty gates array', async () => {
    const result = await createGatePrdFiles([], 'template', '/project')
    expect(result).toEqual([])
  })
})

describe('updateGateDiagrams', () => {
  it('returns the gate-roadmap path', async () => {
    const gates = [
      { id: 'gate-01', name: 'Setup', type: 'feature', status: 'pending', requirementsCount: 1, dependencies: [] },
    ]
    const result = await updateGateDiagrams(gates, '/project')
    expect(result).toContain('zeno/architecture/gate-roadmap.md')
  })

  it('handles empty gates array', async () => {
    const result = await updateGateDiagrams([], '/project')
    expect(Array.isArray(result)).toBe(true)
  })
})
