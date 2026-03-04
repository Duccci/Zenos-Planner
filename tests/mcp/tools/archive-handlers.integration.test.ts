import { describe, it, expect, vi } from 'vitest'
import { archiveHandlers } from '../../../src/mcp/tools/archive-tools.js'

describe('Archive Handlers (integration)', () => {
  it('parses and validates archive gate output', async () => {
    const mockData = { success: true, gateId: 'gate-01', gateName: 'Gate 01', status: 'completed', archivedAt: new Date().toISOString(), location: 'zeno/gates/archive/gate-01.md', gitTag: 'gate-01-gate-01', consolidatedProposals: 0, fulfilledRequirements: 0, nextGateId: 'gate-02', summary: 'Archived' }
    const fakeRegistry: any = {
      invoke: () =>({ success: true, data: mockData })
    }

    const handlers = archiveHandlers(fakeRegistry)
    const res = await handlers.archive_action({ action: 'gate', payload: { gateId: 'gate-01' } })

    console.log('archive res:', JSON.stringify(res, null, 2))
    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsedGate = JSON.parse((res.content[0] as any).text)
    expect(parsedGate?.gateId).toBe('gate-01')
  })

  it('parses and validates archive batch output', async () => {
    const mockData = { success: true, archivedCount: 0, results: [], summary: 'ok' }
    const fakeRegistry: any = {
      invoke: () =>({ success: true, data: mockData })
    }

    const handlers = archiveHandlers(fakeRegistry)
    const res = await handlers.archive_action({ action: 'batch', payload: { artifacts: [{ type: 'gate', gateId: 'gate-01' }] } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsedBatch = JSON.parse((res.content[0] as any).text)
    expect(parsedBatch?.archivedCount).toBeDefined()
  })

  it('archive_action returns not implemented when missing registry', async () => {
    const handlers = archiveHandlers()
    const res = await handlers.archive_action({ action: 'gate', payload: { gateId: 'gate-01' } })
    expect(res.isError).toBe(true)
  })
})
