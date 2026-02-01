import { describe, it, expect, vi } from 'vitest'
import { repositoryHandlers } from '../../../src/mcp/tools/repository-tools.js'
import { ReposListOutputSchema } from '../../../src/mcp/schemas/repository-schemas.js'

describe('Repository Handlers (integration)', () => {
  it('parses and validates structured repo list outputs', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ repositories: [{ id: 'r1', name: 'repo1', type: 'service', path: 'src/repo1', fileCount: 10, lineCount: 200 }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } }) } })
    }

    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_list({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()

    // Validate against schema
    const parsed = res.structuredContent
    const ok = ReposListOutputSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('returns helpful error when backend not implemented', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: false, error: { message: 'Unknown command: repos_list' } })
    }

    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_list({})

    expect(res.isError).toBe(true)
    const text = res.content?.[0]?.text ? String(res.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('not implemented')
  })

  it('repos_list with non-json fallback returns text output', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: 'no json here' } })
    }

    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_list({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(String(res.structuredContent?.output || '')).toContain('no json')
  })

  it('repos_detect returns structured output when parsing succeeds', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ detected: true, repositories: [{ name: 'repo-1' }] }) } })
    }

    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_detect({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()
  })

  it('repos_deps returns structured dependency graph', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ nodes: [], edges: [] }) } })
    }

    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_deps({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
  })

  it('repos_adjust returns parsed payload on success', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ adjusted: true }) } }) }
    const handlers = repositoryHandlers(fakeRegistry)
    const res = await handlers.repos_adjust({ changes: {} })
    expect(res.structuredContent).toBeDefined()
  })
})
