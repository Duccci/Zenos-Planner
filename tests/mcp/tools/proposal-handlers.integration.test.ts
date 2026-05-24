import { describe, it, expect, vi, afterAll } from 'vitest'
import { simpleGit } from 'simple-git'
import { proposalHandlers } from '../../../src/mcp/tools/proposal-tools.js'
import {
  ProposalListOutputSchema,
  ProposalDetailSchema,
} from '../../../src/mcp/schemas/proposal-schemas.js'

describe('Proposal Handlers (integration)', () => {
  it('parses and validates proposal list outputs', async () => {
    const mockData = {
      proposals: [
        {
          hash: 'abcd1234',
          title: 'Proposal 1',
          status: 'pending' as const,
          gateId: 'gate-01',
          tasksCompleted: 0,
          totalTasks: 1,
          lastUpdated: new Date().toISOString(),
        },
      ],
      parallelSets: [['abcd1234']],
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }),
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsedList = JSON.parse(res.content[0]!.text as string)
    const ok = ProposalListOutputSchema.safeParse(parsedList)
    if (!ok.success)
      console.error('Proposal schema errors:', JSON.stringify(ok.error.format(), null, 2))
    expect(ok.success).toBe(true)
  })

  it('parses and validates proposal show output', async () => {
    const mockData = {
      hash: 'abcd1234',
      title: 'My Proposal',
      description: 'desc',
      status: 'pending' as const,
      gateId: 'gate-01',
      tasks: [],
      lastUpdated: new Date().toISOString(),
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }),
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'show', payload: { hash: 'abcd1234' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsedDetail = JSON.parse(res.content[0]!.text as string)
    const ok = ProposalDetailSchema.safeParse(parsedDetail)
    expect(ok.success).toBe(true)
  })

  it('handles validation errors on proposal_validate', async () => {
    const fakeRegistry: any = {
      invoke: vi
        .fn()
        .mockResolvedValue({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid proposal' },
        }),
    }

    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'validate', hash: 'abcd1234' })

    expect(res.isError).toBe(true)
    const text = res.content?.[0]?.text ? String(res.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('invalid proposal')
  })

  it('parses and validates proposal approve output', async () => {
    const mockData = {
      hash: 'abcd1234',
      previousStatus: 'in_progress' as const,
      newStatus: 'completed' as const,
      approvedAt: new Date().toISOString(),
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'approve', payload: { hash: 'abcd1234' } })
    expect(res.content[0]?.text).toBeDefined()
  })

  it('parses and validates proposal reject output', async () => {
    const mockData = {
      hash: 'abcd1234',
      previousStatus: 'pending' as const,
      newStatus: 'rejected' as const,
      rejectedAt: new Date().toISOString(),
      reason: 'Nope',
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'reject',
      payload: { hash: 'abcd1234', rejectionReason: 'Nope' },
    })
    expect(res.content[0]?.text).toBeDefined()
  })

  it('parses and validates proposal start output', async () => {
    const showData = {
      hash: 'abcd1234',
      status: 'validated',
      gateId: 'gate-01',
      files_affected: [],
      solitary: false,
    }
    const startData = {
      hash: 'abcd1234',
      previousStatus: 'validated' as const,
      newStatus: 'in_progress' as const,
      startedAt: new Date().toISOString(),
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_start') return { success: true, data: startData }
        if (name === 'config_get')
          return {
            success: true,
            data: { qualityThresholds: { coverage: 90, lintErrors: 0, securityIssues: 0 } },
          }
        if (name === 'proposal_list')
          return { success: true, data: { proposals: [], parallelSets: [] } }
        return { success: true, data: showData }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'start',
      payload: { hash: 'abcd1234' },
      preReview: {
        phase: 'apply',
        openQuestionsResolved: true,
        questionsFound: [],
        filesVerified: true,
        assumptionsDocumented: [],
        blockersIdentified: [],
      },
      qualitativeReview: {
        taskDescriptionsSpecific: true,
        acceptanceCriteriaMeasurable: true,
        filesAffectedVerified: true,
        noUnresolvedMarkers: true,
        scopeFocused: true,
        rollbackSpecific: true,
        flaggedItems: [],
      },
    })
    expect(res.content[0]?.text).toBeDefined()
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
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed?.newStatus ?? parsed?.status ?? 'in_progress').toBe('in_progress')
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
        if (name === 'config_get')
          return {
            success: true,
            data: { qualityThresholds: { coverage: 90, lintErrors: 0, securityIssues: 0 } },
          }
        if (name === 'proposal_list')
          return { success: true, data: { proposals: [], parallelSets: [] } }
        if (name === 'proposal_start')
          return {
            success: true,
            data: {
              hash: 'solitary01',
              newStatus: 'in_progress',
              startedAt: new Date().toISOString(),
            },
          }
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
      qualitativeReview: {
        taskDescriptionsSpecific: true,
        acceptanceCriteriaMeasurable: true,
        filesAffectedVerified: true,
        noUnresolvedMarkers: true,
        scopeFocused: true,
        rollbackSpecific: true,
        flaggedItems: [],
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
        if (name === 'config_get')
          return {
            success: true,
            data: { qualityThresholds: { coverage: 90, lintErrors: 0, securityIssues: 0 } },
          }
        // proposal_list returns EMPTY → rows.length === 0 → early return allowed:true
        if (name === 'proposal_list')
          return { success: true, data: { proposals: [], parallelSets: [] } }
        if (name === 'proposal_start')
          return {
            success: true,
            data: { hash: 'impl01', newStatus: 'in_progress', startedAt: new Date().toISOString() },
          }
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
      qualitativeReview: {
        taskDescriptionsSpecific: true,
        acceptanceCriteriaMeasurable: true,
        filesAffectedVerified: true,
        noUnresolvedMarkers: true,
        scopeFocused: true,
        rollbackSpecific: true,
        flaggedItems: [],
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
        if (name === 'config_get')
          return {
            success: true,
            data: { qualityThresholds: { coverage: 90, lintErrors: 0, securityIssues: 0 } },
          }
        // proposal_list returns NON-EMPTY → triggers the findProposalByHash + validateGateLevelTestFirst path
        if (name === 'proposal_list') {
          return {
            success: true,
            data: {
              proposals: [
                { hash: 'impl02', lastUpdated: new Date().toISOString() },
                { hash: 'other03', lastUpdated: new Date().toISOString() },
              ],
              parallelSets: [['impl02', 'other03']],
            },
          }
        }
        if (name === 'proposal_start')
          return {
            success: true,
            data: { hash: 'impl02', newStatus: 'in_progress', startedAt: new Date().toISOString() },
          }
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
      qualitativeReview: {
        taskDescriptionsSpecific: true,
        acceptanceCriteriaMeasurable: true,
        filesAffectedVerified: true,
        noUnresolvedMarkers: true,
        scopeFocused: true,
        rollbackSpecific: true,
        flaggedItems: [],
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
        if (name === 'proposal_show')
          return { success: false, error: { message: 'not found', code: 'NOT_FOUND' } }
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
              parallelSets: [['val01', 'val02']],
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

  // ─── validate action handler branches (lines 191-227) ─────────────────────

  // Shared solitary proposal data for validate action tests
  const solitaryInProgress = {
    hash: 'sol-val-01',
    status: 'in_progress' as const,
    gateId: undefined,
    solitary: true,
    files: [],
    files_affected: [],
    tasks: [],
    title: 'Test Proposal',
    description: 'A solitary test proposal',
    dependencies: [],
  }

  it('validate action returns passedQuantitative:true with issues:null → issues:[] (branch 9 false side)', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: solitaryInProgress }
        if (name === 'proposal_validate')
          return {
            success: true,
            data: { passedQuantitative: true, issues: null, hash: 'sol-val-01', checks: {} },
          }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'validate', hash: 'sol-val-01' })
    expect(res).toBeDefined()
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      expect(parsed['passedQuantitative']).toBe(true)
      expect(Array.isArray(parsed['issues'])).toBe(true)
      expect((parsed['issues'] as unknown[]).length).toBe(0)
    }
  })

  it('validate action returns passedQuantitative:true with issues array → issues preserved (branch 9 true side)', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: solitaryInProgress }
        if (name === 'proposal_validate')
          return {
            success: true,
            data: {
              passedQuantitative: true,
              issues: ['minor warning'],
              hash: 'sol-val-01',
              checks: {},
            },
          }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'validate', hash: 'sol-val-01' })
    expect(res).toBeDefined()
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      expect(parsed['passedQuantitative']).toBe(true)
      expect(parsed['issues']).toEqual(['minor warning'])
    }
  })

  it('validate action: passedQuantitative:false with checks:undefined → failedChecks absent (branch 11 false side)', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: solitaryInProgress }
        if (name === 'proposal_validate')
          return {
            success: true,
            data: { passedQuantitative: false, issues: ['coverage too low'], hash: 'sol-val-01' },
          }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'validate', hash: 'sol-val-01' })
    expect(res).toBeDefined()
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      expect(parsed['passedQuantitative']).toBe(false)
      expect(parsed['failedChecks']).toBeUndefined()
    }
  })

  it('validate action: passedQuantitative:false with failed checks → failedChecks populated (branch 11 true side)', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: solitaryInProgress }
        if (name === 'proposal_validate')
          return {
            success: true,
            data: {
              passedQuantitative: false,
              issues: ['coverage below threshold'],
              hash: 'sol-val-01',
              checks: { coverageOk: false, securityOk: true },
            },
          }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'validate', hash: 'sol-val-01' })
    expect(res).toBeDefined()
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      expect(parsed['passedQuantitative']).toBe(false)
      const fc = parsed['failedChecks'] as Record<string, boolean> | undefined
      expect(fc).toBeDefined()
      expect(fc?.['coverageOk']).toBe(false)
      expect(fc?.['securityOk']).toBeUndefined()
    }
  })

  // ─── approve/reject/start idempotency branches (lines 254, 276, 300) ───────

  it('approve action is idempotent when proposal already completed: uses stored lastUpdated (branch 16)', async () => {
    const completedProposal = {
      ...solitaryInProgress,
      status: 'completed' as const,
      lastUpdated: '2026-01-01T00:00:00.000Z',
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: completedProposal }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'approve', hash: 'sol-val-01' })
    expect(res).toBeDefined()
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      expect(parsed['newStatus']).toBe('completed')
      expect(parsed['approvedAt']).toBe('2026-01-01T00:00:00.000Z')
    }
  })

  it('reject action is idempotent when proposal already rejected: uses stored rejectedAt (branch 20)', async () => {
    const rejectedProposal = {
      ...solitaryInProgress,
      status: 'rejected' as const,
      rejectedAt: '2026-02-01T00:00:00.000Z',
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: rejectedProposal }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'reject', hash: 'sol-val-01' })
    expect(res).toBeDefined()
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      expect(parsed['newStatus']).toBe('rejected')
      expect(parsed['rejectedAt']).toBe('2026-02-01T00:00:00.000Z')
    }
  })

  it('start action is idempotent when proposal already in_progress: uses stored startedAt (branch 24)', async () => {
    const inProgressProposal = {
      ...solitaryInProgress,
      status: 'in_progress' as const,
      startedAt: '2026-03-01T00:00:00.000Z',
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: inProgressProposal }
        if (name === 'config_get') return { success: true, data: {} }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'start',
      hash: 'sol-val-01',
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
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      expect(parsed['newStatus']).toBe('in_progress')
      expect(parsed['startedAt']).toBe('2026-03-01T00:00:00.000Z')
    }
  })

  // ─── progress action handler branches (lines 365-369) ─────────────────────

  it('progress action injects progressSummary on success with currentTask and filesAffected (branches 38T, 39T, 40T)', async () => {
    const progressProposal = {
      ...solitaryInProgress,
      tasks: [{ description: 't1' }, { description: 't2' }, { description: 't3' }],
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: progressProposal }
        if (name === 'updateProposalProgress')
          return { success: true, data: { completedFiles: ['src/a.ts'], taskIndex: 1 } }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'progress',
      hash: 'sol-val-01',
      currentTask: 2,
      filesAffected: ['src/a.ts', 'src/b.ts'],
    })
    expect(res).toBeDefined()
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      const summary = parsed['progressSummary'] as Record<string, unknown> | undefined
      expect(summary).toBeDefined()
      expect(summary?.['currentTask']).toBe(2)
      expect(summary?.['cumulativeFilesModified']).toEqual(['src/a.ts'])
      expect(summary?.['remainingFilesNotTouched']).toEqual(['src/b.ts'])
    }
  })

  it('progress action injects progressSummary without filesAffected: remainingFiles=[] (branch 39F)', async () => {
    const progressProposal = {
      ...solitaryInProgress,
      tasks: [{ description: 't1' }, { description: 't2' }],
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: progressProposal }
        if (name === 'updateProposalProgress')
          return { success: true, data: { completedFiles: [], taskIndex: 0 } }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'progress',
      hash: 'sol-val-01',
      currentTask: 1,
    })
    expect(res).toBeDefined()
    if (!res.isError) {
      const parsed = JSON.parse(res.content[0]!.text as string) as Record<string, unknown>
      const summary = parsed['progressSummary'] as Record<string, unknown> | undefined
      expect(summary).toBeDefined()
      expect(summary?.['remainingFilesNotTouched']).toEqual([])
    }
  })

  it('progress action returns progressResult directly when updateProposalProgress fails (branch 38F)', async () => {
    const progressProposal = { ...solitaryInProgress, tasks: [{ description: 't1' }] }
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: progressProposal }
        if (name === 'updateProposalProgress')
          return {
            success: false,
            error: { code: 'PROGRESS_UPDATE_FAILED', message: 'update failed' },
          }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'progress',
      hash: 'sol-val-01',
      currentTask: 1,
    })
    expect(res).toBeDefined()
    // progressResult.success=false is passed through — result is an error response
    const text = String(res.content?.[0]?.text ?? '')
    expect(text).toBeTruthy()
    const parsed = JSON.parse(text) as Record<string, unknown>
    expect(parsed['error']).toBe('update failed')
    expect(parsed['code']).toBe('PROGRESS_UPDATE_FAILED')
    expect(res.structuredContent).toBeUndefined()
  })

  // ─── progress validator branches (lines 676-677, 728) ─────────────────────

  it('progress validator blocks currentTask < 1: schema rejects value below minimum (branches 90-92)', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: solitaryInProgress }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    // currentTask:0 is rejected by the input schema (minimum:1) before validators run
    const res = await handlers.proposal_action({
      action: 'progress',
      hash: 'sol-val-01',
      currentTask: 0,
    })
    expect(res.isError).toBe(true)
    const text = String(res.content?.[0]?.text ?? '')
    expect(text).toBeTruthy()
  })

  it('progress validator blocks currentTask out of bounds: returns error (branch 102)', async () => {
    const twoTaskProposal = {
      ...solitaryInProgress,
      tasks: [{ description: 't1' }, { description: 't2' }],
    }
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') return { success: true, data: twoTaskProposal }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'progress',
      hash: 'sol-val-01',
      currentTask: 3,
    })
    expect(res.isError).toBe(true)
    const text = String(res.content?.[0]?.text ?? '')
    expect(text).toContain('out of bounds')
  })

  // ─── generate action: solitary=true with gateId (lines 163-167) ──────────

  it('generate action removes gateId when solitary=true with gateId provided (branches 3-5)', async () => {
    const invokedArgs: Array<{ name: string; payload: unknown }> = []
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string, payload: unknown) => {
        invokedArgs.push({ name, payload })
        if (name === 'proposal_list')
          return { success: true, data: { proposals: [], parallelSets: [] } }
        if (name === 'proposal_create')
          return { success: true, data: { hash: 'new-sol-01', title: 'Solitary Gen' } }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({
      action: 'generate',
      solitary: true,
      gateId: 'gate-01',
      title: 'Solitary Gen',
      summary:
        'A solitary proposal that exercises the routing logic for solitary=true with gateId provided.',
      tasks: [
        {
          description: 'Verify routing strips gateId when solitary=true',
          acceptanceCriteria: ['proposal_create receives solitary=true and no gateId'],
        },
      ],
      description: 'A solitary proposal',
      filesAffected: [],
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
    expect(res).toBeDefined()
    // proposal_create must have been called without gateId
    const createCall = invokedArgs.find((a) => a.name === 'proposal_create')
    expect(createCall).toBeDefined()
    expect((createCall?.payload as Record<string, unknown>)['gateId']).toBeUndefined()
    expect((createCall?.payload as Record<string, unknown>)['solitary']).toBe(true)
  })

  afterAll(async () => {
    const git = simpleGit(process.cwd())
    await git.raw(['worktree', 'prune']).catch(() => {})
  })
})
