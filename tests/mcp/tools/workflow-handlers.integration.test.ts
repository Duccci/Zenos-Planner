import { describe, it, expect, vi } from 'vitest'
import { workflowHandlers } from '../../../src/mcp/tools/workflow-tools.js'
import { ProposalGenerateOutputSchema, GateGenerateOutputSchema } from '../../../src/mcp/schemas/workflow-schemas.js'

describe('Workflow Handlers (integration)', () => {
  it('generateProposals returns structured output from mockResult', async () => {
    const handlers = workflowHandlers()
    const mock = JSON.stringify({ success: true, gateId: 'gate-01', proposalsGenerated: 1, proposals: [{ hash: 'abc12345', filename: '01-proposal.md', path: 'zeno/proposals/gate-01/01-proposal.md', type: 'gate-tied', status: 'pending', summary: 'Do work' }], message: 'ok' })
    const res = await handlers.generateProposals({ mockResult: mock })
    expect(res.structuredContent).toBeDefined()
    const ok = ProposalGenerateOutputSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('generateGates returns structured output from mockResult', async () => {
    const handlers = workflowHandlers()
    const mock = JSON.stringify({ success: true, mode: 'new', gatesGenerated: 0, gates: [], requirementsAttributed: 0, diagramsUpdated: [], message: 'ok' })
    const res = await handlers.generateGates({ mockResult: mock })
    expect(res.structuredContent).toBeDefined()
    const ok = GateGenerateOutputSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('updateProposalProgress returns error when invalid', async () => {
    const handlers = workflowHandlers()
    const res = await handlers.updateProposalProgress({ hash: 'bad' })
    expect(res.isError).toBe(true)
  })
})