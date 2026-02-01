import { describe, it, expect, vi } from 'vitest'
import { analysisHandlers } from '../../../src/mcp/tools/analysis-tools.js'
import { AnalysisResultSchema, ProjectMetricsSchema } from '../../../src/mcp/schemas/analysis-schemas.js'

describe('Analysis Handlers (integration)', () => {
  it('parses single analysis result', async () => {
    const fakeResult = { path: 'src/core', summary: 'ok', metrics: { lineCount: 10, fileCount: 1 } }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify(fakeResult) } }) }

    const handlers = analysisHandlers(fakeRegistry)
    const res = await handlers.analyze({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    if (res.structuredContent) {
      const ok = AnalysisResultSchema.safeParse(res.structuredContent)
      expect(ok.success).toBe(true)
    }
  })

  it('parses project metrics', async () => {
    const fakeMetrics = { codeMetrics: { lineCount: 100, fileCount: 5 }, timestamp: new Date().toISOString() }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify(fakeMetrics) } }) }

    const handlers = analysisHandlers(fakeRegistry)
    const res = await handlers.metrics({})

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    if (res.structuredContent) {
      const ok = ProjectMetricsSchema.safeParse(res.structuredContent)
      expect(ok.success).toBe(true)
    }
  })

  it('analyze returns array of results when backend returns an array', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify([{ path: 'src/a.ts', metrics: { lineCount: 1, fileCount: 1 } }]) } }) }
    const handlers = analysisHandlers(fakeRegistry)
    const res = await handlers.analyze({})
    expect(res.structuredContent).toBeDefined()
    expect(Array.isArray(res.structuredContent.results)).toBe(true)
  })

  it('analyze falls back to project metrics when appropriate', async () => {
    const metrics = { codeMetrics: { lineCount: 10, fileCount: 2 }, timestamp: new Date().toISOString() }
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify(metrics) } }) }

    const handlers = analysisHandlers(fakeRegistry)
    const res = await handlers.analyze({})

    const ok = ProjectMetricsSchema.safeParse(res.structuredContent)
    expect(ok.success).toBe(true)
  })

  it('show_entity returns parsed entity when possible', async () => {
    const fakeRegistry: any = { invoke: vi.fn().mockResolvedValue({ success: true, data: { output: JSON.stringify({ path: 'src/x.ts' }) } }) }
    const handlers = analysisHandlers(fakeRegistry)
    const res = await handlers.show_entity({ hash: 'abc' })
    expect(res.structuredContent).toBeDefined()
  })
})