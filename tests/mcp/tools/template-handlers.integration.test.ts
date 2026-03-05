import { describe, it, expect, vi } from 'vitest'
import { architectureHandlers } from '../../../src/mcp/tools/architecture-tools.js'

describe('diagram_action template handlers (unit)', () => {
  it('get returns content on success', async () => {
    const handlers = architectureHandlers({} as any)
    const res = await handlers.diagram_action({ action: 'get', name: 'gate-prd-template' })
    expect(res).toBeDefined()
    expect((res.content[0] as any)?.text).toBeDefined()
  })

  it('get with includeContext returns formatted context when found', async () => {
    const handlers = architectureHandlers({} as any)
    const res = await handlers.diagram_action({ action: 'get', name: 'gate-prd-template', includeContext: true })
    expect(res).toBeDefined()
    expect((res.content[0] as any)?.text).toBeDefined()
    if (!res.isError) {
      const sc: any = res.structuredContent
      if (sc?.context) {
        expect(String(sc.context)).toContain('Name: gate-prd-template')
      }
    }
  })

  it('list returns templates array', async () => {
    const handlers = architectureHandlers({} as any)
    const res = await handlers.diagram_action({ action: 'list' })
    expect(res).toBeDefined()
    expect((res.content[0] as any)?.text).toBeDefined()
  })

  it('get with unknown name returns not-found error', async () => {
    const handlers = architectureHandlers({} as any)
    const res = await handlers.diagram_action({ action: 'get', name: 'no-such-template-xyz' })
    expect(res.isError).toBe(true)
  })
})
