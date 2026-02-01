import { AnalyzeInputSchema, MetricsInputSchema, ShowEntityInputSchema } from '../schemas/analysis-schemas.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export const analysisToolDefinitions = [
  {
    name: 'analyze',
    title: 'Analyze Codebase',
    description: 'Analyze codebase or specific path to produce metrics',
    inputSchema: AnalyzeInputSchema
  },
  {
    name: 'show_entity',
    title: 'Show Entity',
    description: 'Show analysis information for an entity by hash',
    inputSchema: ShowEntityInputSchema
  },
  {
    name: 'metrics',
    title: 'Metrics',
    description: 'Return code metrics for a path or gate',
    inputSchema: MetricsInputSchema
  }
]

import { AnalysisResultSchema, ProjectMetricsSchema } from '../schemas/analysis-schemas.js'

export function analysisHandlers(registry: FunctionRegistry) {
  return {
    async analyze(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('analyze', args)
      if (result.success) {
        const data = result.data as any
        const parsed = (() => {
          try { return JSON.parse(String(data.output ?? data)) } catch { return null }
        })()

        if (parsed) {
          // If single result matches AnalysisResultSchema, return it; if it's an array, return array
          if (Array.isArray(parsed)) {
            const allOk = parsed.every(p => AnalysisResultSchema.safeParse(p).success)
            if (allOk) return { content: [ { type: 'text', text: JSON.stringify(parsed, null, 2) } ], structuredContent: { results: parsed } }
          } else {
            const pOk = AnalysisResultSchema.safeParse(parsed)
            if (pOk.success) return { content: [ { type: 'text', text: JSON.stringify(pOk.data, null, 2) } ], structuredContent: pOk.data }
          }
        }

        // Fallback: treat as metrics-shaped output
        const parsedMetrics = (() => { try { return JSON.parse(String(data.output || '{}')) } catch { return null } })()
        if (parsedMetrics) {
          const pm = ProjectMetricsSchema.safeParse(parsedMetrics)
          if (pm.success) return { content: [ { type: 'text', text: JSON.stringify(pm.data, null, 2) } ], structuredContent: pm.data }
        }

        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      } else {
        return { content: [ { type: 'text', text: JSON.stringify(result.error, null, 2) } ], isError: true }
      }
    },

    async show_entity(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('show_entity', args)
      if (result.success) {
        const data = result.data as any
        const parsed = (() => { try { return JSON.parse(String(data.output ?? data)) } catch { return null } })()
        if (parsed) {
          // Validate against entity/info schema when possible
          const ok = AnalysisResultSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      } else {
        return { content: [ { type: 'text', text: JSON.stringify(result.error, null, 2) } ], isError: true }
      }
    },

    async metrics(args: Record<string, unknown>): Promise<CallToolResult> {
      const result = await registry.invoke('metrics', args)
      if (result.success) {
        const data = result.data as any
        const parsed = (() => { try { return JSON.parse(String(data.output ?? data)) } catch { return null } })()
        if (parsed) {
          const parsedOk = ProjectMetricsSchema.safeParse(parsed)
          if (parsedOk.success) return { content: [ { type: 'text', text: JSON.stringify(parsedOk.data, null, 2) } ], structuredContent: parsedOk.data }
        }
        return { content: [ { type: 'text', text: String(data.output ?? data) } ], structuredContent: { output: String(data.output ?? data) } }
      } else {
        return { content: [ { type: 'text', text: JSON.stringify(result.error, null, 2) } ], isError: true }
      }
    }
  }
}
