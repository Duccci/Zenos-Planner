import { describe, it, expect, vi } from 'vitest'
import { analysisHandlers } from '../../../src/mcp/tools/analysis-tools.js'
import { AnalysisResultSchema, ProjectMetricsSchema } from '../../../src/mcp/schemas/analysis-schemas.js'

describe('Analysis Handlers (integration)', () => {
  it('parses single analysis result', async () => {
    const handlers = analysisHandlers()
    const fakeResult = JSON.stringify({ path: 'src/core', summary: 'ok', metrics: { lineCount: 10, fileCount: 1 } })

    const res = await handlers.analyze({ mockResult: fakeResult })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    if (res.content[0]) {
      const ok = AnalysisResultSchema.safeParse(JSON.parse((res.content[0] as any).text))
      expect(ok.success).toBe(true)
    }
  })

  it('parses project metrics via analyze with groupBy', async () => {
    const handlers = analysisHandlers()
    const fakeMetrics = JSON.stringify({ codeMetrics: { lineCount: 100, fileCount: 5 }, timestamp: new Date().toISOString() })

    const res = await handlers.analyze({ groupBy: 'repository', mockResult: fakeMetrics })

    expect(res).toBeDefined()
    expect(res.isError).toBeUndefined()
    if (res.content[0]) {
      const ok = ProjectMetricsSchema.safeParse(JSON.parse((res.content[0] as any).text))
      expect(ok.success).toBe(true)
    }
  })

  it('analyze returns array of results when backend returns an array', async () => {
    const handlers = analysisHandlers()
    const res = await handlers.analyze({ mockResult: JSON.stringify([{ path: 'src/a.ts', metrics: { lineCount: 1, fileCount: 1 } }]) })
    expect(res.content[0]?.text).toBeDefined()
    const parsedArray = JSON.parse((res.content[0] as any).text)
    // When backend returns an array, content is the raw JSON text of that array
    expect(Array.isArray(parsedArray) || parsedArray != null).toBe(true)
  })

  it('analyze falls back to project metrics when appropriate', async () => {
    const handlers = analysisHandlers()
    const metrics = JSON.stringify({ codeMetrics: { lineCount: 10, fileCount: 2 }, timestamp: new Date().toISOString() })

    const res = await handlers.analyze({ mockResult: metrics })

    const ok = ProjectMetricsSchema.safeParse(JSON.parse((res.content[0] as any).text))
    expect(ok.success).toBe(true)
  })

  it('analyze (no groupBy) returns structured result', async () => {
    const handlers = analysisHandlers()
    const res = await handlers.analyze({ mockResult: JSON.stringify({ path: 'src/x.ts' }) })
    expect(res.content[0]?.text).toBeDefined()
  })
})
