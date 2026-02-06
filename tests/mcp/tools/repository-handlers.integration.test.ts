import { describe, it, expect, vi } from 'vitest'
import { repositoryHandlers } from '../../../src/mcp/tools/repository-tools.js'
import { ReposListOutputSchema } from '../../../src/mcp/schemas/repository-schemas.js'

describe('Repository Handlers (integration)', () => {
  it('parses and validates structured repo list outputs', async () => {
    const handlers = repositoryHandlers()
    const mock = JSON.stringify({ repositories: [{ id: 'r1', name: 'repo1', type: 'service', path: 'src/repo1', fileCount: 10, lineCount: 200 }], pagination: { skip: 0, take: 50, total: 1, hasMore: false } })

    const res = await handlers.repos_list({ mockResult: mock })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()

    // Validate against schema
    const parsed = res.structuredContent
    const ok = ReposListOutputSchema.safeParse(parsed)
    expect(ok.success).toBe(true)
  })

  it('returns helpful error when backend not implemented', async () => {
    const handlers = repositoryHandlers()
    const res = await handlers.repos_list({})

    expect(res.isError).toBe(true)
    const text = res.content?.[0]?.text ? String(res.content?.[0]?.text) : ''
    expect(text.toLowerCase()).toContain('not implemented')
  })

  it('repos_list with non-json fallback returns text output', async () => {
    const handlers = repositoryHandlers()
    const res = await handlers.repos_list({ mockResult: 'no json here' })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(String(res.structuredContent?.output || '')).toContain('no json')
  })

  it('repos_detect returns structured output when parsing succeeds', async () => {
    const handlers = repositoryHandlers()
    const res = await handlers.repos_detect({ mockResult: JSON.stringify({ detected: true, repositories: [{ name: 'repo-1' }] }) })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()
  })

  it('repos_deps returns structured dependency graph', async () => {
    const handlers = repositoryHandlers()
    const res = await handlers.repos_deps({ mockResult: JSON.stringify({ nodes: [], edges: [] }) })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
  })

  it('repos_adjust returns parsed payload on success', async () => {
    const handlers = repositoryHandlers()
    const res = await handlers.repos_adjust({ changes: {}, mockResult: JSON.stringify({ adjusted: true }) })
    expect(res.structuredContent).toBeDefined()
  })
})
