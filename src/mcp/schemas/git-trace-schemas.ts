import { z } from 'zod'
import { CommitHashSchema, FilePathSchema } from './common-schemas.js'

/**
 * Zod schemas for git_trace MCP tool input and output
 * Provides runtime validation and TypeScript type inference
 */

// ============================================================================
// INPUT SCHEMA
// ============================================================================

/**
 * Input parameters for git_trace tool
 */
export const GitTraceInputSchema = z.object({
  /** Artifact hash to trace in git history */
  artifactHash: z.string().min(1, 'Artifact hash is required'),

  /** Optional date range for filtering commits */
  dateRange: z.object({
    from: z.string().optional(), // ISO date string
    to: z.string().optional()    // ISO date string
  }).optional(),

  /** Optional branch to search (defaults to current branch) */
  branch: z.string().optional(),

  /** Optional limit on number of commits to return */
  limit: z.number().int().positive().optional(),

  /** Optional repository directory (defaults to current working directory) */
  dir: z.string().optional()
})
export type GitTraceInput = z.infer<typeof GitTraceInputSchema>

// ============================================================================
// OUTPUT SCHEMA
// ============================================================================

/**
 * Individual commit record with traceability information
 */
export const CommitRecordSchema = z.object({
  /** Full commit SHA */
  commitSha: CommitHashSchema,

  /** Author name and email */
  author: z.string(),

  /** Commit date in ISO format */
  date: z.string(),

  /** Commit subject line */
  subject: z.string(),

  /** Commit body (optional) */
  body: z.string().optional(),

  /** Files changed in this commit */
  filesChanged: z.array(FilePathSchema),

  /** Hashes found in commit message */
  matchedHashes: z.array(z.string()),

  /** Artifacts inferred from matched hashes */
  inferredArtifacts: z.array(z.string()),

  /** Confidence score (0-1) for hash matching */
  confidenceScore: z.number().min(0).max(1),

  /** Additional notes about the match */
  notes: z.string().optional()
})
export type CommitRecord = z.infer<typeof CommitRecordSchema>

/**
 * Output structure for git_trace tool
 */
export const GitTraceOutputSchema = z.object({
  /** Array of commit records */
  commits: z.array(CommitRecordSchema),

  /** Total commits found (may exceed returned limit) */
  totalCommits: z.number().int().min(0),

  /** Search parameters used */
  searchParams: z.object({
    artifactHash: z.string(),
    dateRange: z.object({
      from: z.string().optional(),
      to: z.string().optional()
    }).optional(),
    branch: z.string().optional(),
    limit: z.number().int().positive().optional()
  })
})
export type GitTraceOutput = z.infer<typeof GitTraceOutputSchema>