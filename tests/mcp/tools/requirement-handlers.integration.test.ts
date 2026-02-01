import { describe, it, expect, vi } from 'vitest'
import { requirementHandlers } from '../../../src/mcp/tools/requirement-tools.js'
import { ReqListOutputSchema, RequirementDetailSchema, DependencyGraphSchema, ReqTransferOutputSchema } from '../../../src/mcp/schemas/requirement-schemas.js'

describe('Requirement Handlers (integration)', () => {
  it('parses and validates requirement list outputs', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ requirements: [{ hash: 'abcd1234', title: 'Req 1', type: 'feature', gateId: 'gate-01', created: new Date().toISOString() }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } }) } })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.req_list({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ReqListOutputSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Req list schema errors:', JSON.stringify(ok.error.format(), null, 2))
    expect(ok.success).toBe(true)
  })

  it('parses dependency graph outputs', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ root: 'abcd1234', nodes: [{ hash: 'abcd1234', title: 'Req 1', type: 'feature', gateId: 'gate-01' }], edges: [] }) } })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.req_deps({ hash: 'r#1' })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = DependencyGraphSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Dependency graph schema errors:', JSON.stringify(ok.error.format(), null, 2))
    expect(ok.success).toBe(true)
  })

  it('parses and validates requirement show output', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ hash: 'abcd1234', title: 'Req 1', description: 'desc', type: 'feature', gateId: 'gate-01', created: new Date().toISOString() }) } })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.req_show({ hash: 'r#1' })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = RequirementDetailSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Requirement show schema errors:', JSON.stringify(ok.error.format(), null, 2), 'structured:', JSON.stringify(res.structuredContent, null, 2))
    expect(ok.success).toBe(true)
  })

  it('parses and validates req_transfer output', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ hash: 'abcd1234', previousGateId: 'gate-01', newGateId: 'gate-02', transferredAt: new Date().toISOString() }) } })
    }

    const handlers = requirementHandlers(fakeRegistry)
    const res = await handlers.req_transfer({ hash: 'r#1', targetGateId: 'gate-02' })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const ok = ReqTransferOutputSchema.safeParse(res.structuredContent)
    if (!ok.success) console.error('Req transfer schema errors:', JSON.stringify(ok.error.format(), null, 2), 'structured:', JSON.stringify(res.structuredContent, null, 2))
    expect(ok.success).toBe(true)
  })
})