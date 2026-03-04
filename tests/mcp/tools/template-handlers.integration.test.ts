import { describe, it, expect, vi } from 'vitest'
import { templateHandlers } from '../../../src/mcp/tools/template-tools.js'

describe('Template Handlers (unit)', () => {
  it('template_action get returns content on success', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: 'template-body' } }) }
    const handlers = templateHandlers(fakeRegistry)
    const res = await handlers.template_action({ action: 'get', name: 'gate-prd-template' })
    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(String(parsed?.content || '')).toContain('# Gate [XX]: [Gate Name]')
  })

  it('template_action get with includeContext returns formatted context', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: 'context-body' } }) }
    const handlers = templateHandlers(fakeRegistry)
    const res = await handlers.template_action({ action: 'get', name: 'gate-prd-template', includeContext: true })
    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(String(res.content[0]?.text || '')).toContain('Name: gate-prd-template')
  })

  it('template_action list handles non-json output gracefully', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: 'plain-text' } }) }
    const handlers = templateHandlers(fakeRegistry)
    const res = await handlers.template_action({ action: 'list' })
    expect(res).toBeDefined()
    expect(res.content[0]?.text).toBeDefined()
    const parsed = JSON.parse(res.content[0]!.text as string)
    expect(Array.isArray(parsed.templates)).toBe(true)
  })
})
