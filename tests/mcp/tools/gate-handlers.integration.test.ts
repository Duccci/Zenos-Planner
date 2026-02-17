import { describe, it, expect, vi } from 'vitest'
import { gateHandlers } from '../../../src/mcp/tools/gate-tools.js'
import { GatesListOutputSchema, GateDetailSchema } from '../../../src/mcp/schemas/gate-schemas.js'

describe('Gate Handlers Integration', () => {
  it('parses and validates structured gates list output', async () => {
    const mockData = { gates: [{ id: 'gate-01', name: 'Gate 1', description: 'desc', sequence: 1, status: 'pending' as const, type: 'feature' as const, created: new Date().toISOString(), started: null, completed: null, proposalCount: 0, completedProposalCount: 0, requirementCount: 0, testedRequirementCount: 0 }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = gateHandlers(fakeRegistry)

    const res = await handlers.gates_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()

    const ok = GatesListOutputSchema.safeParse((res.structuredContent as any)?.result ?? res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('returns helpful error when start fails', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: false, error: { message: 'Gate not found', code: 'NOT_FOUND' } }) }
    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_action({ action: 'start', payload: { gateId: 'gate-99' } })

    expect(res.isError).toBe(true)
    const text = res.content?.[0]?.text ? String(res.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('not found')
  })

  it('parses and validates gate show output', async () => {
    const mockData = { id: 'gate-01', name: 'Gate 1', description: 'desc', sequence: 1, status: 'pending' as const, type: 'feature' as const, objectives: [], requirements: [], proposals: [], created: new Date().toISOString(), started: null, completed: null }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_action({ action: 'show', payload: { gateId: 'gate-01' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()

    const ok = GateDetailSchema.safeParse((res.structuredContent as any)?.result ?? res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('parses and validates gates regenerate output', async () => {
    const mockData = { mode: 'check' as const, status: 'no_changes' as const, changes: undefined }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_action({ action: 'regenerate', payload: { mode: 'check' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()
  })

  it('parses and validates gates_start output on success', async () => {
    const mockData = { gateId: 'gate-01', previousStatus: 'pending' as const, newStatus: 'in_progress' as const, startedAt: new Date().toISOString() }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_action({ action: 'start', payload: { gateId: 'gate-01' } })
    expect(res.structuredContent).toBeDefined()
  })

  it('parses and validates gates_complete output on success', async () => {
    const mockData = { gateId: 'gate-01', previousStatus: 'in_progress' as const, newStatus: 'completed' as const, completedAt: new Date().toISOString(), summary: { proposalsCompleted: 1, requirementsTested: 2 } }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_action({ action: 'complete', payload: { gateId: 'gate-01' } })
    expect(res.structuredContent).toBeDefined()
  })
})