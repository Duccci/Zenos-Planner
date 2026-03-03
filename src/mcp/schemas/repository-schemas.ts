import { z } from 'zod'
import {
  RepositoryTypeEnum,
  FilePathSchema
} from './common-schemas.js'

/**
 * Zod schemas for repository management operations
 * This file is split from analysis-schemas.ts for better organization
 */

// ============================================================================
// REPOS_LIST - List detected repositories
// ============================================================================

export const ReposListInputSchema = z.object({
  type: RepositoryTypeEnum.optional(),
})
export type ReposListInput = z.infer<typeof ReposListInputSchema>

export const RepositorySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: RepositoryTypeEnum,
  path: FilePathSchema,
  language: z.string().optional(),
  fileCount: z.number().int().min(0),
  lineCount: z.number().int().min(0),
  dependencies: z.number().int().min(0).optional(),
  dependents: z.number().int().min(0).optional()
})
export type RepositorySummary = z.infer<typeof RepositorySummarySchema>

export const ReposListOutputSchema = z.object({
  repositories: z.array(RepositorySummarySchema),
})
export type ReposListOutput = z.infer<typeof ReposListOutputSchema>

// ============================================================================
// REPOS_DEPS - Show repository dependency graph
// ============================================================================

export const ReposDepInputSchema = z.object({
  repositoryId: z.string().optional()
})
export type ReposDepInput = z.infer<typeof ReposDepInputSchema>

export const RepositoryDependencySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: RepositoryTypeEnum,
  path: FilePathSchema
})
export type RepositoryDependency = z.infer<typeof RepositoryDependencySchema>

export const DependencyEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(['imports', 'extends', 'references'])
})
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>

export const RepositoryDependencyGraphSchema = z.object({
  repositories: z.array(RepositoryDependencySchema),
  edges: z.array(DependencyEdgeSchema),
  circularDependencies: z.array(z.array(z.string())).optional()
})
export type RepositoryDependencyGraph = z.infer<typeof RepositoryDependencyGraphSchema>

// ============================================================================
// REPOS_DETECT - Detect repository boundaries
// ============================================================================

export const ReposDetectInputSchema = z.object({
  reanalyzeCrossRepo: z.boolean().default(false)
})
export type ReposDetectInput = z.infer<typeof ReposDetectInputSchema>

export const RepositoryBoundarySchema = z.object({
  repoId: z.string(),
  name: z.string(),
  type: RepositoryTypeEnum,
  path: FilePathSchema,
  boundaries: z.object({
    imports: z.array(z.string()),
    exports: z.array(z.string())
  }).optional()
})
export type RepositoryBoundary = z.infer<typeof RepositoryBoundarySchema>

export const ReposDetectOutputSchema = z.object({
  detected: z.array(RepositoryBoundarySchema),
  changes: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string()),
    modified: z.array(z.string())
  }).optional(),
  summary: z.string().optional()
})
export type ReposDetectOutput = z.infer<typeof ReposDetectOutputSchema>

// ============================================================================
// REPOS_ADJUST - Manually adjust repository boundaries
// ============================================================================

export const ReposAdjustInputSchema = z.object({
  adjustments: z.array(z.object({
    repositoryId: z.string(),
    type: z.enum(['add', 'remove', 'reclassify']),
    newType: RepositoryTypeEnum.optional(),
    reason: z.string().optional()
  }))
})
export type ReposAdjustInput = z.infer<typeof ReposAdjustInputSchema>

export const ReposAdjustOutputSchema = z.object({
  adjustmentsApplied: z.number().int().min(0),
  affectedRepositories: z.array(z.string()),
  summary: z.string().optional()
})
export type ReposAdjustOutput = z.infer<typeof ReposAdjustOutputSchema>

// ============================================================================
// REPOS_ADD / REPOS_REMOVE — placeholder schemas for future actions (@red)
// ============================================================================

export const ReposAddOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: RepositoryTypeEnum,
  path: z.string()
})
export type ReposAddOutput = z.infer<typeof ReposAddOutputSchema>

export const ReposRemoveOutputSchema = z.object({
  removed: z.boolean(),
  repositoryId: z.string()
})
export type ReposRemoveOutput = z.infer<typeof ReposRemoveOutputSchema>
