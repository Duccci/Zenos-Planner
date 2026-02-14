import {
  AnalyzeInputSchema,
  MetricsInputSchema,
  ShowEntityInputSchema,
} from '../schemas/analysis-schemas.js'
import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  createSchemaValidatingHandler,
  handleMockResult,
  createNotImplementedHandler,
} from './handler-factory.js'
import { z } from 'zod'

export const analysisToolDefinitions = [
  {
    name: 'analyze',
    description: 'Analyze codebase or path for metrics',
    inputSchema: AnalyzeInputSchema,
  },
  {
    name: 'show_entity',
    description: 'Show entity analysis by hash',
    inputSchema: ShowEntityInputSchema,
  },
  {
    name: 'metrics',
    description: 'Get code metrics for path or gate',
    inputSchema: MetricsInputSchema,
  },
]

import { AnalysisResultSchema, ProjectMetricsSchema } from '../schemas/analysis-schemas.js'

export function analysisHandlers(
  _registry?: FunctionRegistry
): Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> {
  // analyze may return a single AnalysisResult, an array of them, or ProjectMetrics
  const analyzeOutputSchema = z.union([
    AnalysisResultSchema,
    z.array(AnalysisResultSchema),
    ProjectMetricsSchema,
  ])
  const analyzeHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'analyze', analyzeOutputSchema)
    : undefined
  const showHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'show_entity', AnalysisResultSchema)
    : undefined
  const metricsHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'metrics', ProjectMetricsSchema)
    : undefined

  return {
    async analyze(args: Record<string, unknown>): Promise<CallToolResult> {
      const mock = handleMockResult(args, analyzeOutputSchema)
      if (mock) {
        // Maintain legacy shape: when backend returns an array of results, wrap as { results: [...] }
        if (Array.isArray(mock.structuredContent)) {
          return {
            content: mock.content,
            structuredContent: { results: mock.structuredContent },
          }
        }
        return mock
      }

      if (!analyzeHandler) return createNotImplementedHandler('Analyze not implemented yet.')
      return await analyzeHandler(args)
    },

    async show_entity(args: Record<string, unknown>): Promise<CallToolResult> {
      const mock = handleMockResult(args, AnalysisResultSchema)
      if (mock) return mock

      if (!showHandler) return createNotImplementedHandler('Show entity not implemented yet.')
      return await showHandler(args)
    },

    async metrics(args: Record<string, unknown>): Promise<CallToolResult> {
      const mock = handleMockResult(args, ProjectMetricsSchema)
      if (mock) return mock

      if (!metricsHandler) return createNotImplementedHandler('Metrics not implemented yet.')
      return await metricsHandler(args)
    },
  }
}
