import { describe, it, expect, vi } from 'vitest'
import { repositoryHandlers } from '../../../src/mcp/tools/repository-tools.js'
import {
  ReposListOutputSchema,
  ReposDetectOutputSchema,
  RepositoryDependencyGraphSchema,
  ReposAdjustOutputSchema,
  ReposAddOutputSchema,
  ReposRemoveOutputSchema,
} from '../../../src/mcp/schemas/repository-schemas.js'

describe('Repository Handlers (integration)', () => {
  it('parses and validates structured repo list outputs', async () => {
    const mockData = { repositories: [{ id: 'r1', name: 'repo1', type: 'service' as const, path: 'src/repo1', fileCount: 10, lineCount: 200 }] }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }

    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    // Validate against schema
    const parsed = JSON.parse(res.content[0]!.text as string)
    const ok = ReposListOutputSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('returns helpful error when backend not implemented', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: false, error: { message: 'Backend not implemented' } }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'list', payload: {} })

    expect(res.isError).toBe(true)
    const text = (res.content?.[0] as { text?: string } | undefined)?.text ?? ''
    expect(text.toLowerCase()).toContain('backend')
  })

  it('repos_list with non-json fallback returns text output', async () => {
    const mockData = { repositories: [] }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'list', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.content[0]?.text).toBeDefined()
  })

  it('repos_detect returns structured output when parsing succeeds', async () => {
    const mockData = { detected: [{ repoId: 'r1', name: 'repo-1', type: 'service' as const, path: 'src/repo-1' }] }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'detect', payload: { reanalyzeCrossRepo: false } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.content[0]?.text).toBeDefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    const ok = ReposDetectOutputSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('repos_deps returns structured dependency graph', async () => {
    const mockData = { repositories: [], edges: [] }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'deps', payload: {} })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    const ok = RepositoryDependencyGraphSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('repos_adjust returns parsed payload on success', async () => {
    const mockData = { adjustmentsApplied: 0, affectedRepositories: [] }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'adjust', payload: { adjustments: [] } })
    expect(res.content[0]?.text).toBeDefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    const ok = ReposAdjustOutputSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('repos_add returns structured output matching ReposAddOutputSchema', async () => {
    const mockData = { id: 'repo-new', name: 'new-service', type: 'service', path: 'src/new-service' }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'add', payload: { name: 'new-service', type: 'service', path: 'src/new-service' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    const ok = ReposAddOutputSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('repos_remove returns structured output matching ReposRemoveOutputSchema', async () => {
    const mockData = { removed: true, repositoryId: 'repo-old' }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: mockData }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'remove', payload: { repositoryId: 'repo-old' } })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    const ok = ReposRemoveOutputSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('repos_add returns error when backend rejects invalid path', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: { message: 'Invalid path: traversal detected' } }),
    }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_action({ action: 'add', payload: { name: 'evil', type: 'service', path: '../etc/passwd' } })

    expect(res.isError).toBe(true)
  })

  it('repos_analyze without groupBy calls the analyze function', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: {} }) }
    const handlers = repositoryHandlers(fakeRegistry)
    await handlers.repos_action({ action: 'analyze' })
    expect(fakeRegistry.invoke).toHaveBeenCalledWith('analyze', {})
  })

  it('repos_analyze with groupBy calls the metrics function', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: {} }) }
    const handlers = repositoryHandlers(fakeRegistry)
    await handlers.repos_action({ action: 'analyze', groupBy: 'repository' })
    expect(fakeRegistry.invoke).toHaveBeenCalledWith('metrics', { groupBy: 'repository' })
  })
})
