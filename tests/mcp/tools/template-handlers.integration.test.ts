import { describe, it, expect, vi } from 'vitest'
import { templateHandlers } from '../../../src/mcp/tools/template-tools.js'

describe('Template Handlers (unit)', () => {
  it('template_get returns content on success', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: 'template-body' } }) }
    const handlers = templateHandlers(fakeRegistry)
    const res = await handlers.template_get({ name: 'xyz' })
    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(String(res.structuredContent?.content || '')).toContain('template-body')
  })

  it('template_context returns content on success', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: 'context-body' } }) }
    const handlers = templateHandlers(fakeRegistry)
    const res = await handlers.template_context({ name: 'xyz' })
    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(String(res.structuredContent?.context || '')).toContain('context-body')
  })

  it('template_list handles non-json output gracefully', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: 'plain-text' } }) }
    const handlers = templateHandlers(fakeRegistry)
    const res = await handlers.template_list({})
    expect(res).toBeDefined()
    expect(res.structuredContent).toBeDefined()
    expect(Array.isArray(res.structuredContent.templates)).toBe(true)
  })
})