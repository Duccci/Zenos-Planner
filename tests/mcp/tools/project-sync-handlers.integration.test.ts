import { describe, it, expect, vi } from 'vitest'
import { projectSyncHandlers } from '../../../src/mcp/tools/project-sync-tools.js'

vi.mock('../../../src/core/project-sync-service', () => ({
  syncStatus: vi.fn().mockResolvedValue({
    coreRepo: 'CoreRepo',
    coreHead: 'abc1234567890def1234567890abcdef12345678',
    coreHeadShort: 'abc1234',
    consumers: [],
    summary: { total: 0, current: 0, behind: 0, dirty: 0, blocked: 0 },
  }),
  syncCommit: vi.fn().mockResolvedValue({
    status: 'committed',
    commitHash: 'abc1234567890def1234567890abcdef12345678',
    commitHashShort: 'abc1234',
    commitMessage: 'feat(core): test',
    pushed: false,
  }),
  syncPropagate: vi.fn().mockResolvedValue({
    coreCommitHash: 'abc1234567890def1234567890abcdef12345678',
    coreCommitHashShort: 'abc1234',
    dryRun: false,
    results: [],
    summary: { updated: 0, alreadyCurrent: 0, blocked: 0, errors: 0 },
  }),
  syncFull: vi.fn().mockResolvedValue({
    commit: { status: 'committed', commitHash: 'abc1234', pushed: false },
    propagate: {
      coreCommitHash: 'abc1234567890def1234567890abcdef12345678',
      coreCommitHashShort: 'abc1234',
      dryRun: false,
      results: [],
      summary: { updated: 0, alreadyCurrent: 0, blocked: 0, errors: 0 },
    },
  }),
}))

vi.mock('../../../src/utils/config', () => ({
  findProjectRoot: vi.fn().mockReturnValue('/project/CoreRepo'),
  getWorkspaceRoot: vi.fn().mockReturnValue('/project/CoreRepo'),
}))

describe('project-sync-handlers (integration)', () => {
  const fakeRegistry: any = {
    invoke: vi.fn().mockResolvedValue({ success: false }),
  }

  it('handles status action', async () => {
    const handlers = projectSyncHandlers(fakeRegistry)
    const res = await handlers.project_sync({ action: 'status' })

    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.coreRepo).toBe('CoreRepo')
    expect(parsed.summary).toBeDefined()
  })

  it('handles commit action with message', async () => {
    const handlers = projectSyncHandlers(fakeRegistry)
    const res = await handlers.project_sync({ action: 'commit', message: 'test commit' })

    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.status).toBe('committed')
  })

  it('returns error for commit without message', async () => {
    const handlers = projectSyncHandlers(fakeRegistry)
    const res = await handlers.project_sync({ action: 'commit' })

    expect(res.isError).toBe(true)
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.error).toContain('message is required')
  })

  it('handles propagate action', async () => {
    const handlers = projectSyncHandlers(fakeRegistry)
    const res = await handlers.project_sync({ action: 'propagate', repos: ['ConsumerA'] })

    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.coreCommitHash).toBeDefined()
    expect(parsed.summary).toBeDefined()
  })

  it('handles full action with message', async () => {
    const handlers = projectSyncHandlers(fakeRegistry)
    const res = await handlers.project_sync({ action: 'full', message: 'full sync' })

    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.commit).toBeDefined()
    expect(parsed.propagate).toBeDefined()
  })

  it('returns error for full without message', async () => {
    const handlers = projectSyncHandlers(fakeRegistry)
    const res = await handlers.project_sync({ action: 'full' })

    expect(res.isError).toBe(true)
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.error).toContain('message is required')
  })

  it('catches thrown errors and returns error result', async () => {
    const { syncStatus } = await import('../../../src/core/project-sync-service')
    vi.mocked(syncStatus).mockRejectedValueOnce(new Error('Connection refused'))

    const handlers = projectSyncHandlers(fakeRegistry)
    const res = await handlers.project_sync({ action: 'status' })

    expect(res.isError).toBe(true)
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.error).toContain('Connection refused')
  })

  it('falls back when registry invoke fails', async () => {
    const failingRegistry: any = {
      invoke: vi.fn().mockRejectedValue(new Error('Registry unavailable')),
    }
    const handlers = projectSyncHandlers(failingRegistry)
    const res = await handlers.project_sync({ action: 'status' })

    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(parsed.coreRepo).toBe('CoreRepo')
  })

  it('passes registry consumers when available', async () => {
    const successRegistry: any = {
      invoke: vi.fn().mockResolvedValue({
        success: true,
        data: { repositories: [{ name: 'ConsumerA', path: '/project/ConsumerA' }] },
      }),
    }
    const handlers = projectSyncHandlers(successRegistry)
    const res = await handlers.project_sync({ action: 'status' })

    expect(res.isError).toBeUndefined()
    const { syncStatus } = await import('../../../src/core/project-sync-service')
    expect(vi.mocked(syncStatus)).toHaveBeenCalledWith(
      expect.objectContaining({
        registryConsumers: [{ name: 'ConsumerA', path: '/project/ConsumerA' }],
      }),
    )
  })
})
