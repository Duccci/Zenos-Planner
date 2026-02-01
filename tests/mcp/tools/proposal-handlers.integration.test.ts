import { describe, it, expect, vi } from 'vitest'
import { proposalHandlers } from '../../../src/mcp/tools/proposal-tools.js'
import { ProposalListOutputSchema, ProposalDetailSchema } from '../../../src/mcp/schemas/proposal-schemas.js'

describe('Proposal Handlers (integration)', () => {
  it('parses and validates proposal list outputs', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ proposals: [{ hash: 'abcd1234', title: 'Proposal 1', status: 'pending', gateId: 'gate-01', tasksCompleted: 0, totalTasks: 1, created: new Date().toISOString() }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } }) } })
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_list({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ProposalListOutputSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Proposal schema errors:', JSON.stringify(ok.error.format(), null, 2))
    expect(ok.success).toBe(true)
  })

  it('parses and validates proposal show output', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ hash: 'abcd1234', title: 'My Proposal', description: 'desc', status: 'pending', gateId: 'gate-01', tasks: [], created: new Date().toISOString() }) } })
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_show({ hash: 'abcd1234' })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ProposalDetailSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('handles validation errors on proposal_validate', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid proposal' } })
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_validate({ hash: 'abcd1234' })

    expect(res.isError).toBe(true)
    expect(String(res.content?.[0]?.text || '').toLowerCase()).toContain('validation_error')
  })

  it('parses and validates proposal approve output', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ hash: 'abcd1234', previousStatus: 'in_progress', newStatus: 'completed', approvedAt: new Date().toISOString() }) } }) }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_approve({ hash: 'abcd1234' })
    expect(res.structuredContent).toBeDefined()
  })

  it('parses and validates proposal reject output', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ hash: 'abcd1234', previousStatus: 'pending', newStatus: 'rejected', rejectedAt: new Date().toISOString(), reason: 'Nope' }) } }) }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_reject({ hash: 'abcd1234', rejectionReason: 'Nope' })
    expect(res.structuredContent).toBeDefined()
  })

  it('parses and validates proposal start output', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ hash: 'abcd1234', previousStatus: 'pending', newStatus: 'in_progress', startedAt: new Date().toISOString() }) } }) }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_start({ hash: 'abcd1234' })
    expect(res.structuredContent).toBeDefined()
  })
})