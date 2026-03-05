import { describe, it, expect, vi } from 'vitest'
import { requirementHandlers } from '../../../src/mcp/tools/requirement-tools.js'

describe('Requirement Handlers (integration)', () => {
  it('parses and validates requirement list outputs', async () => {
    const mockData = { requirements: [{ hash: 'abcd123401234567', title: 'Req 1', type: 'functional', gateId: 'gate-01', created: new Date().toISOString() }] }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.reg_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsedList = JSON.parse(res.content[0]!.text as string)
    expect(parsedList.requirements).toBeDefined()
  })

  it('parses dependency graph outputs', async () => {
    const mockData = { graph: { root: 'abcd123401234567', nodes: [{ hash: 'abcd123401234567', title: 'Req 1', type: 'functional', gateId: 'gate-01' }], edges: [] } }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.reg_action({ action: 'deps', payload: { hash: 'abcd123401234567' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsedDeps = JSON.parse(res.content[0]!.text as string)
    expect(parsedDeps.graph).toBeDefined()
  })

  it('parses and validates requirement show output', async () => {
    const mockData = { requirement: { hash: 'abcd123401234567', title: 'Req 1', description: 'desc', type: 'functional', gateId: 'gate-01', created: new Date().toISOString() }, children: [], ancestors: [] }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.reg_action({ action: 'show', payload: { hash: 'abcd123401234567' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsedShow = JSON.parse(res.content[0]!.text as string)
    expect(parsedShow.requirement).toBeDefined()
  })

  it('parses and validates req_transfer output', async () => {
    const mockData = { hash: 'abcd123401234567', previousGateId: 'gate-01', newGateId: 'gate-02', transferredAt: new Date().toISOString(), affectedProposals: [] }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.reg_action({ action: 'transfer', payload: { hash: 'abcd123401234567', targetGateId: 'gate-02' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsedTransfer = JSON.parse(res.content[0]!.text as string)
    expect(parsedTransfer.hash).toBe('abcd123401234567')
  })
})
