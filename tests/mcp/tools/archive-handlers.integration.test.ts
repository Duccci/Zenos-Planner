import { describe, it, expect, vi } from 'vitest'
import { archiveHandlers } from '../../../src/mcp/tools/archive-tools.js'
import { ArchiveGateOutputSchema, ArchiveProposalOutputSchema, ArchiveBatchOutputSchema } from '../../../src/mcp/schemas/archive-schemas.js'

describe('Archive Handlers (integration)', () => {
  it('archive_gate returns structured output from mockResult', async () => {
    const handlers = archiveHandlers()
    const mock = JSON.stringify({ success: true, gateId: 'gate-01', gateName: 'Gate 01', status: 'completed', archivedAt: new Date().toISOString(), location: 'zeno/gates/archive/gate-01.md', gitTag: 'gate-01-gate-01', consolidatedProposals: 0, fulfilledRequirements: 0, nextGateId: 'gate-02', summary: 'Archived' })
    const res = await handlers.archive_gate({ mockResult: mock })
    expect(res.structuredContent).toBeDefined()
    const ok = ArchiveGateOutputSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('archive_proposal returns structured output from mockResult', async () => {
    const handlers = archiveHandlers()
    const mock = JSON.stringify({ success: true, hash: 'abc12345', title: 'Title', type: 'gate-tied', gateId: 'gate-01', archivedAt: new Date().toISOString(), location: 'zeno/proposals/archive/gate-01/abc12345.md', updatedRequirements: [], unblockedProposals: [], gateStatus: 'in_progress', summary: 'Archived proposal' })
    const res = await handlers.archive_proposal({ mockResult: mock })
    expect(res.structuredContent).toBeDefined()
    const ok = ArchiveProposalOutputSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('archive_batch returns structured output from mockResult', async () => {
    const handlers = archiveHandlers()
    const mock = JSON.stringify({ success: true, archivedCount: 0, results: [], summary: 'ok' })
    const res = await handlers.archive_batch({ mockResult: mock })
    expect(res.structuredContent).toBeDefined()
    const ok = ArchiveBatchOutputSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('archive_gate returns not implemented when missing input', async () => {
    const handlers = archiveHandlers()
    const res = await handlers.archive_gate({})
    expect(res.isError).toBe(true)
  })
})