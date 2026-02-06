import { AnalyzeInputSchema, MetricsInputSchema, ShowEntityInputSchema } from '../schemas/analysis-schemas.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { createSchemaValidatingHandler, parseJsonSafe } from './handler-factory.js'
import { z } from 'zod'

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

export function analysisHandlers(_registry?: FunctionRegistry) {
  function notImplemented(msg?: string): CallToolResult {
    const message = msg ?? 'Analysis functionality not implemented yet (Gate 04/05 required).'
    return { content: [ { type: 'text', text: JSON.stringify({ error: message }, null, 2) } ], isError: true } as unknown as CallToolResult
  }

  // analyze may return a single AnalysisResult, an array of them, or ProjectMetrics
  const analyzeOutputSchema = z.union([AnalysisResultSchema, z.array(AnalysisResultSchema), ProjectMetricsSchema])
  const analyzeHandler = _registry ? createSchemaValidatingHandler(_registry, 'analyze', analyzeOutputSchema) : undefined
  const showHandler = _registry ? createSchemaValidatingHandler(_registry, 'show_entity', AnalysisResultSchema) : undefined
  const metricsHandler = _registry ? createSchemaValidatingHandler(_registry, 'metrics', ProjectMetricsSchema) : undefined

  return {
    async analyze(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          if (Array.isArray(parsed)) {
            const allOk = parsed.every(p => AnalysisResultSchema.safeParse(p).success)
            if (allOk) return { content: [ { type: 'text', text: JSON.stringify(parsed, null, 2) } ], structuredContent: { results: parsed } }
          } else {
            const pOk = AnalysisResultSchema.safeParse(parsed)
            if (pOk.success) return { content: [ { type: 'text', text: JSON.stringify(pOk.data, null, 2) } ], structuredContent: pOk.data }
          }
        }

        const parsedMetrics = parseJsonSafe(raw)
        if (parsedMetrics) {
          const pm = ProjectMetricsSchema.safeParse(parsedMetrics)
          if (pm.success) return { content: [ { type: 'text', text: JSON.stringify(pm.data, null, 2) } ], structuredContent: pm.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!analyzeHandler) return notImplemented('Analyze not implemented yet.')
      return analyzeHandler(args)
    },

    async show_entity(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const ok = AnalysisResultSchema.safeParse(parsed)
          if (ok.success) return { content: [ { type: 'text', text: JSON.stringify(ok.data, null, 2) } ], structuredContent: ok.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!showHandler) return notImplemented('Show entity not implemented yet.')
      return showHandler(args)
    },

    async metrics(args: Record<string, unknown>): Promise<CallToolResult> {
      const raw = (args as any)?.mockResult ?? null
      if (raw !== null) {
        const parsed = parseJsonSafe(raw)
        if (parsed) {
          const parsedOk = ProjectMetricsSchema.safeParse(parsed)
          if (parsedOk.success) return { content: [ { type: 'text', text: JSON.stringify(parsedOk.data, null, 2) } ], structuredContent: parsedOk.data }
        }

        return { content: [ { type: 'text', text: String(raw) } ], structuredContent: { output: String(raw) } }
      }

      if (!metricsHandler) return notImplemented('Metrics not implemented yet.')
      return metricsHandler(args)
    }
  }
}
