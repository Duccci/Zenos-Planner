import { z } from 'zod'
import {
  ReposListOutputSchema,
  ReposDetectOutputSchema,
  RepositoryDependencyGraphSchema,
  ReposAdjustOutputSchema,
} from './repository-schemas.js'

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
    .enum(['list', 'detect', 'deps', 'adjust'])
    .optional()
    .describe(
      'Action to perform. ' +
        'list=view detected repositories (optional: type filter). ' +
        'detect=re-run boundary detection (optional: reanalyzeCrossRepo). ' +
        'deps=view dependency graph (optional: repositoryId). ' +
        'adjust=manually adjust boundaries (needs: adjustments array).'
    ),

  // --- list filters ---
  type: z
    .enum(['service', 'library', 'tool', 'app'])
    .optional()
    .describe('Filter repositories by type (list)'),
  skip: z.number().int().min(0).optional().describe('Pagination offset (list, default 0)'),
  take: z.number().int().min(1).max(100).optional().describe('Page size (list, default 50)'),

  // --- detect fields ---
  reanalyzeCrossRepo: z
    .boolean()
    .optional()
    .describe('Re-analyse cross-repo coupling (detect, default false)'),

  // --- deps fields ---
  repositoryId: z.string().optional().describe('Scope dependency graph to this repo (deps)'),

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
])

export type RepositoryActionOutput = z.infer<typeof RepositoryActionOutputSchema>
