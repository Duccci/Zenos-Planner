import { describe, it, expect, vi } from 'vitest'
import { configHandlers } from '../../../src/mcp/tools/config-tools.js'

describe('Config Handlers (integration)', () => {
  it('parses JSON config outputs', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ quality: { coverageThreshold: 90 } }) } })
    }

    const handlers = configHandlers(fakeRegistry)
    const res = await handlers.config_get({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toBeDefined()
    expect(res.structuredContent.quality?.coverageThreshold).toBe(90)
  })

  it('returns an error when backend fails', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: false, error: { message: 'Not available' } }) }
    const handlers = configHandlers(fakeRegistry)
    const res = await handlers.config_get({})
    expect(res.isError).toBe(true)
    expect(String(res.content?.[0]?.text || '').toLowerCase()).toContain('not available')
  })
})