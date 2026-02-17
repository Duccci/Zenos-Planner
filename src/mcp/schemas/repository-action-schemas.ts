import { z } from 'zod'
import {
  ReposListInputSchema,
  ReposListOutputSchema,
  ReposDetectInputSchema,
  ReposDetectOutputSchema,
  ReposDepInputSchema,
  RepositoryDependencyGraphSchema,
  ReposAdjustInputSchema,
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
 * Repository action input with action discriminant
 */
export const RepositoryActionInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    payload: ReposListInputSchema,
  }),
  z.object({
    action: z.literal('detect'),
    payload: ReposDetectInputSchema,
  }),
  z.object({
    action: z.literal('deps'),
    payload: ReposDepInputSchema,
  }),
  z.object({
    action: z.literal('adjust'),
    payload: ReposAdjustInputSchema,
  }),
])

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
