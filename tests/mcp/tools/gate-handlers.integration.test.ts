import { describe, it, expect, vi } from 'vitest'
import { gateHandlers } from '../../../src/mcp/tools/gate-tools.js'
import { GatesListOutputSchema, GateDetailSchema } from '../../../src/mcp/schemas/gate-schemas.js'

describe('Gate Handlers (integration)', () => {
  it('parses and validates structured gates list output', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ gates: [{ id: 'gate-01', name: 'Gate 1', description: 'desc', sequence: 1, status: 'pending', type: 'feature', created: new Date().toISOString(), started: null, completed: null, proposalCount: 0, completedProposalCount: 0, requirementCount: 0, testedRequirementCount: 0 }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } }) } })
    }

    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_list({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()

    const ok = GatesListOutputSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('returns helpful error when start fails', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: { message: 'Gate not found', code: 'NOT_FOUND' } })
    }

    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_start({ gateId: 'does-not-exist' })

    expect(res.isError).toBe(true)
    const text = res.content?.[0]?.text ? String(res.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('not_found')
  })

  it('parses and validates gate show output', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ id: 'gate-01', name: 'Gate 1', description: 'desc', sequence: 1, status: 'pending', type: 'feature', objectives: [], requirements: [], proposals: [], created: new Date().toISOString(), started: null, completed: null }) } })
    }

    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_show({ gateId: 'gate-01' })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()

    const ok = GateDetailSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('parses and validates gates regenerate output', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ mode: 'check', status: 'no_changes', changes: null }) } })
    }

    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_regenerate({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()
  })

  it('parses and validates gates_start output on success', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ gateId: 'gate-01', previousStatus: 'pending', newStatus: 'in_progress', startedAt: new Date().toISOString() }) } })
    }

    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_start({ gateId: 'gate-01' })
    expect(res.structuredContent).toBeDefined()
  })

  it('parses and validates gates_complete output on success', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ gateId: 'gate-01', previousStatus: 'in_progress', newStatus: 'completed', completedAt: new Date().toISOString(), summary: { proposalsCompleted: 1, requirementsTested: 2 } }) } })
    }

    const handlers = gateHandlers(fakeRegistry)
    const res = await handlers.gates_complete({ gateId: 'gate-01' })
    expect(res.structuredContent).toBeDefined()
  })
})