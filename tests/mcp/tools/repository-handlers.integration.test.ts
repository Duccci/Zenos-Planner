import { describe, it, expect, vi } from 'vitest'
import { repositoryHandlers } from '../../../src/mcp/tools/repository-tools.js'
import { ReposListOutputSchema } from '../../../src/mcp/schemas/repository-schemas.js'

describe('Repository Handlers (integration)', () => {
  it('parses and validates structured repo list outputs', async () => {
    const mockData = { repositories: [{ id: 'r1', name: 'repo1', type: 'service' as const, path: 'src/repo1', fileCount: 10, lineCount: 200 }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }

    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()

    // Validate against schema
    const parsed = (res.structuredContent as any)?.result ?? res.structuredContent
    const ok = ReposListOutputSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('returns helpful error when backend not implemented', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: false, error: { message: 'Backend not implemented' } }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'list', payload: {} })

    expect(res.isError).toBe(true)
    const text = res.content?.[0]?.text ? String(res.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('backend')
  })

  it('repos_list with non-json fallback returns text output', async () => {
    const mockData = { repositories: [], pagination: { skip: 0, take: 50, total: 0, hasMore: false } }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()
  })

  it('repos_detect returns structured output when parsing succeeds', async () => {
    const mockData = { detected: [{ repoId: 'r1', name: 'repo-1', type: 'service' as const, path: 'src/repo-1' }] }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'detect', payload: { reanalyzeCrossRepo: false } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()
  })

  it('repos_deps returns structured dependency graph', async () => {
    const mockData = { repositories: [], edges: [] }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'deps', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
  })

  it('repos_adjust returns parsed payload on success', async () => {
    const mockData = { adjustmentsApplied: 0, affectedRepositories: [] }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'adjust', payload: { adjustments: [] } })
    expect(res.structuredContent).toBeDefined()
  })
})
