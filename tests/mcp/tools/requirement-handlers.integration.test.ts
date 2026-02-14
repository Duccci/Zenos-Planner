import { describe, it, expect, vi } from 'vitest'
import { requirementHandlers } from '../../../src/mcp/tools/requirement-tools.js'
import { ReqActionOutputSchema } from '../../../src/mcp/schemas/req-action-schemas.js'

describe('Requirement Handlers (integration)', () => {
  it('parses and validates requirement list outputs', async () => {
    const mockData = { requirements: [{ hash: 'abcd1234', title: 'Req 1', type: 'feature', gateId: 'gate-01', created: new Date().toISOString() }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.req_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ReqActionOutputSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Req action schema errors:', JSON.stringify(ok.error.format(), null, 2))
    expect(ok.success).toBe(true)
    expect(ok.data.action).toBe('list')
  })

  it('parses dependency graph outputs', async () => {
    const mockData = { root: 'abcd1234', nodes: [{ hash: 'abcd1234', title: 'Req 1', type: 'feature', gateId: 'gate-01' }], edges: [] }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.req_action({ action: 'deps', payload: { hash: 'abcd1234' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ReqActionOutputSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Req action deps schema errors:', JSON.stringify(ok.error.format(), null, 2))
    expect(ok.success).toBe(true)
    expect(ok.data.action).toBe('deps')
  })

  it('parses and validates requirement show output', async () => {
    const mockData = { hash: 'abcd1234', title: 'Req 1', description: 'desc', type: 'feature', gateId: 'gate-01', created: new Date().toISOString() }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.req_action({ action: 'show', payload: { hash: 'abcd1234' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ReqActionOutputSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Req action show schema errors:', JSON.stringify(ok.error.format(), null, 2), 'structured:', JSON.stringify(res.structuredContent, null, 2))
    expect(ok.success).toBe(true)
    expect(ok.data.action).toBe('show')
  })

  it('parses and validates req_transfer output', async () => {
    const mockData = { hash: 'abcd1234', previousGateId: 'gate-01', newGateId: 'gate-02', transferredAt: new Date().toISOString(), affectedProposals: [] }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.req_action({ action: 'transfer', payload: { hash: 'abcd1234', targetGateId: 'gate-02' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ReqActionOutputSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Req action transfer schema errors:', JSON.stringify(ok.error.format(), null, 2), 'structured:', JSON.stringify(res.structuredContent, null, 2))
    expect(ok.success).toBe(true)
    expect(ok.data.action).toBe('transfer')
  })
})