import type { FunctionRegistry } from '../../integration/function-registry.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  createSchemaValidatingHandler,
  handleMockResult,
  createNotImplementedHandler,
} from './handler-factory.js'
import { z } from 'zod'

// analyze is now an action under repos_action — no standalone tool definition needed
export const analysisToolDefinitions: never[] = []

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
  const metricsHandler = _registry
    ? createSchemaValidatingHandler(_registry, 'metrics', ProjectMetricsSchema)
    : undefined
  // Note: metricsHandler is used by analyze when groupBy is provided

  return {
    async analyze(args: Record<string, unknown>): Promise<CallToolResult> {
      // Route to metrics handler when groupBy is requested
      if (args['groupBy'] !== undefined && args['groupBy'] !== null) {
        const mock = handleMockResult(args, ProjectMetricsSchema)
        if (mock) return mock
        if (!metricsHandler) return createNotImplementedHandler('Metrics not implemented yet.')
        return await metricsHandler(args)
      }

      const mock = handleMockResult(args, analyzeOutputSchema)
      if (mock) {
        return mock
      }

      if (!analyzeHandler) return createNotImplementedHandler('Analyze not implemented yet.')
      return await analyzeHandler(args)
    },

    // metrics removed as standalone tool — use analyze({ groupBy: '...' }) instead
    // show_entity removed — use context_action with requirement/repository/gate/proposal action instead
  }
}
