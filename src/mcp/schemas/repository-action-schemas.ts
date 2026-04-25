import { z } from 'zod'
import {
  ReposListOutputSchema,
  ReposDetectOutputSchema,
  RepositoryDependencyGraphSchema,
  ReposAdjustOutputSchema,
  ReposAddOutputSchema,
  ReposRemoveOutputSchema,
} from './repository-schemas.js'
import { AnalysisResultSchema, ProjectMetricsSchema } from './analysis-schemas.js'

/**
 * Zod schemas for repository action tool input and output
 * Consolidates repos_list, repos_detect, repos_deps, repos_adjust into unified repos_action
 */

// ============================================================================
// INPUT SCHEMA
// ============================================================================

/**
 * Flat, self-documenting input schema for the repos_action tool.
 *
 * action required for all calls:
 *   list    — list detected repositories; optional: type, skip, take
 *   detect  — re-run boundary detection; optional: reanalyzeCrossRepo
 *   deps    — view dependency graph; optional: repositoryId
 *   adjust  — manually adjust boundaries; required: adjustments
 */
export const RepositoryActionInputSchema = z.object({
  action: z
    .enum(['list', 'detect', 'deps', 'adjust', 'add', 'remove', 'analyze'])
    .optional()
    .describe(
      'Action to perform. ' +
        'list=view detected repositories (optional: type filter). ' +
        'detect=re-run boundary detection (optional: reanalyzeCrossRepo). ' +
        'deps=view dependency graph (optional: repositoryId). ' +
        'adjust=manually adjust boundaries (needs: adjustments array). ' +
        'add=register a repository (needs: name, type, path). ' +
        'remove=unregister a repository (needs: repositoryId). ' +
        'analyze=analyze codebase or path for metrics/dependencies (optional: path, groupBy, includeMetrics, includeDependencies, depth).'
    ),

  // --- list filters ---
  type: z
    .enum(['service', 'library', 'tool', 'app'])
    .optional()
    .describe('Filter repositories by type (list)'),

  // --- detect fields ---
  reanalyzeCrossRepo: z
    .boolean()
    .optional()
    .describe('Re-analyse cross-repo coupling (detect, default false)'),

  // --- deps fields ---
  repositoryId: z.string().optional().describe('Scope dependency graph to this repo (deps)'),

  // --- add fields ---
  name: z.string().optional().describe('Repository name. REQUIRED for the "add" action (the dispatcher marks it optional only because other actions do not use it).'),
  path: z.string().optional().describe('Repository root path. REQUIRED for the "add" action (file or directory path to analyze for the "analyze" action). The dispatcher marks it optional only because other actions do not use it.'),

  // --- analyze fields ---
  includeMetrics: z.boolean().optional().describe('Include code metrics in analysis result (analyze, default true)'),
  includeDependencies: z.boolean().optional().describe('Include dependency info in analysis result (analyze, default true)'),
  depth: z.number().int().min(0).max(10).optional().describe('Directory traversal depth for analysis (analyze, default 3)'),
  groupBy: z
    .enum(['repository', 'language', 'type'])
    .optional()
    .describe('Group metrics by dimension for project-wide analysis (analyze)'),

  // --- adjust fields ---
  adjustments: z
    .array(
      z.object({
        repositoryId: z.string(),
        type: z.enum(['add', 'remove', 'reclassify']),
        newType: z.enum(['service', 'library', 'tool', 'app']).optional(),
        reason: z.string().optional(),
      })
    )
    .optional()
    .describe('Boundary adjustments to apply (adjust action)'),
})

export type RepositoryActionInput = z.infer<typeof RepositoryActionInputSchema>

// ============================================================================
// OUTPUT SCHEMAS (per-action)
// ============================================================================

/**
 * Output schema for repository action
 */
export const RepositoryActionOutputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    result: ReposListOutputSchema,
  }),
  z.object({
    action: z.literal('detect'),
    result: ReposDetectOutputSchema,
  }),
  z.object({
    action: z.literal('deps'),
    result: RepositoryDependencyGraphSchema,
  }),
  z.object({
    action: z.literal('adjust'),
    result: ReposAdjustOutputSchema,
  }),
  z.object({
    action: z.literal('add'),
    result: ReposAddOutputSchema,
  }),
  z.object({
    action: z.literal('remove'),
    result: ReposRemoveOutputSchema,
  }),
  z.object({
    action: z.literal('analyze'),
    result: z.union([AnalysisResultSchema, z.array(AnalysisResultSchema), ProjectMetricsSchema]),
  }),
])

export type RepositoryActionOutput = z.infer<typeof RepositoryActionOutputSchema>
