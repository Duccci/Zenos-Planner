import { describe, it, expect, vi } from 'vitest'
import { proposalHandlers } from '../../../src/mcp/tools/proposal-tools.js'
import { ProposalListOutputSchema, ProposalDetailSchema } from '../../../src/mcp/schemas/proposal-schemas.js'

describe('Proposal Handlers (integration)', () => {
  it('parses and validates proposal list outputs', async () => {
    const mockData = { proposals: [{ hash: 'abcd1234', title: 'Proposal 1', status: 'pending' as const, gateId: 'gate-01', tasksCompleted: 0, totalTasks: 1, created: new Date().toISOString() }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ProposalListOutputSchema.safeParse((res.structuredContent as any)?.result ?? res.structuredContent)
    if (!ok.success) console.error('Proposal schema errors:', JSON.stringify(ok.error.format(), null, 2))
    expect(ok.success).toBe(true)
  })

  it('parses and validates proposal show output', async () => {
    const mockData = { hash: 'abcd1234', title: 'My Proposal', description: 'desc', status: 'pending' as const, gateId: 'gate-01', tasks: [], created: new Date().toISOString() }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'show', payload: { hash: 'abcd1234' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ProposalDetailSchema.safeParse((res.structuredContent as any)?.result ?? res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('handles validation errors on proposal_validate', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid proposal' } })
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'validate', payload: { hash: 'abcd1234' } })

    expect(res.isError).toBe(true)
    const text = res.content?.[0]?.text ? String(res.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('invalid proposal')
  })

  it('parses and validates proposal approve output', async () => {
    const mockData = { hash: 'abcd1234', previousStatus: 'in_progress' as const, newStatus: 'completed' as const, approvedAt: new Date().toISOString() }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'approve', payload: { hash: 'abcd1234' } })
    expect(res.structuredContent).toBeDefined()
  })

  it('parses and validates proposal reject output', async () => {
    const mockData = { hash: 'abcd1234', previousStatus: 'pending' as const, newStatus: 'rejected' as const, rejectedAt: new Date().toISOString(), reason: 'Nope' }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'reject', payload: { hash: 'abcd1234', rejectionReason: 'Nope' } })
    expect(res.structuredContent).toBeDefined()
  })

  it('parses and validates proposal start output', async () => {
    const mockData = { hash: 'abcd1234', previousStatus: 'pending' as const, newStatus: 'in_progress' as const, startedAt: new Date().toISOString() }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'start', payload: { hash: 'abcd1234' } })
    expect(res.structuredContent).toBeDefined()
  })
})