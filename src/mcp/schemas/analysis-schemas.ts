import { z } from 'zod'
import {
  TimestampSchema,
  FilePathSchema
} from './common-schemas.js'

/**
 * Zod schemas for code analysis operations
 */

// ============================================================================
// ANALYZE - Analyze codebase or specific files
// ============================================================================

export const AnalyzeInputSchema = z.object({
  path: FilePathSchema.optional(),
  includeMetrics: z.boolean().default(true),
  includeDependencies: z.boolean().default(true),
  depth: z.number().int().min(0).max(10).default(3)
})
export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>

export const CodeMetricsSchema = z.object({
  lineCount: z.number().int().min(0),
  fileCount: z.number().int().min(0),
  complexity: z.number().min(0).optional(),
  duplicateLines: z.number().int().min(0).optional(),
  maintainabilityIndex: z.number().min(0).max(100).optional()
})
export type CodeMetrics = z.infer<typeof CodeMetricsSchema>

export const DependencyInfoSchema = z.object({
  importCount: z.number().int().min(0),
  externalDependencies: z.array(z.string()).optional(),
  internalDependencies: z.array(z.string()).optional(),
  cyclicDependencies: z.array(z.array(z.string())).optional()
})
export type DependencyInfo = z.infer<typeof DependencyInfoSchema>

export const AnalysisResultSchema = z.object({
  path: FilePathSchema,
  metrics: CodeMetricsSchema.optional(),
  dependencies: DependencyInfoSchema.optional(),
  issues: z.array(z.object({
    level: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    location: z.string().optional()
  })).optional(),
  summary: z.string().optional()
})
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>

// ============================================================================
// SHOW_ENTITY - Resolve and show entity details
// ============================================================================

export const ShowEntityInputSchema = z.object({
  hash: z.string(),
  entityType: z.enum(['gate', 'requirement', 'proposal', 'repository']).optional()
})
export type ShowEntityInput = z.infer<typeof ShowEntityInputSchema>

export const EntityInfoSchema = z.object({
  entityType: z.enum(['gate', 'requirement', 'proposal', 'repository']),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  details: z.record(z.string(), z.any()).optional()
})
export type EntityInfo = z.infer<typeof EntityInfoSchema>

// ============================================================================
// METRICS - Get project-wide metrics
// ============================================================================

export const MetricsInputSchema = z.object({
  path: FilePathSchema.optional(),
  groupBy: z.enum(['repository', 'language', 'type']).optional()
})
export type MetricsInput = z.infer<typeof MetricsInputSchema>

export const ProjectMetricsSchema = z.object({
  codeMetrics: CodeMetricsSchema,
  qualityMetrics: z.object({
    testCoverage: z.number().min(0).max(100).optional(),
    typeErrorCount: z.number().int().min(0).optional(),
    lintErrorCount: z.number().int().min(0).optional(),
    securityIssues: z.number().int().min(0).optional()
  }).optional(),
  dependencyMetrics: z.object({
    directDependencies: z.number().int().min(0),
    transitiveDependen: z.number().int().min(0).optional(),
    cyclicDependencies: z.number().int().min(0).optional()
  }).optional(),
  gateMetrics: z.object({
    totalGates: z.number().int().min(0),
    completedGates: z.number().int().min(0),
    activeGates: z.number().int().min(0)
  }).optional(),
  timestamp: TimestampSchema
})
export type ProjectMetrics = z.infer<typeof ProjectMetricsSchema>
