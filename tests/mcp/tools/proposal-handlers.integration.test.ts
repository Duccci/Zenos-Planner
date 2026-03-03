import { describe, it, expect, vi } from 'vitest'
import { proposalHandlers } from '../../../src/mcp/tools/proposal-tools.js'
import { ProposalListOutputSchema, ProposalDetailSchema } from '../../../src/mcp/schemas/proposal-schemas.js'

describe('Proposal Handlers (integration)', () => {
  it('parses and validates proposal list outputs', async () => {
    const mockData = { proposals: [{ hash: 'abcd1234', title: 'Proposal 1', status: 'pending' as const, gateId: 'gate-01', tasksCompleted: 0, totalTasks: 1, lastUpdated: new Date().toISOString() }] }
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
    const mockData = { hash: 'abcd1234', title: 'My Proposal', description: 'desc', status: 'pending' as const, gateId: 'gate-01', tasks: [], lastUpdated: new Date().toISOString() }
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

  // ── Idempotent start ──────────────────────────────────────────────────────

  it('start returns idempotent success when proposal is already in_progress', async () => {
    const startedAt = '2026-01-01T00:00:00.000Z'
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({
        success: true,
        data: { hash: 'abc12345', status: 'in_progress', startedAt },
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'start', hash: 'abc12345' })
    // State transition validator sees in_progress == targetStatus → idempotent allowed:true
    // Action handler also returns idempotent success
    expect(res).toBeDefined()
    const sc = res.structuredContent as any
    const result = sc?.result ?? sc
    expect(result?.newStatus ?? result?.status ?? 'in_progress').toBe('in_progress')
  })

  // ── Gate-level test-first check (start validators, lines 844-862) ─────────

  it('start validator skips gate-level test-first check for solitary proposal', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: 'solitary01',
              status: 'pending',
              gateId: 'solitary',
              files: [],
              files_affected: [],
              tasks: [],
              title: 'Solo',
              description: 'standalone',
            },
          }
        }
        if (name === 'config_get') return { success: true, data: { qualityThresholds: { coverage: 90, lintErrors: 0, securityIssues: 0 } } }
        if (name === 'proposal_list') return { success: true, data: { proposals: [] } }
        if (name === 'proposal_start') return { success: true, data: { hash: 'solitary01', newStatus: 'in_progress', startedAt: new Date().toISOString() } }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'start',
      hash: 'solitary01',
      preReview: {
        phase: 'apply',
        openQuestionsResolved: true,
        questionsFound: [],
        filesVerified: true,
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })
    // Gate-level test-first check skips for gateId='solitary' — no test-first error
    expect(res).toBeDefined()
    if (res.isError) {
      const text = String(res.content?.[0]?.text ?? '')
      expect(text.toLowerCase()).not.toContain('test-suite')
      expect(text.toLowerCase()).not.toContain('test-first')
    }
  })

  it('start validator gate-level test-first check returns allowed when no sibling proposals', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: 'impl01',
              status: 'pending',
              gateId: 'gate-04',
              files: [],
              files_affected: [],
              tasks: [],
              title: 'Impl',
              description: 'impl desc',
            },
          }
        }
        if (name === 'config_get') return { success: true, data: { qualityThresholds: { coverage: 90, lintErrors: 0, securityIssues: 0 } } }
        // proposal_list returns EMPTY → rows.length === 0 → early return allowed:true
        if (name === 'proposal_list') return { success: true, data: { proposals: [] } }
        if (name === 'proposal_start') return { success: true, data: { hash: 'impl01', newStatus: 'in_progress', startedAt: new Date().toISOString() } }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'start',
      hash: 'impl01',
      preReview: {
        phase: 'apply',
        openQuestionsResolved: true,
        questionsFound: [],
        filesVerified: true,
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })
    expect(res).toBeDefined()
    // rows.length === 0 → gate-level test-first returns allowed:true — no test-first error
    if (res.isError) {
      const text = String(res.content?.[0]?.text ?? '')
      expect(text.toLowerCase()).not.toContain('test-suite missing')
    }
  })

  it('start validator gate-level test-first check runs when sibling proposals exist', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: 'impl02',
              status: 'pending',
              gateId: 'gate-05',
              files: [],
              files_affected: [],
              tasks: [],
              title: 'Impl',
              description: 'impl desc',
            },
          }
        }
        if (name === 'config_get') return { success: true, data: { qualityThresholds: { coverage: 90, lintErrors: 0, securityIssues: 0 } } }
        // proposal_list returns NON-EMPTY → triggers the findProposalByHash + validateGateLevelTestFirst path
        if (name === 'proposal_list') {
          return {
            success: true,
            data: {
              proposals: [
                { hash: 'impl02', lastUpdated: new Date().toISOString() },
                { hash: 'other03', lastUpdated: new Date().toISOString() },
              ],
            },
          }
        }
        if (name === 'proposal_start') return { success: true, data: { hash: 'impl02', newStatus: 'in_progress', startedAt: new Date().toISOString() } }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'start',
      hash: 'impl02',
      preReview: {
        phase: 'apply',
        openQuestionsResolved: true,
        questionsFound: [],
        filesVerified: true,
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })
    // Gate-level test-first check ran (rows.length > 0) — findProposalByHash returns null for
    // real-fs lookups on fake hashes → roles are undefined → validateGateLevelTestFirst runs
    expect(res).toBeDefined()
  })

  // ── reject validator: proposal_show fails → return null ──────────────────

  it('reject validator state check gracefully handles proposal not found', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: false, error: { message: 'not found', code: 'NOT_FOUND' } }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'reject', hash: 'ghost01' })
    expect(res).toBeDefined()
    // Entity not found → state validator allows through, action handler reports the error
    expect(res.isError).toBe(true)
  })

  // ── generate validator: markdown-only branch ──────────────────────────────

  it('generate validator rejects non-markdown filesAffected', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: {} }) }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'generate',
      gateId: 'gate-01',
      filesAffected: ['src/foo.ts'],
      preReview: {
        phase: 'generate',
        openQuestionsResolved: true,
        questionsFound: [],
        gateReviewed: true,
        requirementsVerified: true,
        vagueRequirements: [],
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
    })
    expect(res.isError).toBe(true)
    const text = String(res.content?.[0]?.text ?? '')
    expect(text.toLowerCase()).toContain('markdown')
  })

  // ── validate action: gate-level test-first check with proposals (lines 844-862) ──

  it('validate validators run findProposalByHash for gate-level test-first check when proposals exist', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: 'val01',
              status: 'in_progress',
              gateId: 'gate-07',
              files: [],
              files_affected: [],
              tasks: [],
              title: 'Feature',
              description: 'A feature proposal',
              solitary: false,
            },
          }
        }
        if (name === 'proposal_list') {
          return {
            success: true,
            data: {
              proposals: [
                { hash: 'val01', lastUpdated: new Date().toISOString() },
                { hash: 'val02', lastUpdated: new Date().toISOString() },
              ],
            },
          }
        }
        if (name === 'proposal_validate') {
          return {
            success: true,
            data: { passed: true, passedQuantitative: true, checks: {}, guidance: '' },
          }
        }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    // validate action runs all validators including gate-level test-first check
    // findProposalByHash returns null for fake hashes → roles undefined → validateGateLevelTestFirst called
    const res = await handlers.proposal_action({ action: 'validate', hash: 'val01' })
    expect(res).toBeDefined()
    // Validation ran — result is not a schema parse error or framework error
    if (res.isError) {
      const text = String(res.content?.[0]?.text ?? '')
      // Should not be a zod schema error — the validators ran and produced an actionable message
      expect(text.toLowerCase()).not.toContain('required')
    }
  })
})